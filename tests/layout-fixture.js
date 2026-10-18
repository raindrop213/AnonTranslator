import { anchorRect } from '../src/reader/geometry.js';
import { createDictionaryPopup } from '../src/reader/dictionary-popup.js';
import { defaults } from '../src/settings/settings.js';

const output = document.querySelector('#results'), stage = document.querySelector('#stage'), word = document.querySelector('#word');
const results = [], popups = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); results.push('PASS ' + message); };
const near = (a, b) => Math.abs(a - b) < 1;
const settle = () => new Promise(resolve => setTimeout(resolve, 100));
const settings = { ...defaults, pluginSwitch: true, dictionaryEnabled: true, dictionaryWeblio: false, dictionaryMoji: false, ankiEnabled: false, dictionaryPopupWidth: 300, dictionaryPopupHeight: 200 };
const platform = { setSettings: async patch => Object.assign(settings, patch), send: async message => {
  if (message.action === 'lookup_word') return { url: 'https://www.weblio.jp/content/', html: '<div class="kijiWrp"><h2>図書館</h2><p>本を集め、読書や調査に利用する施設。</p><a class="point">読書</a></div>' };
  if (message.action === 'anki_draft_set') document.querySelector('#draft').textContent = JSON.stringify({ word: message.draft.word, reading: message.draft.reading, sentence: message.draft.sentence, translation: message.draft.translation });
  return {};
} };
const tokens = [{ surface: '図書館', start: 0, end: 3, pos: '名詞' }];
function openPopup(doc, anchor) {
  const popup = createDictionaryPopup(platform, () => settings, doc); popups.push(popup);
  popup.open(tokens, 0, '図書館', anchor);
  return { popup, host: [...document.querySelectorAll('[data-at-dictionary-popup]')].at(-1) };
}
try {
  window.scrollTo(0, 160); await settle();
  assert(!!anchorRect(word, document), 'syosetu 根元素滚动后，屏幕内词语仍可定位');
  const { popup, host } = openPopup(document, word); await settle();
  let reads = 0;
  const originalRects = word.getClientRects.bind(word);
  word.getClientRects = () => { reads++; return originalRects(); };
  assert(!host.hidden && host.getBoundingClientRect().width === 300, '长页面中查词窗可见且尺寸正确');
  const prior = host.getBoundingClientRect();
  window.scrollTo(0, 1700); await settle();
  assert(!host.hidden && near(host.getBoundingClientRect().top, prior.top), 'Kakuyomu 词语滚出屏幕后保留查词窗');
  assert(host.shadowRoot.querySelector('input').value === '図書館', '离屏后查询词与内容保持不变');
  assert(reads === 0, '滚动后不重新读取词语位置，无实时定位');
  window.scrollTo(0, 0); await settle();
  document.documentElement.style.transform = 'translate(13px, 17px)'; await settle();
  const box = host.getBoundingClientRect();
  assert(host.matches(':popover-open') && near(box.left, parseFloat(host.style.left)) && near(box.top, parseFloat(host.style.top)), '页面根元素 transform 不会使顶层浮窗错位');
  document.documentElement.style.transform = ''; popup.close();

  const frame = document.createElement('iframe'); frame.className = 'book';
  const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
  frame.srcdoc = '<!doctype html><html style="writing-mode:vertical-rl"><style>body{margin:0}#inner{position:absolute;left:280px;top:100px;width:24px;height:60px;background:#ffe4ac}</style><span id="inner">図書館</span></html>';
  stage.prepend(frame); await loaded; await settle();
  const child = frame.contentDocument, inner = child.querySelector('#inner');
  const mapped = anchorRect(inner, document), frameBox = frame.getBoundingClientRect();
  assert(near(mapped.left, frameBox.left + (2 + 24 + 280) * .75) && near(mapped.top, frameBox.top + (2 + 48 + 100) * .75), 'Bibi 竖排 iframe 的 padding、边框和缩放全部纳入坐标');
  const framed = openPopup(child, inner); await settle();
  const framedBox = framed.host.getBoundingClientRect();
  assert(!framed.host.hidden && (framedBox.right <= mapped.left || framedBox.left >= mapped.right || framedBox.bottom <= mapped.top || framedBox.top >= mapped.bottom), '竖排查词窗显示在词语旁且不覆盖选中词');
  const before = framed.host.style.top;
  frame.style.transform = 'translateY(30px) scale(.75)'; await settle();
  assert(framed.host.style.top === before, 'iframe 移动后弹窗保持固定，不再跟随');
  inner.remove(); await settle();
  assert(!framed.host.hidden, '原词离开页面后仍可继续查询');
  framed.popup.open(tokens, 0, '図書館', inner); await settle();
  assert(framed.host.hidden, '再次点击当前词语会关闭查词窗');
  const blank = openPopup(document, word);
  document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  assert(blank.host.hidden, '点击页面空白处关闭页面浮窗');
  results.push(`全部通过：${results.length} 项浏览器验证`);
} catch (error) { results.push('FAIL ' + error.stack); }
finally {
  popups.forEach(popup => popup.destroy()); window.scrollTo(0, 0);
  output.textContent = results.join('\n'); output.dataset.ready = 'true'; document.title = results.some(line => line.startsWith('FAIL')) ? 'FAIL 定位验证' : 'PASS 定位验证';
}
let demo, rememberedWindow;
const openedWindows = [], cycleReports = [];
const nativeOpen = window.open.bind(window);
window.open = (...args) => { const handle = nativeOpen(...args); if (handle) openedWindows.push(handle); return handle; };
document.querySelector('#cycle-window').addEventListener('click', async () => {
  try {
    const host = demo.host, root = host.shadowRoot;
    if (host.ownerDocument !== document) root.querySelector('.detach').click();
    root.querySelector('.detach').click();
    const other = host.ownerDocument.defaultView;
    const contentMovedOut = other !== window;
    root.querySelector('.detach').click();
    await new Promise(resolve => setTimeout(resolve, 500));
    cycleReports.push({ cycle: cycleReports.length + 1, contentMovedOut, contentRestored: host.ownerDocument === document && !host.hidden,
      lastWindowClosed: other.closed, totalOpened: openedWindows.length, remainingWindows: openedWindows.filter(view => !view.closed).length });
  } catch (error) { cycleReports.push({ error: error.message }); }
  document.querySelector('#window-report').textContent = JSON.stringify(cycleReports, null, 2);
});
document.querySelector('#fault-window').addEventListener('click', async () => {
  const host = demo.host, root = host.shadowRoot;
  if (host.ownerDocument === document) root.querySelector('.detach').click();
  const other = host.ownerDocument.defaultView, NativeSheet = window.CSSStyleSheet;
  try {
    window.CSSStyleSheet = function () { throw new Error('模拟跨窗口样式构造失败'); };
    root.querySelector('.detach').click();
  } finally { window.CSSStyleSheet = NativeSheet; }
  await new Promise(resolve => setTimeout(resolve, 500));
  cycleReports.push({ fault: 'stylesheet', contentRestored: host.ownerDocument === document && !host.hidden,
    lastWindowClosed: other.closed, remainingWindows: openedWindows.filter(view => !view.closed).length,
    popupStyled: getComputedStyle(root.querySelector('.popup')).display === 'flex',
    ankiStyled: getComputedStyle(root.querySelector('[data-at-anki-panel]').shadowRoot.querySelector('.editor')).display === 'flex' });
  document.querySelector('#window-report').textContent = JSON.stringify(cycleReports, null, 2);
  if (!other.closed) other.close(); // The fixture owns this disposable window.
});
document.querySelector('#fail-open-window').addEventListener('click', async () => {
  const host = demo.host, open = window.open;
  window.open = (...args) => {
    const other = open(...args), element = other.document.documentElement, append = element.append;
    element.append = function () { element.append = append; throw new Error('模拟窗口迁移失败'); };
    return other;
  };
  try { host.shadowRoot.querySelector('.detach').click(); }
  finally { window.open = open; }
  await settle();
  cycleReports.push({ fault: 'open', contentRestored: host.ownerDocument === document && !host.hidden,
    pageTopLayer: host.matches(':popover-open'), lastWindowClosed: openedWindows.at(-1).closed, remainingWindows: openedWindows.filter(view => !view.closed).length });
  document.querySelector('#window-report').textContent = JSON.stringify(cycleReports, null, 2);
});
document.querySelector('#prepare-window').addEventListener('click', () => {
  demo?.popup.destroy();
  Object.assign(settings, { dictionaryPopupMode: 'page', ankiEnabled: true, dictionaryWeblio: true, dictionaryPopupWidth: 480, dictionaryPopupHeight: 600, ankiTranslationServices: [], ankiWordAudioService: 'none', ankiSentenceAudioService: 'none' });
  demo = openPopup(document, word);
});

document.querySelector('#deny-close').addEventListener('click', async () => {
  const host = demo.host, root = host.shadowRoot;
  root.querySelector('.detach').click();
  const other = host.ownerDocument.defaultView, nativeClose = other.close, count = openedWindows.length;
  other.close = () => {};
  for (let index = 0; index < 3; index++) root.querySelector('.detach').click();
  const retained = host.ownerDocument.defaultView === other && !host.hidden && other.document.contains(host);
  const noNewWindows = openedWindows.length === count;
  other.close = nativeClose; root.querySelector('.detach').click(); await settle();
  cycleReports.push({ scenario: 'denied-close', contentRetained: retained, noNewWindows,
    finallyClosed: other.closed, contentRestored: host.ownerDocument === document && !host.hidden,
    remainingWindows: openedWindows.filter(view => !view.closed).length });
  document.querySelector('#window-report').textContent = JSON.stringify(cycleReports, null, 2);
});

document.querySelector('#remember-position').addEventListener('click', async () => {
  const host = demo.host, root = host.shadowRoot;
  root.querySelector('.detach').click();
  const first = host.ownerDocument.defaultView;
  await settle(first); first.moveTo(480, 200); await settle(first);
  const moved = { left: first.screenX, top: first.screenY, width: first.innerWidth, height: first.innerHeight };
  root.querySelector('.detach').click(); await settle();
  rememberedWindow = moved;
  cycleReports.push({ scenario: 'save-position', moved,
    saved: settings.dictionaryWindowLeft === moved.left && settings.dictionaryWindowTop === moved.top });
  document.querySelector('#window-report').textContent = JSON.stringify(cycleReports, null, 2);
  document.querySelector('#window-report').dataset.scenario = 'save-position';
});

document.querySelector('#reopen-position').addEventListener('click', async () => {
  const host = demo.host, root = host.shadowRoot, moved = rememberedWindow;
  root.querySelector('.detach').click();
  const reopened = host.ownerDocument.defaultView; await settle(reopened);
  const restored = { left: reopened.screenX, top: reopened.screenY, width: reopened.innerWidth, height: reopened.innerHeight };
  root.querySelector('.detach').click(); await settle();
  cycleReports.push({ scenario: 'remember-position', moved, restored,
    saved: settings.dictionaryWindowLeft === moved.left && settings.dictionaryWindowTop === moved.top,
    samePosition: moved.left === restored.left && moved.top === restored.top,
    sameSize: moved.width === restored.width && moved.height === restored.height,
    remainingWindows: openedWindows.filter(view => !view.closed).length });
  document.querySelector('#window-report').textContent = JSON.stringify(cycleReports, null, 2);
  document.querySelector('#window-report').dataset.scenario = 'remember-position';
});
document.querySelector('#clear-source').addEventListener('click', () => demo?.popup.clearSource());
document.querySelector('#verify-window').addEventListener('click', async () => {
  try {
    const host = demo.host, otherDoc = host.ownerDocument, otherWindow = otherDoc.defaultView, root = host.shadowRoot;
    assert(otherDoc !== document && host.isConnected && !host.hidden, '整窗已移出原网页并保持可见');
    assert(host.getBoundingClientRect().width === otherDoc.defaultView.innerWidth, '独立窗口中的查词界面填满窗口');
    const anki = root.querySelector('[data-at-anki-panel]').shadowRoot;
    assert(anki.querySelector('[aria-label="例句"]').value === '編集した <b>例句</b>' && anki.querySelector('[aria-label="例句翻译"]').value === '保留编辑的翻译', '独立窗口保留手动编辑的例句和翻译');
    assert(otherDoc.defaultView.getComputedStyle(anki.querySelector('.editor')).display === 'flex', '迁移后词典及 Anki 的 Shadow DOM 样式有效');
    assert(root.querySelector('iframe').contentDocument.body.textContent.includes('読書'), '迁移后词典内容仍可阅读');
    demo.popup.clearSource();
    assert(!host.hidden && host.ownerDocument === otherDoc, '取消原文选择不关闭独立编辑窗口');
    assert(!root.querySelector('.close') && !root.querySelector('.detach').hidden, '查词窗移除叉号并保留模式切换按钮');
    root.querySelector('.detach').click(); await settle();
    assert(!host.hidden && host.ownerDocument === document && host.matches(':popover-open'), '模式按钮可切回页面浮窗且保持内容');
    assert(otherWindow.closed, '切回网页后原生窗口真正关闭，不留下空白窗');
    assert(anki.querySelector('[aria-label="例句翻译"]').value === '保留编辑的翻译', '来回切换模式不丢失手动编辑');
    root.querySelector('.detach').click();
    const nativeWindow = host.ownerDocument.defaultView;
    await new Promise(resolve => {
      nativeWindow.addEventListener('pagehide', () => setTimeout(resolve, 0), { once: true });
      nativeWindow.close(); setTimeout(resolve, 1000);
    });
    assert(host.hidden && host.ownerDocument === document, '使用浏览器窗口关闭按钮也会正确恢复宿主');
    demo.popup.destroy();
  } catch (error) { results.push('FAIL ' + error.stack); }
  results.push(`完成：${results.filter(line => line.startsWith('PASS')).length} 项浏览器验证`);
  output.textContent = results.join('\n');
});
