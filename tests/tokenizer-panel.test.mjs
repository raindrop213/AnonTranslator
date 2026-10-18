import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountTokenizerPanel } from '../src/settings/tokenizer-panel.js';

class Element {
  children = []; listeners = new Map(); attributes = new Map(); dataset = {};
  constructor(ownerDocument, tagName = 'div') { this.ownerDocument = ownerDocument; this.tagName = tagName.toUpperCase(); }
  append(...elements) { for (const element of elements) { element.parentElement = this; this.children.push(element); } }
  prepend(element) { element.parentElement = this; this.children.unshift(element); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  click() { this.listeners.get('click')?.({ target: this }); }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const missing = () => ({ state: 'missing', completed: 0, total: 12 });
const installed = () => ({ state: 'installed', completed: 12, total: 12 });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function fixture(t, { enabled = false, status = missing(), requestServiceAccess, beforeRemove } = {}) {
  const doc = new EventTarget();
  doc.createElement = tag => new Element(doc, tag);
  doc.defaultView = new EventTarget(); doc.visibilityState = 'visible';
  const section = new Element(doc), toggleRow = new Element(doc), toggle = new Element(doc, 'input');
  toggleRow.append(toggle); section.append(toggleRow);
  const subscribers = new Set(), permissionWatchers = new Set(), calls = [], writes = [];
  const store = {
    values: { dictionaryEnabled: enabled },
    subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
    async set(key, value) { writes.push([key, value]); this.values[key] = value; for (const callback of subscribers) callback(this.values); }
  };
  const env = { status, install: { state: 'installing', completed: 0, total: 12 }, remove: missing() };
  const platform = {
    requestServiceAccess,
    watchServiceAccess(callback) { permissionWatchers.add(callback); return () => permissionWatchers.delete(callback); },
    async send(message) {
      calls.push(message.action);
      const response = env[message.action === 'tokenizer_data_status' ? 'status' : message.action === 'tokenizer_data_install' ? 'install' : 'remove'];
      return typeof response === 'function' ? response() : response;
    }
  };
  const panel = mountTokenizerPanel(section, store, platform, { toggle, beforeRemove });
  const box = section.children[0], button = box.children[0].children[1], message = box.children[1], hint = toggleRow.children[1];
  t.after(() => panel.destroy());
  return { panel, env, button, message, hint, calls, writes, store, subscribers, permissionWatchers, box, toggle, doc };
}

test('opening settings only checks data and keeps legacy enabled settings unchanged', async t => {
  const f = fixture(t, { enabled: true }); await flush();
  assert.deepEqual(f.calls, ['tokenizer_data_status']);
  assert.deepEqual(f.writes, []);
  assert.equal(f.store.values.dictionaryEnabled, true);
  assert.equal(f.panel.canEnable(), false);
  assert.match(f.hint.textContent, /已开启.*先安装/);
  assert.equal(f.button.type, 'button');
  assert.match(f.button.textContent, /安装.*17 MB/);
});

test('Chrome installation uses existing permissions without a separate permission request', async t => {
  const f = fixture(t, { requestServiceAccess() { assert.fail('installation must not request separate permissions'); } });
  await flush(); f.button.click();
  assert.deepEqual(f.calls, ['tokenizer_data_status', 'tokenizer_data_install']);
  assert.equal(f.button.disabled, true);
  f.button.click(); await flush();
  assert.deepEqual(f.calls, ['tokenizer_data_status', 'tokenizer_data_install']);
  assert.match(f.message.textContent, /0\/12/);
  assert.equal(f.panel.canEnable(), false);
});

test('userscript installation polls until complete and then allows enabling', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t); await flush(); f.button.click(); await flush();
  f.env.status = { state: 'installing', completed: 6, total: 12 };
  t.mock.timers.tick(1000); await flush();
  assert.match(f.message.textContent, /6\/12/);
  f.env.status = installed(); t.mock.timers.tick(1000); await flush();
  assert.equal(f.button.textContent, '删除');
  assert.equal(f.panel.canEnable(), true);
  assert.equal(f.hint.hidden, true);
  const requestCount = f.calls.length;
  t.mock.timers.tick(10000); await flush();
  assert.equal(f.calls.length, requestCount);
  assert.deepEqual(f.writes, []);
});

test('partially installed data can be resumed and permission changes restore status', async t => {
  const f = fixture(t, { status: { state: 'partial', completed: 5, total: 12 } }); await flush();
  assert.equal(f.button.textContent, '继续安装');
  assert.match(f.message.textContent, /5\/12/);
  f.button.click(); await flush(); assert.ok(f.calls.includes('tokenizer_data_install'));
  f.env.status = installed(); for (const callback of f.permissionWatchers) callback(); await flush();
  assert.equal(f.panel.canEnable(), true);
  assert.equal(f.button.textContent, '删除');
});

test('download request failures produce a readable message and allow retry', async t => {
  const f = fixture(t);
  f.env.install = () => { throw new Error('https://private.example/?secret=oops'); };
  await flush(); f.button.click(); await flush();
  assert.match(f.message.textContent, /重试/);
  assert.doesNotMatch(f.message.textContent, /private|secret/);
  assert.equal(f.button.disabled, false);
  f.env.install = installed(); f.button.click(); await flush();
  assert.equal(f.panel.canEnable(), true);
});

test('the dictionary download source is included with default Chrome host permissions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../src/platform/manifest.json', import.meta.url), 'utf8'));
  assert.ok(manifest.host_permissions.includes('https://cdn.jsdelivr.net/*'));
});

test('deleting data waits for prior settings writes and disables local segmentation', async t => {
  const pending = deferred(); let beforeRemoveCalled = false;
  const f = fixture(t, { enabled: true, status: installed(), requestServiceAccess() { assert.fail('deleting must not request download access'); }, beforeRemove() { beforeRemoveCalled = true; return pending.promise; } });
  await flush(); f.button.click(); await flush();
  assert.equal(beforeRemoveCalled, true);
  assert.equal(f.panel.canEnable(), false);
  assert.deepEqual(f.calls, ['tokenizer_data_status']);
  pending.resolve(); await flush();
  assert.deepEqual(f.calls, ['tokenizer_data_status', 'tokenizer_data_remove']);
  assert.deepEqual(f.writes, [['dictionaryEnabled', false]]);
  assert.equal(f.store.values.dictionaryEnabled, false);
  assert.match(f.button.textContent, /安装/);
});

test('destroy removes subscriptions, polling, and ignores pending responses', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t, { status: { state: 'installing', completed: 4, total: 12 } }); await flush();
  const pending = deferred(); f.env.status = () => pending.promise;
  t.mock.timers.tick(1000); await flush();
  f.panel.destroy();
  assert.equal(f.subscribers.size, 0); assert.equal(f.permissionWatchers.size, 0);
  assert.equal(f.toggle.attributes.has('aria-describedby'), false);
  pending.resolve(installed()); await flush();
  assert.match(f.message.textContent, /4\/12/);
  const requestCount = f.calls.length;
  t.mock.timers.tick(10000); await flush(); assert.equal(f.calls.length, requestCount);
});

test('backend status failure can be retried without leaking an exception', async t => {
  const f = fixture(t, { status() { throw new Error('server credentials or request headers'); } });
  await flush();
  assert.equal(f.button.textContent, '重试安装');
  assert.match(f.message.textContent, /无法检查/);
  assert.doesNotMatch(f.message.textContent, /credentials|headers/);
  f.env.install = installed(); f.button.click(); await flush();
  assert.equal(f.panel.canEnable(), true);
});

test('installation errors expose the backend explanation as plain text', async t => {
  const f = fixture(t, { status: { state: 'error', completed: 4, total: 12, error: '分词数据校验失败，请重试安装。' } });
  await flush();
  assert.equal(f.message.textContent, '分词数据校验失败，请重试安装。');
  f.env.install = { state: 'error', completed: 4, total: 12, error: '未授权访问分词数据下载接口。' };
  f.button.click(); await flush();
  assert.equal(f.message.textContent, '未授权访问分词数据下载接口。');
  assert.equal(f.button.textContent, '重试安装');
});

test('returning to a visible settings page refreshes changes made in another tab', async t => {
  const f = fixture(t); await flush();
  f.env.status = installed();
  f.doc.defaultView.dispatchEvent(new Event('focus')); await flush();
  assert.equal(f.panel.canEnable(), true);
  f.env.status = missing(); f.doc.visibilityState = 'hidden';
  const beforeHidden = f.calls.length;
  f.doc.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(f.calls.length, beforeHidden);
  f.doc.visibilityState = 'visible';
  f.doc.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(f.panel.canEnable(), false);
  f.panel.destroy(); const afterDestroy = f.calls.length;
  f.doc.defaultView.dispatchEvent(new Event('focus'));
  f.doc.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(f.calls.length, afterDestroy);
});
