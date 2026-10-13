/** Placement mechanics use adapter-provided nodes; no Joomla or SmartBrowser selectors here. */
export class PlacementEngine {
  apply(adapter, labels = {}) {
    if (adapter.form.dataset.smartformsReady === '1') return null;
    const controllers = [];
    for (const id of new Set((adapter.config.groups || []).map(group => group.target))) {
      if (!adapter.config.targets.includes(id)) continue;
      const target = adapter.getTarget(id);
      if (!target) continue;
      const groups = adapter.getGroups(target);
      if (!groups.length) continue;
      adapter.form.classList.add('smartforms-form');
      controllers.push(this.applyTarget({
        form: adapter.form, getTarget: () => target, getGroups: () => groups,
        move: (...args) => adapter.move(...args),
        retireGroup: group => adapter.retireGroup(group, target),
        activateTarget: () => adapter.activateTarget(target),
      }, labels));
    }
    if (!controllers.length) return null;
    adapter.form.dataset.smartformsReady = '1';
    return { controllers };
  }

  applyTarget(adapter, labels) {
    const target = adapter.getTarget();
    const groups = adapter.getGroups();
    if (!groups.length) return null;
    const document = adapter.form.ownerDocument;
    const before = groups.filter(group => group.mode === 'before');
    const after = groups.filter(group => group.mode === 'after');
    const toggles = groups.filter(group => group.mode === 'toggle');
    const anchor = document.createComment('smartforms-placement');
    target.native.after(anchor);
    for (const group of before) adapter.move(group.panel, target.container, target.native);
    for (const group of toggles) adapter.move(group.panel, target.container, anchor);
    for (const group of after) adapter.move(group.panel, target.container, anchor);
    anchor.remove();

    let select = () => {};
    let panels = [];
    let buttons = [];
    let trigger = null;
    let menu = null;
    if (toggles.length) {
      const control = document.createElement('span');
      control.className = 'smartforms-toggle';
      panels = [...toggles.map(group => group.panel), target.native];
      const names = [...toggles.map(group => group.label), target.label];
      for (const label of target.labelElements || []) {
        label.hidden = true;
        label.classList.add('smartforms-native-label');
      }
      const legends = panels.map(panel => {
        let legend = [...panel.children].find(child => child.tagName === 'LEGEND');
        if (!legend) {
          legend = document.createElement('legend');
          panel.prepend(legend);
        }
        // Keep each original heading, replacing only its visible presentation.
        const title = document.createElement('span');
        title.className = 'smartforms-legend-title';
        title.hidden = true;
        title.append(...legend.childNodes);
        legend.append(title);
        return legend;
      });
      let selected = 0;
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.id = `${target.id}-smartforms-switcher`;
      trigger.className = 'smartforms-view-button';
      trigger.setAttribute('aria-haspopup', 'menu');
      trigger.setAttribute('aria-expanded', 'false');
      const caption = document.createElement('span');
      caption.className = 'smartforms-view-label';
      const chevron = document.createElement('span');
      chevron.className = 'smartforms-view-chevron';
      chevron.textContent = '▾';
      chevron.setAttribute('aria-hidden', 'true');
      trigger.append(caption, chevron);
      menu = document.createElement('span');
      menu.id = `${target.id}-smartforms-menu`;
      menu.className = 'smartforms-view-menu';
      menu.hidden = true;
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', labels.toggle || 'Form placement');
      trigger.setAttribute('aria-controls', menu.id);
      control.append(trigger, menu);
      const close = (restoreFocus = false) => {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (restoreFocus) trigger.focus();
      };
      const open = (index = selected) => {
        menu.classList.remove('smartforms-menu-above');
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        const bounds = menu.getBoundingClientRect();
        const anchor = trigger.getBoundingClientRect();
        if (bounds.bottom > document.defaultView.innerHeight && anchor.top > document.defaultView.innerHeight - anchor.bottom) {
          menu.classList.add('smartforms-menu-above');
        }
        buttons[index].focus();
      };
      trigger.addEventListener('click', () => menu.hidden ? open() : close());
      trigger.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          open(event.key === 'ArrowDown' ? 0 : buttons.length - 1);
        }
      });
      panels.forEach((panel, index) => {
        panel.classList.add('smartforms-panel');
        if (!panel.id) panel.id = `smartforms-${index === toggles.length ? 'native' : toggles[index].fieldset}-panel`;
        const button = document.createElement('button');
        button.type = 'button';
        button.id = `${panel.id}-smartforms-option`;
        button.className = 'smartforms-view-option';
        button.tabIndex = -1;
        const indicator = document.createElement('span');
        indicator.className = 'smartforms-view-check';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.textContent = '✓';
        const label = document.createElement('span');
        label.className = 'smartforms-option-label';
        label.textContent = names[index];
        button.append(indicator, label);
        button.setAttribute('role', 'menuitemradio');
        button.setAttribute('aria-controls', panel.id);
        panel.setAttribute('aria-label', names[index]);
        button.addEventListener('click', () => { select(index); trigger.focus(); });
        button.addEventListener('keydown', event => {
          const next = event.key === 'ArrowDown' ? (index + 1) % panels.length
            : event.key === 'ArrowUp' ? (index - 1 + panels.length) % panels.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? panels.length - 1 : null;
          if (next !== null) { event.preventDefault(); buttons[next].focus(); }
        });
        buttons.push(button);
        menu.append(button);
      });
      control.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !menu.hidden) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        } else if (event.key === 'Tab' && !menu.hidden) {
          // Resume native tab order from the trigger, without leaving focus in a hidden menu.
          close(true);
        }
      });
      document.addEventListener('pointerdown', event => { if (!control.contains(event.target)) close(); });
      document.addEventListener('focusin', event => { if (!control.contains(event.target)) close(); });
      select = index => {
        selected = index;
        close();
        // Move only the new switcher into the active heading; editor nodes stay untouched.
        legends[index].append(control);
        panels.forEach((panel, i) => {
          panel.hidden = i !== index;
          buttons[i].setAttribute('aria-checked', String(i === index));
        });
        caption.textContent = names[index];
        trigger.setAttribute('aria-label', `${labels.view || 'View'}: ${names[index]}`);
        close();
        // Resize existing editors; never dispose, reinitialize, disable or clone any form control.
        panels[index].dispatchEvent(new CustomEvent('smartforms:shown', { bubbles: true }));
        document.defaultView.dispatchEvent(new Event('resize'));
      };
      select(0);
    }
    for (const group of groups) {
      group.panel.classList.add('smartforms-placement');
      adapter.retireGroup(group);
    }
    const reveal = field => {
      const index = panels.findIndex(panel => panel.contains(field));
      if (index >= 0) select(index);
      if (index >= 0 || groups.some(group => group.panel.contains(field))) adapter.activateTarget();
    };
    adapter.form.addEventListener('invalid', event => reveal(event.target), true);
    // Joomla's formvalidator marks controls with .invalid instead of firing HTML5 invalid events.
    const observer = new MutationObserver(records => {
      const invalid = records.find(record => record.target.classList.contains('invalid')
        && !(record.oldValue || '').split(/\s+/).includes('invalid'))?.target;
      if (invalid) { reveal(invalid); invalid.focus?.(); }
    });
    observer.observe(adapter.form, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true });
    return { select, reveal, groups, panels, buttons, trigger, menu, observer };
  }
}
