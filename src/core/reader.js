function createReader(platform, store, doc = document) {
  let paragraphSelector = store.values.targetTags;
  const editable = 'input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[data-at-ui]';
  let paragraph = null, selectedSentence = null, mode = 'paragraph';
  let hovered = null, hoveredSentence = null, spokenSentence = null, translation = null;
  let auto = false, generation = 0, timer, notificationTimer;
  const translationScope = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const cancelTranslation = () => platform.send({ action: 'cancel_translation', scope: translationScope }).catch(() => {});
  const outlines = new WeakMap(), speaker = App.createSpeaker(platform);
  const notice = doc.createElement('div');
  notice.className = 'at-notification'; notice.setAttribute('role', 'status'); notice.setAttribute('data-at-ui', ''); doc.body.append(notice);
  const settings = () => store.values;
  const show = text => {
    notice.textContent = text; notice.classList.add('at-visible');
    clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => notice.classList.remove('at-visible'), 1800);
  };
  const valid = element => element?.isConnected && !element.classList.contains('at-sentence') && !element.closest(editable) && !element.closest('.at-translation') && !element.querySelector('img') && App.cleanParagraph(element, settings()).text.trim();
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
    outlines.delete(element); element.classList.remove('at-hover', 'at-selected', 'at-paragraph-context');
  };
  const paint = element => {
    if (!element) return;
    if (!outlines.has(element)) outlines.set(element, ['outline', 'border-radius'].map(key => [key, element.style.getPropertyValue(key), element.style.getPropertyPriority(key)]));
    const s = settings(), colors = App.colorsFor(s), active = element === paragraph;
    element.style.outline = `${s.borderWidth} ${active && mode === 'sentence' ? 'dashed' : s.borderStyle} ${active ? colors.selectedBorderColor : colors.freeBorderColor}`;
    element.style.borderRadius = s.borderRadius;
    element.classList.toggle('at-selected', active);
    element.classList.toggle('at-paragraph-context', active && mode === 'sentence');
    element.classList.toggle('at-hover', !active);
  };
  const markSentence = (group, className, enabled) => group?.fragments.forEach(fragment => fragment.classList.toggle(className, enabled));
  const clearHoverSentence = () => { markSentence(hoveredSentence, 'at-sentence-hover', false); hoveredSentence = null; };
  const clearSelectedSentence = () => { markSentence(selectedSentence, 'at-sentence-selected', false); selectedSentence = null; };
  const removeTranslation = () => { translation?.remove(); translation = null; };
  const clearSpeechMark = () => { markSentence(spokenSentence, 'at-sentence-speaking', false); spokenSentence = null; };
  const stop = () => { auto = false; generation++; clearTimeout(timer); speaker.stop(); clearSpeechMark(); };
  const groups = element => { App.wrapSentences(element, settings()); return App.sentenceGroups(element); };
  const targetElement = () => mode === 'sentence' && selectedSentence ? App.sentenceElement(selectedSentence) : paragraph;
  const read = async () => {
    const s = settings(), text = App.cleanParagraph(targetElement(), s), run = generation;
    const copying = s.copy ? platform.copy(s.ignoreFurigana ? text.text : text.furigana).then(() => {
      if (s.showCopyContent) show(s.ignoreFurigana ? text.text : text.furigana);
    }).catch(error => show(`复制失败: ${error.message}`)) : Promise.resolve();
    const speak = async () => {
      if (!App.speechSwitches.some(key => s[key])) return;
      const sentences = mode === 'paragraph' && s.splitSpeech ? groups(paragraph) : [];
      const parts = sentences.length ? sentences : [selectedSentence];
      for (const group of parts) {
        if (run !== generation) return;
        if (group && !group.paragraph.isConnected) { stop(); return; }
        clearSpeechMark(); spokenSentence = group;
        markSentence(group, 'at-sentence-speaking', true);
        if (group) scroll(group.paragraph, group);
        const part = group ? App.cleanParagraph(App.sentenceElement(group), s).text : text.text;
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
    const s = settings(), providers = App.providerNames.filter(name => s[name]);
    if (!providers.length || !valid(paragraph)) return;
    const text = App.cleanParagraph(targetElement(), s);
    const container = doc.createElement('span');
    container.className = `at-translation at-${mode}-translation`;
    container.setAttribute('data-at-ui', '');
    if (mode === 'sentence') selectedSentence.fragments.at(-1).after(container);
    else paragraph.append(container);
    translation = container;
    for (const name of providers) {
      const row = doc.createElement('span');
      row.className = 'at-translation-row'; row.dataset.provider = name; row.style.color = App.colorsFor(s)[`${name}Color`];
      row.textContent = `${name}: 翻译中…`; container.append(row);
      platform.send({ action: 'translate', scope: translationScope, translator: name, text: text.text, from: s[`${name}From`], to: s[`${name}To`] }).then(response => {
        if (!container.isConnected || !settings().pluginSwitch) return;
        row.textContent = text.space + (text.pair ? text.pair[0] + response.translatedText + text.pair[1] : response.translatedText);
      }).catch(error => { if (container.isConnected) row.textContent = `${name}: ${error.message}`; });
    }
  };
  const scroll = (element, group = null) => {
    if (settings().scrollSwitch) App.scrollToReadingTarget(element, group, settings().scrollIntoView);
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
  doc.addEventListener('click', event => {
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
  doc.addEventListener('mouseover', event => {
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
  doc.addEventListener('mouseout', event => {
    if (hovered && !hovered.contains(event.relatedTarget)) {
      if (hovered !== paragraph) restoreOutline(hovered);
      hovered = null;
    }
    if (hoveredSentence && !hoveredSentence.fragments.some(fragment => fragment.contains(event.relatedTarget))) clearHoverSentence();
  });
  doc.addEventListener('contextmenu', event => {
    if (!settings().pluginSwitch || event.target.closest?.(editable + ',.at-translation')) return;
    const group = sentenceAt(event);
    if (!group) return;
    event.preventDefault(); act(group.paragraph, group);
  });
  doc.addEventListener('keydown', event => {
    if (!settings().pluginSwitch || event.defaultPrevented || event.isComposing || event.target.closest?.(editable)) return;
    const action = App.shortcutAction(event, settings());
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
      stop(); cancelTranslation(); removeTranslation();
      restoreOutline(hovered); restoreOutline(paragraph);
      clearSelectedSentence(); clearHoverSentence();
      doc.querySelectorAll('.at-split').forEach(App.unwrapSentences);
      paragraph = hovered = null; mode = 'paragraph'; paragraphSelector = s.targetTags;
    }
    const colors = App.colorsFor(s);
    doc.documentElement.style.setProperty('--at-sentence-color', colors.sentenceColor);
    doc.documentElement.style.setProperty('--at-selected-color', colors.selectedBorderColor);
    doc.documentElement.style.setProperty('--at-notice-color', s.nightMode ? '#cde0cc' : '#225d2e');
    translation?.querySelectorAll('[data-provider]').forEach(row => { row.style.color = colors[`${row.dataset.provider}Color`]; });
    if (['splitSpeech', ...App.speechSwitches, 'huoshVoice'].some(key => key in patch)) stop();
    if ('huoshRate' in patch && s.useHuoshTTS) speaker.setPlaybackRate(s.huoshRate);
    if (!s.pluginSwitch) {
      cancelTranslation();
      stop(); restoreOutline(hovered); restoreOutline(paragraph); removeTranslation();
      clearSelectedSentence(); clearHoverSentence(); paragraph = hovered = null; mode = 'paragraph';
      doc.querySelectorAll('.at-split').forEach(App.unwrapSentences);
      notice.classList.remove('at-visible'); return;
    }
    if ('sentenceDelimiters' in patch) {
      stop(); removeTranslation();
      const index = selectedSentence?.index;
      clearSelectedSentence(); clearHoverSentence();
      doc.querySelectorAll('.at-split').forEach(App.unwrapSentences);
      if (paragraph) {
        const available = groups(paragraph);
        selectedSentence = index === undefined ? null : available.find(group => group.index === index) || available.at(-1);
        if (!selectedSentence) mode = 'paragraph';
        markSentence(selectedSentence, 'at-sentence-selected', true); translate();
      }
    }
    paint(hovered); paint(paragraph);
    if (paragraph && Object.keys(patch).some(key => App.providerNames.some(name => [name, `${name}From`, `${name}To`].includes(key)) || ['symbolPairs', 'ignoreSymbolPairs'].includes(key))) translate();
  };
  store.subscribe(applySettings); applySettings(settings());
  window.addEventListener('pagehide', () => { stop(); cancelTranslation(); });
  return { stop };
}
App.createReader = createReader;
