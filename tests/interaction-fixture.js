import { createReader } from '../src/reader/reader.js';
import { createSettingsStore } from '../src/settings/settings.js';
import readerCSS from '../src/reader/reader.css';

const style = document.createElement('style'); style.textContent = readerCSS; document.head.append(style);
const counters = {}, watchers = [], controls = document.querySelector('#controls');
let saved = { pluginSwitch: true, dictionaryEnabled: true, dictionaryFurigana: false, dictionaryWeblio: true, dictionaryMoji: false,
  ankiEnabled: true, ankiSuccessSound: false, ankiTranslationServices: [], ankiWordAudioService: 'none', ankiSentenceAudioService: 'none',
  copy: false, google: false, youdao: false, useWindowsTTS: false, useVITS: false, useHuoshTTS: false,
  scrollSwitch: false, targetTags: 'at-interaction', dictionaryPopupWidth: 360, dictionaryPopupHeight: 410 };
const readings = { 猫: 'ネコ', 図書館: 'トショカン', 本: 'ホン', 読む: 'ヨム', 犬: 'イヌ', 庭: 'ニワ', 遊ぶ: 'アソブ', 今日: 'キョウ', 晴れ: 'ハレ' };
function tokenize(text) {
  return { tokens: [...text.matchAll(/図書館|今日|晴れ|読む|遊ぶ|です|[\s\S]/gu)].map(match => ({
    surface: match[0], start: match.index, end: match.index + match[0].length,
    reading: readings[match[0]] || match[0], base: match[0],
    pos: match[0] === '。' ? '記号' : ['が', 'で', 'を', 'は'].includes(match[0]) ? '助詞' : ['読む', '遊ぶ'].includes(match[0]) ? '動詞' : '名詞'
  })) };
}
function snapshot() {
  const host = document.querySelector('[data-at-dictionary-popup]'), active = document.querySelector('.at-sentence-selected');
  document.querySelector('#state').textContent = JSON.stringify({ mode: store.values.dictionaryPopupMode, phone: document.querySelector('#phone').checked,
    closeAfterAdd: store.values.ankiCloseAfterAdd, popup: host ? (host.hidden ? 'closed' : host.hasAttribute('data-sheet') ? 'sheet' : 'page') : 'independent window',
    selectedParagraph: document.querySelector('at-interaction.at-selected')?.id || null,
    selectedSentence: active?.dataset.atSentence ?? null, tokens: document.querySelectorAll('.at-word').length,
    requests: { tokenize: 0, lookup_word: 0, anki_add: 0, copy: 0, audio: 0, ...counters } }, null, 2);
}
const platform = {
  async getSettings() { return saved; }, watchSettings(listener) { watchers.push(listener); },
  async setSettings(patch) { saved = { ...saved, ...patch }; watchers.forEach(listener => listener(patch)); queueMicrotask(snapshot); },
  async captureVisibleTab() {
    const canvas = document.createElement('canvas'); canvas.width = innerWidth; canvas.height = innerHeight;
    const context = canvas.getContext('2d'); context.fillStyle = '#edf1ec'; context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  },
  async copy() { counters.copy = (counters.copy || 0) + 1; snapshot(); },
  async send(message) {
    counters[message.action] = (counters[message.action] || 0) + 1;
    if (message.action.endsWith('_audio')) counters.audio = (counters.audio || 0) + 1;
    queueMicrotask(snapshot);
    if (message.action === 'tokenize') return tokenize(message.text);
    if (message.action === 'lookup_word') return { url: 'https://www.weblio.jp/content/test', html: '<div class="kijiWrp"><h2>本地测试词典</h2><p>当前词语的固定释义。无需网络。</p></div>' };
    if (message.action === 'anki_undo_info') return { undoAvailable: false };
    if (message.action === 'anki_add') {
      const result = document.querySelector('#anki-result').value;
      if (result === 'error') return { error: '测试添加失败：保留编辑内容' };
      if (result === 'duplicate' && message.duplicateMode === 'ask') return { status: 'duplicate' };
      return { status: result === 'updated' || message.duplicateMode === 'overwrite' ? 'updated' : 'added', noteId: 123, undoAvailable: false };
    }
    return {};
  }
};
const store = createSettingsStore(platform); await store.init(); createReader(platform, store);
const originalMatchMedia = window.matchMedia;
document.querySelector('#phone').addEventListener('change', event => {
  window.matchMedia = event.target.checked ? query => {
    const result = originalMatchMedia.call(window, query);
    return query.replaceAll(' ', '') === '(pointer:coarse)' ? { ...result, media: query, matches: true } : result;
  } : originalMatchMedia;
  snapshot();
});
document.querySelector('#mode').addEventListener('change', event => void store.set('dictionaryPopupMode', event.target.value));
document.querySelector('#close-after-add').addEventListener('change', event => void store.set('ankiCloseAfterAdd', event.target.checked));
document.querySelector('#swap-mouse').addEventListener('change', event => void store.set('swapMouseButtons', event.target.checked));
document.querySelector('#reset-counts').addEventListener('click', () => { for (const key of Object.keys(counters)) delete counters[key]; snapshot(); });
store.subscribe(values => { document.querySelector('#mode').value = values.dictionaryPopupMode; document.querySelector('#close-after-add').checked = values.ankiCloseAfterAdd; });
new MutationObserver(snapshot).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'data-sheet', 'data-window'] });
controls.addEventListener('change', snapshot);
snapshot();
