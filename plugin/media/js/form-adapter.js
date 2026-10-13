/** Shared DOM operations; concrete adapters own layout recognition. */
export class FormAdapter {
  constructor(form, tabs, config) { Object.assign(this, { form, tabs, config }); }
  safeToMove(panel, container) {
    if (panel.querySelector('iframe') && typeof container.moveBefore !== 'function') return false;
    const registry = this.form.ownerDocument.defaultView.customElements;
    return ![panel, ...panel.querySelectorAll('*')].some(element => {
      const prototype = registry.get(element.localName)?.prototype;
      return prototype && (prototype.connectedCallback || prototype.disconnectedCallback)
        && (typeof container.moveBefore !== 'function' || !prototype.connectedMoveCallback);
    });
  }
  move(panel, container, reference = null) {
    if (typeof container.moveBefore === 'function') container.moveBefore(panel, reference);
    else container.insertBefore(panel, reference);
  }
  wrapRegion(region, id) {
    if (!region || !this.safeToMove(region, region.parentElement)) return null;
    const native = this.form.ownerDocument.createElement('fieldset');
    native.className = 'options-form';
    region.before(native);
    this.move(region, native);
    return this.target(id, native);
  }
  target(id, native) {
    if (!native || !this.form.contains(native)) return null;
    return { id, native, container: native.parentElement, label: this.config.labels?.[id] || id,
      labelElements: [...native.querySelectorAll('label')].filter(label => ['jform_articletext', 'jform_description'].includes(label.htmlFor)),
      tab: native.closest('joomla-tab-element') };
  }
  getGroups(target) {
    const result = [];
    for (const definition of this.config.groups || []) {
      if (definition.target !== target.id || !['toggle', 'before', 'after', 'left', 'right'].includes(definition.mode)
        || !/^fields-[1-9][0-9]*$/.test(definition.fieldset)) continue;
      const fields = (definition.fieldIds || []).map(id => this.form.ownerDocument.getElementById(id)).filter(Boolean);
      if (!fields.length || fields.some(field => !this.form.contains(field))) continue;
      const source = this.tabs?.querySelector(`#attrib-${definition.fieldset}, #smartbrowser-${definition.fieldset}`);
      const candidates = this.tabs ? [...(source?.querySelectorAll('fieldset.options-form') || [])]
        .filter(panel => !source.contains(panel.parentElement.closest('fieldset.options-form')))
        : [...this.form.children].filter(panel => panel.tagName === 'FIELDSET' && fields.every(field => panel.contains(field)));
      if (candidates.length !== 1) continue;
      const panel = candidates[0];
      if (panel === target.native || !fields.every(field => panel.contains(field))) continue;
      if (this.tabs) {
        if (!source || source.parentElement !== this.tabs
          || ![`attrib-${definition.fieldset}`, `smartbrowser-${definition.fieldset}`].includes(source.id)
          || [...source.querySelectorAll('input,select,textarea')].some(field => !panel.contains(field))) continue;
      } else if (panel.parentElement !== this.form) continue;
      if ([...panel.querySelectorAll('input[name],select[name],textarea[name]')].some(field => !field.name.startsWith('jform[com_fields]'))) continue;
      if (!this.safeToMove(panel, target.container)) continue;
      result.push({ ...definition, panel, source, label: panel.querySelector('legend')?.textContent.trim() || definition.fieldset });
    }
    return result;
  }
  retireGroup(group, target) {
    if (!group.source) return;
    if (group.source.hasAttribute('active')) this.activateTarget(target);
    const entry = this.tabs.tabs?.find(item => item.tab === group.source);
    entry?.tabButton.remove(); entry?.accordionButton.remove();
    if (Array.isArray(this.tabs.tabs)) this.tabs.tabs = this.tabs.tabs.filter(item => item.tab !== group.source);
    if (Array.isArray(this.tabs.tabsElements)) this.tabs.tabsElements = this.tabs.tabsElements.filter(item => item !== group.source);
    for (const button of this.tabs.querySelectorAll('button[aria-controls]')) {
      if (button.getAttribute('aria-controls') === group.source.id) button.remove();
    }
    group.source.remove();
  }
  activateTarget(target) {
    if (target.tab && !target.tab.hasAttribute('active')) {
      if (this.tabs.activateTab) this.tabs.activateTab(target.tab, false);
      else target.tab.setAttribute('active', '');
    }
  }
}
