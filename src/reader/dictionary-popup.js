import { topDocument, anchorRect, viewportRect } from './geometry.js';
import { buildDictionarySearchURL, placeDictionaryPopup } from './dictionary-layout.js';
import { createDictionaryView } from './dictionary-view.js';
export { buildDictionarySearchURL, placeDictionaryPopup } from './dictionary-layout.js';
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
import { renderDictionaryDocument } from './dictionary-content.js';
import { createSpeaker } from '../services/speech.js';
import { createAnkiWorkspace, ankiWorkspaceCSS } from './anki-workspace.js';
import { captureRegion } from './screenshot-region.js';
import { serviceOrder } from '../settings/settings.js';

const names = { weblio: 'Weblio', moji: 'MOJi' };
const popupCSS = `
  :host{all:initial;margin:0!important;padding:0!important;border:0!important;position:fixed!important;display:block!important;z-index:2147483646!important;writing-mode:horizontal-tb!important;direction:ltr!important;color-scheme:light}
  :host([hidden]){display:none!important}
  :host([data-window]){left:0!important;top:0!important;width:100%!important;height:100%!important}
  :host([data-sheet]){left:0!important;top:0!important;width:100%!important;height:100%!important;background:#0004}
  :host([data-sheet]) .popup{position:absolute;left:0;right:0;bottom:0;height:min(75dvh,700px);max-height:calc(100% - 24px);border-radius:12px 12px 0 0;padding-bottom:env(safe-area-inset-bottom)}
  :host([data-sheet]) .popup:before{content:"";display:block;flex:none;width:36px;height:3px;margin:6px auto;background:#a6a6a6;border-radius:2px}
  *{box-sizing:border-box} .popup{position:relative;font:14px/1.4 system-ui,"Microsoft YaHei",sans-serif;color:#242a32;background:#fff;border:0;border-radius:0;box-shadow:0 3px 18px #0003;overflow:hidden;display:flex;flex-direction:column;height:100%}
  .query-row{border-bottom:1px solid #e7d6d3;display:grid;grid-template-columns:minmax(0,1fr);grid-auto-flow:column;grid-auto-columns:26px;align-items:center;gap:0;padding:0;flex:none}.query-box{display:flex;min-width:0}input{min-width:0;width:100%;height:26px;flex:1;border:0;border-radius:0;padding:2px 4px;font:inherit;font-size:16px;line-height:1.3;color:inherit;background:transparent}.query-row [hidden]{display:none!important}
  button{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:0 4px;border-radius:0}button:hover{background:#f3e6e3}button:disabled{opacity:.3;cursor:default}button:focus-visible,a:focus-visible{outline:1px solid #a33b35;outline-offset:-1px}input:focus{outline:0;background:#faf3f2;box-shadow:inset 0 0 0 1px color-mix(in srgb,#a33b35 30%,transparent)}
  .icon{width:26px;min-width:26px;height:26px;display:grid;place-items:center;padding:4px}.icon svg{display:block;width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
  .tabs{display:flex;align-items:center;gap:0;padding:0;flex:none;height:24px}.tabs button{height:24px;padding:0 6px;border-bottom:1px solid transparent;border-radius:0}.tabs button[aria-selected=true]{color:#a33b35;border-bottom-color:#a33b35}.source{margin-left:auto;padding:0 4px;color:#766461;font-size:11px;line-height:24px;text-decoration:none}.panel{flex:1;min-height:0;overflow:hidden}.panel[hidden]{display:none}.status{margin:0;padding:4px;overflow-wrap:anywhere;color:#68717d}.status.error{color:#a73636}iframe{width:100%;height:100%;border:0;background:#fff;display:block}
  .resize{position:absolute;right:0;bottom:0;width:17px;height:17px;padding:0;border-radius:0;cursor:nwse-resize;touch-action:none;background:transparent}.resize:after{content:"";position:absolute;right:3px;bottom:3px;width:9px;height:9px;background:linear-gradient(135deg,transparent 37%,#98a1ad 37%,#98a1ad 47%,transparent 47%,transparent 65%,#98a1ad 65%,#98a1ad 75%,transparent 75%)}:host([data-resizing]) .popup{user-select:none}:host([data-resizing]) iframe{pointer-events:none}
  :host([data-night]) .popup{color:#e2e7ed;background:#252a31}:host([data-night]) button:hover{background:#51312e}:host([data-night]) .tabs button[aria-selected=true]{color:#e99c91;border-bottom-color:#e99c91}:host([data-night]) button:focus-visible{outline-color:#e99c91}:host([data-night]) .query-row{border-bottom-color:#654743}:host([data-night]) input:focus{background:#352b2b;box-shadow:inset 0 0 0 1px color-mix(in srgb,#e99c91 30%,transparent)}
  ${ankiWorkspaceCSS}
  @media(pointer:coarse){.icon{width:36px;min-width:36px;height:36px}.query-row{grid-auto-columns:36px}input{height:36px}.tabs{height:32px}.tabs button{height:32px}}
`;

export function createDictionaryPopup(platform, getSettings, sourceDoc, { show = () => {}, onRange = () => {}, onEscape = () => {} } = {}) {
  const doc = topDocument(sourceDoc), win = doc.defaultView;
  const wordSpeaker = createSpeaker(platform);
  const host = doc.createElement('div'); host.setAttribute('data-at-ui', ''); host.setAttribute('data-at-dictionary-popup', ''); host.hidden = true;
  if (typeof host.showPopover === 'function') host.setAttribute('popover', 'manual');
  const root = host.attachShadow({ mode: 'open' });
  // Constructed stylesheets also work on books that disallow inline styles.
  try { const style = new win.CSSStyleSheet(); style.replaceSync(popupCSS); root.adoptedStyleSheets = [style]; }
  catch { const style = doc.createElement('style'); style.textContent = popupCSS; root.append(style); }
  const popup = doc.createElement('section'); popup.className = 'popup'; popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-label', '查词');
  const row = doc.createElement('div'); row.className = 'query-row';
  const query = doc.createElement('input'); query.type = 'text'; query.maxLength = 100; query.placeholder = '查询词'; query.setAttribute('aria-label', '查询词'); query.autocomplete = 'off'; query.spellcheck = false;
  const button = (label, className, content) => { const element = doc.createElement('button'); element.type = 'button'; element.className = className; element.title = label; element.setAttribute('aria-label', label); if (content) element.textContent = content; return element; };
  const detachButton = button('在独立窗口打开', 'icon detach');
  const next = button('添加下一个词', 'icon next'), voice = button('朗读查询词', 'icon voice');
  const sentenceVoice = button('朗读例句', 'icon sentence-voice');
  const drawIcon = (element, path) => {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'), shape = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); shape.setAttribute('d', path); svg.append(shape); element.append(svg);
  };
  drawIcon(detachButton, 'M14 3h7v7M21 3l-9 9M10 5H3v16h16v-7');
  drawIcon(next, 'M12 5v14M5 12h14');
  drawIcon(voice, 'M11 5 6 9H3v6h3l5 4zM15 8c2 2 2 6 0 8M18 5c4 4 4 10 0 14');
  drawIcon(sentenceVoice, 'M3 5h11M3 10h8M3 15h8M3 20h11M16 9l6 6-6 6z');
  const queryBox = doc.createElement('div'); queryBox.className = 'query-box'; queryBox.append(query);
  const workspace = createAnkiWorkspace(platform, getSettings, doc, {
    show, showVoiceControls: false,
    onPlayWord: text => playText(text, 'word'), onPlaySentence: text => playText(text, 'sentence'),
    onAdded() { if (getSettings().ankiCloseAfterAdd) close(); },
    async onCapture() {
      const requestWindow = host.ownerDocument.defaultView;
      const wasHidden = host.hidden, wasCapturing = doc.documentElement.hasAttribute('data-at-capturing'); host.hidden = true;
      doc.documentElement.setAttribute('data-at-capturing', '');
      try {
        await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
        return await captureRegion(doc, platform, requestWindow);
      }
      finally {
        if (!wasCapturing) doc.documentElement.removeAttribute('data-at-capturing');
        if (!destroyed) {
          host.hidden = wasHidden || view.kind === 'closed';
          if (!host.hidden) { position(); view.window?.focus(); }
        }
      }
    }
  });
  row.append(queryBox, next, voice, sentenceVoice, detachButton);
  const tabRow = doc.createElement('div'); tabRow.className = 'tabs'; tabRow.setAttribute('role', 'tablist'); tabRow.setAttribute('aria-label', '词典');
  const source = doc.createElement('a'); source.className = 'source'; source.textContent = '网络搜索 ↗'; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.hidden = true;
  const resize = button('拖动调整窗口大小；方向键微调', 'resize');
  const tabs = {}, panels = {}, results = {}, frames = new Map();
  const instanceId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  for (const provider of Object.keys(names)) {
    const tab = button(names[provider], '', names[provider]), panel = doc.createElement('div');
    tab.setAttribute('role', 'tab'); tab.id = `at-tab-${instanceId}-${provider}`; panel.id = `at-panel-${instanceId}-${provider}`;
    tab.setAttribute('aria-controls', panel.id); panel.className = 'panel'; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('click', () => switchTab(provider));
    tabs[provider] = tab; panels[provider] = panel; tabRow.append(tab);
  }
  tabRow.append(source); workspace.dictionaryPane.append(row, tabRow, ...Object.values(panels));
  popup.append(workspace.element, resize); root.append(popup); doc.documentElement.append(host);
  let active = serviceOrder(getSettings(), 'dictionaryOrder')[0], tabOrder = '', generation = 0, timer = null, composing = false, selected = null, destroyed = false, utterance = null;
  let drag = null, placement = null, popupAnchor = null, writingMode = 'horizontal-tb', sizeOverride = null, currentWord = '', ankiContext = null, ankiVisible = false;
  const view = createDictionaryView(platform, getSettings, host, {
    show, onClose: endSession, onEscape: keydown,
    onMove() {
      workspace.rebindDocument();
      // A document move reloads iframe documents; render cached results again.
      for (const [provider, data] of Object.entries(results)) if (data) showResult(provider, data);
    }
  });
  function refreshAnki(restore = true) {
    const enabled = !!getSettings().ankiEnabled;
    sentenceVoice.disabled = !enabled && !ankiContext?.sentence?.trim(); workspace.refresh();
    if (restore && enabled && !ankiVisible && !host.hidden && ankiContext) {
      workspace.open({ ...ankiContext, word: query.value });
      for (const [provider, data] of Object.entries(results)) if (data) workspace.dictionaryResult(provider, data);
    }
    if (!enabled && ankiVisible) workspace.close();
    ankiVisible = enabled;
  }
  const providers = () => serviceOrder(getSettings(), 'dictionaryOrder').filter(name => getSettings()[name === 'weblio' ? 'dictionaryWeblio' : 'dictionaryMoji']);
  let enabledProviders = providers();
  const pending = new Set();
  const status = (provider, text, error = false) => { frames.delete(provider); const element = doc.createElement('p'); element.className = 'status' + (error ? ' error' : ''); element.textContent = text; panels[provider].replaceChildren(element); };
  const updateNext = () => { next.disabled = !selected || selected.end + 1 >= selected.tokens.length || selected.tokens[selected.end + 1]?.pos === '記号'; };
  const updateSearch = () => {
    const url = buildDictionarySearchURL(getSettings().dictionarySearchURL, query.value);
    source.hidden = !url;
    if (url) source.href = url;
    else source.removeAttribute('href');
  };
  function switchTab(provider) {
    const order = serviceOrder(getSettings(), 'dictionaryOrder'), key = order.join(',');
    if (tabOrder !== key) { tabRow.append(...order.map(name => tabs[name]), source); tabOrder = key; }
    const enabled = providers(); if (!enabled.includes(provider)) provider = enabled[0]; active = provider;
    for (const name of Object.keys(names)) {
      tabs[name].hidden = !enabled.includes(name); tabs[name].setAttribute('aria-selected', String(name === active)); tabs[name].tabIndex = name === active ? 0 : -1;
      panels[name].hidden = name !== active;
    }
    updateSearch();
    if (!enabled.length) { panels.weblio.hidden = false; status('weblio', '请在“词典”设置中开启 Weblio 或 MOJi。'); }
  }
  function position() {
    if (host.hidden || view.kind !== 'page' || !popupAnchor) return;
    const viewport = viewportRect(win), settings = getSettings();
    const requested = drag?.size || sizeOverride || { width: clamp(Number(settings.dictionaryPopupWidth) || 424, 220, 1600), height: clamp(Number(settings.dictionaryPopupHeight) || 470, 160, 1600) };
    placement = placeDictionaryPopup(popupAnchor, { left: viewport.left + 8, top: viewport.top + 8, right: Math.max(viewport.left + 9, viewport.right - 8), bottom: Math.max(viewport.top + 9, viewport.bottom - 8) }, requested, writingMode, drag?.side);
    applyPlacement();
  }
  function applyPlacement() {
    const viewport = viewportRect(win);
    placement.left = clamp(placement.left, viewport.left + 8, Math.max(viewport.left + 8, viewport.right - 8 - placement.width));
    placement.top = clamp(placement.top, viewport.top + 8, Math.max(viewport.top + 8, viewport.bottom - 8 - placement.height));
    for (const key of ['width', 'height', 'left', 'top']) host.style.setProperty(key, `${placement[key]}px`, 'important');
    workspace.reflow(placement.width);
    resize.title = `拖动调整窗口大小；方向键微调（${Math.round(placement.width)} × ${Math.round(placement.height)}）`;
  }
  function invalidate(message) {
    clearTimeout(timer); generation++; currentWord = '';
    for (const provider of Object.keys(names)) { results[provider] = null; status(provider, message); }
    switchTab(active);
  }
  function showResult(provider, data) {
    const frame = doc.createElement('iframe'); frame.setAttribute('data-at-ui', ''); frame.title = `${names[provider]} 词条`; frame.setAttribute('referrerpolicy', 'no-referrer');
    // Render static content directly into a scriptless document. This avoids a
    // blocked extension-page navigation leaving an empty about:blank iframe.
    frame.setAttribute('sandbox', 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    const render = () => {
      if (destroyed || !frame.isConnected || panels[provider].firstChild !== frame) return;
      try {
        if (!frame.contentDocument?.body) return;
        renderDictionaryDocument(frame.contentDocument, provider, data, changeQuery, getSettings().nightMode, dismiss);
      } catch (error) { status(provider, '词典显示失败：' + error.message, true); }
    };
    frame.addEventListener('load', render); panels[provider].replaceChildren(frame); render();
    frames.set(provider, { frame });
    if (getSettings().ankiEnabled) workspace.dictionaryResult(provider, data);
  }
  async function lookup(value) {
    const word = value.trim();
    updateSearch();
    if (view.window) view.window.document.title = 'AnonTranslator · ' + word;
    if (getSettings().ankiEnabled) workspace.queryChanged(word);
    if (!word) { invalidate('请输入查询词。'); return; }
    if (word.length > 100) { invalidate('查询词最多 100 个字符。'); return; }
    clearTimeout(timer); currentWord = word; const run = ++generation;
    for (const provider of Object.keys(names)) { results[provider] = null; status(provider, '正在查询…'); }
    switchTab(active);
    enabledProviders = providers();
    await Promise.all(enabledProviders.map(provider => requestProvider(provider, word, run)));
  }
  async function requestProvider(provider, word, run) {
    const key = `${run}:${provider}`;
    if (pending.has(key)) return;
    pending.add(key);
    try {
      const data = await platform.send({ action: 'lookup_word', provider, word });
      if (destroyed || run !== generation) return;
      if (data?.error) throw new Error(data.error);
      results[provider] = data; showResult(provider, data); switchTab(active);
    } catch (error) { if (!destroyed && run === generation) status(provider, error.message || '查询失败', true); }
    finally { pending.delete(key); }
  }
  function changeQuery(word) {
    query.value = String(word || ''); selected = null; onRange(null); updateNext(); updateSearch(); void lookup(query.value);
  }
  function schedule() {
    if (getSettings().ankiEnabled) workspace.queryChanged(query.value.trim());
    selected = null; onRange(null); updateNext(); updateSearch(); invalidate(composing ? '正在输入…' : query.value.trim() ? '正在等待输入完成…' : '请输入查询词。');
    if (!composing && query.value.trim()) timer = setTimeout(() => void lookup(query.value), 250);
  }
  query.addEventListener('input', schedule);
  query.addEventListener('compositionstart', () => { composing = true; schedule(); });
  query.addEventListener('compositionend', () => { composing = false; schedule(); });
  next.addEventListener('click', () => {
    if (next.disabled || !selected) return;
    selected.end++; query.value = selected.text.slice(selected.tokens[selected.start].start, selected.tokens[selected.end].end);
    if (ankiContext) {
      ankiContext = { ...ankiContext, reading: '', selectedText: query.value,
        sentenceRange: [selected.tokens[selected.start].start - ankiContext.sentenceOffset, selected.tokens[selected.end].end - ankiContext.sentenceOffset] };
      if (getSettings().ankiEnabled) workspace.updateSelection(ankiContext);
    }
    onRange([selected.start, selected.end]); updateNext(); void lookup(query.value);
  });
  function saveDisplayedSize(before) {
    const displayed = host.getBoundingClientRect(), patch = {}, settings = getSettings();
    if (Math.abs(displayed.width - before.width) > .5) patch.dictionaryPopupWidth = clamp(Math.round(displayed.width), 220, 1600);
    if (Math.abs(displayed.height - before.height) > .5) patch.dictionaryPopupHeight = clamp(Math.round(displayed.height), 160, 1600);
    if (!Object.keys(patch).length) return;
    const savedSize = { width: patch.dictionaryPopupWidth ?? settings.dictionaryPopupWidth ?? 424, height: patch.dictionaryPopupHeight ?? settings.dictionaryPopupHeight ?? 470 };
    sizeOverride = savedSize;
    Promise.resolve().then(() => platform.setSettings(patch)).catch(error => { if (!destroyed) show(`保存查词窗大小失败：${error.message}`); })
      .finally(() => { if (sizeOverride === savedSize) { sizeOverride = null; if (!destroyed) position(); } });
  }
  function finishResize(save = true) {
    if (!drag) return;
    const before = drag.before, pointerId = drag.pointerId; drag = null;
    host.removeAttribute('data-resizing');
    if (resize.hasPointerCapture(pointerId)) resize.releasePointerCapture(pointerId);
    if (save && !host.hidden) saveDisplayedSize(before);
    if (!host.hidden) position();
  }
  resize.addEventListener('pointerdown', event => {
    if (event.button !== 0 || host.hidden) return;
    event.preventDefault(); event.stopPropagation();
    const before = host.getBoundingClientRect();
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, before, side: placement?.side, size: { width: before.width, height: before.height } };
    host.setAttribute('data-resizing', ''); resize.setPointerCapture(event.pointerId);
  });
  resize.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.size = { width: clamp(drag.before.width + event.clientX - drag.x, 220, 1600), height: clamp(drag.before.height + event.clientY - drag.y, 160, 1600) };
    position(); event.preventDefault();
  });
  resize.addEventListener('pointerup', () => finishResize());
  resize.addEventListener('pointercancel', () => finishResize(false));
  resize.addEventListener('lostpointercapture', () => finishResize());
  resize.addEventListener('keydown', event => {
    if (drag || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const before = host.getBoundingClientRect(), step = event.shiftKey ? 50 : 10;
    drag = { before, side: placement?.side, size: { width: clamp(before.width + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), 220, 1600), height: clamp(before.height + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0), 160, 1600) } };
    position(); drag = null; saveDisplayedSize(before); position();
  });
  let speechJob = null;
  const stopVoice = () => {
    if (speechJob) { speechJob = null; wordSpeaker.stop(); }
    if (utterance) { win.speechSynthesis?.cancel(); utterance = null; }
  };
  function playText(value, kind = 'word') {
    const text = String(value || '').trim(); if (!text) return;
    let settings = getSettings();
    if (settings.ankiEnabled) {
      const service = settings[kind === 'sentence' ? 'ankiSentenceAudioService' : 'ankiWordAudioService'];
      settings = { ...settings, useVITS: service === 'vits', useHuoshTTS: service === 'huosh', useWindowsTTS: false };
    }
    if (settings.useVITS || settings.useHuoshTTS || settings.useWindowsTTS) {
      stopVoice(); const job = {}; speechJob = job;
      void wordSpeaker.speak(text, settings).catch(error => { if (speechJob === job) show(`朗读失败：${error.message}`); })
        .finally(() => { if (speechJob === job) speechJob = null; }); return;
    }
    if (!win.speechSynthesis || !win.SpeechSynthesisUtterance) { show('浏览器不支持系统语音'); return; }
    stopVoice(); utterance = new win.SpeechSynthesisUtterance(text); utterance.lang = 'ja-JP';
    utterance.voice = win.speechSynthesis.getVoices().find(voice => /^ja(?:-|$)/i.test(voice.lang)) || null;
    const spoken = utterance;
    utterance.onend = () => { if (utterance === spoken) utterance = null; };
    utterance.onerror = event => { if (utterance !== spoken) return; utterance = null; if (!['canceled', 'interrupted'].includes(event.error)) show('朗读失败：' + event.error); };
    win.speechSynthesis.speak(utterance);
  }
  voice.addEventListener('click', () => getSettings().ankiEnabled ? workspace.playWord() : playText(query.value));
  sentenceVoice.addEventListener('click', () => getSettings().ankiEnabled ? workspace.playSentence() : playText(ankiContext?.sentence, 'sentence'));
  function endSession() {
    finishResize(false); generation++; clearTimeout(timer); stopVoice(); workspace.close();
    selected = null; popupAnchor = null; placement = null; onRange(null);
  }
  const close = () => view.close();
  function dismiss() { if (close()) onEscape(); }
  function applyMode(mode) {
    finishResize(false);
    const success = view.show(mode);
    resize.hidden = view.independent;
    detachButton.title = view.independent ? '切换为页面浮窗' : '切换为独立窗口 / 底部面板';
    detachButton.setAttribute('aria-label', detachButton.title);
    detachButton.setAttribute('aria-pressed', String(view.independent));
    if (view.window) view.window.document.title = 'AnonTranslator · ' + query.value;
    return success;
  }
  detachButton.addEventListener('click', () => {
    const mode = view.independent ? 'page' : 'independent';
    if (applyMode(mode)) void platform.setSettings({ dictionaryPopupMode: mode }).catch(error => show('保存窗口模式失败：' + error.message));
    position();
  });
  host.addEventListener('click', event => {
    if (view.kind === 'sheet' && !event.composedPath().includes(popup)) { close(); event.stopPropagation(); }
  });
  const outsideClick = event => {
    if (view.kind !== 'page' || doc.documentElement.hasAttribute('data-at-capturing')) return;
    if (event.composedPath().includes(host) || event.target.closest?.('[data-at-ui],.at-word')) return;
    close();
  };
  doc.addEventListener('click', outsideClick, true);
  if (sourceDoc !== doc) sourceDoc.addEventListener('click', outsideClick, true);
  function keydown(event) {
    if (doc.documentElement.hasAttribute('data-at-capturing')) return;
    if (view.kind !== 'closed' && event.key === 'Escape' && !event.isComposing) { dismiss(); event.preventDefault(); event.stopImmediatePropagation(); }
  }
  doc.addEventListener('keydown', keydown, true); root.addEventListener('keydown', keydown);
  if (sourceDoc !== doc) sourceDoc.addEventListener('keydown', keydown, true);
  tabRow.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const enabled = providers(); if (!enabled.length) return;
    event.preventDefault(); const index = enabled.indexOf(active);
    const provider = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1) : enabled[(index + (event.key === 'ArrowRight' ? 1 : enabled.length - 1)) % enabled.length];
    switchTab(provider); tabs[provider].focus();
  });
  return {
    open(tokens, index, text, anchor, point, context = {}) {
      if (destroyed || !tokens[index]) return;
      if (view.kind !== 'closed' && selected?.tokens === tokens && index >= selected.start && index <= selected.end) { close(); return; }
      const token = tokens[index];
      query.value = getSettings().dictionaryBaseForm && token.base && token.base !== '*' ? token.base : token.surface;
      host.toggleAttribute('data-night', !!getSettings().nightMode);
      applyMode(getSettings().dictionaryPopupMode);
      selected = { tokens, start: index, end: index, text };
      popupAnchor = anchorRect(anchor, doc, point);
      writingMode = anchor.ownerDocument.defaultView.getComputedStyle(anchor).writingMode;
      placement = null;
      ankiContext = { sentence: text, selectedText: token.surface, sentenceRange: [token.start, token.end], sentenceOffset: 0, ...context };
      refreshAnki(false);
      if (getSettings().ankiEnabled && ankiVisible) workspace.open({ ...ankiContext, word: query.value });
      updateNext(); onRange([index, index]); switchTab(active); position(); void lookup(query.value);
    },
    close,
    clearSource() {
      // Re-tokenizing releases only the source association of an independent
      // editing session. Explicit close() always closes the whole session.
      if (!view.independent) return close();
      selected = null; onRange(null); updateNext();
    },
    refresh() {
      host.toggleAttribute('data-night', !!getSettings().nightMode); refreshAnki(); updateSearch(); switchTab(active);
      const enabled = providers(), added = enabled.filter(provider => !enabledProviders.includes(provider)); enabledProviders = enabled;
      if (host.hidden) return;
      position();
      if (composing || !currentWord || currentWord !== query.value.trim()) return;
      for (const provider of added) {
        if (results[provider]) { if (!frames.has(provider)) showResult(provider, results[provider]); }
        else { status(provider, '正在查询…'); void requestProvider(provider, currentWord, generation); }
      }
    },
    destroy() {
      if (destroyed) return true;
      if (!view.destroy()) return false;
      destroyed = true; workspace.destroy(); wordSpeaker.destroy(); host.remove();
      doc.removeEventListener('keydown', keydown, true);
      doc.removeEventListener('click', outsideClick, true);
      if (sourceDoc !== doc) { sourceDoc.removeEventListener('keydown', keydown, true); sourceDoc.removeEventListener('click', outsideClick, true); }
      return true;
    }
  };
}
