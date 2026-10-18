import { createSettingsStore } from '../src/settings/settings.js';
import { mountSettings } from '../src/settings/panel.js';
import { chromeServices, serviceOrigins } from '../src/platform/chrome.js';
import { createTokenizerData } from '../src/services/tokenizer-data.js';
import { createChromeTokenizerStorage, createUserscriptTokenizerStorage } from '../src/platform/tokenizer-storage.js';
import dictionary from '../src/services/tokenizer-dictionary.json' with { type: 'json' };
import { fetchRequest } from '../src/services/request.js';
import css from '../src/settings/panel.css';

const userscript = new URLSearchParams(location.search).has('userscript');
document.documentElement.dataset.fixturePlatform = userscript ? 'userscript' : 'chrome';
const style = document.createElement('style'); style.textContent = css; document.head.append(style);
// Use the production files, sizes, hashes and lifecycle. Only the download host
// changes, so browser verification does not depend on an external CDN.
const manifest = { ...dictionary, baseURL: location.origin + '/tokenizer-data/' };

// A real dictionary's Base64 text exceeds localStorage's usual 5 MB quota.
// IndexedDB supplies persistent GM-shaped key/value storage for this fixture.
function fixtureGM() {
  const opening = new Promise((resolve, reject) => {
    const request = indexedDB.open('at-tokenizer-fixture-gm', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('values');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  async function operation(mode, callback) {
    const db = await opening;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('values', mode);
      const request = callback(transaction.objectStore('values'));
      let value;
      request.onsuccess = () => { value = request.result; };
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error || request.error);
      transaction.onabort = () => reject(transaction.error || new Error('GM fixture storage aborted'));
    });
  }
  return {
    async getValue(key, fallback) { const value = await operation('readonly', store => store.get(key)); return value === undefined ? fallback : value; },
    setValue: (key, value) => operation('readwrite', store => store.put(value, key)),
    deleteValue: key => operation('readwrite', store => store.delete(key)),
    listValues: () => operation('readonly', store => store.getAllKeys())
  };
}

const storage = userscript ? createUserscriptTokenizerStorage(fixtureGM(), manifest) : createChromeTokenizerStorage(caches, manifest);
const manager = createTokenizerData({ storage, request: fetchRequest, manifest });
const settingsKey = 'at-tokenizer-fixture:' + (userscript ? 'userscript' : 'chrome') + ':settings';
const initial = { pluginSwitch: true, dictionaryEnabled: false, settingsTab: '词典' };
const readSettings = () => {
  try { return { ...initial, ...JSON.parse(localStorage.getItem(settingsKey) || '{}') }; }
  catch { return { ...initial }; }
};
let saved = readSettings();
const watchers = new Set();
const platform = {
  updateURL: 'https://github.com/raindrop213/AnonTranslator', ankiPreviewURL: '/anki-preview.html',
  async getSettings() { return saved; },
  watchSettings(listener) { watchers.add(listener); },
  async setSettings(patch) {
    saved = { ...readSettings(), ...patch };
    localStorage.setItem(settingsKey, JSON.stringify(saved));
    for (const listener of watchers) listener(patch);
  },
  async send(message) {
    switch (message.action) {
      case 'tokenizer_data_status': return manager.status();
      case 'tokenizer_data_install': return manager.install();
      case 'tokenizer_data_remove': await platform.setSettings({ dictionaryEnabled: false }); return manager.remove();
      case 'tokenize': return manager.tokenize(message.text);
      case 'check_update': return { available: false };
      case 'vits_speakers': return { voices: [] };
      case 'anki_draft_get': return { draft: null };
      default: throw new Error('Fixture does not implement ' + message.action);
    }
  }
};
if (!userscript) Object.assign(platform, {
  servicePermissions: chromeServices, serviceOrigins,
  async hasServiceAccess() { return true; }, async requestServiceAccess() { return true; },
  watchServiceAccess() { return () => {}; }
});
window.addEventListener('storage', event => {
  if (event.key !== settingsKey) return;
  saved = readSettings(); for (const listener of watchers) listener(saved);
});
const store = createSettingsStore(platform); await store.init();
let root = document.body;
if (userscript) {
  const overlay = document.createElement('div'); overlay.className = 'at-dialog';
  root = document.createElement('div'); root.className = 'at-dialog-panel';
  const close = document.createElement('button'); close.className = 'at-close'; close.textContent = '关闭设置';
  close.type = 'button'; close.addEventListener('click', () => { overlay.hidden = true; });
  root.append(close); overlay.append(root); document.body.append(overlay);
}
mountSettings(root, store, platform);
const testGroup = document.createElement('fieldset');
const legend = document.createElement('legend'); legend.textContent = '本地分词验证';
const testActions = document.createElement('div'); testActions.className = 'at-anki-actions';
const verify = document.createElement('button'); verify.type = 'button'; verify.textContent = '验证离线分词';
const result = document.createElement('p'); result.className = 'at-guide'; result.setAttribute('role', 'status');
result.textContent = '安装后可断网测试：猫は濡らした。';
verify.addEventListener('click', async () => {
  verify.disabled = true; result.textContent = '正在从本地数据分词…';
  try {
    const { tokens } = await manager.tokenize('猫は濡らした。');
    const verb = tokens.find(token => token.surface === '濡らし');
    result.textContent = 'base=' + (verb?.base || '未找到动词') + '；' + tokens.map(token => token.surface).join(' / ');
  } catch (error) { result.textContent = error.message; }
  finally { verify.disabled = false; }
});
testActions.append(verify); testGroup.append(legend, testActions, result);
root.querySelector('.at-tokenizer-data').after(testGroup);
