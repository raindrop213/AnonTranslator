import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createTokenizerData } from '../src/services/tokenizer-data.js';
import { sha256 } from '../src/services/sha256.js';
import dictionary from '../src/services/tokenizer-dictionary.json' with { type: 'json' };

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const values = [new Uint8Array([0, 1, 2, 255]), new Uint8Array([45, 67]), new Uint8Array([128, 129, 130])];
const manifest = { version: 'test-v1', baseURL: 'https://example.invalid/dict/',
  files: values.map((value, i) => ({ name: `${i}.dat.gz`, bytes: value.length, sha256: digest(value) })) };

function memoryStorage() {
  const entries = new Map(); let meta = null, epoch = 'initial';
  return { entries,
    async list() { return [...entries.keys()]; },
    async get(name) { return entries.get(name)?.slice() ?? null; },
    async set(name, data) { entries.set(name, data.slice()); },
    async getMeta() { return structuredClone(meta); },
    async setMeta(value) { meta = structuredClone(value); },
    async getEpoch() { return epoch; },
    async setEpoch(value) { epoch = value; },
    async clear() { entries.clear(); meta = null; }
  };
}

function fixture({ storage = memoryStorage(), now, makeTokenizer } = {}) {
  let loads = 0, resets = 0;
  const requests = [], env = { fail: null, corrupt: false, beforeRequest: null };
  const service = createTokenizerData({ storage, manifest, now,
    makeTokenizer: makeTokenizer || (load => {
      let loaded;
      const tokenize = async text => {
        if (!loaded) { await Promise.all(manifest.files.map(file => load(file.name))); loads++; loaded = true; }
        return { tokens: [{ surface: text }] };
      };
      tokenize.reset = () => { resets++; loaded = false; };
      return tokenize;
    }),
    async request(url, options) {
      requests.push(url); await env.beforeRequest?.(url, options);
      if (env.fail === url) throw new Error('offline');
      const index = manifest.files.findIndex(file => manifest.baseURL + file.name === url);
      assert.notEqual(index, -1, 'only fixed dictionary URLs may be requested');
      return { async arrayBuffer() { return (env.corrupt ? new Uint8Array(values[index].length) : values[index]).buffer.slice(0); } };
    }
  });
  return { storage, requests, env, service, loads: () => loads, resets: () => resets };
}

async function settle(service) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const status = await service.status();
    if (status.state !== 'installing') return status;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('installation did not settle');
}

test('SHA-256 fallback matches native vectors including multi-block and sliced byte arrays', async () => {
  for (const text of ['', 'abc', 'a'.repeat(1000000)]) {
    const bytes = new TextEncoder().encode(text);
    assert.equal(await sha256(bytes, null), digest(bytes));
    assert.equal(await sha256(bytes), digest(bytes));
  }
  const bytes = new Uint8Array([9, 2, 3, 4, 9]).subarray(1, 4);
  assert.equal(await sha256(bytes, null), digest(bytes));
});

test('missing data never downloads implicitly and only explicit install prepares a usable tokenizer', async () => {
  const f = fixture();
  assert.equal((await f.service.status()).state, 'missing');
  await assert.rejects(f.service.tokenize('猫'), /安装分词数据/);
  assert.equal(f.requests.length, 0);
  await f.service.install();
  assert.equal((await settle(f.service)).state, 'installed');
  assert.equal(f.requests.length, 3);
  assert.equal((await f.service.tokenize('猫')).tokens[0].surface, '猫');
  await f.service.tokenize('犬'); assert.equal(f.loads(), 1);
  await f.service.install(); assert.equal(f.requests.length, 3);
});

test('failed downloads retain good files and retry downloads only the missing remainder', async () => {
  const f = fixture(); f.env.fail = manifest.baseURL + '1.dat.gz';
  await f.service.install();
  let status = await settle(f.service);
  assert.equal(status.state, 'error'); assert.equal(status.completed, 1); assert.match(status.error, /offline/);
  assert.notEqual((await f.storage.getMeta()).state, 'installed');
  f.env.fail = null; await f.service.install(); status = await settle(f.service);
  assert.equal(status.state, 'installed'); assert.equal(status.completed, 3);
  assert.equal(f.requests.filter(url => url.endsWith('/0.dat.gz')).length, 1);
});

test('corrupt downloads never mark installed, and same-size corrupt cached bytes can be repaired', async () => {
  const f = fixture(); f.env.corrupt = true; await f.service.install();
  assert.equal((await settle(f.service)).state, 'error'); assert.equal(f.storage.entries.size, 0);
  f.env.corrupt = false; await f.service.install(); await settle(f.service);
  await f.storage.set('0.dat.gz', new Uint8Array(values[0].length));
  await assert.rejects(f.service.tokenize('猫'), /缺失或损坏/);
  assert.equal((await f.service.status()).state, 'error');
  const count = f.requests.length;
  await f.service.install(); assert.equal((await settle(f.service)).state, 'installed');
  assert.equal(f.requests.length, count + 1);
});

test('a fresh service reuses installed data offline and detects missing files despite a ready marker', async () => {
  const f = fixture(); await f.service.install(); await settle(f.service);
  const restarted = fixture({ storage: f.storage });
  assert.equal((await restarted.service.status()).state, 'installed');
  await restarted.service.tokenize('猫'); assert.equal(restarted.requests.length, 0);
  f.storage.entries.delete('1.dat.gz');
  assert.equal((await restarted.service.status()).state, 'partial');
  await assert.rejects(restarted.service.tokenize('猫'), /安装分词数据/);
  await restarted.service.install(); await settle(restarted.service);
  assert.equal(restarted.requests.length, 1);
});

test('remove clears persisted and initialized data, including another userscript page engine', async () => {
  const f = fixture(); await f.service.install(); await settle(f.service);
  const other = fixture({ storage: f.storage }); await other.service.tokenize('猫');
  assert.equal((await f.service.remove()).state, 'missing');
  assert.equal(f.storage.entries.size, 0);
  await assert.rejects(other.service.tokenize('犬'), /安装分词数据/);
  assert.ok(other.resets() > 0);
});

test('interrupted installations can be resumed after a stale owner lease expires', async () => {
  let clock = 1000; const f = fixture({ now: () => clock });
  await f.storage.set('0.dat.gz', values[0]);
  await f.storage.setMeta({ version: manifest.version, state: 'installing', token: 'old-worker', epoch: 'initial', updatedAt: clock });
  assert.equal((await f.service.install()).state, 'installing'); assert.equal(f.requests.length, 0);
  clock += 45001;
  assert.equal((await f.service.status()).state, 'partial');
  await f.service.install(); assert.equal((await settle(f.service)).state, 'installed');
  assert.equal(f.requests.length, 2);
});

test('a different page removing an in-flight install prevents stale completion', async () => {
  const f = fixture(); let release, started;
  const reached = new Promise(resolve => { started = resolve; });
  f.env.beforeRequest = async () => { started(); await new Promise(resolve => { release = resolve; }); };
  await f.service.install(); await reached;
  const other = fixture({ storage: f.storage }); await other.service.remove();
  release(); await settle(f.service);
  assert.equal((await other.service.status()).state, 'missing');
  assert.equal(f.storage.entries.size, 0);
});

test('the pinned production dictionary manifest matches all installed dependency files', async () => {
  assert.equal(dictionary.files.length, 12);
  for (const file of dictionary.files) {
    const bytes = await readFile(new URL('../node_modules/kuromoji/dict/' + file.name, import.meta.url));
    assert.equal(bytes.length, file.bytes); assert.equal(digest(bytes), file.sha256);
  }
});

test('concurrent install calls share startup and download each file once', async () => {
  const f = fixture();
  await Promise.all(Array.from({ length: 8 }, () => f.service.install()));
  assert.equal((await settle(f.service)).state, 'installed');
  assert.equal(f.requests.length, 3);
});

test('remove racing install startup waits for cancellation and cannot leave installed data', async () => {
  const f = fixture();
  const install = f.service.install();
  const removed = f.service.remove();
  await assert.rejects(f.service.install(), /正在删除/);
  await install; await removed;
  assert.equal((await f.service.status()).state, 'missing');
  assert.equal(f.storage.entries.size, 0);
});

test('a delayed metadata checkpoint cannot revive downloads after another page removes the data', async () => {
  const storage = memoryStorage(), saveMeta = storage.setMeta;
  let release, reached, writes = 0;
  const paused = new Promise(resolve => { reached = resolve; });
  storage.setMeta = async meta => {
    if (meta?.state === 'installing' && ++writes === 2) {
      reached(); await new Promise(resolve => { release = resolve; });
    }
    await saveMeta(meta);
  };
  const f = fixture({ storage }); await f.service.install(); await paused;
  const other = fixture({ storage }); await other.service.remove();
  release(); await settle(f.service);
  assert.equal(f.requests.length, 1, 'stale metadata cannot restart later network requests');
  assert.equal((await other.service.status()).state, 'missing');
  assert.equal(storage.entries.size, 0);
});

test('real downloaded IPADIC data tokenizes offline after a service restart', async () => {
  const storage = memoryStorage(); let requests = 0;
  const install = createTokenizerData({ storage, async request(url) {
    requests++;
    const file = dictionary.files.find(file => dictionary.baseURL + file.name === url);
    assert.ok(file);
    const bytes = await readFile(new URL('../node_modules/kuromoji/dict/' + file.name, import.meta.url));
    return { async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } };
  } });
  await install.install(); assert.equal((await settle(install)).state, 'installed');
  const offline = createTokenizerData({ storage, request() { throw new Error('unexpected network'); } });
  const { tokens } = await offline.tokenize('猫は濡らした。');
  assert.equal(tokens.find(token => token.surface === '濡らし').base, '濡らす');
  assert.equal(requests, 12);
  await offline.remove(); await assert.rejects(offline.tokenize('猫'), /安装分词数据/);
});
