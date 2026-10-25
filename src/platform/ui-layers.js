const layers = new WeakMap();

// A single browser top layer; settings and dictionaries use normal z-index
// inside it, so opening a dictionary never hides or reopens settings.
export function attachUILayer(element) {
  const doc = element.ownerDocument;
  let entry = layers.get(doc);
  if (!entry?.root.isConnected) {
    if (entry) doc.removeEventListener('fullscreenchange', entry.fullscreen);
    const root = doc.createElement('div');
    root.setAttribute('data-at-ui', ''); root.setAttribute('data-at-ui-layer', '');
    root.style.cssText = 'all:initial!important;display:block!important;position:fixed!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;pointer-events:none!important;z-index:2147483647!important;';
    if (typeof root.showPopover === 'function') root.setAttribute('popover', 'manual');
    const show = () => {
      try { if (!root.matches(':popover-open')) root.showPopover?.(); }
      catch { /* Fixed-position fallback. */ }
    };
    const fullscreen = () => {
      try { if (root.matches(':popover-open')) root.hidePopover(); } catch { /* No popover support. */ }
      show();
    };
    entry = { root, show, fullscreen }; layers.set(doc, entry);
    doc.documentElement.append(root); doc.addEventListener('fullscreenchange', fullscreen);
  }
  if (element.parentNode !== entry.root) entry.root.append(element);
  entry.show();
}

export function detachUILayer(element) {
  const doc = element.ownerDocument, entry = layers.get(doc);
  element.remove();
  if (entry && !entry.root.childElementCount) {
    doc.removeEventListener('fullscreenchange', entry.fullscreen);
    entry.root.remove(); layers.delete(doc);
  }
}
