import { FormAdapter } from './form-adapter.js';
/** Native administration, article frontend and profile frontend have distinct contracts. */
export class NativeFormAdapter extends FormAdapter {
  static find(document, config) {
    let form, tabs;
    if (config?.adapter === 'native-admin') {
      form = document.querySelector(config.context === 'com_users.user' ? 'form#user-form' : 'form#item-form');
      tabs = form?.querySelector('joomla-tab#myTab');
      if (!tabs) return null;
    } else if (config?.adapter === 'native-article-site' && config.context === 'com_content.article') {
      form = document.querySelector('.edit.item-page form#adminForm');
      tabs = form?.querySelector('joomla-tab#com-content-form');
      if (!tabs) return null;
    } else if (config?.adapter === 'native-profile' && config.context === 'com_users.user') {
      form = document.querySelector('.com-users-profile__edit form#member-profile');
      if (!form) return null;
    } else return null;
    return new NativeFormAdapter(form, tabs, config);
  }
  getTarget(id) {
    const input = name => this.form.querySelector(`[name="jform[${name}]"]`);
    if (id === 'category-options' && this.config.adapter === 'native-admin') {
      return this.target(id, this.tabs.querySelector('#attrib-options #fieldset-basic'));
    }
    if (this.config.adapter === 'native-profile') {
      if (id === 'user-account') return this.target(id, input('username')?.closest('fieldset'));
      if (id === 'user-settings') return this.target(id, this.form.querySelector('[name="jform[params][editor]"]')?.closest('fieldset'));
      return null;
    }
    if (this.config.adapter === 'native-article-site') {
      if (id === 'article-text') {
        const region = input('articletext')?.closest('.control-group');
        return region?.closest('joomla-tab-element')?.id === 'editor' ? this.wrapRegion(region, id) : null;
      }
      // Core frontend combines status and publication settings in the same tab.
      if (id === 'content-settings') return null;
      if (id === 'publishing' || id === 'metadata') {
        const tab = this.tabs.querySelector(`#${id}`);
        return this.wrapContents(tab, id);
      }
      return null;
    }
    const main = this.tabs.querySelector(this.config.context === 'com_users.user' ? '#details' : '#general');
    if (!main) return null;
    if (id === 'article-text') return this.target(id, input('articletext')?.closest('fieldset.adminform'));
    if (id === 'category-description') {
      const region = input('description')?.closest('.col-lg-9');
      return main.contains(region) ? this.wrapContents(region, id) : null;
    }
    if (id === 'content-settings') return this.wrapContents(main.querySelector('.col-lg-3'), id);
    if (id === 'publishing') return this.target(id, this.tabs.querySelector('#fieldset-publishingdata'));
    if (id === 'metadata') return this.target(id, this.tabs.querySelector('#fieldset-metadata'));
    if (id === 'user-account') return this.target(id, main.querySelector(':scope > fieldset.options-form'));
    if (id === 'user-settings') return this.target(id, this.tabs.querySelector('#fieldset-settings'));
    return null;
  }
  wrapContents(region, id) {
    if (!region?.querySelector('input,select,textarea') || !this.safeToMove(region, region)) return null;
    const inner = this.form.ownerDocument.createElement('div');
    region.prepend(inner);
    for (const node of [...region.childNodes]) if (node !== inner) this.move(node, inner);
    return this.wrapRegion(inner, id);
  }
}
