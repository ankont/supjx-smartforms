const start = () => {
  const config = window.Joomla?.getOptions('plg_system_smartforms');
  if (!config) return;
  const adapter = SmartBrowserFormAdapter.find(document, config) || NativeFormAdapter.find(document, config);
  if (adapter) new PlacementEngine().apply(adapter, config.labels);
};

// A classic head asset runs before parsing the body. The interactive transition fires before
// deferred/module scripts upgrade Joomla custom fields/editors, so they initialize in place.
if (document.readyState === 'loading') {
  const ready = () => {
    if (document.readyState === 'loading') return;
    document.removeEventListener('readystatechange', ready);
    start();
  };
  document.addEventListener('readystatechange', ready);
} else {
  start();
}
