const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

// The lookup session keeps its DOM. This controller only owns where it lives:
// closed, page, sheet, or window. Settings store a preference, not another state.
export function createDictionaryView(platform, getSettings, host, { show = () => {}, onMove = () => {}, onClose = () => {}, onEscape = () => {} } = {}) {
  const doc = host.ownerDocument, win = doc.defaultView;
  let kind = 'closed', native = null;

  function move(target) {
    if (host.ownerDocument === target) return;
    const sheets = [];
    const collect = element => {
      const shadow = element.shadowRoot;
      if (!shadow) return;
      sheets.push([shadow, shadow.adoptedStyleSheets.map(sheet => [...sheet.cssRules].map(rule => rule.cssText).join('\n'))]);
      for (const child of shadow.querySelectorAll('*')) if (child.shadowRoot) collect(child);
    };
    collect(host); target.documentElement.append(host);
    // Constructed stylesheets belong to their document; inline fallback styles
    // travel with the DOM if another window cannot construct a stylesheet.
    for (const [shadow, sources] of sheets) {
      try {
        shadow.adoptedStyleSheets = sources.map(css => { const sheet = new target.defaultView.CSSStyleSheet(); sheet.replaceSync(css); return sheet; });
      } catch {
        const style = target.createElement('style'); style.textContent = sources.join('\n'); shadow.prepend(style);
      }
    }
    onMove(target);
  }
  function display(target) {
    const wasOpen = kind !== 'closed';
    kind = target; host.hidden = target === 'closed';
    host.toggleAttribute('data-window', target === 'window');
    host.toggleAttribute('data-sheet', target === 'sheet');
    if (typeof host.showPopover === 'function') {
      if (target === 'window') host.removeAttribute('popover');
      else {
        host.setAttribute('popover', 'manual');
        try { if (host.hidden) host.hidePopover(); else host.showPopover(); } catch { /* Fixed-position fallback. */ }
      }
    }
    if (wasOpen && target === 'closed') onClose();
  }
  function remember(other) {
    const left = other.screenX, top = other.screenY;
    if (Number.isFinite(left) && Number.isFinite(top)) {
      void platform.setSettings({ dictionaryWindowLeft: Math.round(left), dictionaryWindowTop: Math.round(top) })
        .catch(error => show('保存独立窗位置失败：' + error.message));
    }
  }
  function bind(entry, add) {
    const method = add ? 'addEventListener' : 'removeEventListener';
    entry.window[method]('pagehide', entry.closed);
    entry.window.document[method]('keydown', onEscape, true);
  }
  function reclaim(entry) {
    bind(entry, false); native = null; move(doc);
  }
  function windowClosed(entry) {
    if (native !== entry) return;
    // pagehide happens before window.closed becomes true. The browser already
    // owns this close; reclaim the content without calling close() again.
    remember(entry.window); reclaim(entry); display('closed');
  }
  function release() {
    if (!native) return true;
    const entry = native, other = entry.window;
    remember(other); bind(entry, false);
    try { if (!other.closed) other.close(); } catch { /* Handle a rejected close below. */ }
    if (!other.closed) {
      bind(entry, true); show('浏览器未允许关闭独立窗，请使用窗口自身的关闭按钮'); return false;
    }
    reclaim(entry); return true;
  }
  function openWindow() {
    const settings = getSettings();
    const width = clamp(settings.dictionaryPopupWidth || 424, 220, 1600), height = clamp(settings.dictionaryPopupHeight || 470, 160, 1600);
    const left = settings.dictionaryWindowLeft === '' || settings.dictionaryWindowLeft == null
      ? win.screenX + (win.outerWidth - width) / 2 : settings.dictionaryWindowLeft;
    const top = settings.dictionaryWindowTop === '' || settings.dictionaryWindowTop == null
      ? win.screenY + Math.max(0, (win.outerHeight - height) / 2) : settings.dictionaryWindowTop;
    try {
      const other = win.open('', '_blank', `popup,width=${Math.round(width)},height=${Math.round(height)},left=${Math.round(left)},top=${Math.round(top)}`);
      if (!other) { show('窗口未能打开，请允许当前网站弹出窗口后重试'); return false; }
      const entry = { window: other, closed: () => windowClosed(entry) }; native = entry;
      try { host.hidePopover?.(); } catch { /* Fixed-position fallback. */ }
      host.removeAttribute('popover'); other.document.documentElement.setAttribute('data-at-ui', '');
      move(other.document); bind(entry, true); return true;
    } catch (error) {
      if (release()) display(kind);
      else display('window');
      show('窗口未能打开：' + error.message); return false;
    }
  }
  function transition(target) {
    if (native?.window.closed) windowClosed(native);
    if (kind === target) return true;
    if (target !== 'window' && !release()) return false;
    if (target === 'window' && !openWindow()) return false;
    display(target); return true;
  }
  const close = () => transition('closed');
  win.addEventListener('pagehide', close);
  return {
    get kind() { return kind; },
    get window() { return native?.window || null; },
    get independent() { return kind === 'window' || kind === 'sheet'; },
    show(mode) {
      const target = mode === 'independent' ? (win.matchMedia('(pointer:coarse)').matches || win.innerWidth <= 768 ? 'sheet' : 'window') : 'page';
      const success = transition(target);
      if (!success && kind === 'closed') display('page');
      native?.window.focus(); return success;
    },
    close,
    destroy() {
      if (!close()) return false;
      win.removeEventListener('pagehide', close); return true;
    }
  };
}
