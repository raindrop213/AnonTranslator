import { defaults } from '../settings/settings.js';
import { siteStorageKey, siteStoragePrefix } from '../settings/site-access.js';
import { gmRequest } from '../services/request.js';
import { cachedTranslation, cancelTranslation } from '../services/translate.js';
import { vitsSpeakers, vitsAudio, huoshanAudio } from '../services/speech.js';
import { checkLatestVersion } from '../services/update.js';
import { createTokenizerData } from '../services/tokenizer-data.js';
import dictionary from '../services/tokenizer-dictionary.json' with { type: 'json' };
import { createUserscriptTokenizerStorage } from './tokenizer-storage.js';
import { lookupWord } from '../services/dictionary.js';
import { createAnkiService } from '../services/anki.js';
import { startApp } from './app.js';

const tokenizerData = createTokenizerData({
  storage: createUserscriptTokenizerStorage({
    getValue: (...args) => GM_getValue(...args), setValue: (...args) => GM_setValue(...args),
    deleteValue: key => GM_deleteValue(key), listValues: () => GM_listValues()
  }, dictionary),
  request: gmRequest
});
const anki = createAnkiService(gmRequest);

const platform = {
  siteURL: location.ancestorOrigins?.length ? location.ancestorOrigins[location.ancestorOrigins.length - 1] : location.href,
  updateURL: 'https://greasyfork.org/zh-CN/scripts/599752-anontranslator',
  useWebAudio: true,
  async getSettings() {
    // Preserve missing selector keys so old boolean audio settings can migrate.
    const keys = [...new Set([...Object.keys(defaults), ...GM_listValues().filter(key => key.startsWith(siteStoragePrefix))])];
    return Object.fromEntries(keys.map(key => [key, GM_getValue(key,
      ['ankiWordAudioService', 'ankiSentenceAudioService', 'ankiTranslationServices', 'ankiTranslationService'].includes(key) ? undefined : defaults[key])]));
  },
  async setSettings(patch) {
    for (const [key, value] of Object.entries(patch)) GM_setValue(key, value);
  },
  async removeSettings(keys) { keys.forEach(key => GM_deleteValue(key)); },
  async getWidgetState() { return GM_getValue('at-widget-position', null); },
  async setWidgetState(state) { GM_setValue('at-widget-position', state); },
  watchSettings(listener) {
    const keys = [...Object.keys(defaults), siteStorageKey(this.siteURL)].filter(Boolean);
    const ids = keys.map(key => GM_addValueChangeListener(key, (_key, _old, value) => listener({ [key]: value })));
    return () => ids.forEach(id => GM_removeValueChangeListener(id));
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
      case 'vits_speakers': return vitsSpeakers(message.settings, gmRequest);
      case 'vits_audio': return vitsAudio(message.text, message.settings, gmRequest);
      case 'huosh_audio': return huoshanAudio(message.text, message.settings, gmRequest);
      default: throw new Error('未知请求');
    }
  },
  async copy(text) { GM_setClipboard(text, 'text'); }
};

startApp(platform).then(app => {
  if (!app || window !== window.top) return;
  GM_registerMenuCommand('AnonTranslator 设置', () => app.openSettings());
}).catch(error => console.error('AnonTranslator:', error));
