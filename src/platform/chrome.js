import { defaults, normalizeSetting } from '../settings/settings.js';

export const chromeServices = {
  google: { name: 'Google', section: '翻译', origins: ['https://translate-pa.googleapis.com/*'] },
  youdao: { name: '有道', section: '翻译', origins: ['https://m.youdao.com/*'] },
  weblio: { name: 'Weblio', section: '词典', origins: ['https://www.weblio.jp/*', 'https://weblio.jp/*', 'https://cdn.weblio.jp/*', 'https://c.weblio.jp/*'] },
  moji: { name: 'MOJi', section: '词典', origins: ['https://api.mojidict.com/*'] },
  anki: { name: 'AnkiConnect', section: 'Anki', origins: ['http://127.0.0.1/*'] },
  vits: { name: 'VITS', section: '语音', origins: ['http://127.0.0.1/*'] },
  huosh: { name: '火山语音', section: '语音', origins: ['https://translate.volcengine.com/*'] },
  update: { name: '版本更新', section: '帮助', origins: ['https://api.github.com/*'] }
};
export function servicePermissionError(service, origin) {
  const error = new Error(`Chrome 未授权访问 ${service.name} 接口（${new URL(origin).hostname}）。请打开扩展设置，在“${service.section}”栏点击“授权 ${service.name} 接口”，然后重试。`);
  error.code = 'HOST_PERMISSION_MISSING';
  return error;
}
export function serviceOrigins(id, settings = defaults) {
  if (id === 'anki') {
    const address = new URL(settings.ankiURL || defaults.ankiURL);
    return [`${address.protocol}//${address.hostname}/*`];
  }
  if (id !== 'vits') return chromeServices[id].origins;
  const custom = normalizeSetting('vitsCustomAPI', settings.vitsCustomAPI || '');
  const address = new URL(custom || normalizeSetting('vitsAPI', settings.vitsAPI ?? defaults.vitsAPI));
  return [`${address.protocol}//${address.hostname}/*`];
}

export const createChromePlatform = () => ({
  updateURL: 'https://chromewebstore.google.com/detail/anontranslator/echegehpmakkcfcadfjljpcallkhpldi',
  ankiPreviewURL: chrome.runtime.getURL('anki-preview.html'),
  servicePermissions: chromeServices,
  serviceOrigins,
  hasServiceAccess(service, settings) { return chrome.permissions.contains({ origins: serviceOrigins(service, settings) }); },
  // Called directly by a popup button, before any await, preserving user activation.
  requestServiceAccess(service, settings) { return chrome.permissions.request({ origins: serviceOrigins(service, settings) }); },
  watchServiceAccess(listener) {
    chrome.permissions.onAdded.addListener(listener);
    chrome.permissions.onRemoved.addListener(listener);
    return () => { chrome.permissions.onAdded.removeListener(listener); chrome.permissions.onRemoved.removeListener(listener); };
  },
  getSettings() { return chrome.storage.local.get(null); },
  async setSettings(patch) { await chrome.storage.local.set(patch); },
  watchSettings(listener) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      listener(Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.newValue])));
    });
  },
  async send(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response) throw new Error('后台未响应，请重新加载扩展和页面');
    if (response.error) throw new Error(response.error);
    return response;
  },
  playAudio(response, rate, scope) {
    return this.send({ action: 'play_audio', ...response, rate, scope });
  },
  stopAudio(scope) { return this.send({ action: 'stop_audio', scope }); },
  setAudioRate(rate, scope) { return this.send({ action: 'audio_rate', rate, scope }); },
  async captureVisibleTab() { return (await this.send({ action: 'capture_visible_tab' })).dataURL; },
  async copy(text) {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); return; } catch { /* Frame policy can deny the modern API. */ }
    }
    // HTTP reading sites lack Clipboard API; clipboardWrite permits legacy copy.
    const active = document.activeElement, selection = document.getSelection();
    const ranges = Array.from({ length: selection?.rangeCount || 0 }, (_, i) => selection.getRangeAt(i).cloneRange());
    const input = document.createElement('textarea');
    input.value = text; input.readOnly = true; input.setAttribute('data-at-ui', '');
    input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.append(input);
    try {
      input.select();
      if (!document.execCommand('copy')) throw new Error('浏览器拒绝复制，请检查扩展的剪贴板权限');
    } finally {
      input.remove(); active?.focus({ preventScroll: true });
      selection?.removeAllRanges(); ranges.forEach(range => selection.addRange(range));
    }
  }
});

