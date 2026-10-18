import { readingViewport, topDocument } from './geometry.js';
export { readingViewport } from './geometry.js';
import { cleanParagraph, wrapSentences, unwrapSentences, sentenceGroups, sentenceElement, textAtPoint } from './text.js';
import { colorsFor, speechSwitches, shortcutAction, createSettingsStore, serviceOrder } from '../settings/settings.js';
import { createSpeaker } from '../services/speech.js';
import { providerNames } from '../services/translate.js';
import { createWordReader } from './words.js';
export function createReadingNotice(doc) {
  let hostDocument = doc;
  // EPUB chapters can be wider than the visible page. Keep status messages in
  // the outer reader viewport whenever its document is accessible.
  try {
    while (hostDocument.defaultView.parent !== hostDocument.defaultView) {
      const parent = hostDocument.defaultView.parent.document;
      if (!parent.documentElement) break;
      hostDocument = parent;
    }
  } catch { /* Cross-origin chapters keep their own notification. */ }
  let host = hostDocument.querySelector('[data-at-notice]');
  if (!host?.shadowRoot) {
    host = hostDocument.createElement('div');
    host.className = 'at-notification';
    host.setAttribute('data-at-ui', ''); host.setAttribute('data-at-notice', '');
    host.setAttribute('role', 'status');
    const root = host.attachShadow({ mode: 'open' });
    const style = hostDocument.createElement('style');
    style.textContent = `
      :host { all: initial !important; display: block !important; position: fixed !important;
        bottom: 10px !important; left: 10px !important; max-width: min(600px, 90vw) !important;
        z-index: 2147483646 !important; pointer-events: none !important; opacity: 0 !important;
        transition: opacity .2s !important; }
      :host(.at-visible) { opacity: .5 !important; }
      div { all: initial; display: block; padding: 6px 10px; color: var(--at-notice-color, #225d2e);
        font: 14px/1.5 sans-serif; writing-mode: horizontal-tb; direction: ltr; white-space: pre-wrap;
        overflow-wrap: anywhere; max-height: 30vh; overflow: hidden; }
    `;
    const content = hostDocument.createElement('div');
    root.append(style, content); hostDocument.documentElement.append(host);
  }
  let timer, shownId;
  return {
    show(text) {
      shownId = `${Date.now()}-${Math.random()}`;
      host.dataset.atNoticeId = shownId;
      host.shadowRoot.querySelector('div').textContent = text;
      host.classList.add('at-visible'); clearTimeout(timer);
      timer = setTimeout(() => this.hide(), 1800);
    },
    hide() {
      clearTimeout(timer);
      if (host.dataset.atNoticeId === shownId) host.classList.remove('at-visible');
    },
    setColor(color) { host.style.setProperty('--at-notice-color', color); }
  };
}


// Read individual line rectangles: a multi-column paragraph's bounding box can
// cover several pages, including space where no text is actually visible.
export function scrollToReadingTarget(paragraph, group, behavior) {
  const doc = paragraph.ownerDocument, win = doc.defaultView, viewport = readingViewport(paragraph);
  const fragments = group?.fragments || [paragraph.querySelector('.at-sentence') || paragraph];
  const rects = fragments.flatMap(fragment => [...fragment.getClientRects()]).filter(rect => rect.width && rect.height);
  const visible = rect => rect.left >= viewport.left - 1 && rect.right <= viewport.right + 1 && rect.top >= viewport.top - 1 && rect.bottom <= viewport.bottom + 1;
  if (!rects.length || rects.some(visible)) return;

  const book = paragraph.closest('.book-content');
  const columns = book?.querySelector(':scope > .book-content-container');
  if (doc.location?.hostname === 'reader.ttsu.app' && columns && win.getComputedStyle(columns).columnFill === 'auto') {
    // TTsu maintains a separate page position, so native scrollIntoView desyncs
    // its controls. Invoke its existing window pagination handler instead.
    const vertical = book.classList.contains('book-content--writing-vertical-rl');
    const style = win.getComputedStyle(book), rect = book.getBoundingClientRect();
    const size = parseFloat(style.getPropertyValue(vertical ? '--book-content-child-height' : '--book-content-child-width'));
    const gap = parseFloat(win.getComputedStyle(columns).columnGap) || 0;
    if (size > 0) {
      const target = rects[0];
      const offset = vertical ? target.top - rect.top : target.left - rect.left;
      const pages = Math.floor((offset + 1) / (size + gap));
      for (let i = 0; i < Math.abs(pages); i++) win.dispatchEvent(new win.KeyboardEvent('keydown', { code: pages > 0 ? 'ArrowDown' : 'ArrowUp' }));
      return;
    }
  }
  const rect = paragraph.getBoundingClientRect();
  const fits = rect.width <= viewport.right - viewport.left && rect.height <= viewport.bottom - viewport.top;
  // Ordinary short paragraphs use their paragraph position. Long paragraphs
  // use the sentence's first line and move only as far as needed.
  (fits ? paragraph : fragments[0]).scrollIntoView({ behavior, block: fits ? 'center' : 'nearest', inline: 'nearest' });
}


export function createReader(platform, store, doc = document) {
  let paragraphSelector = store.values.targetTags;
  const editable = 'input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[data-at-ui]';
  let paragraph = null, selectedSentence = null, mode = 'paragraph';
  let hoveredSentence = null, spokenSentence = null, translation = null;
  let auto = false, generation = 0, timer, destroyed = false;
  const listeners = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
      listeners.push(() => {
      // listeners.push(() => target.removeEventListener(type, handler, options));
      try {target.removeEventListener(type, handler, options);} catch (error) {if (!(error instanceof DOMException) || error.name !== 'SecurityError') throw error;}
    });
  };
  const translationScope = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const cancelTranslation = () => platform.send({ action: 'cancel_translation', scope: translationScope }).catch(() => {});
  const speaker = createSpeaker(platform);
  const notice = createReadingNotice(doc);
  const settings = () => store.values;
  const show = text => { if (!destroyed) notice.show(text); };
  const words = createWordReader(platform, settings, doc, { show, onEscape: () => resetSelection() });
  const valid = element => element?.isConnected && !element.matches('.at-sentence,.at-word,[data-at-word]') && !element.closest(editable) && !element.closest('.at-translation') && !element.querySelector('img') && cleanParagraph(element, settings()).text.trim();
  const paragraphAt = event => {
    let element = event.target.closest?.(paragraphSelector);
    // Generated sentence spans must not become targets when users enable span.
    while (element?.matches('.at-sentence,.at-word,[data-at-word],rt,rp') || element?.closest('.at-word')) element = element.parentElement?.closest(paragraphSelector);
    return element;
  };
  const restoreOutline = element => {
    if (!element) return;
    element.classList.remove('at-selected','at-paragraph-block-selected');
    element.querySelectorAll('.at-paragraph-selected').forEach(fragment => fragment.classList.remove('at-paragraph-selected'));
  };
  const paint = element => {
    if (!element) return;
    const active = element === paragraph;
    const available = groups(element);
    element.classList.toggle('at-paragraph-block-selected', !available.length && active && mode === 'paragraph');
    available.forEach(group => group.fragments.forEach(fragment => {
      fragment.classList.toggle('at-paragraph-selected', active && mode === 'paragraph');
    }));
    element.classList.toggle('at-selected', active);
  };
  const markSentence = (group, className, enabled) => group?.fragments.forEach(fragment => fragment.classList.toggle(className, enabled));
  const clearHoverSentence = () => { markSentence(hoveredSentence, 'at-sentence-hover', false); hoveredSentence = null; };
  const clearSelectedSentence = () => { markSentence(selectedSentence, 'at-sentence-selected', false); selectedSentence = null; };
  const removeTranslation = () => { translation?.remove(); translation = null; };
  const clearSpeechMark = () => { markSentence(spokenSentence, 'at-sentence-speaking', false); spokenSentence = null; };
  const stop = () => { auto = false; generation++; clearTimeout(timer); speaker.stop(); clearSpeechMark(); };
  const resetSelection = () => {
    stop(); cancelTranslation(); removeTranslation();
    words.clear();
    restoreOutline(paragraph);
    clearSelectedSentence(); clearHoverSentence();
    doc.querySelectorAll('.at-split').forEach(unwrapSentences);
    paragraph = null; mode = 'paragraph'; notice.hide();
  };
  const groups = element => { wrapSentences(element, settings()); return sentenceGroups(element); };
  const targetElement = () => mode === 'sentence' && selectedSentence ? sentenceElement(selectedSentence) : paragraph;
  const read = async () => {
    const s = settings(), text = cleanParagraph(targetElement(), s), run = generation;
    const copying = s.copy ? platform.copy(s.ignoreFurigana ? text.text : text.furigana).then(() => {
      if (run === generation && settings().pluginSwitch && s.showCopyContent) show(s.ignoreFurigana ? text.text : text.furigana);
    }).catch(error => show(`复制失败: ${error.message}`)) : Promise.resolve();
    const speak = async () => {
      if (!speechSwitches.some(key => s[key])) return;
      const sentences = mode === 'paragraph' && s.splitSpeech ? groups(paragraph) : [];
      const parts = sentences.length ? sentences : [selectedSentence];
      for (const group of parts) {
        if (run !== generation) return;
        if (group && !group.paragraph.isConnected) { stop(); return; }
        clearSpeechMark(); spokenSentence = group;
        markSentence(group, 'at-sentence-speaking', true);
        if (group) scroll(group.paragraph, group);
        const part = group ? cleanParagraph(sentenceElement(group), s).text : text.text;
        await speaker.speak(part, s);
      }
      if (run === generation) clearSpeechMark();
    };
    try { await Promise.all([copying, speak()]); }
    finally { if (run === generation) clearSpeechMark(); }
  };
  const translate = () => {
    removeTranslation();
    cancelTranslation();
    const s = settings(), providers = serviceOrder(s, 'translationOrder').filter(name => s[name]);
    if (!providers.length || !valid(paragraph)) return;
    const text = cleanParagraph(targetElement(), s);
    const container = doc.createElement('span');
    container.className = `at-translation at-${mode}-translation`;
    container.setAttribute('data-at-ui', '');
    if (mode === 'sentence') selectedSentence.fragments.at(-1).after(container);
    else paragraph.append(container);
    translation = container;
    for (const name of providers) {
      const row = doc.createElement('span');
      row.className = 'at-translation-row'; row.dataset.provider = name; row.style.color = colorsFor(s)[`${name}Color`];
      row.textContent = `${name}: 翻译中…`; container.append(row);
      platform.send({ action: 'translate', scope: translationScope, translator: name, text: text.text, from: s[`${name}From`], to: s[`${name}To`] }).then(response => {
        if (!container.isConnected || !settings().pluginSwitch) return;
        row.textContent = text.space + (text.pair ? text.pair[0] + response.translatedText + text.pair[1] : response.translatedText);
      }).catch(error => { if (container.isConnected) row.textContent = `${name}: ${error.message}`; });
    }
  };
  const scroll = (element, group = null) => {
    if (settings().scrollSwitch) scrollToReadingTarget(element, group, settings().scrollIntoView);
  };
  const select = (element, group = null) => {
    words.clear();
    removeTranslation(); clearSelectedSentence(); clearHoverSentence();
    if (paragraph !== element) restoreOutline(paragraph);
    paragraph = element; mode = group ? 'sentence' : 'paragraph';
    groups(element); selectedSentence = group;
    paint(paragraph); markSentence(group, 'at-sentence-selected', true);
    scroll(element, group); translate();
    if (settings().dictionaryEnabled) void words.render(element, group).catch(error => show(`分词失败：${error.message}`));
  };
  const adjacentParagraph = direction => {
    const paragraphs = Array.from(doc.querySelectorAll(paragraphSelector)).filter(valid);
    return paragraphs[paragraphs.indexOf(paragraph) + direction] || null;
  };
  const adjacentSentence = direction => {
    const currentGroups = groups(paragraph);
    if (!selectedSentence) return direction > 0 ? currentGroups[0] : currentGroups.at(-1);
    const index = currentGroups.findIndex(group => group.index === selectedSentence.index);
    if (currentGroups[index + direction]) return currentGroups[index + direction];
    const paragraphs = Array.from(doc.querySelectorAll(paragraphSelector)).filter(valid);
    for (let i = paragraphs.indexOf(paragraph) + direction; i >= 0 && i < paragraphs.length; i += direction) {
      const nextGroups = groups(paragraphs[i]);
      if (nextGroups.length) return direction > 0 ? nextGroups[0] : nextGroups.at(-1);
    }
    return null;
  };
  const move = (kind, direction) => {
    if (kind === 'sentence') {
      const group = adjacentSentence(direction);
      if (!group) return false;
      select(group.paragraph, group);
    } else {
      const next = adjacentParagraph(direction);
      if (!next) return false;
      select(next);
    }
    return true;
  };
  const act = (element, group = null) => {
    stop(); select(element, group);
    const run = generation;
    read().catch(error => { if (run === generation) show(error.message); });
  };
  const beginAuto = () => {
    if (!valid(paragraph)) return;
    stop(); auto = true;
    const run = generation, kind = mode;
    const step = async () => {
      if (!auto || generation !== run) return;
      if (!valid(paragraph)) { stop(); return; }
      try { await read(); }
      catch (error) { if (generation === run) { stop(); show(error.message); } return; }
      if (!auto || generation !== run) return;
      timer = setTimeout(() => {
        if (!auto || generation !== run) return;
        if (!move(kind, 1)) { stop(); return; }
        void step();
      }, settings().readingInterval);
    };
    void step();
  };
  const sentenceAt = event => {
    const element = paragraphAt(event);
    if (!valid(element)) return null;
    const available = groups(element);
    const node = textAtPoint(element, event.clientX, event.clientY);
    const fragment = node?.parentElement?.closest('.at-sentence');
    return fragment && available.find(group => group.index === Number(fragment.dataset.atSentence));
  };
  listen(doc, 'click', event => {
    if (!settings().pluginSwitch || event.target.closest?.(editable + ',.at-translation')) return;
    const token = event.target.closest?.('.at-word');
    if (token && !textAtPoint(token, event.clientX, event.clientY)) return;
    if (words.handleClick(event)) { clearHoverSentence(); stop(); event.preventDefault(); event.stopPropagation(); return; }
    // Active text is now a dictionary surface; only unselected text activates reading.
    if (event.target.closest?.('.at-sentence-selected,.at-paragraph-selected,.at-paragraph-block-selected')) return;
    const image = event.target.closest?.('img,svg image');
    if (settings().extraImage && image) {
      const src = image.currentSrc || image.src || image.getAttribute('href') || image.getAttribute('xlink:href');
      if (src) {
        const url = new URL(src, doc.baseURI);
        if (['http:', 'https:', 'file:', 'blob:'].includes(url.protocol)) window.open(url.href, '_blank', 'noopener');
      }
      return;
    }
    const group = sentenceAt(event);
    if (group) act(group.paragraph, settings().swapMouseButtons ? null : group);
  });
  listen(doc, 'mousemove', event => {
    if (!settings().pluginSwitch || event.target.closest?.(editable + ',.at-translation,.at-word,.at-sentence-selected,.at-paragraph-selected,.at-paragraph-block-selected')) { clearHoverSentence(); return; }
    const next = sentenceAt(event);
    if (hoveredSentence?.paragraph !== next?.paragraph || hoveredSentence?.index !== next?.index) {
      clearHoverSentence(); hoveredSentence = next;
      markSentence(next, 'at-sentence-hover', true);
    }
  });
  listen(doc, 'mouseout', event => {
    if (hoveredSentence && !hoveredSentence.fragments.some(fragment => fragment.contains(event.relatedTarget))) clearHoverSentence();
  });
  listen(doc, 'contextmenu', event => {
    if (!settings().pluginSwitch || event.target.closest?.(editable + ',.at-translation,.at-sentence-selected,.at-paragraph-selected,.at-paragraph-block-selected')) return;
    if (settings().swapMouseButtons) {
      const group = sentenceAt(event);
      if (!group) return;
      event.preventDefault(); act(group.paragraph, group);
      return;
    }
    const element = paragraphAt(event);
    if (!valid(element) || !textAtPoint(element, event.clientX, event.clientY)) return;
    event.preventDefault(); act(element);
  });
  listen(doc, 'keydown', event => {
    if (!settings().pluginSwitch || event.key !== 'Escape' || event.isComposing || doc.documentElement.hasAttribute('data-at-capturing')) return;
    resetSelection();
    // Settings dialogs and editable controls may also use Escape themselves.
    if (!event.target.closest?.(editable)) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  listen(doc, 'keydown', event => {
    if (!settings().pluginSwitch || event.defaultPrevented || event.isComposing || event.target.closest?.(editable)) return;
    const action = shortcutAction(event, settings());
    if (!action) return;
    if (action === 'stop') { event.preventDefault(); event.stopPropagation(); stop(); return; }
    if (!valid(paragraph)) return;
    event.preventDefault();
    // Readers such as TTsu handle arrows on window even after preventDefault.
    // A tool shortcut must not also turn the reader's page a second time.
    event.stopPropagation();
    if (event.repeat) return;
    if (action === 'autoRead') { if (auto) stop(); else beginAuto(); }
    else if (action === 'readCurrent') act(paragraph, mode === 'sentence' ? selectedSentence : null);
    else {
      stop();
      if (move(action.endsWith('Sentence') ? 'sentence' : 'paragraph', action.startsWith('next') ? 1 : -1)) {
        const run = generation;
        read().catch(error => { if (run === generation) show(error.message); });
      }
    }
  });
  const applySettings = (s, patch = {}) => {
    if ('targetTags' in patch) {
      resetSelection(); paragraphSelector = s.targetTags;
    }
    const colors = colorsFor(s);
    doc.documentElement.style.setProperty('--at-sentence-color', colors.sentenceColor);
    doc.documentElement.style.setProperty('--at-word-opacity', `${s.posOpacity ?? 100}%`);
    notice.setColor(s.nightMode ? '#cde0cc' : '#225d2e');
    translation?.querySelectorAll('[data-provider]').forEach(row => { row.style.color = colors[`${row.dataset.provider}Color`]; });
    if ('translationOrder' in patch && translation) {
      for (const provider of serviceOrder(s, 'translationOrder')) {
        const row = translation.querySelector(`[data-provider="${provider}"]`);
        if (row) translation.append(row);
      }
    }
    if (['splitSpeech', ...speechSwitches, 'huoshVoice'].some(key => key in patch)) stop();
    if ('huoshRate' in patch && s.useHuoshTTS) speaker.setPlaybackRate(s.huoshRate);
    if (!s.pluginSwitch) {
      resetSelection();
      notice.hide(); return;
    }
    if ('sentenceDelimiters' in patch) {
      stop(); removeTranslation();
      words.clear();
      const index = selectedSentence?.index;
      clearSelectedSentence(); clearHoverSentence();
      doc.querySelectorAll('.at-split').forEach(unwrapSentences);
      if (paragraph) {
        const available = groups(paragraph);
        selectedSentence = index === undefined ? null : available.find(group => group.index === index) || available.at(-1);
        if (!selectedSentence) mode = 'paragraph';
        markSentence(selectedSentence, 'at-sentence-selected', true); translate();
      }
    }
    paint(paragraph);
    if (['dictionaryEnabled', 'dictionaryFurigana', 'sentenceDelimiters'].some(key => key in patch)) {
      if (s.dictionaryEnabled && paragraph) void words.render(paragraph, mode === 'sentence' ? selectedSentence : null).catch(error => show(`分词失败：${error.message}`));
      else words.clear();
    }
    else if (Object.keys(patch).some(key => key.startsWith('dictionary') || key.startsWith('anki') || /^(night)?[Pp]os.*Color$/.test(key) || key === 'nightMode' || key === 'translationOrder')) words.refresh();
    if (paragraph && Object.keys(patch).some(key => providerNames.some(name => [name, `${name}From`, `${name}To`].includes(key)) || ['symbolPairs', 'ignoreSymbolPairs'].includes(key))) translate();
  };
  const unsubscribe = store.subscribe(applySettings);
  applySettings(settings());
  const addedMarker = !doc.documentElement.hasAttribute('data-at-reader');
  if (addedMarker) doc.documentElement.setAttribute('data-at-reader', '');
  listen(doc.defaultView, 'pagehide', () => { stop(); cancelTranslation(); words.clear(); notice.hide(); });
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    unsubscribe();
    listeners.splice(0).forEach(remove => remove());
    resetSelection(); words.destroy(); notice.hide(); speaker.destroy?.();
    if (addedMarker) doc.documentElement.removeAttribute('data-at-reader');
  };
  return { stop, destroy };
}

export function isReaderUIFrame(doc) {
  if (doc.documentElement?.hasAttribute('data-at-ui')) return true;
  try { return Boolean(doc.defaultView?.frameElement?.hasAttribute('data-at-ui')); }
  catch { return false; } // Inaccessible parent frames can still contain real book text.
}

export async function startReader(platform, doc = document, css = '') {
  // Dictionary about:blank frames inherit content-script matching from the page.
  if (isReaderUIFrame(doc) || topDocument(doc) !== doc) return;
  const store = createSettingsStore(platform);
  await store.init();
  return mountReaders(platform, store, doc, css);
}

// Bind accessible chapters from the outer page's realm. A sandboxed EPUB frame
// must not own the functions which open or close native browser windows.
export function mountReaders(platform, store, rootDoc, css = '') {
  const documents = new Map(), frames = new Map();
  const scan = () => {
    const liveDocuments = new Set(), liveFrames = new Set();
    const visit = doc => {
      if (!doc?.documentElement || isReaderUIFrame(doc) || liveDocuments.has(doc)) return;
      liveDocuments.add(doc);
      if (!documents.has(doc)) {
        let reader, style;
        if (!doc.documentElement.hasAttribute('data-at-reader')) {
          if (css) {
            style = doc.createElement('style'); style.textContent = css;
            (doc.head || doc.documentElement).append(style);
          }
          reader = createReader(platform, store, doc);
        }
        const observer = new MutationObserver(records => {
          const hasFrame = node => node.nodeType === 1 && (node.matches('iframe,frame') || node.querySelector('iframe,frame'));
          if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(hasFrame))) scan();
        });
        observer.observe(doc.documentElement, { childList: true, subtree: true });
        documents.set(doc, { reader, observer, style });
      }
      for (const frame of doc.querySelectorAll('iframe,frame')) {
        if (frame.hasAttribute('data-at-ui')) continue;
        liveFrames.add(frame);
        if (!frames.has(frame)) { frame.addEventListener('load', scan); frames.set(frame, scan); }
        try { visit(frame.contentDocument); } catch { /* Cross-origin frames initialize independently. */ }
      }
    };
    visit(rootDoc);
    for (const [doc, entry] of documents) {
      if (liveDocuments.has(doc)) continue;
      entry.observer.disconnect(); entry.reader?.destroy(); entry.style?.remove(); documents.delete(doc);
    }
    for (const [frame, listener] of frames) {
      if (liveFrames.has(frame)) continue;
      frame.removeEventListener('load', listener); frames.delete(frame);
    }
  };
  scan();
  return { destroy() {
    for (const entry of documents.values()) { entry.observer.disconnect(); entry.reader?.destroy(); entry.style?.remove(); }
    for (const [frame, listener] of frames) frame.removeEventListener('load', listener);
    documents.clear(); frames.clear();
  } };
}
