import { chromeServices, serviceOrigins, servicePermissionError } from './chrome.js';
import { normalizeSetting } from '../settings/settings.js';
import { fetchRequest } from '../services/request.js';
import { cachedTranslation, cancelTranslation } from '../services/translate.js';
import { vitsSpeakers, vitsAudio, huoshanAudio } from '../services/speech.js';
import { checkLatestVersion } from '../services/update.js';

async function request(url, options) {
  const address = new URL(url);
  let entry = Object.values(chromeServices).flatMap(service => service.origins.map(origin => ({ service, origin })))
    .find(({ origin }) => { const allowed = new URL(origin); return allowed.protocol === address.protocol && allowed.hostname === address.hostname; });
  if (options?.vitsBase) {
    const base = normalizeSetting('vitsAPI', options.vitsBase);
    if (address.origin !== new URL(base).origin) throw new Error('不支持的 VITS 接口地址');
    entry = { service: chromeServices.vits, origin: serviceOrigins('vits', { vitsAPI: base })[0] };
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

function service(message) {
  switch (message.action) {
    case 'check_update': return checkLatestVersion(request);
    case 'cancel_translation': return cancelTranslation(message.scope);
    case 'translate': return cachedTranslation(message, request);
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
  if (message.scope) message = { ...message, scope: JSON.stringify([sender.tab?.id, sender.frameId, message.scope]) };
  const response = ['play_audio', 'stop_audio', 'audio_rate'].includes(message.action)
    ? forwardAudio(message) : service(message);
  if (!response) return false;
  Promise.resolve(response).then(sendResponse, error => sendResponse({ error: error.message }));
  return true;
});
