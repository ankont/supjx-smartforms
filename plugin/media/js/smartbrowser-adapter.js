import { FormAdapter } from './form-adapter.js';
/** SmartBrowser's article, category and user layout contracts. */
export class SmartBrowserFormAdapter extends FormAdapter {
  static find(document, config) {
    if (config?.adapter !== 'smartbrowser') return null;
    const type = { 'com_content.article': 'article', 'com_content.categories': 'category', 'com_users.user': 'user' }[config.context];
    if (!type) return null;
    const form = document.querySelector(`.com-smartbrowser-editor[data-resource-type="${type}"] form#adminForm`);
    const tabs = form?.querySelector('joomla-tab#smartbrowserEditorTabs');
    if (!tabs?.querySelector('joomla-tab-element#smartbrowser-main')) return null;
    return new SmartBrowserFormAdapter(form, tabs, config);
  }
  getTarget(id) {
    const main = this.tabs.querySelector('#smartbrowser-main');
    const input = name => this.form.querySelector(`[name="jform[${name}]"]`);
    if (id === 'article-text' || id === 'category-description') {
      const native = input(id === 'article-text' ? 'articletext' : 'description')?.closest('fieldset.options-form');
      return main.contains(native) ? this.target(id, native) : null;
    }
    if (id === 'content-settings') return this.target(id, main.querySelector('.col-lg-3 > fieldset.options-form'));
    if (id === 'user-account') return this.target(id, main.querySelector(':scope > fieldset.options-form'));
    if (id === 'user-settings') return this.target(id, this.tabs.querySelector('#fieldset-settings'));
    const publishing = this.tabs.querySelector('#smartbrowser-publishing, #smartbrowser-publishing-options');
    if (id === 'publishing') return this.target(id, publishing?.querySelector('.col-lg-6:first-child > fieldset.options-form'));
    if (id === 'metadata') return this.target(id, publishing?.querySelector('.col-lg-6:nth-child(2) > fieldset.options-form'));
    return null;
  }
}
