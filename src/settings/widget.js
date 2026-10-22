import panelHTML from './panel.html';
import panelCSS from './panel.css';
import icon from '../../assets/img/icon128.png';
import { mountSettingsPanel } from './panel.js';
import { mountMaterial } from './material.js';
import { mountBackground } from './background.js';
import { mountSelects } from './selects.js';
import { mountFloatingWidget } from './floating-widget.js';
import { mountScrollFeather } from './scroll-feather.js';

// Keep the panel's styles and controls isolated from the reading website.
const isolationCSS = `
:host { all:initial!important; position:fixed!important; inset:0!important; width:100%!important;
  height:100%!important; z-index:2147483647!important; pointer-events:none!important;
  direction:ltr!important; writing-mode:horizontal-tb!important; }
[data-glass-root] { direction:ltr; writing-mode:horizontal-tb; pointer-events:none; }
[data-glass-root] body { margin:0; background:transparent; pointer-events:none; }
.settings-shell, #settings-orb, .glass-select-popover, dialog, #toast { pointer-events:auto; }
[data-glass-root] #settings-orb[data-widget-state="collapsed"][data-dock]:not([data-dock=""]):not(:hover, :focus-visible, .is-peeking, .is-dragging, .is-animating) { opacity:var(--at-docked-icon-opacity, .5); }
`;

export async function mountSettingsWidget(store, platform, doc = document) {
  const view = doc.defaultView;
  let disposed = false, controller, unmount;
  const cleanups = [], observers = new Set(), frames = new Set(), timers = new Set(), objectURLs = new Set();
  const motionWaiters = new Set();
  const host = doc.createElement('div'); host.setAttribute('data-at-ui', ''); host.setAttribute('data-at-widget', '');
  const shadow = host.attachShadow({ mode: 'open' });
  const root = doc.createElement('div'); root.setAttribute('data-glass-root', '');
  root.style.visibility = 'hidden';
  root.dataset.theme = store.values.nightMode ? 'dark' : 'light'; root.dataset.backdrop = 'aurora';
  const head = doc.createElement('div'); head.hidden = true;
  const body = doc.createElement('body'); body.innerHTML = panelHTML;
  const style = doc.createElement('style'); style.textContent = panelCSS + '\n' + isolationCSS;
  root.append(head, body); shadow.append(style, root); doc.documentElement.append(host);

  const listen = (target, name, callback, options) => {
    target.addEventListener(name, callback, options);
    const remove = () => target.removeEventListener(name, callback, options);
    cleanups.push(remove); return remove;
  };
  const frame = callback => {
    const id = view.requestAnimationFrame(time => { frames.delete(id); if (!disposed) callback(time); });
    frames.add(id); return id;
  };
  const timeout = (callback, delay, ...args) => {
    const id = view.setTimeout(() => { timers.delete(id); if (!disposed) callback(...args); }, delay);
    timers.add(id); return id;
  };
  const scope = {
    requestAnimationFrame: frame,
    cancelAnimationFrame(id) { frames.delete(id); view.cancelAnimationFrame(id); },
    setTimeout: timeout,
    clearTimeout(id) { timers.delete(id); view.clearTimeout(id); },
    getComputedStyle: view.getComputedStyle.bind(view),
    CustomEvent: view.CustomEvent, Event: view.Event, FileReader: view.FileReader, Image: view.Image,
    URL: view.URL, Blob: view.Blob, performance: view.performance
  };
  scope.URL = class extends view.URL {
    static createObjectURL(blob) { const url = view.URL.createObjectURL(blob); objectURLs.add(url); return url; }
    static revokeObjectURL(url) { objectURLs.delete(url); view.URL.revokeObjectURL(url); }
  };
  if (view.ResizeObserver) scope.ResizeObserver = class extends view.ResizeObserver {
    constructor(callback) { super((...args) => { if (!disposed) callback(...args); }); observers.add(this); }
  };
  scope.MutationObserver = class extends view.MutationObserver {
    constructor(callback) { super((...args) => { if (!disposed) callback(...args); }); observers.add(this); }
  };
  const eventFacade = target => ({
    addEventListener(name, callback, options) { listen(target, name, callback, options); },
    removeEventListener: target.removeEventListener.bind(target)
  });
  const windowFacade = {
    ...scope, ...eventFacade(view),
    get innerWidth() { return view.innerWidth; }, get innerHeight() { return view.innerHeight; },
    matchMedia(query) {
      const media = view.matchMedia(query);
      return { ...eventFacade(media), get matches() { return media.matches; }, get media() { return media.media; } };
    },
    visualViewport: view.visualViewport ? eventFacade(view.visualViewport) : null,
    speechSynthesis: view.speechSynthesis ? {
      ...eventFacade(view.speechSynthesis),
      getVoices: view.speechSynthesis.getVoices.bind(view.speechSynthesis)
    } : undefined
  };
  const documentListeners = [];
  const documentFacade = {
    documentElement: root, body, head, defaultView: windowFacade, fonts: doc.fonts,
    get activeElement() { return shadow.activeElement; },
    get visibilityState() { return doc.visibilityState; },
    createElement: doc.createElement.bind(doc), createElementNS: doc.createElementNS.bind(doc),
    createDocumentFragment: doc.createDocumentFragment.bind(doc),
    querySelector: shadow.querySelector.bind(shadow), querySelectorAll: shadow.querySelectorAll.bind(shadow),
    getElementById: shadow.getElementById.bind(shadow),
    addEventListener(name, callback, options) {
      // Inner events keep their actual target. Only outside events are forwarded
      // from the real document, where Shadow DOM would otherwise retarget them.
      const outside = event => { if (!event.composedPath().includes(host)) callback(event); };
      const removeInside = listen(shadow, name, callback, options), removeOutside = listen(doc, name, outside, options);
      documentListeners.push({ name, callback, options, removeInside, removeOutside });
    },
    removeEventListener(name, callback, options) {
      const entry = documentListeners.find(item => item.name === name && item.callback === callback && Boolean(item.options?.capture || item.options === true) === Boolean(options?.capture || options === true));
      entry?.removeInside(); entry?.removeOutside();
    },
    dispatchEvent: shadow.dispatchEvent.bind(shadow)
  };
  windowFacade.document = documentFacade;
  let saved;
  try { saved = await platform.getWidgetState?.(); } catch { /* Use the default panel position. */ }
  const raw = saved?.glass && typeof saved.glass === 'object' ? { ...saved.glass } : {};
  if (!raw['anon-glass-floating-widget-v1'] && Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) {
    raw['anon-glass-floating-widget-v1'] = JSON.stringify({ orb: { x: saved.x, y: saved.y, dock: saved.dock || '' }, mode: 'collapsed', followOrb: true });
  }
  let storageQueue = Promise.resolve();
  const persist = () => {
    const snapshot = { glass: { ...raw } };
    storageQueue = storageQueue.catch(() => {}).then(() => platform.setWidgetState?.(snapshot)).catch(() => {});
  };
  const localStorage = {
    getItem(key) { return typeof raw[key] === 'string' ? raw[key] : null; },
    setItem(key, value) { raw[key] = String(value); persist(); },
    removeItem(key) { delete raw[key]; persist(); },
    clear() { for (const key of Object.keys(raw)) delete raw[key]; persist(); }
  };
  let initialized = false;
  const initialize = () => {
    if (initialized) return controller;
    initialized = true;
    env.material = mountMaterial(env);
    mountBackground(env);
    env.selects = mountSelects(env);
    controller = mountFloatingWidget(env);
    mountScrollFeather(env);
    return controller;
  };
  const env = { ...scope, window: windowFacade, document: documentFacade, localStorage, icon, root, body, shadow, host, initialize };
  const unsubscribe = store.subscribe(values => { root.dataset.theme = values.nightMode ? 'dark' : 'light'; });
  cleanups.push(unsubscribe);
  try {
    unmount = await mountSettingsPanel(env, store, platform);
    if (!initialized) initialize();
    if (store.values.pluginSwitch) root.style.removeProperty('visibility');
  } catch (error) {
    disposed = true; cleanups.forEach(remove => remove()); observers.forEach(observer => observer.disconnect()); host.remove(); throw error;
  }
  const settled = () => new Promise(resolve => {
    const done = () => { motionWaiters.delete(done); resolve(); };
    motionWaiters.add(done);
    const check = () => {
      if (disposed || !controller?.getState().animation) done();
      else frame(check);
    };
    check();
  });
  const open = async () => {
    await settled();
    if (disposed || !store.values.pluginSwitch) return;
    host.inert = false; root.style.removeProperty('visibility');
    return controller?.open({ reveal: true, focus: false });
  };
  return {
    open,
    async dismiss() {
      host.inert = true;
      await settled();
      if (disposed) return;
      await controller?.close();
      if (!disposed) root.style.visibility = 'hidden';
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      motionWaiters.forEach(done => done());
      if (typeof unmount === 'function') unmount(); else unmount?.destroy?.();
      cleanups.forEach(remove => remove()); observers.forEach(observer => observer.disconnect());
      frames.forEach(id => view.cancelAnimationFrame(id)); timers.forEach(id => view.clearTimeout(id));
      objectURLs.forEach(url => view.URL.revokeObjectURL(url));
      body.querySelectorAll('*').forEach(element => element.getAnimations?.().forEach(animation => animation.cancel()));
      host.remove();
    }
  };
}
