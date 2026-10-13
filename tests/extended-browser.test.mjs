import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { startFixture } from './browser-fixture.mjs';
import { catalogs } from './extended-fixture.mjs';
const { chromium } = await import(process.env.SMARTFORMS_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.SMARTFORMS_PLAYWRIGHT_MODULE)).href : 'playwright');

test('All form adapters, contexts and simultaneous targets', async t => {
  const fixture = await startFixture();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SMARTFORMS_BROWSER_EXECUTABLE || undefined });
  try {
    const scenarios = [['smartbrowser','article'],['smartbrowser','category'],['smartbrowser','user'],
      ['native-admin','article'],['native-admin','category'],['native-admin','user'],
      ['native-article-site','article'],['native-profile','user']];
    await t.test('Hidden preceding fieldsets do not add frontend top spacing', async () => {
      for (const adapter of ['smartbrowser','native-article-site','native-profile']) {
        const type=adapter==='native-profile'?'user':'article', target=type==='user'?'user-account':'article-text';
        const page=await browser.newPage();
        await page.goto(`${fixture.url}/?extended=1&toggleOnly=1&adapter=${adapter}&type=${type}`);
        await page.waitForFunction(()=>window.extendedReady);
        const trigger=page.locator(`#${target}-smartforms-switcher`);
        for(const name of ['Group 100','Group 102']) {
          if(name==='Group 102'){await trigger.click();await page.getByRole('menuitemradio',{name,exact:true}).click();}
          assert.equal(await trigger.evaluate(button=>getComputedStyle(button.closest('fieldset')).marginTop),'0px');
        }
        await page.close();
      }
    });
    for (const [adapter,type] of scenarios) await t.test(`${adapter} ${type}`, async () => {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.setDefaultTimeout(5000);
      await page.goto(`${fixture.url}/?extended=1&adapter=${adapter}&type=${type}`);
      await page.waitForFunction(() => window.extendedReady);
      const supported = catalogs[type].filter(id => !(adapter === 'native-article-site' && id === 'content-settings'));
      assert.equal(await page.locator('.smartforms-view-button').count(), supported.length);
      if(process.env.SMARTFORMS_CAPTURE_PREVIEW) await page.screenshot({path:`build/output/${adapter}-${type}.png`,fullPage:true});
      assert.equal(await page.evaluate(() => window.originalControls.every(node => node.isConnected)), true);
      await page.evaluate(() => {window.liveEditor = document.querySelector('.rich-editor') ? tinymce.get(document.querySelector('.rich-editor').id) : null;
        if(window.liveEditor){window.liveFrame=window.liveEditor.iframeElement;window.liveEditor.setContent('<p>Unsaved editor</p>');}});
      for (const target of supported) {
        const index = catalogs[type].indexOf(target);
        const first = 100 + index * 10, second = first + 2;
        const trigger = page.locator(`#${target}-smartforms-switcher`);
        await trigger.evaluate(button => { const tab=button.closest('joomla-tab-element'); if(tab) tab.parentElement.activateTab(tab,false); });
        const select = async name => {await trigger.click();await page.getByRole('menuitemradio',{name,exact:true}).click();};
        assert.equal(await trigger.locator('.smartforms-view-label').textContent(), `Group ${first}`);
        assert.equal(await trigger.evaluate(button => button.parentElement.parentElement.tagName), 'LEGEND');
        assert.equal(await page.locator(`#jform_com_fields_f${second}`).isVisible(), false);
        await select(`Group ${second}`);
        await page.locator(`#jform_com_fields_f${second}`).fill(`Edited ${second}`);
        // Each target has its own native region and independent active selection.
        await select(target.replaceAll('-',' '));
        const order = await trigger.evaluate((button,first) => {
          const native=button.closest('fieldset');
          return [...native.parentElement.children].filter(node=>node.tagName==='FIELDSET'
            && (node===native || [0,1,2,3].some(offset=>node.querySelector(`#jform_com_fields_f${first+offset}`))))
            .map(node=>node===native ? button.querySelector('.smartforms-view-label').textContent
              : node.querySelector('.smartforms-legend-title')?.textContent || node.querySelector('legend')?.textContent);
        },first);
        assert.deepEqual(order, [`Group ${first+1}`, target.replaceAll('-',' '), `Group ${first}`, `Group ${second}`, `Group ${first+3}`]);
        await select(`Group ${first}`);
        assert.equal(await page.locator(`#jform_com_fields_f${first+1}`).isVisible(), true);
        assert.equal(await page.locator(`#jform_com_fields_f${first+3}`).isVisible(), true);
        assert.equal(await page.locator(`#jform_com_fields_f${second}`).isVisible(), false);
        await page.locator(`#jform_com_fields_f${second}`).evaluate(field=>{field.value='';document.formvalidator.isValid(field.form);});
        await page.waitForFunction(({id,second}) => document.getElementById(id).textContent.includes(`Group ${second}`), {id:`${target}-smartforms-switcher`,second});
        assert.equal(await page.locator(`#jform_com_fields_f${second}`).isVisible(), true);
        await page.locator(`#jform_com_fields_f${second}`).fill(`Edited ${second}`);
        if(adapter!=='native-profile') assert.equal(await page.locator(`#attrib-fields-${first}`).count(),0);
      }
      assert.equal(await page.evaluate(() => !window.liveEditor || (tinymce.get(window.liveEditor.id)===window.liveEditor && window.liveEditor.iframeElement===window.liveFrame && window.liveEditor.getContent()==='<p>Unsaved editor</p>')),true);
      if(adapter==='native-article-site') assert.equal(await page.locator('#attrib-fields-110').count(),1);
      await page.setViewportSize({width:500,height:800});
      if(adapter!=='native-profile') await page.waitForFunction(()=>document.querySelector('joomla-tab').view==='accordion');
      // Hidden controls still submit; a real endpoint receives all groups and native fields.
      await Promise.all([page.waitForURL('**/save'),page.getByRole('button',{name:'Save',exact:true}).click()]);
      const values=fixture.requests.at(-1), saved=Object.fromEntries(values);
      for(let index=0;index<catalogs[type].length;index++) for(let offset=0;offset<4;offset++) {
        const id=100+index*10+offset;assert.ok(saved[`jform[com_fields][f${id}]`]);
      }
      assert.equal(new Set(values.map(([name])=>name)).size,values.length);
      if(type!=='user') assert.equal(saved[`jform[${type==='article'?'articletext':'description'}]`],'<p>Unsaved editor</p>');
      else assert.equal(saved['jform[username]'],'Native draft');
      assert.deepEqual(errors,[]);
      await page.close();
    });
  } finally {await browser.close();await fixture.close();}
});
