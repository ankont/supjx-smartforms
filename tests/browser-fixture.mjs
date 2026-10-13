import { createServer } from 'node:http';
import { extendedFixture } from './extended-fixture.mjs';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export const joomlaRoot = resolve(process.env.SMARTFORMS_JOOMLA_ROOT || '../../JoomlaTest/site');
const pluginRoot = resolve('plugin/media');
const mirrorAssets = JSON.parse(readFileSync(resolve(joomlaRoot, 'media/plg_editors_codemirror/joomla.asset.json'), 'utf8')).assets;
const mirrorImports = Object.fromEntries(mirrorAssets.filter(asset => asset.importmap).map(asset => [asset.name, '/joomla/' + asset.uri]));
mirrorImports.codemirror = '/joomla/media/plg_editors_codemirror/js/codemirror.js';
mirrorImports['editor-api'] = '/joomla/media/system/js/editors/editor-api.js';
mirrorImports['editor-decorator'] = '/joomla/media/system/js/editors/editor-decorator.js';
const definitions = [
  [9, 'toggle', 'First group'], [2, 'before', 'Before one'], [7, 'toggle', 'Second group'],
  [4, 'after', 'After one'], [8, 'before', 'Before two'], [5, 'after', 'After two'],
];

function fixture(url) {
  const site = url.searchParams.has('site');
  const late = url.searchParams.has('late');
  const unsupported = url.searchParams.has('unsupported');
  const fallback = url.searchParams.has('fallback');
  const codemirror = url.searchParams.has('codemirror');
  const groupMarkup = ([id, mode, label]) => `<joomla-tab-element id="${site ? 'smartbrowser' : 'attrib'}-fields-${id}" name="${label}">
    <fieldset ${site ? '' : `id="fieldset-fields-${id}"`} class="options-form"><legend>${label}</legend>
      <label for="jform_com_fields_group${id}">${label} value</label><input id="jform_com_fields_group${id}" name="jform[com_fields][group${id}]" value="Draft ${id}" required="required">
      ${id === 9 ? '<textarea class="rich-editor" id="jform_com_fields_rich9" name="jform[com_fields][rich9]">Group editor draft</textarea>' : ''}
      ${id === 9 && codemirror ? '<joomla-editor-codemirror id="code-editor" options="{}"><textarea id="jform_com_fields_code9" name="jform[com_fields][code9]">CodeMirror draft</textarea></joomla-editor-codemirror>' : ''}
    </fieldset></joomla-tab-element>`;
  const config = {
    adapter: 'smartbrowser', context: 'com_content.article', targets: ['article-text'],
    labels: { 'article-text': 'Article Text', toggle: 'Article Text and Custom Field Groups' },
    groups: definitions.map(([id, mode]) => ({ fieldset: `fields-${id}`, target: 'article-text', mode, fieldIds: [`jform_com_fields_group${id}`] })),
  };
  return `<!doctype html><html><head><meta charset="utf-8"><title>SmartForms browser verification</title>
    <link rel="stylesheet" href="/joomla/media/vendor/joomla-custom-elements/css/joomla-tab.css">
    <link rel="stylesheet" href="/plugin/css/placement.css">
    <style>body{font:16px system-ui;margin:24px}.col-lg-9{width:75%}.btn{padding:8px 14px;border:1px solid #789;border-radius:4px;background:white}.btn-primary{background:#244b80;color:white}fieldset{padding:16px}label{margin-right:12px}</style>
    <script>window.Joomla={editors:{instances:{}},getOptions:key=>key==='plg_system_smartforms'?${JSON.stringify(config)}:null,Text:{_:key=>key},sanitizeHtml:value=>value,renderMessages:messages=>window.validationMessages=messages};</script>
    ${codemirror ? '<script type="importmap">' + JSON.stringify({ imports: mirrorImports }) + '</script><script type="module" src="/joomla/media/plg_editors_codemirror/js/joomla-editor-codemirror.js"></script>' : ''}
    <script src="/joomla/media/vendor/joomla-custom-elements/js/joomla-tab.js" defer></script>
    <script src="/joomla/media/vendor/tinymce/tinymce.min.js" defer></script>
    <script src="/joomla/media/system/js/fields/validate.js" defer></script>
    ${late ? '' : '<script src="/plugin/js/smartforms.js"></script>'}
    </head><body><div class="com-smartbrowser-editor" data-resource-type="${unsupported ? 'category' : 'article'}">
    <form id="adminForm" method="post" action="/save" class="form-validate">
    <joomla-tab id="smartbrowserEditorTabs" breakpoint="768"><joomla-tab-element id="smartbrowser-main" name="Content" active><div class="row"><div class="col-lg-9">
      <fieldset class="options-form"><legend>Article Text</legend><textarea class="rich-editor" id="jform_articletext" name="jform[articletext]">Native editor draft</textarea></fieldset>
    </div><div class="col-lg-3"><label>Title <input name="jform[title]" value="Article draft"></label></div></div></joomla-tab-element>
    ${definitions.map(groupMarkup).join('')}
    ${groupMarkup([6, null, 'Default group'])}
    <joomla-tab-element id="smartbrowser-publishing" name="Publishing"><input name="jform[state]" value="1"></joomla-tab-element>
    </joomla-tab><button type="submit">Save article</button></form></div>
    <script>
      window.originalControls=[...document.querySelectorAll('input,textarea')];
      window.originalNative=document.getElementById('jform_articletext').closest('fieldset');
      window.controlClicks=0;document.getElementById('jform_com_fields_group9').addEventListener('click',()=>window.controlClicks++);
      if (${fallback}) Element.prototype.moveBefore=undefined;
      window.editorReady=new Promise(resolve=>document.addEventListener('DOMContentLoaded',async()=>{
        await tinymce.init({selector:'.rich-editor',base_url:'/joomla/media/vendor/tinymce',suffix:'.min',license_key:'gpl',promotion:false,menubar:false,plugins:[],toolbar:'bold italic',height:200});
        ${codemirror ? "while(!document.getElementById('code-editor').jEditor) await new Promise(resolve=>setTimeout(resolve,20));" : ''}
        window.editorReadyCompleted=true;resolve(true);
      }));
      document.getElementById('adminForm').addEventListener('submit',event=>{if(!document.formvalidator.isValid(event.target)){event.preventDefault();return;}tinymce.triggerSave();});
    </script>
    <script type="module">${late ? `await window.editorReady; await import('/plugin/js/smartforms.js');` : ''}window.fixtureReady=true;</script>
    </body></html>`;
}

export async function startFixture() {
  const requests = [];
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'POST' && url.pathname === '/save') {
        let body = ''; for await (const chunk of request) body += chunk;
        const values = [...new URLSearchParams(body)];
        requests.push(values);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(values)); return;
      }
      if (url.pathname === '/') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(url.searchParams.has('extended') ? extendedFixture(url) : fixture(url)); return;
      }
      const root = url.pathname.startsWith('/plugin/') ? pluginRoot : url.pathname.startsWith('/joomla/media/') ? joomlaRoot : null;
      if (!root) { response.writeHead(404); response.end(); return; }
      const relative = url.pathname.startsWith('/plugin/') ? url.pathname.slice(8) : url.pathname.slice(8);
      const path = resolve(root, '.' + sep + decodeURIComponent(relative));
      if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error('Invalid static path');
      const data = await readFile(path);
      response.writeHead(200, { 'Content-Type': path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
      response.end(data);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, requests, close: () => new Promise(resolve => {
    server.close(resolve);
    // Browsers are closed before fixture teardown; discard remaining HTTP keep-alive sockets.
    server.closeAllConnections();
  }) };
}
