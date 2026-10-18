import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSessionDraftStore, serializeAnkiDraft } from '../src/platform/anki-drafts.js';

function memoryStorage() {
  const entries = {};
  return { entries,
    async get(key) { return structuredClone(key === null ? entries : { [key]: entries[key] }); },
    async set(patch) { Object.assign(entries, structuredClone(patch)); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete entries[key]; }
  };
}

test('drafts survive service-worker recreation in session storage and stay isolated by tab', async () => {
  const storage = memoryStorage(), store = createSessionDraftStore(storage);
  const source = { word: '猫', image: { mime: 'image/png', data: 'aGVsbG8=' }, dictionaries: [] };
  await store.set(1, source); source.word = '犬';
  await store.set(2, { word: '鳥' });
  assert.equal((await store.get(1)).draft.word, '猫');
  const restarted = createSessionDraftStore(storage);
  assert.equal((await restarted.get(2)).draft.word, '鳥');
  await restarted.set(1, null); assert.deepEqual(await store.get(1), { draft: null });
  assert.ok(Object.keys(storage.entries).every(key => key.startsWith('at-anki-draft:')));
});

test('session transport limits memory, evicts oldest drafts and clears rejected stale content', async () => {
  const storage = memoryStorage(), store = createSessionDraftStore(storage);
  for (const tab of [1, 2, 3]) await store.set(tab, { word: String(tab), data: 'a'.repeat(3 * 1024 * 1024) });
  assert.deepEqual(await store.get(1), { draft: null });
  assert.equal((await store.get(3)).draft.word, '3');
  await assert.rejects(store.set(3, { word: 'too large', data: 'b'.repeat(7 * 1024 * 1024) }), /6 MB/);
  assert.deepEqual(await store.get(3), { draft: null });
  assert.throws(() => serializeAnkiDraft([]), /格式无效/);
});

const storage = memoryStorage();
let messageListener, removedListener, active = { id: 42, windowId: 7 }, captures = [], changedDuringCapture = false;
globalThis.chrome = {
  storage: { session: storage },
  runtime: { onMessage: { addListener(listener) { messageListener = listener; } }, getURL(path) { return 'chrome-extension://test/' + path; } },
  tabs: { onRemoved: { addListener(listener) { removedListener = listener; } },
    async query() { return active ? [{ ...active }] : []; },
    async captureVisibleTab(windowId, options) { captures.push({ windowId, options }); if (changedDuringCapture) active = { id: 99, windowId: 7 }; return 'data:image/png;base64,aGVsbG8='; }
  }
};
await import('../src/platform/background.js');
const send = (message, sender = {}) => new Promise(resolve => messageListener(message, sender, resolve));

test('background popup gets active-tab draft; content frames cannot read another tab draft', async () => {
  active = { id: 42, windowId: 7 };
  assert.deepEqual(await send({ action: 'anki_draft_set', draft: { word: '猫' } }, { tab: { id: 42, windowId: 7 } }), { saved: true });
  assert.equal((await send({ action: 'anki_draft_get' })).draft.word, '猫');
  assert.deepEqual(await send({ action: 'anki_draft_get' }, { tab: { id: 99, windowId: 7 } }), { draft: null });
  removedListener(42); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(await send({ action: 'anki_draft_get' }), { draft: null });
});

test('visible screenshot verifies active sender before and after capture', async () => {
  active = { id: 42, windowId: 7 }; captures = []; changedDuringCapture = false;
  const result = await send({ action: 'capture_visible_tab' }, { tab: { id: 42, windowId: 7 } });
  assert.equal(result.dataURL, 'data:image/png;base64,aGVsbG8=');
  assert.deepEqual(captures, [{ windowId: 7, options: { format: 'png' } }]);
  const rejected = await send({ action: 'capture_visible_tab' }, { tab: { id: 99, windowId: 7 } });
  assert.match(rejected.error, /当前标签页/); assert.equal(captures.length, 1);
  changedDuringCapture = true;
  assert.match((await send({ action: 'capture_visible_tab' }, { tab: { id: 42, windowId: 7 } })).error, /当前标签页|发生变化/);
  const manifest = JSON.parse(await readFile(new URL('../src/platform/manifest.json', import.meta.url), 'utf8'));
  assert.ok(manifest.permissions.includes('activeTab'));
  assert.equal(manifest.host_permissions.includes('<all_urls>'), false);
});
