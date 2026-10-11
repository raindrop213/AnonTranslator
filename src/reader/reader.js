import { cleanParagraph, wrapSentences, unwrapSentences, sentenceGroups, sentenceElement } from './text.js';
import { colorsFor, speechSwitches, shortcutAction, createSettingsStore } from '../settings/settings.js';
import { createSpeaker } from '../services/speech.js';
import { providerNames } from '../services/translate.js';
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


export function readingViewport(element) {
  const win = element.ownerDocument.defaultView;
  let viewport = { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight };
  for (let node = element.parentElement; node; node = node.parentElement) {
    const style = win.getComputedStyle(node), rect = node.getBoundingClientRect();
    if (style.overflowX !== 'visible') {
      viewport.left = Math.max(viewport.left, rect.left + node.clientLeft);
      viewport.right = Math.min(viewport.right, rect.left + node.clientLeft + node.clientWidth);
    }
    if (style.overflowY !== 'visible') {
      viewport.top = Math.max(viewport.top, rect.top + node.clientTop);
      viewport.bottom = Math.min(viewport.bottom, rect.top + node.clientTop + node.clientHeight);
    }
  }
  // Bibi and EPUB.js expand a chapter iframe to cover many pages, then clip it
  // in the parent reader. Its innerWidth alone does not describe what is visible.
  let frame;
  try { frame = win.frameElement; } catch { /* Cross-origin parent. */ }
  if (frame) {
    const outer = readingViewport(frame), rect = frame.getBoundingClientRect();
    const scaleX = rect.width / frame.offsetWidth, scaleY = rect.height / frame.offsetHeight;
    if (scaleX > 0 && scaleY > 0) {
      const left = rect.left + frame.clientLeft * scaleX, top = rect.top + frame.clientTop * scaleY;
      viewport.left = Math.max(viewport.left, (outer.left - left) / scaleX);
      viewport.right = Math.min(viewport.right, (outer.right - left) / scaleX);
      viewport.top = Math.max(viewport.top, (outer.top - top) / scaleY);
      viewport.bottom = Math.min(viewport.bottom, (outer.bottom - top) / scaleY);
    }
  }
  return viewport;
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
  let hovered = null, hoveredSentence = null, spokenSentence = null, translation = null;
  let auto = false, generation = 0, timer, destroyed = false;
  const listeners = [];
  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };
  const translationScope = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const cancelTranslation = () => platform.send({ action: 'cancel_translation', scope: translationScope }).catch(() => {});
  const outlines = new WeakMap(), speaker = createSpeaker(platform);
  const notice = createReadingNotice(doc);
  const settings = () => store.values;
  const show = text => { if (!destroyed) notice.show(text); };
  const valid = element => element?.isConnected && !element.classList.contains('at-sentence') && !element.closest(editable) && !element.closest('.at-translation') && !element.querySelector('img') && cleanParagraph(element, settings()).text.trim();
  const paragraphAt = event => {
    let element = event.target.closest?.(paragraphSelector);
    // Generated sentence spans must not become targets when users enable span.
    while (element?.classList.contains('at-sentence')) element = element.parentElement?.closest(paragraphSelector);
    return element;
  };
  const restoreOutline = element => {
    if (!element) return;
    for (const [key, value, priority] of outlines.get(element) || []) {
      if (value) element.style.setProperty(key, value, priority);
      else element.style.removeProperty(key);
    }
    outlines.delete(element); element.classList.remove('at-selected');
  };
  const paint = element => {
    if (!element) return;
    if (!outlines.has(element)) outlines.set(element, ['outline', 'border-radius'].map(key => [key, element.style.getPropertyValue(key), element.style.getPropertyPriority(key)]));
    const s = settings(), colors = colorsFor(s), active = element === paragraph;
    element.style.outline = `${s.borderWidth} ${active && mode === 'sentence' ? 'dashed' : s.borderStyle} ${active ? colors.selectedBorderColor : colors.freeBorderColor}`;
    element.style.borderRadius = s.borderRadius;
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
    restoreOutline(hovered); restoreOutline(paragraph);
    clearSelectedSentence(); clearHoverSentence();
    doc.querySelectorAll('.at-split').forEach(unwrapSentences);
    paragraph = hovered = null; mode = 'paragraph';
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
    const s = settings(), providers = providerNames.filter(name => s[name]);
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
    removeTranslation(); clearSelectedSentence();
    if (paragraph !== element) restoreOutline(paragraph);
    paragraph = element; mode = group ? 'sentence' : 'paragraph';
    groups(element); selectedSentence = group;
    paint(paragraph); markSentence(group, 'at-sentence-selected', true);
    scroll(element, group); translate();
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
    let fragment = event.target.closest?.('.at-sentence');
    if (!fragment) {
      const position = doc.caretPositionFromPoint?.(event.clientX, event.clientY);
      const node = position?.offsetNode || doc.caretRangeFromPoint?.(event.clientX, event.clientY)?.startContainer;
      fragment = (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('.at-sentence');
    }
    return fragment && available.find(group => group.index === Number(fragment.dataset.atSentence));
  };
  listen(doc, 'click', event => {
    if (!settings().pluginSwitch || event.target.closest?.(editable + ',.at-translation')) return;
    const image = event.target.closest?.('img,svg image');
    if (settings().extraImage && image) {
      const src = image.currentSrc || image.src || image.getAttribute('href') || image.getAttribute('xlink:href');
      if (src) {
        const url = new URL(src, doc.baseURI);
        if (['http:', 'https:', 'file:', 'blob:'].includes(url.protocol)) window.open(url.href, '_blank', 'noopener');
      }
      return;
    }
    const element = paragraphAt(event);
    if (valid(element)) act(element);
  });
  listen(doc, 'mouseover', event => {
    if (!settings().pluginSwitch || event.target.closest?.(editable + ',.at-translation')) return;
    const element = paragraphAt(event);
    if (hovered !== element) {
      if (hovered !== paragraph) restoreOutline(hovered);
      hovered = valid(element) ? element : null;
      if (hovered) { groups(hovered); paint(hovered); }
    }
    const next = sentenceAt(event);
    if (hoveredSentence?.paragraph !== next?.paragraph || hoveredSentence?.index !== next?.index) {
      clearHoverSentence(); hoveredSentence = next;
      markSentence(next, 'at-sentence-hover', true);
    }
  });
  listen(doc, 'mouseout', event => {
    if (hovered && !hovered.contains(event.relatedTarget)) {
      if (hovered !== paragraph) restoreOutline(hovered);
      hovered = null;
    }
    if (hoveredSentence && !hoveredSentence.fragments.some(fragment => fragment.contains(event.relatedTarget))) clearHoverSentence();
  });
  listen(doc, 'contextmenu', event => {
    if (!settings().pluginSwitch || event.target.closest?.(editable + ',.at-translation')) return;
    const group = sentenceAt(event);
    if (!group) return;
    event.preventDefault(); act(group.paragraph, group);
  });
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
    notice.setColor(s.nightMode ? '#cde0cc' : '#225d2e');
    translation?.querySelectorAll('[data-provider]').forEach(row => { row.style.color = colors[`${row.dataset.provider}Color`]; });
    if (['splitSpeech', ...speechSwitches, 'huoshVoice'].some(key => key in patch)) stop();
    if ('huoshRate' in patch && s.useHuoshTTS) speaker.setPlaybackRate(s.huoshRate);
    if (!s.pluginSwitch) {
      resetSelection();
      notice.hide(); return;
    }
    if ('sentenceDelimiters' in patch) {
      stop(); removeTranslation();
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
    paint(hovered); paint(paragraph);
    if (paragraph && Object.keys(patch).some(key => providerNames.some(name => [name, `${name}From`, `${name}To`].includes(key)) || ['symbolPairs', 'ignoreSymbolPairs'].includes(key))) translate();
  };
  const unsubscribe = store.subscribe(applySettings);
  applySettings(settings());
  const addedMarker = !doc.documentElement.hasAttribute('data-at-reader');
  if (addedMarker) doc.documentElement.setAttribute('data-at-reader', '');
  listen(doc.defaultView, 'pagehide', () => { stop(); cancelTranslation(); notice.hide(); });
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    unsubscribe();
    listeners.splice(0).forEach(remove => remove());
    resetSelection(); notice.hide(); speaker.destroy?.();
    if (addedMarker) doc.documentElement.removeAttribute('data-at-reader');
  };
  return { stop, destroy };
}

export async function startReader(platform) {
  const store = createSettingsStore(platform);
  await store.init();
  return createReader(platform, store);
}
