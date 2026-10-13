import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { startFixture } from './browser-fixture.mjs';
import { catalogs } from './extended-fixture.mjs';
const { chromium } = await import(process.env.SMARTFORMS_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.SMARTFORMS_PLAYWRIGHT_MODULE)).href : 'playwright');

test('Horizontal placement, Options, responsive layout and safe native moves', async t => {
  const fixture=await startFixture();
  const browser=await chromium.launch({headless:true,executablePath:process.env.SMARTFORMS_BROWSER_EXECUTABLE||undefined});
  try {
    for(const [adapter,type] of [['smartbrowser','article'],['smartbrowser','category'],['smartbrowser','user'],['native-admin','article'],['native-admin','category'],['native-admin','user'],['native-article-site','article'],['native-profile','user']]) await t.test(`${adapter} ${type}`,async()=>{
      const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
      page.setDefaultTimeout(5000);
      await page.goto(`${fixture.url}/?extended=1&sides=1&adapter=${adapter}&type=${type}`);
      await page.waitForFunction(()=>window.extendedReady);
      const targets=catalogs[type].filter(id=>!(adapter==='native-article-site'&&id==='content-settings'));
      assert.equal(await page.locator('.smartforms-side-row').count(),targets.length);
      await page.evaluate(()=>{window.editor=document.querySelector('.rich-editor')?tinymce.get(document.querySelector('.rich-editor').id):null;if(window.editor){window.frame=window.editor.iframeElement;window.editor.setContent('<p>Horizontal draft</p>');}});
      for(const target of targets){
        const first=100+catalogs[type].indexOf(target)*10;
        const row=page.locator(`.smartforms-side-row[data-smartforms-target="${target}"]`);
        const trigger=page.locator(`#${target}-smartforms-switcher`);
        await trigger.evaluate(button=>{const tab=button.closest('joomla-tab-element');if(tab)tab.parentElement.activateTab(tab,false);});
        assert.deepEqual(await row.locator(':scope > .smartforms-side-left input').all().then(async fields=>Promise.all(fields.map(field=>field.getAttribute('id')))),[`jform_com_fields_f${first+4}`,`jform_com_fields_f${first+6}`]);
        assert.deepEqual(await row.locator(':scope > .smartforms-side-right input').all().then(async fields=>Promise.all(fields.map(field=>field.getAttribute('id')))),[`jform_com_fields_f${first+5}`,`jform_com_fields_f${first+7}`]);
        const widths=await row.evaluate(node=>[...node.children].map(column=>column.getBoundingClientRect().width));
        assert.ok(Math.max(...widths)-Math.min(...widths)<1);
        const before=page.locator(`#jform_com_fields_f${first+1}`),after=page.locator(`#jform_com_fields_f${first+3}`);
        assert.equal(await before.evaluate(field=>!field.closest('.smartforms-side-row')),true);
        assert.equal(await after.evaluate(field=>!field.closest('.smartforms-side-row')),true);
        await row.locator('.smartforms-side-left input').first().fill('Edited left');
        await trigger.click();await page.getByRole('menuitemradio',{name:target.replaceAll('-',' '),exact:true}).click();
        await trigger.click();await page.getByRole('menuitemradio',{name:`Group ${first+2}`,exact:true}).click();
        assert.equal(await row.locator('.smartforms-side-left input').first().isVisible(),true);
        assert.equal(await row.locator('.smartforms-side-right input').first().isVisible(),true);
        await before.evaluate(field=>{field.value='';document.formvalidator.isValid(field.form);});
        await before.fill('Edited before');
        if(process.env.SMARTFORMS_CAPTURE_PREVIEW && target==='category-options' && adapter==='smartbrowser')await page.screenshot({path:'build/output/category-options-sides.png',fullPage:true});
        await page.setViewportSize({width:500,height:800});
        const boxes=await row.evaluate(node=>[...node.children].map(column=>({x:column.getBoundingClientRect().x,y:column.getBoundingClientRect().y,width:column.getBoundingClientRect().width})));
        assert.ok(boxes[1].y>boxes[0].y && boxes[2].y>boxes[1].y);
        assert.ok(Math.max(...boxes.map(box=>box.x))-Math.min(...boxes.map(box=>box.x))<1);
        await page.setViewportSize({width:1280,height:800});
      }
      assert.equal(await page.evaluate(()=>window.originalControls.every(node=>node.isConnected)),true);
      assert.equal(await page.evaluate(()=>!window.editor||(tinymce.get(window.editor.id)===window.editor && window.editor.iframeElement===window.frame && window.editor.getContent()==='<p>Horizontal draft</p>')),true);
      await Promise.all([page.waitForURL('**/save'),page.getByRole('button',{name:'Save',exact:true}).click()]);
      const values=fixture.requests.at(-1),saved=Object.fromEntries(values);
      for(let index=0;index<catalogs[type].length;index++)for(let offset=0;offset<8;offset++)assert.ok(saved[`jform[com_fields][f${100+index*10+offset}]`]);
      assert.equal(new Set(values.map(([name])=>name)).size,values.length);assert.deepEqual(errors,[]);await page.close();
    });
    await t.test('Left/right without toggle and a late native iframe',async()=>{
      for(const flag of ['leftOnly','rightOnly']){
        const page=await browser.newPage();await page.goto(`${fixture.url}/?extended=1&adapter=native-admin&type=category&${flag}=1`);await page.waitForFunction(()=>window.extendedReady);
        assert.equal(await page.locator('.smartforms-toggle').count(),0);
        const row=page.locator('.smartforms-side-row[data-smartforms-target="category-options"]');
        assert.equal(await row.locator(':scope > div').count(),2);
        assert.deepEqual(await row.locator(':scope > div').all().then(async columns=>Promise.all(columns.map(column=>column.getAttribute('class')))),flag==='leftOnly'?['smartforms-side-column smartforms-side-left','smartforms-side-column smartforms-side-native']:['smartforms-side-column smartforms-side-native','smartforms-side-column smartforms-side-right']);
        await page.close();
      }
      const page=await browser.newPage();await page.goto(`${fixture.url}/?extended=1&adapter=native-admin&type=article&leftOnly=1&lateSides=1`);await page.waitForFunction(()=>window.extendedReady);
      assert.equal(await page.locator('.smartforms-side-row[data-smartforms-target="article-text"]').count(),0);
      assert.equal(await page.locator('#attrib-fields-100').count(),1);
      assert.equal(await page.evaluate(()=>tinymce.get(window.lateEditor.id)===window.lateEditor && window.lateEditor.iframeElement===window.lateFrame && window.lateEditor.getContent()==='<p>Late unsaved value</p>'),true);
      await page.close();
    });
  } finally{await browser.close();await fixture.close();}
});
