import { defaults, createSettingsStore } from '../settings/settings.js';
import { gmRequest } from '../services/request.js';
import { cachedTranslation, cancelTranslation } from '../services/translate.js';
import { vitsSpeakers, vitsAudio, huoshanAudio } from '../services/speech.js';
import { checkLatestVersion } from '../services/update.js';
import { createTokenizerData } from '../services/tokenizer-data.js';
import dictionary from '../services/tokenizer-dictionary.json' with { type: 'json' };
import { createUserscriptTokenizerStorage } from './tokenizer-storage.js';
import { lookupWord } from '../services/dictionary.js';
import { createAnkiService } from '../services/anki.js';
import { serializeAnkiDraft } from './anki-drafts.js';
import { mountReaders } from '../reader/reader.js';
import { mountSettings } from '../settings/panel.js';
import readerCss from '../reader/reader.css';
import panelCss from '../settings/panel.css';

const tokenizerData = createTokenizerData({
  storage: createUserscriptTokenizerStorage({
    getValue: (...args) => GM_getValue(...args), setValue: (...args) => GM_setValue(...args),
    deleteValue: key => GM_deleteValue(key), listValues: () => GM_listValues()
  }, dictionary),
  request: gmRequest
});
const anki = createAnkiService(gmRequest);
let ankiDraft = null;

const platform = {
  updateURL: 'https://greasyfork.org/zh-CN/scripts/599752-anontranslator',
  useWebAudio: true,
  async getSettings() {
    // Preserve missing selector keys so old boolean audio settings can migrate.
    return Object.fromEntries(Object.keys(defaults).map(key => [key, GM_getValue(key,
      ['ankiWordAudioService', 'ankiSentenceAudioService', 'ankiTranslationServices', 'ankiTranslationService'].includes(key) ? undefined : defaults[key])]));
  },
  async setSettings(patch) {
    for (const [key, value] of Object.entries(patch)) GM_setValue(key, value);
  },
  watchSettings(listener) {
    for (const key of Object.keys(defaults)) GM_addValueChangeListener(key, (_key, _old, value) => listener({ [key]: value }));
  },
  async send(message) {
    switch (message.action) {
      case 'check_update': return checkLatestVersion(gmRequest);
      case 'cancel_translation': return cancelTranslation(message.scope);
      case 'translate': return cachedTranslation(message, gmRequest);
      case 'tokenize': return tokenizerData.tokenize(message.text);
      case 'tokenizer_data_status': return tokenizerData.status();
      case 'tokenizer_data_install': return tokenizerData.install();
      case 'tokenizer_data_remove':
        await platform.setSettings({ dictionaryEnabled: false });
        return tokenizerData.remove();
      case 'lookup_word': return lookupWord(message, gmRequest);
      case 'anki_info': case 'anki_setup': case 'anki_add': case 'anki_undo_info': case 'anki_undo': return anki.send(message);
      case 'anki_draft_set': ankiDraft = null; ankiDraft = serializeAnkiDraft(message.draft); return { saved: true };
      case 'anki_draft_get': return { draft: ankiDraft ? JSON.parse(ankiDraft) : null };
      case 'vits_speakers': return vitsSpeakers(message.settings, gmRequest);
      case 'vits_audio': return vitsAudio(message.text, message.settings, gmRequest);
      case 'huosh_audio': return huoshanAudio(message.text, message.settings, gmRequest);
      default: throw new Error('未知请求');
    }
  },
  async copy(text) { GM_setClipboard(text, 'text'); }
};

(async () => {
  // Same-origin chapters share their parent's settings and event handlers.
  if (window.parent !== window) {
    try { if (window.parent.document) return; } catch { /* Independent cross-origin reader. */ }
  }
  const store = createSettingsStore(platform);
  await store.init();
  mountReaders(platform, store, document, readerCss);
  let panel;
  GM_registerMenuCommand('AnonTranslator 设置', () => {
    if (panel) return;
    const host = document.createElement('div');
    host.setAttribute('data-at-ui', '');
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = panelCss;
    const overlay = document.createElement('div'); overlay.className = 'at-dialog';
    const box = document.createElement('div'); box.className = 'at-dialog-panel';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'AnonTranslator 设置');
    const button = document.createElement('button'); button.className = 'at-close'; button.textContent = '关闭 ×';
    const unmount = mountSettings(box, store, platform);
    const close = () => { unmount(); host.remove(); panel = null; document.removeEventListener('keydown', onEscape); };
    const onEscape = event => { if (event.code === 'Escape') close(); };
    button.addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', onEscape);
    box.prepend(button); overlay.append(box); root.append(style, overlay);
    document.documentElement.append(host); panel = host;
    button.focus();
  });
})().catch(error => console.error('AnonTranslator:', error));
