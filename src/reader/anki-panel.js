import { serializeDictionaryContent } from './dictionary-content.js';
import { serviceOrder } from '../settings/settings.js';
import { escapeHTML, plainText } from '../services/anki-fields.js';
const panelCSS = `
:host{display:block;min-width:0;min-height:0;height:100%;--at-anki-accent:#a33b35;color:var(--at-anki-color,#29313b);font:13px/1.35 system-ui,"Microsoft YaHei",sans-serif;writing-mode:horizontal-tb;direction:ltr;color-scheme:light}
*{box-sizing:border-box}.editor{display:flex;flex-direction:column;gap:0;min-height:0;height:100%;padding:0;overflow:hidden;background:var(--at-anki-bg,#fff)}
input,textarea,select{font:inherit;color:inherit;background:transparent;border:0;border-radius:0;min-width:0;outline:none}input:focus,textarea:focus,select:focus{background:var(--at-anki-focus,#faf3f2);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--at-anki-accent) 30%,transparent)}textarea{display:block;width:100%;padding:2px 4px;line-height:1.45;resize:vertical}
button{font:inherit;color:inherit;border:0;border-radius:2px;background:transparent;cursor:pointer;padding:0 4px}button:hover{background:var(--at-anki-hover,#f3e6e3)}button:disabled{opacity:.35;cursor:default}button:focus-visible{outline:1px solid var(--at-anki-accent);outline-offset:-1px}.icon{width:26px;height:26px;min-width:26px;padding:3px;display:grid;place-items:center;flex:none}.icon svg{display:block;width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.add{color:var(--at-anki-accent)}.toolbar{display:flex;align-items:center;gap:0;flex:none;height:27px;border-bottom:1px solid var(--at-anki-line,#e7d6d3)}.reading{flex:1;min-width:0;width:0;height:26px;padding:0 4px;font-size:16px}
.main{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}.main-content{display:flex;align-items:stretch;gap:0;min-height:100%}.fields{flex:1;min-width:0}.sentence-box{min-width:0;border-bottom:1px solid var(--at-anki-line,#e7d6d3)}.fields textarea{height:56px;min-height:40px;max-height:none;resize:vertical}.sidebar{display:flex;flex-direction:column;flex:none;width:32%;max-width:38%;min-width:88px;min-height:76px}.footer{display:flex;align-items:flex-end;gap:0;flex:none;min-height:26px;padding:0}.decks{flex:1;width:0;min-width:0;height:26px;padding:0 4px}.choices{display:flex;gap:2px;flex-direction:column;max-height:140px;overflow:auto}.choice{display:flex;align-items:flex-start;gap:3px;overflow-wrap:anywhere}.choice input{margin:2px 0 0;flex:none;accent-color:var(--at-anki-accent)}.choice span{min-width:0}
.muted{font-size:11px;color:var(--at-anki-muted,#737e8d)}.tags{position:relative;flex:2;min-width:0}.tag-summary{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:2px;min-height:26px;padding:2px 19px 2px 4px;list-style:none;border:0;border-radius:0;cursor:pointer}.tag-summary::-webkit-details-marker{display:none}.tag-summary:after{content:'';position:absolute;right:7px;top:calc(50% - 4px);width:6px;height:6px;border-right:1px solid;border-bottom:1px solid;transform:rotate(45deg)}.tags[open]>.tag-summary:after{top:calc(50% - 1px);transform:rotate(225deg)}.tag-summary:focus-visible{outline:1px solid var(--at-anki-accent);outline-offset:-1px}.tag-chip{min-width:0;max-width:100%;padding:1px 4px;border-radius:2px;background:color-mix(in srgb,var(--at-anki-accent) 12%,transparent);font-size:12px;overflow-wrap:anywhere}.tags>.choices{position:absolute;bottom:100%;left:0;right:0;z-index:5;padding:4px;background:var(--at-anki-bg,#fff);border:0;border-radius:2px;box-shadow:0 2px 8px #0002}.image-area{position:relative;display:flex;flex:1;flex-direction:column;align-items:stretch;justify-content:center;min-width:0;width:100%;min-height:76px;padding:24px 2px 14px;border:0;background:var(--at-anki-image-bg,#fafaf8)}.image-empty{display:grid;place-items:center;flex:1;min-height:28px}.image-tools{position:absolute;right:0;top:0;display:flex;gap:0;height:22px}.image-tools>.icon{width:22px;height:22px;min-width:22px;padding:2px}.image-tools svg{width:16px;height:16px}.thumbnail{position:relative;display:flex;align-items:center;justify-content:center;flex:1;min-height:28px;padding:0;max-width:100%;line-height:0;overflow:hidden}.thumbnail canvas{position:absolute;inset:0;display:block;margin:auto;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}.image-info{position:absolute;bottom:2px;left:3px;max-width:calc(100% - 6px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:var(--at-anki-muted,#737e8d);pointer-events:none}
:host([data-layout=right]) .main-content{flex-direction:column}:host([data-layout=right]) .fields{flex:none;width:100%}:host([data-layout=right]) .sidebar{flex:1 0 88px;width:100%;max-width:none;min-width:0;min-height:88px}:host([data-layout=right]) .image-area{min-height:88px}
.status{padding:0 4px;min-height:15px;font-size:12px;overflow-wrap:anywhere;color:var(--at-anki-muted,#667484)}.status:empty{display:none}.status.error{color:#b34141}.status.success{color:var(--at-anki-success,#347347)}.duplicate{padding:4px;background:var(--at-anki-focus,#faf3f2)}.duplicate p{margin:0 0 3px}.duplicate-actions{display:flex;gap:3px}.duplicate-actions button{flex:1;padding:3px}.duplicate-actions .overwrite{color:var(--at-anki-accent)}
.image-viewer{position:fixed;inset:0;display:grid;place-items:center;z-index:2147483647;background:#000b;padding:35px 15px 15px}.image-viewer canvas{max-width:90vw;max-height:85vh;object-fit:contain;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/16px 16px}.image-close{position:absolute;right:10px;top:5px;font-size:26px;color:#fff;width:30px;height:30px}
:host([data-night]){--at-anki-accent:#e99c91;--at-anki-bg:#252a31;--at-anki-color:#e2e7ed;--at-anki-muted:#b2bdca;--at-anki-border:#566170;--at-anki-hover:#51312e;--at-anki-focus:#352b2b;--at-anki-line:#654743;--at-anki-image-bg:#22272b;--at-anki-success:#98cda8;color-scheme:dark}
[hidden]{display:none!important}
`;

const maxImageBytes = 10 * 1024 * 1024, maxImageSide = 8192, maxImagePixels = 16 * 1024 * 1024;
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const isBlob = value => value && typeof value.arrayBuffer === 'function' && typeof value.size === 'number' && typeof value.type === 'string';
const lines = value => [...new Set(String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
const translationServices = settings => {
  const selected = Array.isArray(settings.ankiTranslationServices) ? settings.ankiTranslationServices : [settings.ankiTranslationService];
  return serviceOrder(settings, 'translationOrder').filter(provider => selected.includes(provider));
};
const translationConfig = settings => JSON.stringify(translationServices(settings).map(provider => [provider, settings[provider + 'From'], settings[provider + 'To']]));
const translationKey = (settings, provider, text) => JSON.stringify([text, settings[provider + 'From'], settings[provider + 'To']]);
export const toHiragana = value => String(value || '').replace(/[\u30a1-\u30f6]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60));

// Format the source once; the editable textarea is the card's Sentence field.
export function sentenceMarkup(context, bold = true) {
  const text = String(context.sentence || ''), selected = String(context.selectedText || context.word || ''), range = context.sentenceRange;
  const start = Array.isArray(range) && Number.isInteger(range[0]) && Number.isInteger(range[1]) && range[0] >= 0 && text.slice(range[0], range[1]) === selected ? range[0] : text.indexOf(selected);
  if (!bold || !selected || start < 0) return escapeHTML(text);
  return escapeHTML(text.slice(0, start)) + '<b>' + escapeHTML(selected) + '</b>' + escapeHTML(text.slice(start + selected.length));
}

// Inspect dimensions before native decoding, including compressed image bombs.
export function imageDimensions(bytes, type) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), ascii = (start, count) => String.fromCharCode(...bytes.subarray(start, start + count));
  if (type === 'image/png' && bytes.length >= 24 && ascii(1, 3) === 'PNG') return { width: view.getUint32(16), height: view.getUint32(20) };
  if (type === 'image/gif' && bytes.length >= 10 && /^GIF8[79]a$/.test(ascii(0, 6))) return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  if (type === 'image/webp' && bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const kind = ascii(12, 4);
    if (kind === 'VP8X') return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
    if (kind === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (kind === 'VP8L' && bytes[20] === 0x2f) return { width: 1 + ((bytes[21] | bytes[22] << 8) & 0x3fff), height: 1 + ((bytes[22] >> 6 | bytes[23] << 2 | bytes[24] << 10) & 0x3fff) };
  }
  if (type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset++] !== 0xff) continue;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
      offset += length;
    }
  }
  throw new Error('图片格式无法识别，请上传 PNG、JPEG、WebP 或 GIF');
}

export function validateImageDimensions({ width, height }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > maxImageSide || height > maxImageSide || width * height > maxImagePixels) throw new Error('图片尺寸过大，请缩小到 8192 像素以内、总计 1600 万像素以内');
}

function base64Bytes(value) {
  const raw = atob(value), bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function bytesBase64(bytes) {
  const parts = [];
  for (let offset = 0; offset < bytes.length; offset += 32768) parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
  return btoa(parts.join(''));
}

export function createAnkiPanel(platform, getSettings, doc = document, { show = () => {}, onLayoutChange = () => {}, onPlayWord = () => {}, onPlaySentence = () => {}, onCapture = null, onAdded = () => {} } = {}) {
  const win = doc.defaultView, element = doc.createElement('div'); element.setAttribute('data-at-ui', ''); element.setAttribute('data-at-anki-panel', '');
  const root = element.attachShadow({ mode: 'open' });
  try { const sheet = new win.CSSStyleSheet(); sheet.replaceSync(panelCSS); root.adoptedStyleSheets = [sheet]; }
  catch { const style = doc.createElement('style'); style.textContent = panelCSS; root.append(style); }
  const create = (tag, className, text, parent) => { const node = doc.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; parent?.append(node); return node; };
  const editor = create('section', 'editor', undefined, root); editor.setAttribute('aria-label', 'Anki 卡片编辑');
  const word = create('span', '', ''), reading = create('input', 'reading'); reading.type = 'text'; reading.placeholder = '平假名读音'; reading.setAttribute('aria-label', '平假名读音'); reading.maxLength = 300;
  const icon = (label, path, parent) => {
    const button = create('button', 'icon', undefined, parent); button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'), shape = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); shape.setAttribute('d', path); svg.append(shape); button.append(svg); return button;
  };
  const toolbar = create('div', 'toolbar', undefined, editor);
  toolbar.append(reading);
  const wordVoice = icon('朗读单词', 'M11 5 6 9H3v6h3l5 4zM15 8c2 2 2 6 0 8M18 5c4 4 4 10 0 14', toolbar);
  const sentenceVoice = icon('朗读例句', 'M3 5h11M3 10h8M3 15h8M3 20h11M16 9l6 6-6 6z', toolbar);
  const undoButton = icon('撤回上一张新建卡片', 'M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12', toolbar);
  const addButton = icon('添加到 Anki', 'M12 3.2l2.7 5.5 6.1.9-4.4 4.3 1.1 6.1L12 17.1l-5.5 2.9 1.1-6.1-4.4-4.3 6.1-.9z', toolbar); addButton.classList.add('add'); addButton.addEventListener('click', event => { if (event.isTrusted) void add(); });
  const main = create('div', 'main', undefined, editor), content = create('div', 'main-content', undefined, main), fields = create('div', 'fields', undefined, content);
  const sentenceBox = create('div', 'sentence-box', undefined, fields), sentence = create('textarea', '', undefined, sentenceBox); sentence.rows = 3; sentence.maxLength = 20000; sentence.setAttribute('aria-label', '例句'); sentence.placeholder = '例句';
  const translation = create('textarea', 'translation', undefined, fields); translation.rows = 3; translation.maxLength = 20000; translation.setAttribute('aria-label', '例句翻译'); translation.placeholder = '例句翻译';
  const sidebar = create('aside', 'sidebar', undefined, content);
  const imageArea = create('div', 'image-area', undefined, sidebar), imageEmpty = create('span', 'muted image-empty', '截图（可选）', imageArea), thumbnail = create('button', 'thumbnail', undefined, imageArea); thumbnail.type = 'button'; thumbnail.title = '放大图片'; thumbnail.setAttribute('aria-label', '放大图片'); thumbnail.hidden = true;
  const thumbnailCanvas = create('canvas', '', undefined, thumbnail), imageInfo = create('span', 'image-info', '', imageArea), tools = create('div', 'image-tools', undefined, imageArea);
  const upload = icon('上传图片', 'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6', tools), clipboard = icon('从剪贴板读取图片', 'M8 4H5v17h14V4h-3M8 2h8v5H8zM8 13l3-3 5 6H8z', tools), capture = icon('框选截图', 'M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 7h10v10H7z', tools), clearImage = icon('清空图片', 'M6 6l12 12M18 6 6 18', tools);
  const footer = create('div', 'footer', undefined, editor);
  const decks = create('select', 'decks', undefined, footer); decks.setAttribute('aria-label', '牌组');
  const tags = create('details', 'tags', undefined, footer); tags.setAttribute('aria-label', '标签');
  const tagSummary = create('summary', 'tag-summary', undefined, tags), tagChoices = create('div', 'choices', undefined, tags);
  const file = create('input', '', undefined, editor); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp,image/gif'; file.hidden = true;
  const duplicate = create('div', 'duplicate', undefined, main); duplicate.hidden = true; duplicate.setAttribute('role', 'alertdialog'); duplicate.setAttribute('aria-label', '处理重复单词');
  const status = create('div', 'status', '', main); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  let context = {}, revision = 0, mediaRevision = 0, readingRevision = 0, readingTimer = null, publishTimer = null, audioTimer = null, audioAttempt = '', readingTouched = false, translationTouched = false, busy = false, mediaBusy = false, opened = false, destroyed = false, image = null, imageCanvas = null, imageFormat = null, viewer = null, duplicateResolve = null, audioContext = null;
  let deck = '', selectedTags = new Set(), configuredDecks = [], configuredTags = [];
  let translationAttempt = '', lastTranslationService = translationConfig(getSettings()), sentenceTouched = false, lastBoldWord = getSettings().ankiBoldWord;
  const translationParts = new Map();
  let undoInfo = { undoAvailable: false, reason: '暂无可撤回的新建卡片' }, undoBusy = false, undoRevision = 0;
  let undoEndpoint = `${getSettings().ankiURL}:${getSettings().ankiModel}`;
  const dictionaries = new Map();
  function publishDraft() {
    clearTimeout(publishTimer); const run = revision;
    if (!opened || destroyed) return;
    publishTimer = setTimeout(() => { if (!opened || destroyed || run !== revision || !word.textContent.trim()) return; void platform.send({ action: 'anki_draft_set', draft: getDraft() }).catch(() => {}); }, 250);
  }
  const notifyLayout = () => { if (!destroyed) onLayoutChange(); };
  const setStatus = (text, kind = '') => { status.textContent = text; status.className = 'status' + (kind ? ' ' + kind : ''); };
  const updateControls = () => {
    for (const control of root.querySelectorAll('input,textarea,select')) control.disabled = busy;
    reading.disabled = busy; addButton.disabled = busy || undoBusy || mediaBusy;
    undoButton.disabled = busy || undoBusy || !undoInfo.undoAvailable;
    undoButton.title = undoInfo.undoAvailable ? `撤回上一张新建卡片${undoInfo.word ? '：' + undoInfo.word : ''}` : undoInfo.reason || '暂无可撤回的新建卡片';
    upload.disabled = clipboard.disabled = busy || mediaBusy; capture.disabled = busy || mediaBusy || !onCapture; clearImage.disabled = busy || !image && !mediaBusy;
    tagSummary.setAttribute('aria-disabled', String(busy));
    editor.setAttribute('aria-busy', String(busy || undoBusy));
  };
  const choice = (container, type, value, checked, change) => {
    const label = create('label', 'choice', undefined, container), input = create('input', '', undefined, label); input.type = type; input.checked = checked; input.value = value;
    create('span', '', value, label); input.addEventListener('change', () => change(input.checked)); return input;
  };
  function renderTagSummary() {
    tagSummary.replaceChildren();
    if (selectedTags.size) for (const value of selectedTags) create('span', 'tag-chip', value, tagSummary);
    else create('span', 'muted', '选择标签', tagSummary);
    tagSummary.setAttribute('aria-label', selectedTags.size ? `标签：${[...selectedTags].join('、')}` : '选择标签');
  }
  const sizeTagMenu = () => {
    if (!tags.open) return;
    const bounds = tagSummary.getBoundingClientRect(), editorBounds = editor.getBoundingClientRect();
    tagChoices.style.maxHeight = `${Math.max(1, Math.min(140, Math.floor(bounds.top - editorBounds.top - 6)))}px`;
  };
  tags.addEventListener('toggle', sizeTagMenu); main.addEventListener('scroll', sizeTagMenu);
  tagSummary.addEventListener('click', event => { if (busy) event.preventDefault(); });
  const closeTagMenu = event => { if (!event.composedPath().includes(tags)) tags.open = false; };
  let eventDoc = doc;
  eventDoc.addEventListener('pointerdown', closeTagMenu, true);
  function rebindDocument() {
    eventDoc.removeEventListener('pointerdown', closeTagMenu, true);
    eventDoc = element.ownerDocument;
    eventDoc.addEventListener('pointerdown', closeTagMenu, true);
  }
  function renderChoices() {
    const settings = getSettings(); configuredDecks = lines(settings.ankiDecks); configuredTags = lines(settings.ankiTags);
    if (deck && !configuredDecks.includes(deck)) configuredDecks.unshift(deck);
    if (!deck) deck = configuredDecks[0] || '';
    decks.replaceChildren();
    for (const value of configuredDecks) { const option = create('option', '', value, decks); option.value = value; option.selected = value === deck; }
    if (!configuredDecks.length) { const option = create('option', '', '选择牌组', decks); option.value = ''; }
    tagChoices.replaceChildren();
    for (const value of new Set([...configuredTags, ...selectedTags])) choice(tagChoices, 'checkbox', value, selectedTags.has(value), checked => { if (checked) selectedTags.add(value); else selectedTags.delete(value); renderTagSummary(); publishDraft(); sizeTagMenu(); });
    if (!configuredTags.length && !selectedTags.size) create('span', 'muted', '可在设置中添加预设标签', tagChoices);
    renderTagSummary(); updateControls(); sizeTagMenu();
  }
  decks.addEventListener('change', () => { deck = decks.value; publishDraft(); });
  function cancelDuplicate() { duplicateResolve?.(null); duplicateResolve = null; duplicate.hidden = true; duplicate.replaceChildren(); }
  function nextDraft() { revision++; mediaRevision++; readingRevision++; clearTimeout(readingTimer); clearTimeout(publishTimer); clearTimeout(audioTimer); audioAttempt = ''; busy = false; mediaBusy = false; cancelDuplicate(); setStatus(''); updateControls(); }
  function prepareAudio() {
    if (!opened || destroyed) return;
    const settings = getSettings(), jobs = [[settings.ankiWordAudioService, word.textContent.trim()], [settings.ankiSentenceAudioService, plainText(sentence.value)]]
      .filter(([provider, text]) => ['vits', 'huosh'].includes(provider) && text.trim());
    const parameters = ['vitsAPI', 'vitsCustomAPI', 'vitsVoice', 'vitsLang', 'length', 'noise', 'noisew', 'max', 'huoshVoice'].map(key => settings[key]);
    const key = JSON.stringify([jobs, parameters]);
    if (key === audioAttempt) return;
    audioAttempt = key; clearTimeout(audioTimer); const run = revision;
    if (jobs.length) audioTimer = setTimeout(() => {
      if (destroyed || !opened || run !== revision) return;
      // Preparation and later playback/export share the provider's audio cache.
      void Promise.allSettled(jobs.map(([provider, text]) => platform.send({ action: provider === 'vits' ? 'vits_audio' : 'huosh_audio', text, settings })));
    }, 700);
  }
  function fetchReading(value) {
    clearTimeout(readingTimer); const run = ++readingRevision;
    readingTimer = setTimeout(async () => {
      try {
        const data = await platform.send({ action: 'tokenize', text: value });
        if (destroyed || !opened || run !== readingRevision || value !== word.textContent || readingTouched) return;
        if (!Array.isArray(data?.tokens)) return;
        if (data.tokens.some(token => /[\p{Script=Han}]/u.test(token.surface) && (!token.reading || token.reading === '*'))) return;
        const result = data.tokens.map(token => token.reading && token.reading !== '*' ? token.reading : token.surface).join('');
        if (result) { reading.value = toHiragana(result); publishDraft(); }
      } catch { /* Dictionary-only lookup is still useful if pronunciation is unknown. */ }
    }, 250);
  }
  reading.addEventListener('input', () => { readingTouched = true; readingRevision++; clearTimeout(readingTimer); publishDraft(); });
  reading.addEventListener('blur', () => { reading.value = toHiragana(reading.value); publishDraft(); });
  sentence.addEventListener('input', () => { sentenceTouched = true; publishDraft(); prepareAudio(); });
  translation.addEventListener('input', () => { translationTouched = true; publishDraft(); });
  async function fetchTranslation() {
    const run = revision, settings = getSettings(), providers = translationServices(settings), config = translationConfig(settings), text = plainText(sentence.value);
    if (!text || translationTouched) return;
    const saved = provider => { const part = translationParts.get(provider); return part?.key === translationKey(settings, provider, text) ? part.text : ''; };
    const attempt = JSON.stringify([run, config, text]);
    if (translationAttempt === attempt) return;
    translationAttempt = attempt;
    const merge = () => { translation.value = providers.map(saved).filter(Boolean).join('\n'); publishDraft(); };
    merge();
    const pending = providers.filter(provider => !saved(provider));
    const results = await Promise.allSettled(pending.map(async translator => {
      const result = await platform.send({ action: 'translate', translator, text, from: settings[translator + 'From'], to: settings[translator + 'To'] });
      if (typeof result?.translatedText !== 'string' || !result.translatedText.trim()) throw new Error('翻译为空');
      return escapeHTML(result.translatedText);
    }));
    if (destroyed || !opened || run !== revision || translationTouched || plainText(sentence.value) !== text || translationConfig(getSettings()) !== config) return;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') translationParts.set(pending[index], { text: result.value, key: translationKey(settings, pending[index], text) });
    });
    merge();
    if (results.some(result => result.status === 'rejected') && !busy && !mediaBusy) setStatus(translation.value.trim() ? '部分例句翻译未取得，可手动补充' : '例句翻译未取得，可直接手动填写');
  }
  wordVoice.addEventListener('click', () => onPlayWord(word.textContent));
  sentenceVoice.addEventListener('click', () => onPlaySentence(plainText(sentence.value)));
  function closeViewer() { viewer?.remove(); viewer = null; }
  thumbnail.addEventListener('click', () => {
    if (!imageCanvas) return; closeViewer(); viewer = create('div', 'image-viewer', undefined, root); viewer.setAttribute('role', 'dialog'); viewer.setAttribute('aria-label', '图片预览');
    const enlarged = create('canvas', '', undefined, viewer); enlarged.width = imageCanvas.width; enlarged.height = imageCanvas.height; enlarged.getContext('2d').drawImage(imageCanvas, 0, 0);
    const close = icon('关闭图片预览', 'M6 6l12 12M18 6 6 18', viewer); close.classList.add('image-close'); close.addEventListener('click', closeViewer); viewer.addEventListener('click', event => { if (event.target === viewer) closeViewer(); }); close.focus();
  });
  function updateThumbnail() {
    thumbnail.hidden = !image; imageEmpty.hidden = !!image; imageInfo.textContent = image ? `${Math.round(image.data.length * .75 / 1024)} KB` : '';
    if (imageCanvas) { const scale = Math.min(1, 160 / imageCanvas.width, 104 / imageCanvas.height); thumbnailCanvas.width = Math.max(1, Math.round(imageCanvas.width * scale)); thumbnailCanvas.height = Math.max(1, Math.round(imageCanvas.height * scale)); thumbnailCanvas.getContext('2d').drawImage(imageCanvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height); }
    else { thumbnailCanvas.width = thumbnailCanvas.height = 1; }
    updateControls(); notifyLayout(); publishDraft();
  }
  const outputFormat = () => ['webp', 'jpeg', 'png'].includes(getSettings().ankiImageFormat) ? getSettings().ankiImageFormat : 'webp';
  async function encodeCanvas(canvas, run) {
    const format = outputFormat(), target = doc.createElement('canvas'); target.width = canvas.width; target.height = canvas.height;
    const drawing = target.getContext('2d'); if (format === 'jpeg') { drawing.fillStyle = '#fff'; drawing.fillRect(0, 0, target.width, target.height); } drawing.drawImage(canvas, 0, 0);
    const blob = await new Promise((resolve, reject) => target.toBlob(result => result ? resolve(result) : reject(new Error('图片编码失败')), `image/${format}`, .88));
    if (blob.size > maxImageBytes) throw new Error('处理后的图片超过 10 MB，请选择 WebP / JPEG 格式或缩小图片');
    const data = bytesBase64(new Uint8Array(await blob.arrayBuffer()));
    if (destroyed || !opened || run !== mediaRevision) return;
    image = { data, mime: blob.type }; imageCanvas = canvas; imageFormat = format; setStatus('图片已准备'); updateThumbnail();
  }
  async function importImage(blob) {
    const run = ++mediaRevision; mediaBusy = true; updateControls(); setStatus('正在处理图片…');
    let bitmap;
    try {
      if (!isBlob(blob) || !imageTypes.has(blob.type)) throw new Error('只支持 PNG、JPEG、WebP 或 GIF 图片');
      if (!blob.size || blob.size > maxImageBytes) throw new Error('图片不能超过 10 MB');
      const bytes = new Uint8Array(await blob.arrayBuffer()); validateImageDimensions(imageDimensions(bytes, blob.type));
      const decode = win.createImageBitmap || globalThis.createImageBitmap;
      if (!decode) throw new Error('浏览器不支持安全解码图片，请更新浏览器');
      bitmap = await decode.call(win, blob); validateImageDimensions(bitmap);
      if (destroyed || !opened || run !== mediaRevision) return;
      const canvas = doc.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext('2d').drawImage(bitmap, 0, 0);
      await encodeCanvas(canvas, run);
    } catch (error) { if (run === mediaRevision && opened && !destroyed) throw error; }
    finally { bitmap?.close(); if (run === mediaRevision) { mediaBusy = false; updateControls(); } }
  }
  const imageError = error => { if (!destroyed && opened) setStatus(error.message || '图片处理失败', 'error'); };
  upload.addEventListener('click', () => { file.value = ''; file.click(); });
  file.addEventListener('change', () => { if (file.files[0]) void importImage(file.files[0]).catch(imageError); });
  clipboard.addEventListener('click', async event => {
    if (!event.isTrusted) return;
    const run = revision, mediaRun = ++mediaRevision; let importStarted = false; mediaBusy = true; updateControls(); setStatus('正在读取剪贴板图片…');
    try {
      let blob;
      if (platform.readClipboardImage) {
        const value = await platform.readClipboardImage();
        if (isBlob(value)) blob = value;
        else if (value?.data && imageTypes.has(value.mime || value.type)) {
          if (value.data.length > Math.ceil(maxImageBytes * 4 / 3) + 8) throw new Error('图片不能超过 10 MB');
          blob = new Blob([base64Bytes(value.data)], { type: value.mime || value.type });
        }
      } else {
        const clipboardAPI = element.ownerDocument.defaultView.navigator.clipboard;
        if (!clipboardAPI?.read) throw new Error('浏览器不允许读取剪贴板图片，请使用上传图片');
        const items = await clipboardAPI.read();
        for (const item of items) { const type = item.types.find(value => imageTypes.has(value)); if (type) { blob = await item.getType(type); break; } }
      }
      if (destroyed || !opened || run !== revision || mediaRun !== mediaRevision) return;
      if (!blob) throw new Error('剪贴板中没有支持的图片，请复制图片或上传图片');
      importStarted = true;
      await importImage(blob);
    } catch (error) { if (run === revision && (mediaRun === mediaRevision || importStarted && mediaRevision === mediaRun + 1)) imageError(new Error(error.name === 'NotAllowedError' ? '剪贴板权限被拒绝，请允许访问或使用上传图片' : error.message)); }
    finally { if (mediaRun === mediaRevision) { mediaBusy = false; updateControls(); } }
  });
  capture.addEventListener('click', async event => {
    if (!event.isTrusted || !onCapture) return;
    const run = revision, mediaRun = ++mediaRevision; let importStarted = false; mediaBusy = true; updateControls(); setStatus('拖动框选截图…');
    try {
      const blob = await onCapture();
      if (destroyed || !opened || run !== revision || mediaRun !== mediaRevision) return;
      if (!blob) { setStatus(''); return; }
      importStarted = true; await importImage(blob);
    } catch (error) { if (run === revision && (mediaRun === mediaRevision || importStarted && mediaRevision === mediaRun + 1)) imageError(error); }
    finally { if (mediaRun === mediaRevision) { mediaBusy = false; updateControls(); } }
  });
  clearImage.addEventListener('click', () => { mediaRevision++; mediaBusy = false; image = imageCanvas = imageFormat = null; closeViewer(); setStatus(''); updateThumbnail(); });
  function getDraft() {
    const orderedDictionaries = serviceOrder(getSettings(), 'dictionaryOrder').map(provider => dictionaries.get(provider)).filter(Boolean).map(value => ({ ...value }));
    return { word: word.textContent.trim(), reading: reading.value, sentence: sentence.value, translation: translation.value,
      deck, tags: [...selectedTags], image: image ? { ...image } : null, dictionaries: orderedDictionaries,
      sourceURL: context.sourceURL, sourceTitle: context.sourceTitle };
  }
  async function refreshUndo() {
    const run = ++undoRevision, settings = getSettings(), endpoint = `${settings.ankiURL}:${settings.ankiModel}`;
    try {
      const info = await platform.send({ action: 'anki_undo_info', settings });
      if (destroyed || run !== undoRevision || endpoint !== `${getSettings().ankiURL}:${getSettings().ankiModel}`) return;
      if (info?.error) throw new Error(info.error);
      undoInfo = { ...info, undoAvailable: !!info?.undoAvailable }; updateControls();
    } catch (error) { if (!destroyed && run === undoRevision) { undoInfo = { undoAvailable: false, reason: error.message }; updateControls(); } }
  }
  function updateUndoFromAdd(result, value) {
    if (destroyed || !['added', 'updated'].includes(result?.status)) return;
    undoRevision++;
    undoInfo = { undoAvailable: !!result.undoAvailable, noteId: result.noteId, word: value, reason: result.undoReason || (result.status === 'updated' ? '覆盖已有卡片不支持撤回' : '暂无可撤回的新建卡片') }; updateControls();
  }
  undoButton.addEventListener('click', async event => {
    if (!event.isTrusted || busy || undoBusy || !undoInfo.undoAvailable) return;
    const run = revision, settings = getSettings(); undoBusy = true; undoRevision++; updateControls();
    try {
      const info = await platform.send({ action: 'anki_undo_info', settings });
      if (destroyed || !opened || run !== revision) return;
      if (settings.ankiURL !== getSettings().ankiURL || settings.ankiModel !== getSettings().ankiModel) { void refreshUndo(); return; }
      if (info?.error) throw new Error(info.error);
      undoInfo = { ...info, undoAvailable: !!info?.undoAvailable };
      if (!undoInfo.undoAvailable) { setStatus(info?.reason || '暂无可撤回的新建卡片'); return; }
      const question = `撤回上一张新建卡片${info.word ? '“' + info.word + '”' : ''}？`;
      if (!element.ownerDocument.defaultView.confirm(question)) return;
      setStatus('正在撤回…');
      const result = await platform.send({ action: 'anki_undo', settings, noteId: info.noteId, confirmed: true });
      if (destroyed) return;
      if (result?.error) throw new Error(result.error);
      if (result?.status !== 'undone') throw new Error('Anki 未确认撤回结果');
      undoInfo = { undoAvailable: false, reason: '上一张新建卡片已撤回，没有更早的撤回记录' };
      if (opened && run === revision) { setStatus('已撤回上一张新建卡片', 'success'); show('已撤回上一张新建卡片'); }
    } catch (error) { if (!destroyed) { if (opened && run === revision) { setStatus(error.message || '撤回失败', 'error'); show(`Anki：${error.message || '撤回失败'}`); } void refreshUndo(); } }
    finally { undoBusy = false; if (!destroyed) updateControls(); }
  });
  function prepareSound() {
    if (!getSettings().ankiSuccessSound) return;
    try { const AudioContext = win.AudioContext || win.webkitAudioContext; if (!audioContext && AudioContext) audioContext = new AudioContext(); if (audioContext?.state === 'suspended') void audioContext.resume().catch(() => {}); } catch { /* A confirmation message is always available. */ }
  }
  function successSound() {
    if (!getSettings().ankiSuccessSound || audioContext?.state !== 'running') return;
    try { const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), start = audioContext.currentTime; oscillator.frequency.value = 880; gain.gain.setValueAtTime(.035, start); gain.gain.exponentialRampToValueAtTime(.001, start + .09); oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + .1); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); }; } catch { /* Do not turn a sound failure into an add failure. */ }
  }
  function duplicateChoice(value) {
    cancelDuplicate(); create('p', '', `“${value}”已存在，如何处理？`, duplicate); const actions = create('div', 'duplicate-actions', undefined, duplicate); duplicate.hidden = false; notifyLayout();
    return new Promise(resolve => {
      duplicateResolve = resolve;
      for (const [text, mode] of [['重复', 'duplicate'], ['覆盖', 'overwrite'], ['放弃', null]]) { const button = create('button', mode === 'overwrite' ? 'overwrite' : '', text, actions); button.type = 'button'; button.addEventListener('click', event => { if (!event.isTrusted) return; duplicateResolve = null; duplicate.hidden = true; resolve(mode); notifyLayout(); }); }
      main.scrollTop = main.scrollHeight - main.clientHeight;
    });
  }
  async function add() {
    if (destroyed || !opened || busy || undoBusy) return null;
    if (mediaBusy) { setStatus('图片正在处理，请稍候'); return null; }
    const draft = getDraft(); if (!draft.word || !draft.deck) { setStatus(draft.word ? '请选择牌组' : '请先选择查询词', 'error'); return null; }
    const run = revision, settings = { ...getSettings() }; busy = true; updateControls(); setStatus('正在添加…'); prepareSound();
    try {
      let result = await platform.send({ action: 'anki_add', settings, draft, duplicateMode: 'ask' });
      updateUndoFromAdd(result, draft.word);
      if (destroyed || !opened || run !== revision) return result;
      if (result?.status === 'duplicate') {
        const mode = await duplicateChoice(draft.word);
        if (!mode || destroyed || !opened || run !== revision) { if (run === revision) setStatus('已放弃添加'); return null; }
        setStatus(mode === 'overwrite' ? '正在覆盖…' : '正在添加重复卡片…');
        result = await platform.send({ action: 'anki_add', settings, draft, duplicateMode: mode });
        updateUndoFromAdd(result, draft.word);
      }
      if (destroyed || !opened || run !== revision) return result;
      if (result?.error) throw new Error(result.error);
      if (!['added', 'updated'].includes(result?.status)) throw new Error('Anki 未确认添加结果，请重试');
      const message = `${result.status === 'updated' ? '已覆盖' : '已添加'}：${draft.word}`;
      setStatus([message, ...(result.warnings || [])].join(' · '), 'success'); show(message); successSound(); onAdded(result); return result;
    } catch (error) { if (!destroyed && opened && run === revision) { setStatus(error.message || '添加失败', 'error'); show(`Anki：${error.message || '添加失败'}`); } return null; }
    finally { if (run === revision) { busy = false; updateControls(); } }
  }
  function refresh() {
    element.toggleAttribute('data-night', !!getSettings().nightMode); element.dataset.layout = getSettings().ankiLayout === 'right' ? 'right' : 'below'; renderChoices();
    if (opened && !sentenceTouched && lastBoldWord !== getSettings().ankiBoldWord) sentence.value = sentenceMarkup(context, getSettings().ankiBoldWord !== false);
    lastBoldWord = getSettings().ankiBoldWord;
    const endpoint = `${getSettings().ankiURL}:${getSettings().ankiModel}`;
    if (endpoint !== undoEndpoint) { undoEndpoint = endpoint; undoRevision++; undoInfo = { undoAvailable: false, reason: 'Anki 连接或模型已变更' }; updateControls(); if (opened) void refreshUndo(); }
    const translationService = translationConfig(getSettings());
    if (opened && translationService !== lastTranslationService) void fetchTranslation();
    lastTranslationService = translationService;
    prepareAudio();
    publishDraft();
    if (opened && imageCanvas && imageFormat !== outputFormat() && !mediaBusy) { const run = ++mediaRevision; mediaBusy = true; updateControls(); void encodeCanvas(imageCanvas, run).catch(error => { if (run === mediaRevision) imageError(error); }).finally(() => { if (run === mediaRevision) { mediaBusy = false; updateControls(); } }); }
  }
  function close() { nextDraft(); opened = false; tags.open = false; closeViewer(); }
  return {
    element, readingInput: reading, addButton, add, getDraft, get busy() { return busy || undoBusy; },
    open(value = {}) {
      nextDraft(); opened = true; tags.open = false; context = { ...value }; word.textContent = String(value.word || ''); reading.value = toHiragana(value.reading || ''); readingTouched = sentenceTouched = false; sentence.value = sentenceMarkup(context, getSettings().ankiBoldWord !== false); translation.value = String(value.translation || '');
      translationParts.clear();
      for (const [provider, text] of Object.entries(value.translationSources || {})) if (['google', 'youdao'].includes(provider) && typeof text === 'string' && text.trim()) translationParts.set(provider, { text: escapeHTML(text), key: translationKey(getSettings(), provider, plainText(sentence.value)) });
      translationTouched = !!translation.value.trim() && !translationParts.size;
      deck = value.deck || lines(getSettings().ankiDecks)[0] || ''; selectedTags = new Set(Array.isArray(value.tags) ? value.tags : []); dictionaries.clear(); image = imageCanvas = imageFormat = null; closeViewer(); updateThumbnail(); refresh();
      if ((value.selectedText && value.selectedText !== value.word) || (!reading.value && word.textContent)) { reading.value = ''; fetchReading(word.textContent); }
      void fetchTranslation(); publishDraft(); void refreshUndo();
    },
    queryChanged(value) {
      value = String(value || ''); if (value === word.textContent) return;
      nextDraft(); word.textContent = value; reading.value = ''; readingTouched = false; dictionaries.clear(); if (value.trim()) fetchReading(value); void fetchTranslation(); prepareAudio(); publishDraft();
    },
    updateSelection(value = {}) {
      if (typeof value.selectedText === 'string') context.selectedText = value.selectedText;
      if (Array.isArray(value.sentenceRange)) context.sentenceRange = [...value.sentenceRange];
      if (!sentenceTouched) sentence.value = sentenceMarkup(context, getSettings().ankiBoldWord !== false);
      publishDraft();
    },
    dictionaryResult(provider, data) {
      if (!opened || destroyed || !['weblio', 'moji'].includes(provider)) return;
      try { dictionaries.set(provider, serializeDictionaryContent(provider, data, doc)); publishDraft(); } catch { /* A dictionary failure does not block a useful card. */ }
    },
    refresh, rebindDocument,
    close,
    reset() { close(); context = {}; word.textContent = reading.value = sentence.value = translation.value = ''; dictionaries.clear(); image = imageCanvas = imageFormat = null; updateThumbnail(); },
    destroy() { if (destroyed) return; close(); destroyed = true; eventDoc.removeEventListener('pointerdown', closeTagMenu, true); element.remove(); reading.remove(); if (audioContext) void audioContext.close().catch(() => {}); }
  };
}
