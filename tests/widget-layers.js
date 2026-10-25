import { mountSettingsWidget } from '../src/settings/widget.js';
import { createSettingsStore } from '../src/settings/settings.js';
import { createDictionaryView } from '../src/reader/dictionary-view.js';

const button = document.querySelector('#run'), status = document.querySelector('#status'), list = document.querySelector('#results');
let running = false, report = [], cleanups = [];
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
async function waitFor(predicate) {
  const deadline = performance.now() + 5000;
  while (!predicate()) { if (performance.now() > deadline) throw new Error('等待设置栏动画完成超时'); await nextFrame(); }
}
const expect = (condition, message) => { if (!condition) throw new Error(message); };
async function check(name, action) {
  const row = document.createElement('li'); list.append(row);
  try { await action(); report.push({ name, passed: true }); row.className = 'pass'; row.textContent = '通过 · ' + name; }
  catch (error) {
    const message = error.message || String(error); report.push({ name, passed: false, message });
    row.className = 'fail'; row.textContent = '失败 · ' + name;
    const detail = document.createElement('small'); detail.textContent = message; row.append(detail);
  }
}
function memoryPlatform() {
  const values = { copy: false, settingsTab: '复制', dockedIconOpacity: 100 }, listeners = new Set();
  return {
    async getSettings() { return { ...values }; },
    async setSettings(patch) { Object.assign(values, patch); for (const listener of listeners) listener(patch); },
    async removeSettings(keys) { for (const key of keys) delete values[key]; for (const listener of listeners) listener(Object.fromEntries(keys.map(key => [key, undefined]))); },
    watchSettings(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async getWidgetState() { return null; }, async setWidgetState() {},
    async send(message) {
      if (message.action === 'tokenizer_data_status') return { state: 'missing', completed: 0, total: 12 };
      if (message.action === 'check_update') return { available: false };
      throw new Error('检测不应请求在线服务：' + message.action);
    }
  };
}
function visibleInside(element, doc) {
  expect(element && !element.hidden, '组件不存在或带有 hidden 属性');
  const style = doc.defaultView.getComputedStyle(element), rect = element.getBoundingClientRect();
  expect(style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0, '组件被样式隐藏');
  expect(rect.width > 20 && rect.height > 20, '组件没有可见尺寸');
  expect(rect.left >= -1 && rect.top >= -1 && rect.right <= doc.defaultView.innerWidth + 1 && rect.bottom <= doc.defaultView.innerHeight + 1,
    `组件越出视口：${JSON.stringify({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, viewportWidth: doc.defaultView.innerWidth, viewportHeight: doc.defaultView.innerHeight })}`);
  return rect;
}
function dictionaryHost(doc) {
  const host = doc.createElement('div'); host.setAttribute('data-at-ui', ''); host.setAttribute('data-at-dictionary-popup', ''); host.hidden = true;
  const shadow = host.attachShadow({ mode: 'open' });
  const sheet = new doc.defaultView.CSSStyleSheet();
  sheet.replaceSync(':host{position:fixed!important;margin:0!important;padding:0!important;border:0!important;display:block!important;z-index:2147483646!important;background:#7490b9!important;color:#fff!important;pointer-events:auto!important}:host([hidden]){display:none!important}div{padding:12px;font:14px/1.6 sans-serif}');
  shadow.adoptedStyleSheets = [sheet];
  const label = doc.createElement('div'); label.textContent = '查词浮窗（真实窗口控制器）'; shadow.append(label); doc.documentElement.append(host);
  return host;
}
function assertSettingsOnTop(doc, host, panel, popupHost) {
  const rect = visibleInside(panel, doc), x = rect.left + Math.min(rect.width / 2, 120), y = rect.top + Math.min(rect.height / 2, 90);
  const popupRect = popupHost.getBoundingClientRect();
  expect(x > popupRect.left && x < popupRect.right && y > popupRect.top && y < popupRect.bottom, '测试点没有覆盖两层组件');
  const actual = doc.elementFromPoint(x, y);
  expect(actual === host, `重叠区域命中 ${actual?.getAttribute('data-at-widget') !== null ? '设置栏以外的组件' : actual?.outerHTML?.slice(0, 160) || '空白'}`);
  const inside = host.shadowRoot.elementFromPoint(x, y);
  expect(inside && (panel === inside || panel.contains(inside)), '设置栏内部未命中可操作控件');
}
function dragWithPageInterception(doc, target, dx, dy) {
  const rect = target.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
  const pointerId = 91;
  const dispatch = (type, offsetX = 0, offsetY = 0) => target.dispatchEvent(new doc.defaultView.PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true, pointerType: 'mouse', pointerId, isPrimary: true,
    button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    clientX: x + offsetX, clientY: y + offsetY
  }));
  // Match Bibi's HTML capture listener: pointermove is stopped before reaching
  // the handle. Pointerup must still reach the page to release its gesture state.
  let pageMoves = 0, pageUps = 0;
  const intercept = event => { pageMoves++; event.stopPropagation(); };
  const released = () => { pageUps++; };
  doc.documentElement.addEventListener('pointermove', intercept, true);
  doc.documentElement.addEventListener('pointerup', released, true);
  try {
    doc.body.dispatchEvent(new doc.defaultView.PointerEvent('pointermove', { bubbles: true, composed: true, pointerId, isPrimary: true }));
    expect(pageMoves === 1, '未拖动设置时页面的移动事件被拦截'); pageMoves = 0;
    dispatch('pointerdown'); dispatch('pointermove', dx, dy); dispatch('pointerup', dx, dy);
    expect(pageMoves === 0, '设置拖动期间移动事件仍到达页面捕获处理器');
    expect(pageUps === 1, '页面没有收到 pointerup 来结束自己的手势状态');
  }
  finally {
    doc.documentElement.removeEventListener('pointermove', intercept, true);
    doc.documentElement.removeEventListener('pointerup', released, true);
    // Release a failed baseline's unfinished drag as well as the successful run.
    dispatch('pointercancel', dx, dy);
  }
}
function checkWheelIsolation(doc, target) {
  let pageWheels = 0;
  const onWheel = () => { pageWheels++; };
  const wheel = element => {
    const event = new doc.defaultView.WheelEvent('wheel', { bubbles: true, composed: true, cancelable: true, deltaY: 120 });
    element.dispatchEvent(event); return event;
  };
  // Bibi's document capture handler turns wheel gestures into reader movement.
  doc.addEventListener('wheel', onWheel, { capture: true, passive: false });
  try {
    const inside = wheel(target);
    expect(pageWheels === 0, '设置栏内的滚轮到达页面捕获处理器，会触发翻页');
    expect(!inside.defaultPrevented, '设置栏内的原生滚动被禁用');
    const outside = wheel(doc.body);
    expect(pageWheels === 1, '设置栏外的滚轮被拦截');
    expect(!outside.defaultPrevented, '设置栏外的原生滚动被禁用');
  } finally { doc.removeEventListener('wheel', onWheel, true); }
}
function dragDistance(element) {
  const rect = element.getBoundingClientRect();
  return rect.left > 100 ? -48 : 48;
}
async function scenario(id, strict, missingUUID = false) {
  const frame = document.querySelector('#' + id), prefix = missingUUID ? '局域网 HTTP' : strict ? '严格 CSP' : '普通页面';
  const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
  frame.srcdoc = `<!doctype html><html lang="zh-CN" data-at-ui><meta charset="utf-8">${strict ? '<meta http-equiv="Content-Security-Policy" content="style-src \'none\'">' : ''}<body><h1>阅读器正文</h1><p>設定欄と辞書を同時に開く。</p></body></html>`;
  await loaded;
  frame.scrollIntoView({ block: 'start', behavior: 'instant' });
  const doc = frame.contentDocument, platform = memoryPlatform(), store = createSettingsStore(platform, { siteURL: location.href });
  let widget, view, popupHost;
  cleanups.push(() => { view?.destroy(); widget?.destroy(); store.destroy(); popupHost?.remove(); });
  try {
    await store.init(); await store.set('pluginSwitch', true);
    // The real modules execute in this parent realm. Temporarily omit the
    // secure-context API here, then restore the exact original descriptor.
    const uuidDescriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    const matchMedia = doc.defaultView.matchMedia;
    // Animation timelines can pause in offscreen test iframes. Exercise the
    // production reduced-motion path so visibility/layer assertions settle.
    doc.defaultView.matchMedia = query => query === '(prefers-reduced-motion: reduce)'
      ? { matches: true, media: query, addEventListener() {}, removeEventListener() {} }
      : matchMedia.call(doc.defaultView, query);
    if (missingUUID) Object.defineProperty(crypto, 'randomUUID', { configurable: true, writable: true, value: undefined });
    try { widget = await mountSettingsWidget(store, platform, doc); }
    finally {
      doc.defaultView.matchMedia = matchMedia;
      if (missingUUID) {
        if (uuidDescriptor) Object.defineProperty(crypto, 'randomUUID', uuidDescriptor);
        else delete crypto.randomUUID;
      }
    }
    const host = doc.querySelector('[data-at-widget]'), shadow = host?.shadowRoot;
    const orb = shadow?.querySelector('#settings-orb'), panel = shadow?.querySelector('#floating-settings');
    await check(prefix + ' · 设置头像可见且位于视口内', () => { visibleInside(orb, doc); expect(doc.defaultView.getComputedStyle(orb).position === 'fixed', '头像定位样式未生效'); });
    await widget.open();
    await check(prefix + ' · 设置面板展开后可见且位于视口内', () => { visibleInside(panel, doc); expect(doc.defaultView.getComputedStyle(panel).position === 'fixed', '面板定位样式未生效'); });
    if (missingUUID) return;
    const layer = host.closest('[data-at-ui-layer]');
    let layerToggles = 0;
    layer?.addEventListener('beforetoggle', event => { if (event.target === layer) layerToggles++; });
    await check(prefix + ' · 设置栏位于共享浏览器顶层', () => {
      expect(layer && layer.matches(':popover-open'), '共享 UI 层未进入 popover 顶层');
      expect(host.parentElement === layer, '设置栏不是共享 UI 层的直接子节点');
    });
    popupHost = dictionaryHost(doc); view = createDictionaryView(platform, () => store.values, popupHost);
    const overlap = () => {
      const rect = panel.getBoundingClientRect();
      for (const [key, value] of Object.entries({ left: rect.left, top: rect.top, width: Math.max(rect.width, 360), height: Math.max(rect.height, 490) })) popupHost.style.setProperty(key, value + 'px', 'important');
    };
    for (let round = 1; round <= 2; round++) await check(prefix + ` · 第 ${round} 次打开查词后设置栏仍在上方`, async () => {
      view.close(); overlap(); view.show('page'); await nextFrame(); assertSettingsOnTop(doc, host, panel, popupHost);
      expect(popupHost.parentElement === layer, '查词栏与设置栏没有共用顶层容器');
    });
    await check(prefix + ' · 设置栏收起后头像仍在查词栏上方', async () => {
      orb.click(); await waitFor(() => panel.hidden && !orb.dataset.animation);
      const rect = visibleInside(orb, doc), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      expect(doc.elementFromPoint(x, y) === host, '收起后的头像被查词栏遮挡');
    });
    await check(prefix + ' · 再次展开恢复可见并保持层级', async () => {
      await widget.open(); overlap(); assertSettingsOnTop(doc, host, panel, popupHost);
    });
    await check(prefix + ' · Esc 收起后可再次打开', async () => {
      view.close(); panel.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
      await waitFor(() => panel.hidden && !orb.dataset.animation); await widget.open(); visibleInside(panel, doc);
      overlap(); view.show('page'); await nextFrame(); assertSettingsOnTop(doc, host, panel, popupHost);
    });
    await check(prefix + ' · 页面捕获拦截移动事件时仍可拖动头像且不误展开', async () => {
      view.close(); orb.click(); await waitFor(() => panel.hidden && !orb.dataset.animation);
      const before = visibleInside(orb, doc), dx = dragDistance(orb);
      dragWithPageInterception(doc, orb, dx, 0);
      const after = visibleInside(orb, doc);
      expect(Math.abs(after.left - before.left) >= 30, 'HTML 捕获拦截事件后头像没有移动');
      orb.dispatchEvent(new doc.defaultView.MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail: 1 }));
      await nextFrame(); expect(panel.hidden, '拖动后的 click 误触发展开设置栏');
    });
    await check(prefix + ' · 页面捕获拦截移动事件时仍可拖动展开的面板', async () => {
      await widget.open();
      const header = panel.querySelector('.settings-header'), before = visibleInside(panel, doc), dx = dragDistance(panel);
      dragWithPageInterception(doc, header, dx, 0);
      const after = visibleInside(panel, doc);
      expect(Math.abs(after.left - before.left) >= 30, 'HTML 捕获拦截事件后面板没有移动');
      expect(!panel.hidden && !panel.classList.contains('is-dragging'), '拖动结束后面板状态异常');
      overlap(); view.show('page'); await nextFrame(); assertSettingsOnTop(doc, host, panel, popupHost);
    });
    await check(prefix + ' · 设置滚轮不触发页面捕获处理且允许原生滚动', () => {
      checkWheelIsolation(doc, panel.querySelector('.panel-scroll'));
    });
    await check(prefix + ' · 查词及设置开关不会隐藏重开共享顶层', () => {
      expect(layer && layer.matches(':popover-open'), '共享 UI 层未保持打开');
      expect(host.parentElement === layer && popupHost.parentElement === layer, '组件离开了共享 UI 层');
      expect(layerToggles === 0, `共享 UI 层发生了 ${layerToggles} 次关闭或重开`);
    });
  } catch (error) { await check(prefix + ' · 初始化真实组件', () => { throw error; }); }
}
async function run() {
  if (running) return;
  running = true; button.disabled = true; status.className = ''; status.textContent = '检测中…';
  document.documentElement.dataset.auditStatus = 'running'; for (const cleanup of cleanups.splice(0)) cleanup(); report = []; list.replaceChildren();
  try { await scenario('normal', false); await scenario('strict', true); await scenario('insecure', false, true); }
  finally {
    const failed = report.filter(item => !item.passed).length;
    document.documentElement.dataset.auditStatus = failed ? 'failed' : 'passed';
    status.textContent = failed ? `${failed} 项失败，${report.length - failed} 项通过` : `${report.length} 项全部通过`;
    status.className = failed ? 'fail' : 'pass'; button.disabled = false; running = false;
  }
  return report.map(item => ({ ...item }));
}
button.addEventListener('click', () => { void run(); });
window.widgetLayerAudit = { run, get results() { return report.map(item => ({ ...item })); } };
