import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersistentAudioCache } from '../src/platform/audio-cache.js';
import { configureAudioCacheStorage, huoshanAudio } from '../src/services/speech.js';

function cacheStorage() {
  const entries = new Map();
  const address = value => typeof value === 'string' ? value : value.url;
  return { entries, async open() { return {
    async match(key) { return entries.get(address(key))?.clone(); },
    async put(key, response) { entries.set(address(key), response.clone()); },
    async delete(key) { return entries.delete(address(key)); },
    async keys() { return [...entries.keys()].map(url => ({ url })); }
  }; } };
}

test('hashed extension audio cache survives worker recreation, expires and evicts least recently used data', async () => {
  const storage = cacheStorage(); let now = 1000;
  const options = { ttl: 100, maxBytes: 200, now: () => now };
  const cache = createPersistentAudioCache(storage, options), value = { audio: 'AQID', mime: 'audio/mpeg' };
  await cache.set('secret-token-in-provider-url', value);
  assert.ok([...storage.entries.keys()].every(key => /\/audio-cache\/[a-f0-9]{64}$/.test(key)));
  const restarted = createPersistentAudioCache(storage, options);
  assert.deepEqual(await restarted.get('secret-token-in-provider-url'), value);
  now++; await restarted.set('second', value);
  now++; await restarted.get('secret-token-in-provider-url');
  now++; await restarted.set('third', value);
  assert.deepEqual(await restarted.get('secret-token-in-provider-url'), value);
  assert.equal(await restarted.get('second'), null);
  now += 101;
  assert.equal(await restarted.get('secret-token-in-provider-url'), null);
});

test('service reload reuses persistent audio with a new transport identity; cache failure does not block generation', async () => {
  const storage = cacheStorage(); let calls = 0;
  const request = async () => { calls++; return { json: async () => ({ audio: { data: 'AQID' } }) }; };
  configureAudioCacheStorage(createPersistentAudioCache(storage));
  try {
    await huoshanAudio('缓存跨进程', {}, request);
    configureAudioCacheStorage(createPersistentAudioCache(storage));
    await huoshanAudio('缓存跨进程', {}, (...args) => request(...args));
    assert.equal(calls, 1);
    configureAudioCacheStorage({ async get() { throw new Error('cache closed'); }, async set() { throw new Error('quota exceeded'); } });
    assert.equal((await huoshanAudio('缓存故障仍发声', {}, request)).audio, 'AQID');
    assert.equal(calls, 2);
  } finally { configureAudioCacheStorage(null); }
});
