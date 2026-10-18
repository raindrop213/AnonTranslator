import { createSettingsStore } from '../src/settings/settings.js';
import { mountSettings } from '../src/settings/panel.js';
import { chromeServices, serviceOrigins } from '../src/platform/chrome.js';
import css from '../src/settings/panel.css';

const style = document.createElement('style'); style.textContent = css; document.head.append(style);
let saved = { pluginSwitch: true, dictionaryEnabled: true, settingsTab: '词典' };
const watchers = [], platform = {
  updateURL: 'https://github.com/raindrop213/AnonTranslator', servicePermissions: chromeServices, serviceOrigins,
  async getSettings() { return saved; }, watchSettings(listener) { watchers.push(listener); },
  async setSettings(patch) { saved = { ...saved, ...patch }; watchers.forEach(listener => listener(patch)); },
  async hasServiceAccess() { return true; }, async requestServiceAccess() { return true; },
  watchServiceAccess() { return () => {}; },
  async send(message) { return message.action === 'check_update' ? { available: false } : message.action === 'vits_speakers' ? { voices: [] } : {}; }
};
const store = createSettingsStore(platform); await store.init();
let root = document.body;
if (location.search.includes('userscript')) {
  const overlay = document.createElement('div'); overlay.className = 'at-dialog';
  root = document.createElement('div'); root.className = 'at-dialog-panel';
  const close = document.createElement('button'); close.className = 'at-close'; close.textContent = '关闭设置';
  close.addEventListener('click', () => { overlay.hidden = true; });
  root.append(close); overlay.append(root); document.body.append(overlay);
}
mountSettings(root, store, platform);
