import { chromeServices, serviceOrigins, servicePermissionError } from './chrome.js';
import { normalizeSetting } from '../settings/settings.js';
import { fetchRequest } from '../services/request.js';
import { cachedTranslation, cancelTranslation } from '../services/translate.js';
import { vitsSpeakers, vitsAudio, huoshanAudio, configureAudioCacheStorage } from '../services/speech.js';
import { createPersistentAudioCache } from './audio-cache.js';
import { checkLatestVersion } from '../services/update.js';
import { createTokenizerData } from '../services/tokenizer-data.js';
import dictionary from '../services/tokenizer-dictionary.json' with { type: 'json' };
import { createChromeTokenizerStorage } from './tokenizer-storage.js';
import { lookupWord } from '../services/dictionary.js';
import { createAnkiService, normalizeAnkiURL } from '../services/anki.js';

if (globalThis.caches) configureAudioCacheStorage(createPersistentAudioCache(caches));

const undoKey = 'at-anki-undo';
const anki = createAnkiService(request, { undoStorage: {
  async get() { return (await chrome.storage.session.get(undoKey))[undoKey] || null; },
  async set(record) { if (record) await chrome.storage.session.set({ [undoKey]: record }); else await chrome.storage.session.remove(undoKey); }
} });

const tokenizerData = createTokenizerData({
  storage: createChromeTokenizerStorage(globalThis.caches, dictionary), request
});

async function request(url, options) {
  const address = new URL(url);
  let entry = Object.values(chromeServices).flatMap(service => service.origins.map(origin => ({ service, origin })))
    .find(({ origin }) => { const allowed = new URL(origin); return allowed.protocol === address.protocol && allowed.hostname === address.hostname; });
  if (options?.vitsBase) {
    const base = normalizeSetting('vitsAPI', options.vitsBase);
    if (address.origin !== new URL(base).origin) throw new Error('不支持的 VITS 接口地址');
    entry = { service: chromeServices.vits, origin: serviceOrigins('vits', { vitsAPI: base })[0] };
  }
  if (options?.ankiBase) {
    const base = normalizeAnkiURL(options.ankiBase);
    if (address.href !== base) throw new Error('不支持的 AnkiConnect 接口地址');
    entry = { service: chromeServices.anki, origin: serviceOrigins('anki', { ankiURL: base })[0] };
  }
  if (!entry) throw new Error('不支持的接口地址');
  const { service, origin } = entry;
  if (!await chrome.permissions.contains({ origins: [origin] })) throw servicePermissionError(service, origin);
  try { return await fetchRequest(url, options); }
  catch (error) {
    if (error instanceof TypeError || error.name === 'TypeError') {
      if (!await chrome.permissions.contains({ origins: [origin] })) throw servicePermissionError(service, origin);
      throw new Error(`${service.name} 接口连接失败（${address.hostname}）。请检查网络、代理或 Chrome 的网站访问限制。`, { cause: error });
    }
    throw error;
  }
}

async function senderTab(sender, requireActive = false) {
  if (sender.tab && !requireActive) return sender.tab;
  const [active] = await chrome.tabs.query(sender.tab ? { active: true, windowId: sender.tab.windowId } : { active: true, currentWindow: true });
  if (!active || (sender.tab && active.id !== sender.tab.id)) throw new Error('目标阅读页面已不是当前标签页，请切回该页面重试');
  return active;
}

async function captureVisible(sender) {
  const tab = await senderTab(sender, true);
  const dataURL = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const current = await senderTab(sender, true);
  if (current.id !== tab.id) throw new Error('截图期间标签页发生变化，请重试');
  if (typeof dataURL !== 'string' || !dataURL.startsWith('data:image/png;base64,') || dataURL.length > 32 * 1024 * 1024) throw new Error('截图无效或过大，请改用系统截图');
  return { dataURL };
}

function service(message, sender) {
  switch (message.action) {
    case 'service_access': case 'service_access_request': {
      if (!Object.hasOwn(chromeServices, message.service)) throw new Error('未知接口');
      const permission = { origins: serviceOrigins(message.service, message.settings) };
      return (message.action === 'service_access_request' ? chrome.permissions.request(permission) : chrome.permissions.contains(permission))
        .then(granted => ({ granted }));
    }
    case 'check_update': return checkLatestVersion(request);
    case 'cancel_translation': return cancelTranslation(message.scope);
    case 'translate': return cachedTranslation(message, request);
    case 'tokenize': return tokenizerData.tokenize(message.text);
    case 'tokenizer_data_status': return tokenizerData.status();
    case 'tokenizer_data_install': return tokenizerData.install();
    case 'tokenizer_data_remove': return (async () => {
      await chrome.storage.local.set({ dictionaryEnabled: false });
      return tokenizerData.remove();
    })();
    case 'lookup_word': return lookupWord(message, request);
    case 'anki_info': case 'anki_setup': case 'anki_add': case 'anki_undo_info': case 'anki_undo': return anki.send(message);
    case 'capture_visible_tab': return captureVisible(sender);
    case 'vits_speakers': return vitsSpeakers(message.settings, request);
    case 'vits_audio': return vitsAudio(message.text, message.settings, request);
    case 'huosh_audio': return huoshanAudio(message.text, message.settings, request);
  }
}

let creatingAudioDocument;
const pendingAudio = new Map();
async function forwardAudio(message) {
  let job;
  const pending = pendingAudio.get(message.scope);
  if (message.action === 'play_audio') {
    if (pending) pending.cancelled = true;
    job = { cancelled: false, rate: message.rate };
    pendingAudio.set(message.scope, job);
  } else {
    if (pending && message.action === 'stop_audio') pending.cancelled = true;
    if (pending && message.action === 'audio_rate') pending.rate = message.rate;
  }
  try {
    const documentUrl = chrome.runtime.getURL('offscreen.html');
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [documentUrl] });
    if (job?.cancelled) return {};
    if (!contexts.length) {
      if (message.action !== 'play_audio' && !creatingAudioDocument) return {};
      if (!creatingAudioDocument) {
        creatingAudioDocument = chrome.offscreen.createDocument({
          url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'],
          justification: 'Play VITS and Huoshan speech independently of reading page media policies.'
        });
      }
      try { await creatingAudioDocument; }
      finally { creatingAudioDocument = null; }
    }
    if (job?.cancelled) return {};
    return await chrome.runtime.sendMessage({ ...message, ...(job ? { rate: job.rate } : {}), target: 'offscreen' });
  } finally {
    if (job && pendingAudio.get(message.scope) === job) pendingAudio.delete(message.scope);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen') return false;
  // runtime messaging carries the click's user gesture. Request immediately
  // so an optional custom service can still open Chrome's permission dialog.
  if (message.action === 'service_access_request') {
    try { Promise.resolve(service(message, sender)).then(sendResponse, error => sendResponse({ error: error.message })); }
    catch (error) { sendResponse({ error: error.message }); }
    return true;
  }
  if (message.scope) message = { ...message, scope: JSON.stringify([sender.tab?.id, sender.frameId, message.scope]) };
  const response = Promise.resolve().then(() => ['play_audio', 'stop_audio', 'audio_rate'].includes(message.action)
    ? forwardAudio(message) : service(message, sender));
  response.then(result => sendResponse(result || {}), error => sendResponse({ error: error.message }));
  return true;
});
const notifyServiceAccess = () => {
  void chrome.tabs.query({}).then(tabs => Promise.allSettled(tabs.filter(tab => tab.id != null)
    .map(tab => chrome.tabs.sendMessage(tab.id, { action: 'service_access_changed' }, { frameId: 0 })))).catch(() => {});
};
chrome.permissions.onAdded.addListener(notifyServiceAccess);
chrome.permissions.onRemoved.addListener(notifyServiceAccess);
chrome.action?.onClicked.addListener(tab => {
  if (tab.id != null) void chrome.tabs.sendMessage(tab.id, { action: 'open_settings' }, { frameId: 0 }).catch(() => {});
});
