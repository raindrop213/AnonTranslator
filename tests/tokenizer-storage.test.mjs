import test from 'node:test';
import assert from 'node:assert/strict';
import { createChromeTokenizerStorage, createUserscriptTokenizerStorage } from '../src/platform/tokenizer-storage.js';

const options = { version: 'kuromoji-0.1.2-v1', baseURL: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/' };

function cacheStorage() {
  const caches = new Map();
  let reads = 0;
  const address = value => typeof value === 'string' ? value : value.url;
  return {
    caches,
    get reads() { return reads; },
    async open(name) {
      if (!caches.has(name)) caches.set(name, new Map());
      const entries = caches.get(name);
      return {
        async match(key) {
          if (!address(key).endsWith('/.at-tokenizer-epoch')) reads++;
          return entries.get(address(key))?.clone();
        },
        async put(key, response) { entries.set(address(key), response.clone()); },
        async delete(key) { return entries.delete(address(key)); },
        async keys() { return [...entries.keys()].map(url => ({ url })); }
      };
    },
    async delete(name) { return caches.delete(name); }
  };
}

function gmStorage(asyncFunctions = false) {
  const entries = new Map();
  let reads = 0;
  const methods = {
    getValue(key, fallback) {
      if (!key.endsWith(':epoch')) reads++;
      return entries.has(key) ? structuredClone(entries.get(key)) : fallback;
    },
    setValue(key, value) { entries.set(key, structuredClone(value)); },
    deleteValue(key) { entries.delete(key); },
    listValues() { return [...entries.keys()]; }
  };
  return {
    entries,
    get reads() { return reads; },
    api: asyncFunctions ? Object.fromEntries(Object.entries(methods).map(([key, fn]) => [key, async (...args) => fn(...args)])) : methods
  };
}

function deferred() {
  let resolve;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve };
}

function pauseNextWrite(storage, platform, matches) {
  const entered = deferred(), release = deferred();
  let paused = false;
  const pause = async key => {
    if (!paused && matches(key)) { paused = true; entered.resolve(); await release.promise; }
  };
  if (platform === 'Chrome') {
    const open = storage.open.bind(storage);
    storage.open = async name => {
      const cache = await open(name);
      return { ...cache, async put(key, response) { await pause(key); await cache.put(key, response); } };
    };
  } else {
    const setValue = storage.api.setValue;
    storage.api.setValue = async (key, value) => { await pause(key); await setValue(key, value); };
  }
  return { entered: entered.promise, release: release.resolve };
}

test('Chrome dictionary bytes and metadata survive background recreation; list avoids dictionary payloads', async () => {
  const storage = cacheStorage(), first = createChromeTokenizerStorage(storage, options);
  const bytes = Uint8Array.from([0, 255, 128, 63, 194, 169]);
  await first.set('base.dat.gz', bytes.subarray(1, 5));
  await first.set('check.dat.gz', new Uint8Array([1]));
  await first.setMeta({ installed: true, version: options.version });
  const restarted = createChromeTokenizerStorage(storage, options);
  assert.deepEqual(await restarted.list(), ['base.dat.gz', 'check.dat.gz']);
  assert.equal(storage.reads, 0, 'checking installation must not read dictionary bodies');
  assert.deepEqual(await restarted.get('base.dat.gz'), bytes.subarray(1, 5));
  assert.deepEqual(await restarted.getMeta(), { installed: true, version: options.version });
  assert.deepEqual([...storage.caches.keys()], ['at-tokenizer-' + options.version]);
});

test('Chrome clear removes only the current dictionary version and leaves audio intact', async () => {
  const storage = cacheStorage(), current = createChromeTokenizerStorage(storage, options);
  const other = createChromeTokenizerStorage(storage, { ...options, version: 'v2' });
  const audio = await storage.open('at-audio-v1');
  await audio.put('https://example.com/audio', new Response('audio'));
  assert.equal(await current.get('base.dat.gz'), null);
  assert.equal(await current.getMeta(), null);
  await current.set('base.dat.gz', new Uint8Array([255]));
  await current.setMeta({ ready: true });
  await other.set('base.dat.gz', new Uint8Array([7]));
  assert.equal(await other.getMeta(), null);
  await current.setMeta(null);
  assert.equal(await current.getMeta(), null);
  assert.deepEqual(await current.list(), ['base.dat.gz']);
  await current.setMeta({ ready: true });
  await current.clear();
  assert.deepEqual(await current.list(), []);
  assert.equal(await current.get('base.dat.gz'), null);
  assert.equal(await current.getMeta(), null);
  assert.deepEqual(await other.get('base.dat.gz'), new Uint8Array([7]));
  assert.equal(await (await audio.match('https://example.com/audio')).text(), 'audio');
});

for (const asyncFunctions of [false, true]) {
  test(`userscript dictionary installation is shared across sites with ${asyncFunctions ? 'async' : 'sync'} GM APIs`, async () => {
    const storage = gmStorage(asyncFunctions), firstSite = createUserscriptTokenizerStorage(storage.api, options);
    const bytes = Uint8Array.from([0, 128, 255, 0, 233, 240]);
    storage.entries.set('readerEnabled', true);
    storage.entries.set('settings', { fontSize: 24 });
    await firstSite.set('base.dat.gz', bytes);
    await firstSite.setMeta({ ready: true });
    const secondSite = createUserscriptTokenizerStorage(storage.api, options);
    assert.deepEqual(await secondSite.list(), ['base.dat.gz']);
    assert.equal(storage.reads, 0, 'cross-site installation detection must not decode all files');
    assert.deepEqual(await secondSite.get('base.dat.gz'), bytes);
    assert.deepEqual(await secondSite.getMeta(), { ready: true });
    assert.equal(storage.entries.get('at-tokenizer:' + options.version + ':data:initial:file:base.dat.gz'), 'AID/AOnw');
    assert.deepEqual(storage.entries.get('settings'), { fontSize: 24 });
    assert.equal(storage.entries.get('readerEnabled'), true);
  });
}

test('userscript encodes large binary files in bounded chunks and preserves a subarray', async () => {
  const storage = gmStorage(), adapter = createUserscriptTokenizerStorage(storage.api, options);
  const bytes = Uint8Array.from({ length: 2 * 1024 * 1024 + 7 }, (_, index) => index % 256);
  await adapter.set('tid.dat.gz', bytes.subarray(3, -2));
  assert.deepEqual(await adapter.get('tid.dat.gz'), bytes.subarray(3, -2));
});

test('userscript missing/corrupt data and removal remain isolated by version', async () => {
  const storage = gmStorage(), current = createUserscriptTokenizerStorage(storage.api, options);
  const other = createUserscriptTokenizerStorage(storage.api, { version: 'v2' });
  const prefix = 'at-tokenizer:' + options.version + ':';
  storage.entries.set('settings', { readerEnabled: true });
  assert.deepEqual(await current.list(), []);
  assert.equal(await current.get('base.dat.gz'), null);
  assert.equal(await current.getMeta(), null);
  await current.set('base.dat.gz', new Uint8Array([255]));
  await current.setMeta({ ready: true });
  await other.set('base.dat.gz', new Uint8Array([8]));
  assert.equal(await other.getMeta(), null);
  await current.setMeta(null);
  assert.equal(await current.getMeta(), null);
  assert.deepEqual(await current.list(), ['base.dat.gz']);
  storage.entries.set(prefix + 'data:initial:file:corrupt.dat.gz', '!invalid base64!');
  assert.equal(await current.get('corrupt.dat.gz'), null);
  await current.setMeta({ ready: true });
  await current.clear();
  assert.deepEqual(await current.list(), []);
  assert.equal(await current.get('base.dat.gz'), null);
  assert.equal(await current.getMeta(), null);
  assert.deepEqual(await other.get('base.dat.gz'), new Uint8Array([8]));
  assert.deepEqual(storage.entries.get('settings'), { readerEnabled: true });
  assert.ok([...storage.entries.keys()].every(key => !key.startsWith(prefix)));
});

for (const platform of ['Chrome', 'userscript']) {
  test(`${platform} preserves its independent removal epoch across clear, restart and late metadata writes`, async () => {
    const storage = platform === 'Chrome' ? cacheStorage() : gmStorage(true);
    const create = version => platform === 'Chrome'
      ? createChromeTokenizerStorage(storage, { ...options, version })
      : createUserscriptTokenizerStorage(storage.api, { version });
    const current = create(options.version), other = create('v2');
    assert.equal(await current.getEpoch(), 'initial');
    assert.equal(await other.getEpoch(), 'initial');
    await current.setEpoch('removed-1');
    await current.set('base.dat.gz', new Uint8Array([255]));
    await current.setMeta({ epoch: 'removed-1', ready: true });
    await other.setEpoch('other-version');
    await current.clear();
    const restarted = create(options.version);
    assert.equal(await restarted.getEpoch(), 'removed-1');
    assert.deepEqual(await restarted.list(), []);
    assert.equal(await restarted.get('base.dat.gz'), null);
    assert.equal(await restarted.getMeta(), null);
    assert.equal(await other.getEpoch(), 'other-version');
    await current.setMeta({ epoch: 'initial', ready: true });
    assert.equal(await restarted.getMeta(), null, 'a stale metadata write stays outside the current epoch');
    assert.equal(await restarted.getEpoch(), 'removed-1', 'a stale metadata write cannot restore its old epoch');
    await restarted.setMeta(null);
    assert.equal(await restarted.getEpoch(), 'removed-1', 'deleting metadata does not remove the tombstone');
    await restarted.clear();
    assert.equal(await restarted.getEpoch(), 'removed-1');
    if (platform === 'Chrome') {
      assert.equal(storage.caches.get('at-tokenizer-' + options.version).size, 1);
    } else {
      const keys = [...storage.entries.keys()].filter(key => key.startsWith('at-tokenizer:' + options.version + ':'));
      assert.deepEqual(keys, ['at-tokenizer:' + options.version + ':epoch']);
    }
  });

  for (const writeType of ['file', 'metadata']) {
    test(`${platform} cleans a late ${writeType} write after removal without deleting a new install`, async () => {
      const storage = platform === 'Chrome' ? cacheStorage() : gmStorage(true);
      const matches = key => writeType === 'file' ? key.endsWith('base.dat.gz')
        : key.endsWith('.at-tokenizer-meta.json') || key.endsWith(':meta');
      const paused = pauseNextWrite(storage, platform, matches);
      const create = () => platform === 'Chrome' ? createChromeTokenizerStorage(storage, options)
        : createUserscriptTokenizerStorage(storage.api, options);
      const oldPage = create(), newPage = create();
      const pending = writeType === 'file'
        ? oldPage.set('base.dat.gz', new Uint8Array([1]), 'initial')
        : oldPage.setMeta({ epoch: 'initial', ready: true });
      await paused.entered;
      await newPage.setEpoch('removed-2');
      await newPage.clear();
      await newPage.set('base.dat.gz', new Uint8Array([9]), 'removed-2');
      await newPage.setMeta({ epoch: 'removed-2', ready: true });
      paused.release();
      await pending;
      assert.deepEqual(await oldPage.list(), ['base.dat.gz']);
      assert.deepEqual(await oldPage.get('base.dat.gz'), new Uint8Array([9]));
      assert.deepEqual(await oldPage.getMeta(), { epoch: 'removed-2', ready: true });
      const keys = platform === 'Chrome' ? [...storage.caches.get('at-tokenizer-' + options.version).keys()]
        : [...storage.entries.keys()];
      assert.equal(keys.length, 3, 'only the root epoch and the new install remain');
      assert.ok(keys.every(key => !key.includes('/initial/') && !key.includes(':initial:')));
      await oldPage.set('check.dat.gz', new Uint8Array([1]), 'initial');
      await oldPage.setMeta({ epoch: 'initial', ready: false });
      assert.deepEqual(await newPage.list(), ['base.dat.gz'], 'a known stale write is skipped before storage');
      assert.deepEqual(await newPage.getMeta(), { epoch: 'removed-2', ready: true });
    });
  }
}

test('dictionary adapters reject paths, URL fragments and reserved metadata names', async () => {
  const chrome = createChromeTokenizerStorage(cacheStorage(), options);
  const userscript = createUserscriptTokenizerStorage(gmStorage().api, options);
  for (const adapter of [chrome, userscript]) {
    for (const filename of ['../base.dat.gz', 'dir/base.dat.gz', 'dir\\base.dat.gz', '.at-tokenizer-meta.json', '.at-tokenizer-epoch',
      'https://example.com/data', 'base.dat.gz?query', 'base.dat.gz#hash', '%2e%2e', '', null]) {
      await assert.rejects(adapter.set(filename, new Uint8Array([1])), /Invalid tokenizer filename/);
      await assert.rejects(adapter.get(filename), /Invalid tokenizer filename/);
    }
    await assert.rejects(adapter.set('base.dat.gz', new ArrayBuffer(1)), /Uint8Array/);
    await assert.rejects(adapter.setMeta([]), /metadata/);
    await assert.rejects(adapter.setEpoch(null), /epoch/);
    await assert.rejects(adapter.setEpoch('../old'), /epoch/);
    await assert.rejects(adapter.set('base.dat.gz', new Uint8Array([1]), '../old'), /epoch/);
    await assert.rejects(adapter.setMeta({ epoch: '../old' }), /epoch/);
  }
  assert.throws(() => createChromeTokenizerStorage(cacheStorage(), { ...options, version: '../v2' }), /version/);
  assert.throws(() => createUserscriptTokenizerStorage(gmStorage().api, { version: '../v2' }), /version/);
});
