import { wordColorFor } from '../settings/settings.js';
import { createDictionaryPopup } from './dictionary-popup.js';
import { sentenceGroups } from './text.js';
import { providerNames } from '../services/translate.js';

import { hiragana, readingParts } from './word-reading.js';
export { hiragana, readingParts } from './word-reading.js';
const wordCSS = `
  .at-word[data-at-word]{display:inline!important;background-color:color-mix(in srgb,var(--at-word-color,transparent) var(--at-word-opacity,100%),transparent)!important;cursor:pointer!important;filter:none!important;box-shadow:none!important;-webkit-box-decoration-break:clone;box-decoration-break:clone;border-radius:2px;padding:0!important;margin:0!important;line-height:inherit!important;font-size:inherit!important;color:inherit!important}
  .at-word[data-at-word]:hover, .at-word:focus-visible {outline: 1px solid currentColor;outline-offset: 1px;}
  .at-word-active{text-decoration-line:underline!important;text-decoration-thickness:2px!important;text-underline-position:under left!important;text-underline-offset:.08em!important}
  .at-word ruby{display:ruby!important;ruby-position:over;font:inherit!important;line-height:inherit!important;background:none!important;color:inherit!important}
  .at-word rt{display:ruby-text!important;font-size:.5em!important;line-height:1!important;background:none!important;color:inherit!important;opacity:.60!important;user-select:none}
  .at-word-source-reading-hidden{display:none!important}
`;

export function collectWordText(paragraph, group = null) {
  const entries = [], roots = group?.fragments || [paragraph]; let text = '';
  const visit = node => {
    if (node.nodeType === 3) { const start = text.length; text += node.textContent; if (node.textContent) entries.push({ node, start, end: text.length, ruby: node.parentElement?.closest('ruby') }); return; }
    if (node.nodeType !== 1 || node.matches('.at-translation,[data-at-ui],rt,rp,script,style')) return;
    if (node.tagName === 'BR') { text += '\n'; return; }
    node.childNodes.forEach(visit);
  };
  roots.forEach(visit); return { text, entries };
}

function appendTextWithReading(doc, span, token, begin, end, furigana) {
  if (!furigana) { span.textContent = token.surface.slice(begin, end); return; }
  for (const part of readingParts(token.surface, token.reading)) {
    const left = Math.max(begin, part.start), right = Math.min(end, part.end);
    if (left >= right) continue;
    const text = token.surface.slice(left, right);
    // A reading belongs to the whole kanji run; don't invent readings when a
    // word crosses an author-provided element boundary inside that run.
    if (part.reading && left === part.start && right === part.end) {
      const ruby = doc.createElement('ruby'), rt = doc.createElement('rt');
      ruby.append(doc.createTextNode(text)); rt.textContent = part.reading; rt.setAttribute('data-at-generated-reading', ''); ruby.append(rt); span.append(ruby);
    } else span.append(doc.createTextNode(text));
  }
}

export function createWordReader(platform, getSettings, doc = document, { show = () => {}, onEscape = () => {} } = {}) {
  let generation = 0, destroyed = false, current = null, wordSheet = null;
  const records = [], annotations = [], spans = [];
  const style = doc.createElement('style'); style.setAttribute('data-at-ui', ''); style.textContent = wordCSS;
  try { wordSheet = new doc.defaultView.CSSStyleSheet(); wordSheet.replaceSync(wordCSS); doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, wordSheet]; }
  catch { doc.documentElement.append(style); }
  const popup = createDictionaryPopup(platform, getSettings, doc, { show, onEscape, onRange(range) { spans.forEach(span => span.classList.toggle('at-word-active', !!range && Number(span.dataset.atWord) >= range[0] && Number(span.dataset.atWord) <= range[1])); } });
  function clear() {
    generation++;
    if (getSettings().pluginSwitch === false || getSettings().dictionaryEnabled === false) popup.close();
    else popup.clearSource();
    if (current && !current.hadTokenizedClass) current.paragraph.classList.remove('at-tokenized');
    current = null;
    for (const record of records.splice(0).reverse()) {
      // Restore the exact original text nodes; ancestor elements/listeners and
      // existing ruby annotations are never serialized or recreated.
      if (record.start.parentNode) {
        for (const node of record.generated) if (node.parentNode === record.start.parentNode) node.remove();
        record.start.replaceWith(record.node); record.end.remove();
      }
    }
    for (const annotation of annotations.splice(0)) if (!annotation.hadClass) annotation.node.classList.remove('at-word-source-reading-hidden');
    spans.length = 0;
  }
  async function render(paragraph, group = null) {
    clear(); if (destroyed || !getSettings().dictionaryEnabled || !paragraph?.isConnected) return;
    const run = generation, source = collectWordText(paragraph, group);
    if (!source.text.trim()) return;
    let data;
    try { data = await platform.send({ action: 'tokenize', text: source.text }); }
    catch (error) {
      if (destroyed || run !== generation || !paragraph.isConnected || !getSettings().dictionaryEnabled) return;
      throw error;
    }
    if (destroyed || run !== generation || !paragraph.isConnected || !getSettings().dictionaryEnabled) return;
    if (data?.error) throw new Error(data.error);
    const tokens = data?.tokens;
    if (!Array.isArray(tokens)) throw new Error('分词器未返回有效结果');
    // Stale DOM or malformed offsets must not remove any page text.
    if (source.entries.some(entry => !entry.node.isConnected || entry.node.textContent !== source.text.slice(entry.start, entry.end))) return;
    let previousEnd = 0;
    for (const token of tokens) {
      if (!Number.isInteger(token.start) || !Number.isInteger(token.end) || token.start < previousEnd || token.end <= token.start || source.text.slice(token.start, token.end) !== token.surface) throw new Error('分词结果与原文不一致');
      previousEnd = token.end;
    }
    current = { paragraph, group, tokens, text: source.text, hadTokenizedClass: paragraph.classList.contains('at-tokenized') };
    const settings = getSettings();
    let tokenCursor = 0;
    for (const entry of source.entries) {
      while (tokenCursor < tokens.length && tokens[tokenCursor].end <= entry.start) tokenCursor++;
      const overlaps = [];
      for (let index = tokenCursor; index < tokens.length && tokens[index].start < entry.end; index++) overlaps.push({ token: tokens[index], index });
      if (!overlaps.length) continue;
      const replacement = doc.createDocumentFragment(), start = doc.createComment('at-word-start'), end = doc.createComment('at-word-end');
      replacement.append(start); let offset = entry.start;
      for (const { token, index } of overlaps) {
        const left = Math.max(token.start, entry.start), right = Math.min(token.end, entry.end);
        if (left > offset) replacement.append(doc.createTextNode(source.text.slice(offset, left)));
        const span = doc.createElement('span'); span.className = 'at-word'; span.dataset.atWord = String(index); span.dataset.atPos = token.pos || '';
        span.style.setProperty('--at-word-color', token.pos === '記号' ? 'transparent' : wordColorFor(settings, token.pos));
        span.title = [token.pos, token.reading, token.base && token.base !== '*' && token.base !== token.surface ? `基本形：${token.base}` : ''].filter(Boolean).join(' · ');
        if (token.pos !== '記号') { span.setAttribute('role', 'button'); span.setAttribute('aria-label', token.surface); span.tabIndex = 0; }
        appendTextWithReading(doc, span, token, left - token.start, right - token.start, settings.dictionaryFurigana && !entry.ruby);
        replacement.append(span); spans.push(span); offset = right;
      }
      if (offset < entry.end) replacement.append(doc.createTextNode(source.text.slice(offset, entry.end)));
      const generated = [...replacement.childNodes].slice(1);
      replacement.append(end); records.push({ node: entry.node, start, end, generated }); entry.node.replaceWith(replacement);
    }
    if (!settings.dictionaryFurigana) {
      const originalRuby = new Set(source.entries.map(entry => entry.ruby).filter(Boolean));
      for (const ruby of originalRuby) for (const node of ruby.querySelectorAll('rt,rp')) { annotations.push({ node, hadClass: node.classList.contains('at-word-source-reading-hidden') }); node.classList.add('at-word-source-reading-hidden'); }
    }
    if (spans.length) paragraph.classList.add('at-tokenized');
  }
  function handleClick(event) {
    const span = event.target?.closest?.('.at-word');
    if (!span || !spans.includes(span) || !current || !getSettings().dictionaryEnabled) return false;
    const index = Number(span.dataset.atWord), token = current.tokens[index];
    if (token?.pos !== '記号') {
      const groups = sentenceGroups(current.paragraph);
      const group = current.group || groups.find(group => group.index === Number(span.closest('.at-sentence')?.dataset.atSentence));
      let sentence = group ? collectWordText(current.paragraph, group).text : current.text, offset = 0;
      if (!current.group && group) {
        for (let position = current.text.indexOf(sentence); position >= 0; position = current.text.indexOf(sentence, position + 1)) {
          if (position <= token.start && position + sentence.length >= token.end) { offset = position; break; }
        }
      }
      offset += sentence.length - sentence.trimStart().length; sentence = sentence.trim();
      let sentenceRange = [token.start - offset, token.end - offset];
      if (sentence.slice(...sentenceRange) !== token.surface) {
        const start = sentence.indexOf(token.surface); sentenceRange = start < 0 ? null : [start, start + token.surface.length];
      }
      const translated = group?.fragments.at(-1)?.nextElementSibling;
      const translationBox = translated?.matches('.at-sentence-translation') ? translated : groups.length === 1 ? current.paragraph.querySelector('.at-paragraph-translation') : null;
      const translationRows = [...(translationBox?.querySelectorAll('.at-translation-row[data-translated="true"]') || [])].filter(row => row.textContent.trim());
      const translationSources = Object.fromEntries(translationRows.filter(row => providerNames.includes(row.dataset.provider)).map(row => [row.dataset.provider, row.textContent]));
      popup.open(current.tokens, index, current.text, span, { x: event.clientX, y: event.clientY }, {
        word: token.surface, reading: token.reading === '*' ? '' : hiragana(token.reading), sentence,
        translationSources, selectedText: token.surface, sentenceRange, sentenceOffset: offset, sourceURL: doc.location.href, sourceTitle: doc.title
      });
    }
    return true;
  }
  const keydown = event => {
    if (!['Enter', ' '].includes(event.key) || !spans.includes(event.target)) return;
    if (handleClick(event)) { event.preventDefault(); event.stopPropagation(); }
  };
  doc.addEventListener('keydown', keydown, true);
  return {
    render, clear, handleClick,
    refresh() {
      const settings = getSettings();
      spans.forEach(span => span.style.setProperty('--at-word-color', span.dataset.atPos === '記号' ? 'transparent' : wordColorFor(settings, span.dataset.atPos)));
      popup.refresh();
    },
    destroy() {
      if (destroyed) return; clear(); destroyed = true; popup.destroy(); style.remove(); doc.removeEventListener('keydown', keydown, true);
      if (wordSheet) doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter(sheet => sheet !== wordSheet);
    }
  };
}
