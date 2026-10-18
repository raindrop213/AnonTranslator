const output = document.querySelector('#results');
const observedWindows = new Set(), history = [];
let host = null, rounds = 0;
const settle = () => new Promise(resolve => setTimeout(resolve, 100));
const visibleHost = () => [...document.querySelectorAll('[data-at-dictionary-popup]')].find(element => !element.hidden);
const button = () => host?.shadowRoot?.querySelector('.detach');
function windowStats() {
  return { windowsCreated: observedWindows.size, windowCount: [...observedWindows].filter(win => !win.closed).length,
    windowCountScope: '仅统计此夹具观察到的独立窗口，不包含阅读页' };
}
function styles() {
  const popup = host?.shadowRoot?.querySelector('.popup');
  if (!popup) return { valid: false };
  const win = host.ownerDocument.defaultView, style = win.getComputedStyle(popup), rect = popup.getBoundingClientRect();
  const anki = host.shadowRoot.querySelector('[data-at-anki-panel]')?.shadowRoot?.querySelector('.editor');
  const ankiDisplay = anki ? win.getComputedStyle(anki).display : null;
  return { valid: style.display === 'flex' && rect.width > 100 && rect.height > 100 && (!anki || ankiDisplay === 'flex'),
    popupDisplay: style.display, width: Math.round(rect.width), height: Math.round(rect.height), ankiDisplay };
}
function report(action, details = {}) {
  const result = { action, rounds, ...details, ...windowStats() };
  history.push(result); output.textContent = history.map(value => JSON.stringify(value, null, 2)).join('\n\n');
  output.dataset.rounds = String(rounds);
  document.title = details.pass === false ? 'FAIL 真实 Chrome 扩展窗口验证' : '真实 Chrome 扩展窗口验证';
}
document.querySelector('#bind').addEventListener('click', () => {
  const found = visibleHost();
  if (!found?.shadowRoot?.querySelector('.detach')) { report('bind', { pass: false, error: '请先点击分词，在阅读页中打开查词窗。' }); return; }
  host = found; report('bind', { pass: true, hostInSource: host.ownerDocument === document, styles: styles() });
});

document.querySelector('#open-chapter').addEventListener('click', async () => {
  try {
    const chapter = document.querySelector('#chapter').contentDocument;
    const clickText = element => {
      const range = chapter.createRange(); range.selectNodeContents(element.querySelector('ruby')?.firstChild || element);
      const rect = range.getClientRects()[0];
      element.dispatchEvent(new chapter.defaultView.MouseEvent('click', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
    };
    clickText(chapter.querySelector('p span'));
    for (let attempt = 0; attempt < 200 && !chapter.querySelector('.at-word'); attempt++) await new Promise(resolve => setTimeout(resolve, 20));
    const word = chapter.querySelector('.at-word');
    if (!word) throw new Error('章节尚未产生分词，请确认已刷新并启用分词');
    const candidates = [...document.querySelectorAll('[data-at-dictionary-popup]')];
    clickText(word);
    host = candidates.find(element => element.shadowRoot?.querySelector('input')?.value === '図書館');
    if (!host || host.hidden) throw new Error('章节查词窗未打开');
    if (host.ownerDocument !== document) button().click();
    report('sandbox-chapter', { pass: true, sandbox: document.querySelector('#chapter').getAttribute('sandbox'),
      chapterBound: chapter.documentElement.hasAttribute('data-at-reader'), hostInSource: host.ownerDocument === document, styles: styles() });
  } catch (error) { report('sandbox-chapter', { pass: false, error: error.message }); }
});
document.querySelector('#roundtrip').addEventListener('click', () => {
  if (!host?.isConnected || host.hidden || host.ownerDocument !== document || !button()) {
    report('roundtrip', { pass: false, error: '请先绑定阅读页中的查词窗。' }); return;
  }
  const control = document.querySelector('#roundtrip'); control.disabled = true;
  try {
    button().click();
    const firstMoved = host.ownerDocument !== document;
    const native = firstMoved ? host.ownerDocument.defaultView : null;
    if (native) observedWindows.add(native);
    const detachedStyles = styles();
    if (!firstMoved) { report('roundtrip', { pass: false, firstMoved, error: '查词窗未进入独立窗口；请使用桌面宽度并允许弹窗。' }); return; }
    button().click(); rounds++;
    const nativeClosed = native.closed, hostInSource = host.ownerDocument === document && host.isConnected && !host.hidden;
    const restoredStyles = styles();
    report('roundtrip', { pass: firstMoved && nativeClosed && hostInSource && detachedStyles.valid && restoredStyles.valid,
      firstMoved, nativeClosed, hostInSource, detachedStyles, restoredStyles });
  } catch (error) { report('roundtrip', { pass: false, error: error.stack || error.message }); }
  finally { control.disabled = false; }
});
document.querySelector('#cleanup').addEventListener('click', async () => {
  for (const win of observedWindows) if (!win.closed) win.close();
  await settle(); report('cleanup', { pass: [...observedWindows].every(win => win.closed), hostInSource: host?.ownerDocument === document });
});
