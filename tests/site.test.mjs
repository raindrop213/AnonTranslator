import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsStore } from '../src/settings/settings.js';
import { createSiteUI } from '../src/platform/site-ui.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function memory(initial = {}) {
  const saved = { ...initial }, listeners = new Set();
  const emit = patch => { for (const listener of listeners) listener(patch); };
  const storage = { saved, listeners, error: null, acknowledge: null };
  storage.platform = {
    async getSettings() { return { ...saved }; },
    async setSettings(patch) {
      if (storage.error) throw storage.error;
      Object.assign(saved, patch); emit(patch);
      await storage.acknowledge?.(patch);
    },
    async removeSettings(keys) {
      if (storage.error) throw storage.error;
      for (const key of keys) delete saved[key];
      emit(Object.fromEntries(keys.map(key => [key, undefined])));
    },
    watchSettings(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
  return storage;
}

function widget() {
  return {
    opened: 0, dismissed: 0, destroyed: 0,
    open() { this.opened++; },
    dismiss() { this.dismissed++; },
    destroy() { this.destroyed++; }
  };
}

async function visit(t, storage, siteURL = 'https://novel.example/chapter/1', factory) {
  const store = createSettingsStore(storage.platform, { siteURL }), widgets = [];
  await store.init();
  const ui = createSiteUI(store, async () => {
    const item = factory ? await factory() : widget();
    widgets.push(item);
    return item;
  });
  const destroy = () => { ui.destroy(); store.destroy(); };
  t.after(destroy);
  await ui.ready;
  return { store, ui, widgets, destroy };
}

test('fresh installs and legacy global switches leave websites off without creating floating UI', async t => {
  for (const initial of [{}, { pluginSwitch: true }]) {
    const storage = memory(initial), page = await visit(t, storage);
    await storage.platform.setSettings({ pluginSwitch: true });
    await settle();
    assert.equal(page.store.values.pluginSwitch, false);
    assert.equal(page.widgets.length, 0);
    assert.equal(Object.hasOwn(storage.saved, 'at-site:novel.example'), false);
  }
});

test('explicit opening remembers this hostname, restores it on later visits and leaves other sites off', async t => {
  const storage = memory(), page = await visit(t, storage);
  await page.ui.open();
  assert.equal(storage.saved['at-site:novel.example'], true);
  assert.equal(page.widgets[0].opened, 1);
  assert.equal(Object.hasOwn(storage.saved, 'pluginSwitch'), false);

  const revisit = await visit(t, storage, 'http://novel.example:8080/chapter/2');
  const other = await visit(t, storage, 'https://other.example');
  assert.equal(revisit.store.values.pluginSwitch, true);
  assert.equal(revisit.widgets.length, 1);
  assert.equal(revisit.widgets[0].opened, 0);
  assert.equal(other.store.values.pluginSwitch, false);
  assert.equal(other.widgets.length, 0);
});

test('closing removes the website record and floating UI, and refresh remains off until another explicit open', async t => {
  const storage = memory(), page = await visit(t, storage);
  await page.ui.open();
  await page.store.set('pluginSwitch', false);
  await settle();
  assert.equal(Object.hasOwn(storage.saved, 'at-site:novel.example'), false);
  assert.equal(page.widgets[0].dismissed, 1);
  assert.equal(page.widgets[0].destroyed, 1);
  page.destroy();

  const refresh = await visit(t, storage);
  assert.equal(refresh.store.values.pluginSwitch, false);
  assert.equal(refresh.widgets.length, 0);
  await refresh.ui.open();
  assert.equal(refresh.widgets[0].opened, 1);
  assert.equal(storage.saved['at-site:novel.example'], true);
});

test('same-site tabs synchronize opening and closing while another remembered website stays enabled', async t => {
  const storage = memory({ 'at-site:other.example': true });
  const first = await visit(t, storage), second = await visit(t, storage);
  const other = await visit(t, storage, 'https://other.example');
  await first.ui.open();
  await settle();
  assert.equal(second.store.values.pluginSwitch, true);
  assert.equal(second.widgets.length, 1);
  assert.equal(second.widgets[0].opened, 0);

  await second.store.set('pluginSwitch', false);
  await settle();
  for (const page of [first, second]) {
    assert.equal(page.store.values.pluginSwitch, false);
    assert.equal(page.widgets[0].destroyed, 1);
  }
  assert.equal(other.store.values.pluginSwitch, true);
  assert.equal(other.widgets[0].destroyed, 0);
  assert.equal(storage.saved['at-site:other.example'], true);
});

test('closing during mounting survives late storage acknowledgements and a fast reopen never reveals the old panel', async t => {
  const storage = memory(), acknowledgement = deferred(), oldMount = deferred(), newMount = deferred();
  let firstWrite = true, mounts = 0;
  storage.acknowledge = () => {
    if (firstWrite) { firstWrite = false; return acknowledgement.promise; }
  };
  const page = await visit(t, storage, undefined, () => ++mounts === 1 ? oldMount.promise : newMount.promise);
  const otherTab = await visit(t, storage);
  const firstOpen = page.ui.open();
  await settle();
  await otherTab.store.set('pluginSwitch', false);
  acknowledgement.resolve();
  await firstOpen;
  assert.equal(page.store.values.pluginSwitch, false);
  assert.equal(Object.hasOwn(storage.saved, 'at-site:novel.example'), false);

  const secondOpen = page.ui.open();
  await settle();
  const fresh = widget(), old = widget();
  newMount.resolve(fresh);
  await secondOpen;
  oldMount.resolve(old);
  await settle();
  assert.equal(mounts, 2);
  assert.equal(fresh.opened, 1);
  assert.equal(fresh.destroyed, 0);
  assert.equal(old.opened, 0);
  assert.equal(old.destroyed, 1);
  assert.equal(storage.saved['at-site:novel.example'], true);
});

test('failed saves leave the visible state truthful, allow retry and dispose listeners and widgets cleanly', async t => {
  const storage = memory(), page = await visit(t, storage);
  storage.error = new Error('storage unavailable');
  await assert.rejects(page.ui.open(), /storage unavailable/);
  assert.equal(page.store.values.pluginSwitch, false);
  assert.equal(page.widgets.length, 0);
  assert.deepEqual(storage.saved, {});

  storage.error = null;
  await page.ui.open();
  storage.error = new Error('storage unavailable');
  await assert.rejects(page.store.set('pluginSwitch', false), /storage unavailable/);
  assert.equal(page.store.values.pluginSwitch, true);
  assert.equal(storage.saved['at-site:novel.example'], true);
  assert.equal(page.widgets[0].destroyed, 0);
  storage.error = null;
  await page.store.set('pluginSwitch', false);
  await settle();
  page.destroy(); page.destroy();
  assert.equal(page.widgets[0].destroyed, 1);
  assert.equal(storage.listeners.size, 0);
  await storage.platform.setSettings({ 'at-site:novel.example': true });
  await settle();
  assert.equal(page.widgets.length, 1);
});
