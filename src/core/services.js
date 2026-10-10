// Start Youdao first and keep its row first; providers run independently.
const providerNames = ['youdao', 'google'];
const youdaoHeaders = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
};

function httpError(status) {
  const error = new Error(`HTTP ${status}`);
  error.status = status;
  return error;
}
async function fetchRequest(url, options = {}) {
  const { timeout = 30000, binary: _binary, vitsBase: _vitsBase, signal, ...init } = options;
  const deadline = AbortSignal.timeout(timeout);
  const response = await fetch(url, { ...init, signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
  if (!response.ok) throw httpError(response.status);
  return response;
}
function decodeHtml(text) {
  return unescapeHtml(text.replace(/<[^>]*>/g, ''));
}
function unescapeHtml(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return value <= 0x10ffff ? String.fromCodePoint(value) : entity;
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[code.toLowerCase()];
  });
}

// Split at punctuation where possible, with a hard cap for unpunctuated text.
function translationChunks(text, limit) {
  const characters = Array.from(text);
  const chunks = [];
  while (characters.length) {
    let end = Math.min(limit, characters.length);
    if (end < characters.length) {
      for (let i = end - 1; i >= Math.floor(end / 2); i--) {
        if (/[。！？!?；;\n]/.test(characters[i])) { end = i + 1; break; }
      }
    }
    chunks.push(characters.splice(0, end).join(''));
  }
  return chunks;
}
async function youdaoChunk(text, from, to, request) {
  try {
    const response = await request('https://m.youdao.com/translate', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...youdaoHeaders },
      body: new URLSearchParams({ inputtext: text, type: `${from}2${to}` }).toString()
    });
    const html = await response.text();
    const result = html.match(/<ul id="translateResult">([\s\S]*?)<\/ul>/)?.[1];
    const rows = result && [...result.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)];
    if (!rows?.length) throw new Error('有道未返回翻译结果');
    return rows.map(row => decodeHtml(row[1])).join('\n');
  } catch (error) {
    if (error.status !== 413 || Array.from(text).length < 2) throw error;
    const pieces = translationChunks(text, Math.max(1, Math.floor(Array.from(text).length / 2)));
    const result = [];
    for (const piece of pieces) result.push(await youdaoChunk(piece, from, to, request));
    return result.join('\n');
  }
}
// Website client key from the user-supplied google.py implementation.
const googleHtmlKey = 'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520';
async function googleChunk(text, from, to, request) {
  const result = [];
  for (const line of text.split(/\r\n|[\n\r]/)) {
    if (!line) { result.push(''); continue; }
    const response = await request('https://translate-pa.googleapis.com/v1/translateHtml', {
      method: 'POST', timeout: 20000,
      headers: { Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json+protobuf', 'X-Goog-Api-Key': googleHtmlKey },
      body: JSON.stringify([[[line], from, to], 'wt_lib'])
    });
    const data = await response.json();
    if (typeof data?.[0]?.[0] !== 'string' || !data[0][0].trim()) throw new Error('Google 新接口未返回翻译结果');
    result.push(unescapeHtml(data[0][0]));
  }
  return result.join('\n');
}
async function translateText(message, request) {
  const { text, from, to, translator } = message;
  if (!providerNames.includes(translator)) throw new Error('不支持的翻译器');
  if (typeof text !== 'string' || !text.trim()) throw new Error('没有提供翻译文本');
  if (typeof from !== 'string' || typeof to !== 'string') throw new Error('缺少翻译语言');
  const result = [];
  const chunks = translationChunks(text, translator === 'youdao' ? 180 : 1000);
  for (const chunk of chunks) {
    if (result.length) await new Promise(resolve => setTimeout(resolve, 250));
    result.push(await (translator === 'youdao' ? youdaoChunk : googleChunk)(chunk, from, to, request));
  }
  return result.join('\n');
}

// Coalesce identical in-flight requests and retain only successful translations.
// Provider queues prevent rapid selection / settings changes from sending bursts.
const translationCache = new Map(), providerQueues = new Map(), googleCooldown = { until: 0 };
// Each reader owns one replaceable job per provider. Completed cache entries
// are shared; in-flight work is local so one tab cannot cancel another tab.
const readerJobs = new Map();
function latestTranslation(message, request) {
  const lane = JSON.stringify([message.scope, message.translator]);
  const key = JSON.stringify([message.translator, message.from, message.to, message.text]);
  const previous = readerJobs.get(lane);
  if (previous?.key === key && !previous.controller.signal.aborted) return previous.promise;
  previous?.controller.abort();
  const cached = translationCache.get(key);
  if (cached?.complete && cached.expires > Date.now()) return cached.promise;
  const controller = new AbortController();
  const signal = controller.signal;
  const job = { key, controller };
  const currentRequest = (url, options = {}) => {
    signal.throwIfAborted();
    return request(url, { ...options, signal });
  };
  job.promise = (async () => {
    // Brief debounce avoids starting a network request for every rapid click.
    await new Promise((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 150);
      signal.addEventListener('abort', cancel, { once: true });
    });
    signal.throwIfAborted();
    if (message.translator === 'google' && Date.now() < googleCooldown.until) throw new Error('Google 请求受限，请稍后再试（HTTP 429）');
    const translatedText = await translateText(message, currentRequest);
    signal.throwIfAborted();
    const result = { translatedText };
    translationCache.set(key, { complete: true, promise: Promise.resolve(result), expires: Date.now() + 300000 });
    if (translationCache.size > 100) translationCache.delete(translationCache.keys().next().value);
    return result;
  })().catch(error => {
    if (!signal.aborted && message.translator === 'google' && error.status === 429) {
      googleCooldown.until = Date.now() + 60000;
      throw new Error('Google 请求受限，请稍后再试（HTTP 429）');
    }
    throw error;
  }).finally(() => { if (readerJobs.get(lane) === job) readerJobs.delete(lane); });
  readerJobs.set(lane, job);
  return job.promise;
}
function cachedTranslation(message, request) {
  if (message.scope) return latestTranslation(message, request);
  const key = JSON.stringify([message.translator, message.from, message.to, message.text]);
  const cached = translationCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const previous = providerQueues.get(message.translator) || Promise.resolve();
  const promise = previous.catch(() => {}).then(async () => {
    if (message.translator === 'google' && Date.now() < googleCooldown.until) throw new Error('Google 请求受限，请稍后再试（HTTP 429）');
    try {
      const result = { translatedText: await translateText(message, request) };
      const entry = translationCache.get(key);
      if (entry?.promise === promise) entry.complete = true;
      return result;
    }
    catch (error) {
      if (message.translator === 'google' && error.status === 429) {
        googleCooldown.until = Date.now() + 60000;
        throw new Error('Google 请求受限，请稍后再试（HTTP 429）');
      }
      throw error;
    }
  });
  providerQueues.set(message.translator, promise.then(() => new Promise(resolve => setTimeout(resolve, 250)), () => {}));
  translationCache.set(key, { promise, expires: Date.now() + 300000 });
  if (translationCache.size > 100) translationCache.delete(translationCache.keys().next().value);
  promise.catch(() => { if (translationCache.get(key)?.promise === promise) translationCache.delete(key); });
  return promise;
}
function audioBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
async function handleServiceMessage(message, request = fetchRequest) {
  if (message.action === 'cancel_translation') {
    for (const [lane, job] of readerJobs) {
      if (JSON.parse(lane)[0] === message.scope) job.controller.abort();
    }
    return {};
  }
  if (message.action === 'translate') return cachedTranslation(message, request);
  if (message.action === 'huosh_audio') {
    const settings = App.normalizeSettings(message.settings);
    if (typeof message.text !== 'string' || !message.text.trim()) throw new Error('没有提供朗读文本');
    const response = await request('https://translate.volcengine.com/crx/tts/v1/', {
      method: 'POST', timeout: 60000,
      headers: { Accept: 'application/json, text/plain, */*', 'Accept-Language': 'zh-CN,zh;q=0.9', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message.text, speaker: settings.huoshVoice })
    });
    const data = await response.json();
    const audio = data?.audio?.data;
    try {
      if (typeof audio !== 'string' || !audio.trim() || !atob(audio).length) throw new Error();
    } catch { throw new Error('火山语音未返回有效音频'); }
    return { audio, mime: 'audio/mpeg' };
  }
  if (['vits_speakers', 'vits_audio'].includes(message.action)) {
    const settings = App.normalizeSettings(message.settings);
    const base = settings.vitsAPI;
    if (message.action === 'vits_speakers') {
      const response = await request(`${base}/voice/speakers`, { vitsBase: base });
      const data = await response.json();
      if (!Array.isArray(data.VITS)) throw new Error('VITS 未返回声音列表');
      return { voices: data.VITS };
    }
    if (typeof message.text !== 'string' || !message.text.trim()) throw new Error('没有提供朗读文本');
    const params = new URLSearchParams({ text: message.text, id: settings.vitsVoice, lang: settings.vitsLang, length: settings.length, noise: settings.noise, noisew: settings.noisew, segment_size: settings.max, streaming: settings.streaming, format: 'mp3' });
    const response = await request(`${base}/voice/vits?${params}`, { binary: true, timeout: 120000, vitsBase: base });
    const mime = response.headers?.get('content-type') || 'audio/mpeg';
    if (!/^(audio\/|application\/octet-stream)/i.test(mime)) throw new Error('VITS 未返回音频，请检查声音和语言配置');
    return { audio: audioBase64(await response.arrayBuffer()), mime };
  }
  throw new Error('未知请求');
}
Object.assign(App, { providerNames, httpError, fetchRequest, decodeHtml, translationChunks, translateText, handleServiceMessage });
