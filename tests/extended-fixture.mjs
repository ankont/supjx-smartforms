/** Fixtures mirror inspected core/SmartBrowser structures, including bare native regions. */
export const catalogs = {
  article: ['article-text', 'content-settings', 'publishing', 'metadata'],
  category: ['category-description', 'content-settings', 'publishing', 'metadata', 'category-options'],
  user: ['user-account', 'user-settings'],
};
export function extendedFixture(url) {
  const type = url.searchParams.get('type') || 'article';
  const adapter = url.searchParams.get('adapter') || 'native-admin';
  const profile = adapter === 'native-profile';
  const frontend = adapter === 'native-article-site';
  const smart = adapter === 'smartbrowser';
  const context = { article: 'com_content.article', category: 'com_content.categories', user: 'com_users.user' }[type];
  const targets = catalogs[type];
  const labels = Object.fromEntries(targets.map(id => [id, id.replaceAll('-', ' ')]));
  const tab = (id, label, html, active = false) => `<joomla-tab-element id="${id}" name="${label}" ${active ? 'active' : ''}>${html}</joomla-tab-element>`;
  const input = (name, value = 'Native draft') => `<label for="jform_${name}">${name}</label><input id="jform_${name}" name="jform[${name}]" value="${value}" required="required">`;
  const text = name => `<label for="jform_${name}">${name}</label><textarea class="rich-editor" id="jform_${name}" name="jform[${name}]">Native editor draft</textarea>`;
  const panel = (id, html, attrs = '') => `<fieldset ${attrs} class="options-form"><legend>${labels[id]}</legend>${html}</fieldset>`;
  const mainId = smart ? 'smartbrowser-main' : type === 'user' ? 'details' : frontend ? 'editor' : 'general';
  let main, extra = '';
  if (type === 'user') {
    main = panel('user-account', `<div class="form-grid">${input('username')}${input('name')}${input('email')}</div>`);
    extra = tab('attrib-settings', 'Basic Settings', panel('user-settings', '<label for="jform_params_editor">Editor</label><input id="jform_params_editor" name="jform[params][editor]" value="none">', 'id="fieldset-settings"'));
  } else if (frontend) {
    main = input('title') + input('alias') + `<div class="control-group"><div class="control-label"><label for="jform_articletext">articletext</label></div><div class="controls"><textarea class="rich-editor" id="jform_articletext" name="jform[articletext]">Native editor draft</textarea></div></div>`;
    extra = tab('publishing', 'Publishing', `<div class="control-group">${input('state')}${input('publish_up')}</div>`)
      + tab('metadata', 'Metadata', `<div class="control-group">${input('metadesc')}</div>`);
  } else {
    const editorName = type === 'article' ? 'articletext' : 'description';
    const editor = smart ? panel(targets[0], text(editorName)) : type === 'article'
      ? `<div><fieldset class="adminform">${text(editorName)}</fieldset></div>` : text(editorName);
    const global = `<fieldset class="form-vertical"><legend class="visually-hidden">Global</legend>${input('state')}</fieldset>`;
    main = `<div class="row"><div class="col-lg-9">${editor}</div><div class="col-lg-3">${smart ? panel('content-settings', global) : global}</div></div>`;
    extra = tab(smart ? 'smartbrowser-publishing' : 'publishing', 'Publishing', `<div class="row"><div class="col-lg-6">${panel('publishing', input('publish_up'), smart ? '' : 'id="fieldset-publishingdata"')}</div><div class="col-lg-6">${panel('metadata', input('metadesc'), smart ? '' : 'id="fieldset-metadata"')}</div></div>`);
  }
  if(type==='category') extra += tab('attrib-options','Options', panel('category-options', '<div class="form-grid">'+input('params_category_layout')+'</div>', 'id="fieldset-basic"'));
  const groups = targets.flatMap((target, index) => (url.searchParams.has('sides') ? ['toggle','before','toggle','after','left','right','left','right'] : url.searchParams.has('leftOnly') ? ['left','left'] : url.searchParams.has('rightOnly') ? ['right','right'] : ['toggle', 'before', 'toggle', 'after']).map((mode, offset) => ({
    fieldset: `fields-${100 + index * 10 + offset}`, target, mode,
    fieldIds: [`jform_com_fields_f${100 + index * 10 + offset}`],
  }))).filter(group => !url.searchParams.has('toggleOnly') || group.mode === 'toggle');
  const groupHtml = groups.map(group => {
    const id = group.fieldset.slice(7);
    const html = `<fieldset class="options-form"><legend>Group ${id}</legend><input id="jform_com_fields_f${id}" name="jform[com_fields][f${id}]" value="Draft ${id}" required="required"></fieldset>`;
    return profile ? html : tab(`attrib-${group.fieldset}`, `Group ${id}`, html);
  }).join('');
  const config = { adapter, context, targets, groups, labels: { ...labels, toggle: 'Views', view: 'View' } };
  const tabsId = smart ? 'smartbrowserEditorTabs' : frontend ? 'com-content-form' : 'myTab';
  const body = profile ? main + extra.replace(/<\/?joomla-tab-element[^>]*>/g, '') + groupHtml
    : `${frontend ? '<fieldset>' : ''}<joomla-tab id="${tabsId}" breakpoint="768">${tab(mainId, 'Main', main, true)}${extra}${groupHtml}</joomla-tab>${frontend ? '</fieldset>' : ''}`;
  const formId = smart || frontend ? 'adminForm' : profile ? 'member-profile' : type === 'user' ? 'user-form' : 'item-form';
  const host = smart ? `class="com-smartbrowser-editor" data-resource-type="${type}"` : profile ? 'class="com-users-profile__edit"' : frontend ? 'class="edit item-page"' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/joomla/media/vendor/joomla-custom-elements/css/joomla-tab.css"><link rel="stylesheet" href="/plugin/css/placement.css">
  <style>body{font:16px system-ui;margin:24px}fieldset{padding:16px;margin:12px 0}fieldset+fieldset{margin-top:2em}legend{font-weight:bold}.row{display:flex}.col-lg-9{width:75%}.col-lg-3{width:25%}.col-lg-6{width:50%}.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden}label{margin-right:12px}</style>
  <script>window.Joomla={editors:{instances:{}},getOptions:key=>key==='plg_system_smartforms'?${JSON.stringify(config)}:null,Text:{_:key=>key},sanitizeHtml:value=>value,renderMessages:()=>{}};</script>
  ${url.searchParams.has('lateSides') ? '' : '<script src="/plugin/js/smartforms.js"></script>'}<script src="/joomla/media/vendor/joomla-custom-elements/js/joomla-tab.js" defer></script><script src="/joomla/media/vendor/tinymce/tinymce.min.js" defer></script><script src="/joomla/media/system/js/fields/validate.js" defer></script></head>
  <body><div ${host}><form id="${formId}" method="post" action="/save" class="form-validate">${body}<button type="submit">Save</button></form></div>
  <script>window.originalControls=[...document.querySelectorAll('input,textarea')];
  document.addEventListener('DOMContentLoaded',async()=>{if(document.querySelector('.rich-editor')) await tinymce.init({selector:'.rich-editor',base_url:'/joomla/media/vendor/tinymce',suffix:'.min',license_key:'gpl',promotion:false,menubar:false,plugins:[],toolbar:'bold italic',height:200});${url.searchParams.has('lateSides') ? "window.lateEditor=tinymce.get(document.querySelector('.rich-editor').id);window.lateFrame=window.lateEditor.iframeElement;window.lateEditor.setContent('<p>Late unsaved value</p>');Element.prototype.moveBefore=undefined;await import('/plugin/js/smartforms.js');" : ''}window.extendedReady=true;});
  document.querySelector('form').addEventListener('submit',event=>{if(!document.formvalidator.isValid(event.target)){event.preventDefault();return;}tinymce.triggerSave();});</script></body></html>`;
}
