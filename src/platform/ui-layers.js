// Popovers share a browser-managed top layer; their z-index cannot order them.
export function raiseSettingsLayer(doc) {
  const host = doc.querySelector('[data-at-widget]');
  if (!host || typeof host.showPopover !== 'function') return;
  try {
    host.setAttribute('popover', 'manual');
    if (host.matches(':popover-open')) host.hidePopover();
    host.showPopover();
  } catch { /* Keep the fixed-position fallback when popovers are unavailable. */ }
}
