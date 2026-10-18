import test from 'node:test';
import assert from 'node:assert/strict';
import { createDictionaryView } from '../src/reader/dictionary-view.js';

// Model the browser's relevant window lifecycle, including pagehide before the
// closed flag changes. No dictionary services or DOM library are involved.
class Events {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type, properties = {}) {
    const event = { type, target: this, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...properties };
    for (const listener of [...(this.listeners.get(type) || [])]) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
    return event;
  }
  count(type) { return this.listeners.get(type)?.size || 0; }
}

class Element extends Events {
  attributes = new Map();
  children = [];
  hidden = true;
  isConnected = true;
  style = { setProperty() {}, removeProperty() {} };
  constructor(ownerDocument) { super(); this.ownerDocument = ownerDocument; }
  setAttribute(name, value = '') { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  toggleAttribute(name, force = !this.hasAttribute(name)) {
    if (force) this.setAttribute(name); else this.removeAttribute(name);
    return force;
  }
  append(...elements) {
    if (this.ownerDocument.failAppend) { this.ownerDocument.failAppend = false; throw new Error('move failed'); }
    for (const element of elements) {
      element.parentElement?.children.splice(element.parentElement.children.indexOf(element), 1);
      element.ownerDocument = this.ownerDocument;
      element.parentElement = this;
      this.children.push(element);
    }
  }
  prepend(...elements) { this.append(...elements); }
  showPopover() { this.popoverOpen = true; }
  hidePopover() { this.popoverOpen = false; }
  querySelectorAll() { return []; }
}

class Sheet {
  cssRules = [];
  replaceSync(css) { this.cssRules = [{ cssText: css }]; }
}

function fixture({ coarse = false, narrow = false } = {}) {
  const env = { coarse, windows: [], openCalls: [], openBlocked: false, openThrows: false, failNextMove: false };
  const makeDocument = window => {
    const doc = new Events();
    doc.defaultView = window; doc.documentElement = new Element(doc); doc.body = new Element(doc);
    doc.createElement = () => new Element(doc);
    return doc;
  };
  const main = new Events();
  Object.assign(main, {
    screenX: 800, screenY: 100, outerWidth: 1200, outerHeight: 900,
    innerWidth: narrow ? 600 : 1200, innerHeight: 800, CSSStyleSheet: Sheet,
    matchMedia: () => ({ matches: env.coarse }), focus() {}
  });
  main.document = makeDocument(main);
  main.open = (url, target, features) => {
    env.openCalls.push({ url, target, features });
    if (env.openThrows) throw new Error('popup denied');
    if (env.openBlocked) return null;
    const other = new Events();
    const feature = name => Number(features.match(new RegExp(`(?:^|,)${name}=(-?\\d+)`))?.[1]);
    Object.assign(other, {
      screenX: feature('left'), screenY: feature('top'), innerWidth: feature('width'), innerHeight: feature('height'),
      closed: false, denied: false, closeCalls: 0, focusCalls: 0, CSSStyleSheet: Sheet,
      focus() { this.focusCalls++; },
      close() {
        this.closeCalls++;
        if (this.closeThrows) throw new Error('browser refused to close');
        if (this.denied || this.closed) return;
        this.dispatch('pagehide');
        this.closed = true;
      }
    });
    other.document = makeDocument(other);
    other.document.failAppend = env.failNextMove; env.failNextMove = false;
    env.configureWindow?.(other);
    env.windows.push(other);
    return other;
  };
  const host = new Element(main.document);
  host.shadowRoot = { adoptedStyleSheets: [], querySelectorAll: () => [], prepend() {} };
  host.setAttribute('popover', 'manual'); main.document.documentElement.append(host);
  const settings = {
    dictionaryPopupWidth: 424, dictionaryPopupHeight: 470,
    dictionaryWindowLeft: '', dictionaryWindowTop: ''
  };
  const moves = [], notices = [], writes = []; let closes = 0;
  const platform = { async setSettings(patch) { writes.push(patch); Object.assign(settings, patch); } };
  const view = createDictionaryView(platform, () => settings, host, {
    show: message => notices.push(message),
    onMove: doc => { moves.push(doc); env.afterMove?.(doc); },
    onClose: () => closes++
  });
  return { env, main, doc: main.document, host, settings, view, moves, notices, writes, closes: () => closes };
}

test('page/window round trips keep one host and leave no native windows after ten switches', () => {
  const f = fixture(), { view, host, doc, env } = f;
  assert.equal(view.kind, 'closed');
  assert.equal(view.show('page'), true);
  assert.equal(view.kind, 'page');
  assert.equal(host.hidden, false);
  for (let i = 0; i < 10; i++) {
    assert.equal(view.show('independent'), true);
    const other = view.window;
    assert.equal(view.kind, 'window');
    assert.equal(view.independent, true);
    assert.equal(host.ownerDocument, other.document);
    assert.equal(host.hasAttribute('data-window'), true);
    assert.equal(view.show('page'), true);
    assert.equal(other.closed, true);
    assert.equal(host.ownerDocument, doc);
    assert.equal(host.hidden, false);
    assert.equal(view.kind, 'page');
    assert.equal(view.independent, false);
    assert.equal(view.window, null);
    assert.equal(env.windows.filter(window => !window.closed).length, 0);
  }
  assert.equal(f.moves.length, 20, 'document migration is reported once in each direction');
  assert.equal(f.closes(), 0, 'changing presentation does not end the lookup session');
  assert.equal(view.close(), true);
  assert.equal(view.close(), true);
  assert.equal(f.closes(), 1, 'closing an already closed view is harmless');
  assert.equal(host.hidden, true);
  view.destroy();
});

test('showing the same presentation is idempotent', () => {
  const f = fixture(), { view, host, env } = f;
  view.show('independent');
  const other = view.window, moves = f.moves.length;
  const windowListeners = other.count('pagehide'), keyListeners = other.document.count('keydown');
  for (let i = 0; i < 5; i++) assert.equal(view.show('independent'), true);
  assert.equal(env.windows.length, 1);
  assert.equal(view.window, other);
  assert.equal(host.ownerDocument, other.document);
  assert.equal(f.moves.length, moves);
  assert.equal(other.count('pagehide'), windowListeners);
  assert.equal(other.document.count('keydown'), keyListeners);
  view.destroy();
});

test('touch and narrow displays use a bottom sheet without opening a native window', () => {
  for (const options of [{ coarse: true }, { narrow: true }]) {
    const { view, host, doc, env } = fixture(options);
    assert.equal(view.show('independent'), true);
    assert.equal(view.kind, 'sheet');
    assert.equal(view.independent, true);
    assert.equal(view.window, null);
    assert.equal(host.ownerDocument, doc);
    assert.equal(host.hasAttribute('data-sheet'), true);
    assert.equal(env.openCalls.length, 0);
    view.show('page');
    assert.equal(view.kind, 'page');
    assert.equal(host.hasAttribute('data-sheet'), false);
    view.destroy();
  }
});

test('a denied native close retains the populated window and prevents duplicate windows', () => {
  const f = fixture(), { view, host, env } = f;
  view.show('independent');
  const other = view.window;
  other.denied = true;
  for (let i = 0; i < 3; i++) {
    assert.equal(view.show('page'), false);
    assert.equal(view.kind, 'window');
    assert.equal(view.window, other);
    assert.equal(host.ownerDocument, other.document);
    assert.equal(host.hidden, false);
    assert.equal(view.show('independent'), true);
  }
  assert.equal(view.close(), false);
  assert.equal(f.closes(), 0);
  assert.equal(env.windows.length, 1);
  assert.equal(other.count('pagehide'), 1);
  other.denied = false;
  assert.equal(view.show('page'), true);
  assert.equal(other.closed, true);
  assert.equal(env.windows.filter(window => !window.closed).length, 0);
  view.destroy();
});

test('explicit close does not reenter when the native close dispatches pagehide synchronously', () => {
  const f = fixture(), { view, host, doc } = f;
  view.show('independent');
  const other = view.window;
  assert.equal(view.close(), true);
  assert.equal(other.closeCalls, 1);
  assert.equal(f.closes(), 1);
  assert.equal(view.kind, 'closed');
  assert.equal(host.ownerDocument, doc);
  assert.equal(host.hidden, true);
  assert.equal(other.count('pagehide'), 0);
  view.destroy();
});

test('a native close exception retains content, the handle, and its event listeners', () => {
  const f = fixture(), { view, host, doc } = f;
  view.show('independent');
  const other = view.window; other.closeThrows = true;
  assert.equal(view.close(), false);
  assert.equal(view.kind, 'window');
  assert.equal(view.window, other);
  assert.equal(host.ownerDocument, other.document);
  assert.equal(host.hidden, false);
  assert.equal(other.count('pagehide'), 1);
  assert.equal(other.document.count('keydown'), 1);
  assert.equal(f.closes(), 0);
  other.closeThrows = false;
  assert.equal(view.show('page'), true);
  assert.equal(other.closed, true);
  assert.equal(host.ownerDocument, doc);
  view.destroy();
});

test('the native close event reclaims the view even before window.closed becomes true', () => {
  const f = fixture(), { view, host, doc, settings } = f;
  view.show('independent');
  const other = view.window;
  other.screenX = -630; other.screenY = 140;
  other.dispatch('pagehide');
  assert.equal(other.closed, false, 'the event is deliberately delivered before this browser flag');
  assert.equal(other.closeCalls, 0, 'an event is not a new request to close the browser window');
  assert.equal(view.kind, 'closed');
  assert.equal(view.window, null);
  assert.equal(host.ownerDocument, doc);
  assert.equal(host.hidden, true);
  assert.equal(f.closes(), 1);
  assert.equal(settings.dictionaryWindowLeft, -630);
  assert.equal(settings.dictionaryWindowTop, 140);
  other.closed = true;
  view.destroy();
});

test('a late pagehide callback from an old window cannot close a replacement', () => {
  const f = fixture(), { view, host } = f;
  view.show('independent');
  const old = view.window, callbacks = [...old.listeners.get('pagehide')];
  view.show('page'); view.show('independent');
  const replacement = view.window;
  for (const callback of callbacks) callback({ type: 'pagehide', target: old });
  assert.equal(view.kind, 'window');
  assert.equal(view.window, replacement);
  assert.equal(host.ownerDocument, replacement.document);
  assert.equal(host.hidden, false);
  assert.equal(replacement.closed, false);
  assert.equal(f.closes(), 0);
  view.destroy();
});

test('a blocked or throwing first open falls back to a visible page view', () => {
  for (const failure of ['openBlocked', 'openThrows']) {
    const f = fixture(), { view, host, doc, env } = f;
    env[failure] = true;
    assert.equal(view.show('independent'), false);
    assert.equal(view.kind, 'page');
    assert.equal(view.window, null);
    assert.equal(host.ownerDocument, doc);
    assert.equal(host.hidden, false);
    assert.equal(host.hasAttribute('data-window'), false);
    assert.equal(host.hasAttribute('data-sheet'), false);
    assert.equal(f.closes(), 0);
    assert.ok(f.notices.length);
    view.destroy();
  }
});

test('failed migration closes the unused native window and restores the existing page view', () => {
  const f = fixture(), { view, host, doc, env } = f;
  view.show('page'); env.failNextMove = true;
  assert.equal(view.show('independent'), false);
  assert.equal(view.kind, 'page');
  assert.equal(view.window, null);
  assert.equal(host.ownerDocument, doc);
  assert.equal(host.hidden, false);
  assert.equal(env.windows.length, 1);
  assert.equal(env.windows[0].closed, true);
  assert.equal(env.windows.filter(window => !window.closed).length, 0);
  assert.equal(f.closes(), 0);
  view.destroy();
});

test('a failed switch out of the bottom sheet preserves that current presentation', () => {
  const { view, host, env, doc } = fixture({ coarse: true });
  view.show('independent');
  env.coarse = false; env.openBlocked = true;
  assert.equal(view.show('independent'), false);
  assert.equal(view.kind, 'sheet');
  assert.equal(view.window, null);
  assert.equal(host.ownerDocument, doc);
  assert.equal(host.hasAttribute('data-sheet'), true);
  assert.equal(host.hidden, false);
  view.destroy();
});

test('a migration callback failure with denied rollback retains the actual populated window', () => {
  const f = fixture(), { view, host, env, doc } = f;
  view.show('page');
  env.configureWindow = other => { other.denied = true; };
  env.afterMove = target => { if (target !== doc) throw new Error('migration callback failed'); };
  assert.equal(view.show('independent'), false);
  const other = env.windows[0];
  assert.equal(view.kind, 'window', 'state describes where the content actually remains');
  assert.equal(view.independent, true);
  assert.equal(view.window, other);
  assert.equal(host.ownerDocument, other.document);
  assert.equal(host.hasAttribute('data-window'), true);
  assert.equal(host.hidden, false);
  assert.equal(other.count('pagehide'), 1);
  assert.equal(other.document.count('keydown'), 1);
  assert.equal(env.windows.length, 1);
  assert.equal(f.closes(), 0);
  env.afterMove = null; other.denied = false;
  assert.equal(view.show('page'), true);
  assert.equal(other.closed, true);
  assert.equal(host.ownerDocument, doc);
  assert.equal(host.hidden, false);
  view.destroy();
});

test('native position is centered initially and saved on exit for the next opening', () => {
  const { view, env, settings } = fixture();
  view.show('independent');
  const other = view.window;
  assert.equal(other.screenX, 1188);
  assert.equal(other.screenY, 315);
  other.screenX = -425; other.screenY = 210;
  view.show('page');
  assert.equal(settings.dictionaryWindowLeft, -425);
  assert.equal(settings.dictionaryWindowTop, 210);
  view.show('independent');
  assert.equal(view.window.screenX, -425);
  assert.equal(view.window.screenY, 210);
  assert.equal(env.windows.length, 2);
  view.destroy();
});

test('destroy respects a denied close without clearing the live native window', () => {
  const f = fixture(), { view, host, doc, main } = f;
  view.show('independent');
  const other = view.window; other.denied = true;
  assert.equal(view.destroy(), false);
  assert.equal(view.kind, 'window');
  assert.equal(view.window, other);
  assert.equal(host.ownerDocument, other.document);
  assert.equal(host.hidden, false);
  assert.equal(f.closes(), 0);
  other.denied = false;
  assert.equal(view.destroy(), true);
  assert.equal(other.closed, true);
  assert.equal(host.ownerDocument, doc);
  assert.equal(host.hidden, true);
  assert.equal(main.count('pagehide'), 0);
  assert.equal(other.count('pagehide'), 0);
  assert.equal(other.document.count('keydown'), 0);
  assert.equal(f.closes(), 1);
});

test('the source window leaving closes the view through the same cleanup path', () => {
  const f = fixture(), { view, host, main, doc } = f;
  view.show('independent');
  const other = view.window;
  main.dispatch('pagehide');
  assert.equal(other.closed, true);
  assert.equal(view.kind, 'closed');
  assert.equal(host.ownerDocument, doc);
  assert.equal(host.hidden, true);
  assert.equal(f.closes(), 1);
  view.destroy();
});
