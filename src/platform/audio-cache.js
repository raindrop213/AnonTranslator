// Extension-origin CacheStorage survives service-worker sleep without putting
// large audio blobs in settings or the session draft quota. URLs are never sent.
export function createPersistentAudioCache(storage, { ttl = 600000, maxBytes = 32 * 1024 * 1024, now = Date.now } = {}) {
  const touched = new Map();
  let writes = Promise.resolve();
  const keyURL = async key => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    return 'https://anontranslator.invalid/audio-cache/' + [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  };
  const open = () => storage.open('at-audio-v1');
  const trim = async cache => {
    const rows = []; let bytes = 0;
    for (const request of await cache.keys()) {
      const response = await cache.match(request), size = Number(response?.headers.get('x-at-bytes'));
      if (!response || Number(response.headers.get('x-at-expires')) <= now() || !Number.isFinite(size) || size <= 0) {
        await cache.delete(request); touched.delete(request.url); continue;
      }
      bytes += size;
      rows.push({ request, size, at: touched.get(request.url) || Number(response.headers.get('x-at-stored')) || 0 });
    }
    rows.sort((left, right) => left.at - right.at);
    while ((bytes > maxBytes || rows.length > 128) && rows.length) {
      const row = rows.shift(); bytes -= row.size; await cache.delete(row.request); touched.delete(row.request.url);
    }
  };
  return {
    async get(key) {
      const cache = await open(), url = await keyURL(key), response = await cache.match(url);
      if (!response) return null;
      if (!(Number(response.headers.get('x-at-expires')) > now())) { await cache.delete(url); touched.delete(url); return null; }
      try {
        const result = await response.json();
        if (typeof result?.audio !== 'string' || !result.audio || typeof result.mime !== 'string') throw new Error('Invalid cached audio');
        touched.set(url, now()); return result;
      } catch { await cache.delete(url); touched.delete(url); return null; }
    },
    set(key, result) {
      const task = writes.catch(() => {}).then(async () => {
        const body = JSON.stringify(result), size = body.length * 2;
        if (size > maxBytes) return;
        const cache = await open(), url = await keyURL(key), stored = now();
        await cache.put(url, new Response(body, { headers: { 'Content-Type': 'application/json',
          'x-at-expires': String(stored + ttl), 'x-at-bytes': String(size), 'x-at-stored': String(stored) } }));
        touched.set(url, stored); await trim(cache);
      });
      writes = task; return task;
    }
  };
}
