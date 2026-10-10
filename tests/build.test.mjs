import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, access } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');

test('both Chrome manifests resolve packaged assets and scripts', async () => {
  for (const folder of ['', 'dist/chrome/']) {
    const manifest = JSON.parse(await read(`${folder}manifest.json`));
    assert.equal(manifest.version, JSON.parse(await read('package.json')).version);
    assert.equal(manifest.content_scripts[0].all_frames, true);
    assert.ok(manifest.host_permissions.includes('https://m.youdao.com/*'));
    assert.ok(manifest.host_permissions.includes('http://127.0.0.1/*'));
    assert.ok(manifest.host_permissions.includes('https://translate-pa.googleapis.com/*'));
    assert.ok(manifest.host_permissions.includes('https://translate.volcengine.com/*'));
    assert.ok(!manifest.host_permissions.some(host => /translate\.google\.com|translate\.googleapis\.com/.test(host)));
    assert.ok(!manifest.host_permissions.some(host => /deepl|caiyun/.test(host)));
    for (const file of [...Object.values(manifest.icons), manifest.action.default_popup, manifest.background.service_worker, ...manifest.content_scripts.flatMap(script => [...script.js, ...script.css])]) {
      await access(new URL(folder + file, root));
    }
  }
});

test('generated bundles parse and userscript declares the required GM capabilities', async () => {
  for (const file of ['dist/chrome/content.js', 'dist/chrome/background.js', 'dist/chrome/popup.js', 'dist/userscript/AnonTranslator.user.js']) {
    const source = await read(file);
    assert.doesNotThrow(() => new vm.Script(source, { filename: file }));
    assert.ok(!/translate\.google\.com|translate\.googleapis\.com|translation\.googleapis\.com/.test(source), `${file} must not include retired Google endpoints`);
  }
  const userscript = await read('dist/userscript/AnonTranslator.user.js');
  for (const grant of ['GM_setClipboard', 'GM_xmlhttpRequest', 'GM_addValueChangeListener', 'GM_registerMenuCommand']) assert.ok(userscript.includes(`// @grant        ${grant}`));
  assert.ok(userscript.startsWith('// ==UserScript=='));
  assert.ok(!userscript.includes('Buffer.from('));
  assert.ok(userscript.includes('// @connect      translate.volcengine.com'));
  assert.ok(!userscript.includes('App.voices.VITS'));
});
