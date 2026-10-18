const META_FILE = '.at-tokenizer-meta.json';
const EPOCH_FILE = '.at-tokenizer-epoch';
const safeSegment = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);

function requireSegment(value, label) {
  if (!safeSegment(value)) throw new TypeError(`Invalid tokenizer ${label}`);
  return value;
}

function requireBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('Tokenizer data must be a Uint8Array');
  return bytes;
}

const isMeta = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function requireMeta(meta) {
  if (meta !== null && !isMeta(meta)) throw new TypeError('Tokenizer metadata must be an object or null');
}

function requireEpoch(epoch) {
  return requireSegment(epoch, 'epoch');
}

// Kept separate from the expiring audio cache: installed dictionaries remain
// available after a worker restart without reading all dictionary bytes first.
export function createChromeTokenizerStorage(cacheStorage, { version, baseURL }) {
  const cacheName = 'at-tokenizer-' + requireSegment(version, 'version');
  const base = new URL(baseURL);
  if (!['https:', 'http:'].includes(base.protocol) || base.search || base.hash) {
    throw new TypeError('Invalid tokenizer dictionary URL');
  }
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const namespaceURL = epoch => base.href + '.at-tokenizer-data/' + requireEpoch(epoch) + '/';
  const epochURL = base.href + EPOCH_FILE;
  const open = () => cacheStorage.open(cacheName);
  const readEpoch = async cache => {
    const response = await cache.match(epochURL), value = response ? await response.text() : null;
    return safeSegment(value) ? value : 'initial';
  };
  return {
    async list() {
      const cache = await open(), namespace = namespaceURL(await readEpoch(cache));
      return (await cache.keys()).map(request => request.url)
        .filter(url => url.startsWith(namespace)).map(url => url.slice(namespace.length))
        .filter(safeSegment);
    },
    async get(file) {
      requireSegment(file, 'filename');
      const cache = await open(), url = namespaceURL(await readEpoch(cache)) + file, response = await cache.match(url);
      return response ? new Uint8Array(await response.arrayBuffer()) : null;
    },
    async set(file, bytes, expectedEpoch) {
      requireSegment(file, 'filename');
      requireBytes(bytes);
      const cache = await open();
      const epoch = expectedEpoch === undefined ? await readEpoch(cache) : requireEpoch(expectedEpoch);
      if (await readEpoch(cache) !== epoch) return;
      const url = namespaceURL(epoch) + file;
      await cache.put(url, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }));
      if (await readEpoch(cache) !== epoch) await cache.delete(url);
    },
    async getMeta() {
      const cache = await open(), metaURL = namespaceURL(await readEpoch(cache)) + META_FILE;
      const response = await cache.match(metaURL);
      if (!response) return null;
      try {
        const value = await response.json();
        return isMeta(value) ? value : null;
      } catch { return null; }
    },
    async setMeta(meta) {
      requireMeta(meta);
      const cache = await open();
      const epoch = meta?.epoch === undefined ? await readEpoch(cache) : requireEpoch(meta.epoch);
      const metaURL = namespaceURL(epoch) + META_FILE;
      if (meta === null) { await cache.delete(metaURL); return; }
      if (await readEpoch(cache) !== epoch) return;
      await cache.put(metaURL, new Response(JSON.stringify(meta), { headers: { 'Content-Type': 'application/json' } }));
      if (await readEpoch(cache) !== epoch) await cache.delete(metaURL);
    },
    async getEpoch() {
      return readEpoch(await open());
    },
    async setEpoch(epoch) {
      requireEpoch(epoch);
      const cache = await open();
      await cache.put(epochURL, new Response(epoch, { headers: { 'Content-Type': 'text/plain' } }));
    },
    async clear() {
      const cache = await open();
      // Keep the deletion marker independent from metadata: a late write from
      // another reader must not erase the fact that its install was removed.
      for (const request of await cache.keys()) {
        if (request.url !== epochURL) await cache.delete(request);
      }
    }
  };
}

function encodeBytes(bytes) {
  const chunks = [];
  // A whole dictionary file can exceed the engine's function-argument limit.
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  }
  return btoa(chunks.join(''));
}

function decodeBytes(encoded) {
  const binary = atob(encoded), bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

// GM storage belongs to the userscript, so all reading sites share one install.
// Only compressed data is Base64 encoded; metadata stays a small GM object.
export function createUserscriptTokenizerStorage({ getValue, setValue, deleteValue, listValues }, { version }) {
  const prefix = 'at-tokenizer:' + requireSegment(version, 'version') + ':';
  const namespace = epoch => prefix + 'data:' + requireEpoch(epoch) + ':';
  const epochKey = prefix + 'epoch';
  const readEpoch = async () => {
    const value = await getValue(epochKey, 'initial');
    return safeSegment(value) ? value : 'initial';
  };
  return {
    async list() {
      const filePrefix = namespace(await readEpoch()) + 'file:';
      return (await listValues()).filter(key => typeof key === 'string' && key.startsWith(filePrefix))
        .map(key => key.slice(filePrefix.length)).filter(safeSegment);
    },
    async get(file) {
      requireSegment(file, 'filename');
      const key = namespace(await readEpoch()) + 'file:' + file;
      const value = await getValue(key, null);
      if (typeof value !== 'string') return null;
      try { return decodeBytes(value); } catch { return null; }
    },
    async set(file, bytes, expectedEpoch) {
      requireSegment(file, 'filename');
      requireBytes(bytes);
      const epoch = expectedEpoch === undefined ? await readEpoch() : requireEpoch(expectedEpoch);
      const key = namespace(epoch) + 'file:' + file, value = encodeBytes(bytes);
      if (await readEpoch() !== epoch) return;
      await setValue(key, value);
      if (await readEpoch() !== epoch) await deleteValue(key);
    },
    async getMeta() {
      const metaKey = namespace(await readEpoch()) + 'meta';
      const value = await getValue(metaKey, null);
      return isMeta(value) ? value : null;
    },
    async setMeta(meta) {
      requireMeta(meta);
      const epoch = meta?.epoch === undefined ? await readEpoch() : requireEpoch(meta.epoch);
      const metaKey = namespace(epoch) + 'meta';
      if (meta === null) { await deleteValue(metaKey); return; }
      if (await readEpoch() !== epoch) return;
      await setValue(metaKey, meta);
      if (await readEpoch() !== epoch) await deleteValue(metaKey);
    },
    getEpoch: readEpoch,
    async setEpoch(epoch) { await setValue(epochKey, requireEpoch(epoch)); },
    async clear() {
      for (const key of await listValues()) {
        if (typeof key === 'string' && key.startsWith(prefix) && key !== epochKey) await deleteValue(key);
      }
    }
  };
}
