import { fetchRequest } from './request.js';

// Providers run independently; Youdao starts first and occupies the first row.
export const providerNames = ['youdao', 'google'];

function unescapeHtml(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return value <= 0x10ffff ? String.fromCodePoint(value) : entity;
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[code.toLowerCase()];
  });
}

function decodeHtml(text) {
  return unescapeHtml(text.replace(/<[^>]*>/g, ''));
}

// Count code points so a split never breaks a supplementary character.
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

// Public website client key retained from the existing implementation.
const googleHtmlKey = 'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520';

async function googleChunk(text, from, to, request) {
  const result = [];
  for (const line of text.split(/\r\n|[\n\r]/)) {
    if (!line) { result.push(''); continue; }
    const response = await request('https://translate-pa.googleapis.com/v1/translateHtml', {
      method: 'POST', timeout: 20000,
      headers: {
        Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json+protobuf', 'X-Goog-Api-Key': googleHtmlKey
      },
      body: JSON.stringify([[[line], from, to], 'wt_lib'])
    });
    const data = await response.json();
    if (typeof data?.[0]?.[0] !== 'string' || !data[0][0].trim()) throw new Error('Google 新接口未返回翻译结果');
    result.push(unescapeHtml(data[0][0]));
  }
  return result.join('\n');
}

const headers = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
};

async function youdaoChunk(text, from, to, request) {
  try {
    const response = await request('https://m.youdao.com/translate', {
      method: 'POST', headers,
      body: new URLSearchParams({ inputtext: text, type: `${from}2${to}` }).toString()
    });
    const html = await response.text();
    const result = html.match(/<ul id="translateResult">([\s\S]*?)<\/ul>/)?.[1];
    const rows = result && [...result.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)];
    if (!rows?.length) throw new Error('有道未返回翻译结果');
    return rows.map(row => decodeHtml(row[1])).join('');
  } catch (error) {
    if (error.status !== 413 || Array.from(text).length < 2) throw error;
    const pieces = translationChunks(text, Math.max(1, Math.floor(Array.from(text).length / 2)));
    const result = [];
    for (const piece of pieces) result.push(await youdaoChunk(piece, from, to, request));
    return result.join('');
  }
}


async function translateText(message, request) {
  const { text, from, to, translator } = message;
  if (!providerNames.includes(translator)) throw new Error('不支持的翻译器');
  if (typeof text !== 'string' || !text.trim()) throw new Error('没有提供翻译文本');
  if (typeof from !== 'string' || typeof to !== 'string') throw new Error('缺少翻译语言');
  // Preserve source line breaks without inserting breaks at Youdao boundaries.
  const lines = translator === 'youdao' ? text.split(/\r\n|[\n\r]/) : [text];
  const result = [];
  let sent = false;
  for (const line of lines) {
    const translated = [];
    for (const chunk of translationChunks(line, translator === 'youdao' ? 180 : 1000)) {
      if (sent) await new Promise(resolve => setTimeout(resolve, 250));
      sent = true;
      translated.push(await (translator === 'youdao' ? youdaoChunk : googleChunk)(chunk, from, to, request));
    }
    result.push(translated.join(translator === 'youdao' ? '' : '\n'));
  }
  return result.join('\n');
}

const translationCache = new Map(), readerJobs = new Map(), translationRequests = new WeakMap();
let googleCooldownUntil = 0, nextTranslationRequest = 0;

const cacheKey = (message, request) => {
  if (!translationRequests.has(request)) translationRequests.set(request, ++nextTranslationRequest);
  return JSON.stringify([translationRequests.get(request), message.translator, message.from, message.to, message.text]);
};
const isCached = entry => entry && entry.expires > Date.now();
const cooldownError = () => new Error('Google 请求受限，请稍后再试（HTTP 429）');

function remember(key, entry) {
  translationCache.set(key, entry);
  if (translationCache.size > 100) translationCache.delete(translationCache.keys().next().value);
}

async function translateResult(message, request, signal) {
  if (message.translator === 'google' && Date.now() < googleCooldownUntil) throw cooldownError();
  try {
    return { translatedText: await translateText(message, request) };
  } catch (error) {
    if (!signal?.aborted && message.translator === 'google' && error.status === 429) {
      googleCooldownUntil = Date.now() + 60000;
      throw cooldownError();
    }
    throw error;
  }
}

function debounce(signal) {
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 150);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

// Each reader owns replaceable work. Shared completed results cannot be cancelled
// by a different tab, and rapid selections discard their stale requests.
function latestTranslation(message, request) {
  const key = cacheKey(message, request);
  const lane = JSON.stringify([message.scope, message.translator, translationRequests.get(request)]);
  const previous = readerJobs.get(lane);
  if (previous?.key === key && !previous.controller.signal.aborted) return previous.promise;
  previous?.controller.abort();
  const cached = translationCache.get(key);
  if (isCached(cached)) return cached.promise;
  const controller = new AbortController();
  const signal = controller.signal;
  const job = { key, controller };
  const currentRequest = (url, options = {}) => {
    signal.throwIfAborted();
    return request(url, { ...options, signal });
  };
  job.promise = (async () => {
    await debounce(signal);
    signal.throwIfAborted();
    const result = await translateResult(message, currentRequest, signal);
    signal.throwIfAborted();
    remember(key, { complete: true, promise: Promise.resolve(result), expires: Date.now() + 300000 });
    return result;
  })().finally(() => { if (readerJobs.get(lane) === job) readerJobs.delete(lane); });
  readerJobs.set(lane, job);
  return job.promise;
}

// Reuse identical requests; the reader cancels work when its selection changes.
export function cachedTranslation(message, request = fetchRequest) {
  if (message.scope) return latestTranslation(message, request);
  const key = cacheKey(message, request);
  const cached = translationCache.get(key);
  if (isCached(cached)) return cached.promise;
  const active = [...readerJobs.values()].find(job => job.key === key && !job.controller.signal.aborted);
  // Export can join an already-running reader translation. If its reading
  // selection is replaced, retry independently instead of cancelling the card.
  const pending = active ? active.promise.catch(error => {
    if (active.controller.signal.aborted) return translateResult(message, request);
    throw error;
  }) : translateResult(message, request);
  const promise = pending.then(result => {
    const entry = translationCache.get(key);
    if (entry?.promise === promise) entry.complete = true;
    return result;
  });
  remember(key, { promise, expires: Date.now() + 300000 });
  promise.catch(() => { if (translationCache.get(key)?.promise === promise) translationCache.delete(key); });
  return promise;
}

export function cancelTranslation(scope) {
  for (const [lane, job] of readerJobs) {
    if (JSON.parse(lane)[0] === scope) job.controller.abort();
  }
  return {};
}
