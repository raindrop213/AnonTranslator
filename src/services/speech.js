import { normalizeSettings } from '../settings/settings.js';
import { fetchRequest } from './request.js';

export function createSpeaker(platform = {}) {
  let generation = 0, audio = null, objectUrl = null, settle = null;
  let playbackRate = 1, playbackScope = null;
  let context = null, source = null;
  const scope = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const setPlaybackRate = rate => {
    playbackRate = rate;
    if (audio) audio.playbackRate = rate;
    if (source) source.playbackRate.value = rate;
    if (playbackScope) Promise.resolve(platform.setAudioRate(rate, playbackScope)).catch(() => {});
  };
  const clearMedia = () => {
    if (audio) {
      audio.onended = audio.onerror = null;
      audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null;
    }
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  };
  const stop = () => {
    generation++;
    clearMedia();
    if (source) {
      source.onended = null;
      try { source.stop(); } catch { /* Already ended. */ }
      source.disconnect(); source = null;
    }
    settle?.(); settle = null;
    window.speechSynthesis?.cancel();
    if (playbackScope) {
      const stoppedScope = playbackScope; playbackScope = null;
      Promise.resolve(platform.stopAudio(stoppedScope)).catch(() => {});
    }
  };
  const prepareBufferPlayback = () => {
    if (!platform.useWebAudio) return;
    // Unlock during the click, before waiting for the speech API.
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!context && AudioContext) context = new AudioContext();
      if (context?.state === 'suspended') void context.resume().catch(() => {});
    } catch { /* Ordinary audio playback remains available. */ }
  };
  const play = async (response, name, current) => {
    if (current !== generation) return;
    // Chrome plays in its own extension document; a reading site's media-src
    // policy otherwise blocks the synthesized Blob even when its API works.
    if (platform.playAudio) {
      playbackScope = `${scope}:${current}`;
      await platform.playAudio({ ...response, name }, playbackRate, playbackScope);
      return;
    }
    let bytes;
    try {
      if (typeof response?.audio !== 'string') throw new Error();
      bytes = Uint8Array.from(atob(response.audio), character => character.charCodeAt(0));
      if (!bytes.length) throw new Error();
    } catch { throw new Error(`${name} 未返回有效音频`); }
    objectUrl = URL.createObjectURL(new Blob([bytes], { type: response.mime || 'audio/mpeg' }));
    audio = new Audio(objectUrl);
    audio.preservesPitch = true;
    audio.playbackRate = playbackRate;
    try {
      await new Promise((resolve, reject) => {
        settle = resolve;
        audio.onended = resolve;
        audio.onerror = () => reject(new Error(`${name} 音频播放失败，请检查音频格式或网页的媒体访问限制`));
        audio.play().catch(error => reject(new Error(error.name === 'NotAllowedError'
          ? '浏览器阻止自动播放，请点击正文后重新朗读'
          : `无法播放${name}音频: ${error.message}`)));
      });
    } catch (error) {
      if (current !== generation) return;
      clearMedia();
      if (!context) throw error;
      // A site's media-src can block Blob audio. Decode the already downloaded
      // bytes instead; no additional media URL or request is needed.
      const buffer = await context.decodeAudioData(bytes.buffer);
      if (current !== generation) return;
      if (context.state !== 'running') throw new Error('浏览器阻止自动播放，请点击正文后重新朗读');
      await new Promise(resolve => {
        settle = resolve;
        source = context.createBufferSource(); source.buffer = buffer;
        source.playbackRate.value = playbackRate;
        source.connect(context.destination); source.onended = resolve; source.start();
      });
    }
  };
  const playAudio = async (response, rate = 1) => {
    stop(); setPlaybackRate(rate);
    const current = generation;
    try { await play(response, response?.name || '语音', current); }
    finally { if (current === generation) stop(); }
  };
  const speak = async (text, settings) => {
    stop();
    const current = generation;
    try {
      if (settings.useVITS || settings.useHuoshTTS) {
        prepareBufferPlayback();
        setPlaybackRate(settings.useHuoshTTS ? settings.huoshRate : 1);
        const name = settings.useHuoshTTS ? '火山语音' : 'VITS';
        const response = await platform.send({ action: settings.useHuoshTTS ? 'huosh_audio' : 'vits_audio', text, settings });
        await play(response, name, current);
      } else if (settings.useWindowsTTS) {
        if (!window.speechSynthesis) throw new Error('浏览器不支持系统语音');
        await new Promise((resolve, reject) => {
          settle = resolve;
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.voice = window.speechSynthesis.getVoices()[settings.winVoice] || null;
          utterance.rate = settings.rate; utterance.pitch = settings.pitch;
          utterance.onend = resolve;
          utterance.onerror = event => ['canceled', 'interrupted'].includes(event.error) ? resolve() : reject(new Error(`系统语音: ${event.error}`));
          window.speechSynthesis.speak(utterance);
        });
      }
    } finally { if (current === generation) stop(); }
  };
  const destroy = () => { stop(); if (context) { void context.close().catch(() => {}); context = null; } };
  return { speak, playAudio, stop, setPlaybackRate, destroy };
}

function audioBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}

// Playback and Anki export share these provider results. Cache the actual wire
// parameters, so changing a voice, language or custom API cannot reuse old audio.
const audioCache = new Map(), audioRequests = new WeakMap();
const audioTTL = 10 * 60 * 1000, audioLimit = 32 * 1024 * 1024;
let audioBytes = 0, nextAudioRequest = 0, audioStorage = null;
export function configureAudioCacheStorage(storage) { audioStorage = storage; }
function removeAudio(key) {
  const entry = audioCache.get(key);
  if (entry) { audioBytes -= entry.bytes; audioCache.delete(key); }
}
function cachedAudio(provider, parameters, request, generate) {
  if (!audioRequests.has(request)) audioRequests.set(request, ++nextAudioRequest);
  const key = JSON.stringify([audioRequests.get(request), provider, parameters]), now = Date.now();
  for (const [stored, entry] of audioCache) if (entry.expires <= now) removeAudio(stored);
  const previous = audioCache.get(key);
  if (previous) { audioCache.delete(key); audioCache.set(key, previous); return previous.promise; }
  const entry = { bytes: key.length * 2, expires: now + audioTTL };
  const persistentKey = JSON.stringify([provider, parameters]);
  entry.promise = Promise.resolve().then(async () => {
    // Chrome's worker can sleep between preview playback and saving a card.
    const storage = audioStorage;
    try { const stored = await storage?.get(persistentKey); if (stored) return stored; } catch { /* Optional cache. */ }
    const result = await generate();
    try { await storage?.set(persistentKey, result); } catch { /* Playback/export still succeeds. */ }
    return result;
  }).then(result => {
    if (audioCache.get(key) === entry) {
      entry.bytes += (result.audio.length + String(result.mime || '').length) * 2;
      audioBytes += (result.audio.length + String(result.mime || '').length) * 2;
      entry.expires = Date.now() + audioTTL;
      trimAudio();
    }
    return Object.freeze(result);
  }).catch(error => { if (audioCache.get(key) === entry) removeAudio(key); throw error; });
  audioCache.set(key, entry); audioBytes += entry.bytes; trimAudio();
  return entry.promise;
}
function trimAudio() {
  while (audioBytes > audioLimit || audioCache.size > 128) removeAudio(audioCache.keys().next().value);
}

export async function vitsSpeakers(settings, request = fetchRequest) {
  const { vitsAPI: base } = normalizeSettings(settings);
  const response = await request(`${base}/voice/speakers`, { vitsBase: base });
  const data = await response.json();
  if (!Array.isArray(data.VITS)) throw new Error('VITS 未返回声音列表');
  return { voices: data.VITS };
}

export async function vitsAudio(text, settings, request = fetchRequest) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('没有提供朗读文本');
  const config = normalizeSettings(settings);
  const base = config.vitsAPI;
  const url = new URL(config.vitsCustomAPI || `${base}/voice/vits`);
  if (!config.vitsCustomAPI) url.search = new URLSearchParams({
    id: config.vitsVoice, lang: config.vitsLang, length: config.length,
    noise: config.noise, noisew: config.noisew, segment_size: config.max, format: 'mp3'
  }).toString();
  url.searchParams.set('text', text);
  return cachedAudio('vits', url.href, request, async () => {
    const response = await request(url.href, { binary: true, timeout: 120000, vitsBase: url.origin });
    const mime = response.headers?.get('content-type') || 'audio/mpeg';
    const buffer = /^(audio\/|application\/octet-stream)/i.test(mime) ? await response.arrayBuffer() : null;
    if (!buffer?.byteLength) throw new Error(config.vitsCustomAPI
      ? 'VITS 未返回音频，请检查完整 API 地址和参数'
      : 'VITS 未返回音频，请检查声音和语言配置');
    return { audio: audioBase64(buffer), mime };
  });
}

export async function huoshanAudio(text, settings, request = fetchRequest) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('没有提供朗读文本');
  const { huoshVoice: speaker } = normalizeSettings(settings);
  const body = JSON.stringify({ text, speaker });
  return cachedAudio('huosh', body, request, async () => {
    const response = await request('https://translate.volcengine.com/crx/tts/v1/', {
      method: 'POST', timeout: 60000,
      headers: {
        Accept: 'application/json, text/plain, */*', 'Accept-Language': 'zh-CN,zh;q=0.9',
        'Content-Type': 'application/json'
      }, body
    });
    const data = await response.json(), audio = data?.audio?.data;
    try {
      if (typeof audio !== 'string' || !audio.trim() || !atob(audio).length) throw new Error();
    } catch { throw new Error('火山语音未返回有效音频'); }
    return { audio, mime: 'audio/mpeg' };
  });
}

// Extension playback is independent of the reading site's media CSP.
export function registerAudioPage() {
  const speakers = new Map();
  const listener = (message, _sender, sendResponse) => {
    if (message.target !== 'offscreen') return false;
    const previous = speakers.get(message.scope);
    if (message.action === 'play_audio') {
      previous?.stop();
      const speaker = createSpeaker();
      speakers.set(message.scope, speaker);
      speaker.playAudio({ audio: message.audio, mime: message.mime, name: message.name }, message.rate)
        .then(() => sendResponse({}), error => sendResponse({ error: error.message }))
        .finally(() => { if (speakers.get(message.scope) === speaker) speakers.delete(message.scope); });
    } else if (message.action === 'stop_audio') {
      previous?.stop(); speakers.delete(message.scope); sendResponse({});
    } else if (message.action === 'audio_rate') {
      previous?.setPlaybackRate(message.rate); sendResponse({});
    } else return false;
    return true;
  };
  const stopAll = () => {
    for (const speaker of speakers.values()) speaker.stop();
    speakers.clear();
  };
  chrome.runtime.onMessage.addListener(listener);
  window.addEventListener('pagehide', stopAll);
}
