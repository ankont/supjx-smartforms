import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { startFixture } from './browser-fixture.mjs';

const playwrightPath = process.env.SMARTFORMS_PLAYWRIGHT_MODULE;
const { chromium } = await import(playwrightPath ? pathToFileURL(resolve(playwrightPath)).href : 'playwright');

async function chooseView(page, name) {
  await page.locator('.smartforms-view-button').click();
  await page.getByRole('menuitemradio', { name, exact: true }).click();
}

test('SmartBrowser placement, live editors, validation and submit', async t => {
  const fixture = await startFixture();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.SMARTFORMS_BROWSER_EXECUTABLE || undefined });
    for (const scenario of ['administrator', 'site', 'fallback', 'late', 'codemirror', 'codemirror-fallback']) {
      await t.test(scenario, async () => {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
        page.setDefaultTimeout(5000);
        const query = scenario === 'administrator' ? '' : scenario === 'codemirror-fallback' ? '?codemirror=1&fallback=1' : `?${scenario}=1`;
        await page.goto(fixture.url + query);
        await page.waitForFunction(() => window.fixtureReady && document.getElementById('adminForm').dataset.smartformsReady === '1', null, { timeout: 5000 });
        await page.waitForFunction(() => window.editorReadyCompleted, null, { timeout: 5000 });
        const initial = await page.evaluate(() => {
          const container = window.originalNative.parentElement;
          const fieldsets = [...container.querySelectorAll(':scope > fieldset')];
          const input = [...document.querySelectorAll('input,textarea')];
          return {
            order: fieldsets.map(panel => (panel.querySelector('.smartforms-legend-title') || panel.querySelector('legend')).textContent),
            toggle: [...document.querySelectorAll('.smartforms-option-label')].map(label => label.textContent),
            hiddenNative: window.originalNative.hidden,
            controlsIntact: window.originalControls.every(field => input.includes(field)) && input.length === window.originalControls.length,
            defaultPosition: document.getElementById('jform_com_fields_group6').closest('joomla-tab-element').id,
            tabs: [...document.getElementById('smartbrowserEditorTabs').tabs].map(entry => entry.tab.id),
            editorCount: tinymce.editors?.length ?? tinymce.get().length,
          };
        });
        assert.deepEqual(initial.order, ['Before one', 'Before two', 'Article Text', 'First group', 'Second group', 'After one', 'After two']);
        assert.deepEqual(initial.toggle, ['First group', 'Second group', 'Article Text']);
        assert.equal(initial.hiddenNative, true);
        assert.equal(initial.controlsIntact, true);
        assert.equal(initial.defaultPosition, `${scenario === 'site' ? 'smartbrowser' : 'attrib'}-fields-6`);
        assert.deepEqual(initial.tabs, ['smartbrowser-main', initial.defaultPosition, 'smartbrowser-publishing']);
        assert.equal(initial.editorCount, 2);
        assert.equal(await page.locator('.smartforms-view-button').count(), 1);
        assert.equal(await page.getByRole('menuitemradio').count(), 0);
        assert.equal(await page.locator('.smartforms-toggle[role="tablist"]').count(), 0);
        assert.equal(await page.locator('.smartforms-view-label').textContent(), 'First group');
        const selectedStyle = await page.locator('.smartforms-view-button').evaluate(button => {
          const style = getComputedStyle(button);
          return { color: style.color, legendColor: getComputedStyle(button.closest('legend')).color,
            background: style.backgroundColor, border: style.borderTopWidth };
        });
        assert.equal(selectedStyle.color, selectedStyle.legendColor);
        assert.equal(selectedStyle.background, 'rgba(0, 0, 0, 0)');
        assert.equal(selectedStyle.border, '0px');
        assert.equal(await page.locator('.smartforms-view-button').evaluate(button =>
          button.closest('fieldset') === document.getElementById('jform_com_fields_group9').closest('fieldset')), true);
        assert.equal(await page.locator('.smartforms-panel:not([hidden]) > legend > .smartforms-legend-title').isVisible(), false);
        if (process.env.SMARTFORMS_CAPTURE_PREVIEW && scenario === 'administrator') {
          await page.screenshot({ path: 'build/output/smartforms-menu-closed.png', fullPage: true });
        }
        await page.evaluate(() => {
          window.nativeEditor = tinymce.get('jform_articletext');
          window.groupEditor = tinymce.get('jform_com_fields_rich9');
          window.nativeFrame = window.nativeEditor.iframeElement;
          window.groupFrame = window.groupEditor.iframeElement;
          window.nativeDocument = window.nativeFrame.contentDocument;
          window.groupDocument = window.groupFrame.contentDocument;
          window.nativeEditor.setContent('<p>Unsaved native value</p>');
          window.groupEditor.setContent('<p>Unsaved group value</p>');
          const mirror = document.getElementById('code-editor');
          if (mirror) { window.codeInstance = mirror.instance; mirror.jEditor.setValue('Unsaved CodeMirror value'); }
        });
        await page.locator('.smartforms-view-button').click();
        assert.equal(await page.getByRole('menuitemradio').count(), 3);
        assert.equal(await page.getByRole('menuitemradio', { name: 'First group', exact: true }).getAttribute('aria-checked'), 'true');
        if (process.env.SMARTFORMS_CAPTURE_PREVIEW && scenario === 'administrator') {
          await page.screenshot({ path: 'build/output/smartforms-menu-open.png', fullPage: true });
        }
        await page.getByRole('menuitemradio', { name: 'Second group', exact: true }).click();
        assert.equal(await page.locator('.smartforms-view-label').textContent(), 'Second group');
        assert.equal(await page.locator('.smartforms-view-button').evaluate(button =>
          button.closest('fieldset') === document.getElementById('jform_com_fields_group7').closest('fieldset')), true);
        assert.equal(await page.getByRole('menu').count(), 0);
        await page.locator('#jform_com_fields_group7').fill('Edited second group');
        await chooseView(page, 'Article Text');
        assert.equal(await page.locator('.smartforms-view-button').evaluate(button => button.closest('fieldset') === window.originalNative), true);
        assert.equal(await page.locator('.smartforms-panel:not([hidden]) > legend > .smartforms-legend-title').isVisible(), false);
        await chooseView(page, 'First group');
        await page.locator('#jform_com_fields_group9').click();
        await page.locator('.smartforms-view-button').press('ArrowDown');
        await page.getByRole('menuitemradio', { name: 'First group', exact: true }).press('End');
        assert.equal(await page.getByRole('menuitemradio', { name: 'Article Text', exact: true }).evaluate(node => node === document.activeElement), true);
        await page.getByRole('menuitemradio', { name: 'Article Text', exact: true }).press('Enter');
        assert.equal(await page.locator('.smartforms-view-label').textContent(), 'Article Text');
        await page.locator('.smartforms-view-button').press('ArrowUp');
        await page.getByRole('menuitemradio', { name: 'Article Text', exact: true }).press('Home');
        await page.getByRole('menuitemradio', { name: 'First group', exact: true }).press('Enter');
        await page.locator('.smartforms-view-button').click();
        await page.getByRole('menuitemradio', { name: 'First group', exact: true }).press('Escape');
        assert.equal(await page.locator('.smartforms-view-button').getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('.smartforms-view-button').evaluate(node => node === document.activeElement), true);
        await page.locator('.smartforms-view-button').click();
        await page.locator('input[name="jform[title]"]').click();
        assert.equal(await page.locator('.smartforms-view-button').getAttribute('aria-expanded'), 'false');
        await page.locator('.smartforms-view-button').press('ArrowDown');
        await page.getByRole('menuitemradio', { name: 'First group', exact: true }).press('Tab');
        assert.equal(await page.getByRole('menu').count(), 0);
        assert.equal(await page.locator('#jform_com_fields_group9').evaluate(node => node === document.activeElement), true);
        const preserved = await page.evaluate(() => ({
          native: tinymce.get('jform_articletext') === window.nativeEditor && window.nativeEditor.iframeElement === window.nativeFrame && window.nativeFrame.contentDocument === window.nativeDocument,
          group: tinymce.get('jform_com_fields_rich9') === window.groupEditor && window.groupEditor.iframeElement === window.groupFrame && window.groupFrame.contentDocument === window.groupDocument,
          content: [window.nativeEditor.getContent(), window.groupEditor.getContent()], clicks: window.controlClicks,
          mirror: !window.codeInstance || (document.getElementById('code-editor').instance === window.codeInstance && document.getElementById('code-editor').jEditor.getValue() === 'Unsaved CodeMirror value'),
        }));
        assert.equal(preserved.native, true); assert.equal(preserved.group, true);
        assert.deepEqual(preserved.content, ['<p>Unsaved native value</p>', '<p>Unsaved group value</p>']);
        assert.equal(preserved.clicks, 1);
        assert.equal(preserved.mirror, true);
        // HTML5 validation of a required field in a hidden toggle panel reveals it synchronously.
        await page.evaluate(() => { document.getElementById('jform_com_fields_group7').value = ''; document.getElementById('adminForm').reportValidity(); });
        assert.equal(await page.locator('.smartforms-view-label').textContent(), 'Second group');
        await page.locator('#jform_com_fields_group7').fill('Edited second group');
        await chooseView(page, 'First group');
        // Joomla's separate validator must reveal the same invalid panel.
        await page.evaluate(() => { document.getElementById('jform_com_fields_group7').value = ''; document.formvalidator.isValid(document.getElementById('adminForm')); });
        await page.waitForFunction(() => document.querySelector('.smartforms-view-label').textContent === 'Second group', null, { timeout: 5000 });
        assert.equal(await page.locator('.smartforms-view-button').getAttribute('aria-expanded'), 'false');
        await page.locator('#jform_com_fields_group7').fill('Edited second group');
        // Before/after groups stay visible with either selected panel and with accordion navigation.
        await page.setViewportSize({ width: 500, height: 800 });
        await page.waitForFunction(() => document.getElementById('smartbrowserEditorTabs').view === 'accordion');
        assert.equal(await page.locator('#jform_com_fields_group2').isVisible(), true);
        assert.equal(await page.locator('#jform_com_fields_group4').isVisible(), true);
        assert.equal(await page.locator('[aria-controls="attrib-fields-9"], [aria-controls="smartbrowser-fields-9"]').count(), 0);
        const idempotent = await page.evaluate(async () => {
          const { PlacementEngine } = await import('/plugin/js/placement-engine.js');
          const { SmartBrowserFormAdapter } = await import('/plugin/js/smartbrowser-adapter.js');
          const config = Joomla.getOptions('plg_system_smartforms');
          return new PlacementEngine().apply(SmartBrowserFormAdapter.find(document, config)) === null;
        });
        assert.equal(idempotent, true);
        await Promise.all([page.waitForURL('**/save'), page.getByRole('button', { name: 'Save article', exact: true }).click()]);
        const values = fixture.requests.at(-1);
        const saved = Object.fromEntries(values);
        assert.equal(saved['jform[articletext]'], '<p>Unsaved native value</p>');
        assert.equal(saved['jform[com_fields][rich9]'], '<p>Unsaved group value</p>');
        assert.equal(saved['jform[com_fields][group7]'], 'Edited second group');
        if (scenario.startsWith('codemirror')) assert.equal(saved['jform[com_fields][code9]'], 'Unsaved CodeMirror value');
        for (const id of [9, 2, 7, 4, 8, 5, 6]) assert.ok(saved[`jform[com_fields][group${id}]`]);
        assert.equal(new Set(values.map(([name]) => name)).size, values.length);
        assert.deepEqual(errors, []);
        await page.close();
      });
    }
    await t.test('unsupported forms fail safely', async () => {
      const page = await browser.newPage();
      await page.goto(fixture.url + '?unsupported=1');
      await page.waitForFunction(() => window.fixtureReady);
      assert.equal(await page.locator('.smartforms-toggle').count(), 0);
      assert.equal(await page.locator('#jform_com_fields_group9').evaluate(node => node.closest('joomla-tab-element').id), 'attrib-fields-9');
      await page.close();
    });
    await t.test('late initialized custom elements and legacy iframes stay intact', async () => {
      for (const query of ['?late=1&codemirror=1', '?late=1&fallback=1']) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(fixture.url + query);
        await page.waitForFunction(() => window.fixtureReady && document.getElementById('adminForm').dataset.smartformsReady === '1');
        assert.equal(await page.locator('#jform_com_fields_group9').evaluate(node => node.closest('joomla-tab-element').id), 'attrib-fields-9');
        assert.deepEqual(await page.locator('.smartforms-option-label').allTextContents(), ['Second group', 'Article Text']);
        assert.equal(await page.evaluate(() => tinymce.get('jform_com_fields_rich9').getContent()), '<p>Group editor draft</p>');
        assert.deepEqual(errors, []);
        await page.close();
      }
    });
  } finally {
    await browser?.close(); await fixture.close();
  }
});
