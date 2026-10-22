import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');

test('一次构建生成可安装的 Chrome 扩展和油猴脚本', async () => {
  await promisify(execFile)(process.execPath, ['build.mjs'], { cwd: fileURLToPath(root) });
  const metadata = JSON.parse(await read('package.json'));
  const manifest = JSON.parse(await read('dist/extension/manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, metadata.version);
  assert.deepEqual(manifest.sandbox.pages, ['anki-preview.html']);
  assert(manifest.web_accessible_resources.some(entry => entry.resources.includes('anki-preview.html')));
  assert.equal(await read('dist/extension/anki-preview.html'), await read('src/platform/anki-preview.html'));

  const scripts = new Set([manifest.background.service_worker]);
  for (const content of manifest.content_scripts) {
    for (const file of content.js) scripts.add(file);
    for (const file of content.css || []) assert.ok(await read('dist/extension/' + file));
  }
  for (const file of scripts) {
    const source = await read('dist/extension/' + file);
    assert.doesNotThrow(() => new Script(source, { filename: file }));
  }
  for (const file of Object.values(manifest.icons)) {
    const copied = await readFile(new URL('dist/extension/' + file, root));
    const original = await readFile(new URL(file, root));
    assert.deepEqual(copied, original);
  }
  const offscreen = await read('dist/extension/offscreen.html');
  const offscreenScript = offscreen.match(/<script src="([^"]+)"/)[1];
  const offscreenCode = await read('dist/extension/' + offscreenScript);
  assert.doesNotThrow(() => new Script(offscreenCode));
  const userscript = await read('dist/tampermonkey/AnonTranslator.user.js');
  assert.match(userscript, /^\/\/ ==UserScript==/);
  assert.equal(userscript.match(/^\/\/ @version\s+(.+)$/m)[1].trim(), metadata.version);
  assert.doesNotThrow(() => new Script(userscript, { filename: 'AnonTranslator.user.js' }));
  assert.ok((await read('dist/extension/THIRD_PARTY_LICENSES.txt')).includes('Kuromoji'));
});
