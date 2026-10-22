import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('.', import.meta.url));
const { version } = JSON.parse(await readFile(new URL('package.json', import.meta.url)));
const dist = path.resolve(root, 'dist'), extension = path.join(dist, 'extension');
if (path.dirname(dist) !== path.resolve(root) || path.basename(dist) !== 'dist') throw new Error('构建目录错误');
await rm(dist, { recursive: true, force: true });
await mkdir(extension, { recursive: true });
const thirdPartyNotices = (await Promise.all([
  ['Kuromoji (Apache-2.0)', 'kuromoji/LICENSE-2.0.txt'], ['IPADIC notice', 'kuromoji/NOTICE.md'],
  ['DoubleArray (MIT)', 'doublearray/LICENSE.txt'], ['fflate (MIT)', 'fflate/LICENSE']
].map(async ([name, file]) => `${name}\n${await readFile(path.join(root, 'node_modules', file), 'utf8')}`))).join('\n\n');

const bundles = [
  ['extension/content.js', `import './src/platform/content.js';`],
  ['extension/background.js', `import './src/platform/background.js';`],
  ['extension/offscreen.js', `import { registerAudioPage } from './src/services/speech.js'; registerAudioPage();`],
  ['tampermonkey/AnonTranslator.user.js', `import './src/platform/userscript.js';`]
];
const metadata = `// ==UserScript==
// @name         AnonTranslator
// @namespace    https://github.com/raindrop213/AnonTranslator
// @version      ${version}
// @description  日语分词查词、复制、朗读与翻译网页段落
// @author       raindrop213
// @license      MIT
// @match        http://*/*
// @match        https://*/*
// @match        file:///*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @connect      api.github.com
// @connect      translate-pa.googleapis.com
// @connect      m.youdao.com
// @connect      www.weblio.jp
// @connect      weblio.jp
// @connect      cdn.weblio.jp
// @connect      c.weblio.jp
// @connect      api.mojidict.com
// @connect      cdn.jsdelivr.net
// @connect      translate.volcengine.com
// @connect      127.0.0.1
// @connect      localhost
// @connect      *
// ==/UserScript==
`;
for (const [file, contents] of bundles) {
  await build({ stdin: { contents, resolveDir: root }, outfile: path.join(dist, file),
    bundle: true, format: 'iife', target: 'chrome116', charset: 'utf8', legalComments: 'none',
    loader: { '.html': 'text', '.css': 'text', '.png': 'dataurl' },
    banner: { js: file.endsWith('.user.js') ? `${metadata}\n/*\n${thirdPartyNotices.replace(/\*\//g, '* /')}\n*/` : '' }
  });
}
const manifest = JSON.parse(await readFile(path.join(root, 'src/platform/manifest.json'), 'utf8'));
manifest.version = version;
await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await cp(path.join(root, 'assets/img'), path.join(extension, 'assets/img'), { recursive: true });
await writeFile(path.join(extension, 'THIRD_PARTY_LICENSES.txt'), thirdPartyNotices);
await cp(path.join(root, 'LICENSE'), path.join(extension, 'LICENSE'));
await cp(path.join(root, 'src/platform/anki-preview.html'), path.join(extension, 'anki-preview.html'));
const html = (title, script, css = '') => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${css ? `<link rel="stylesheet" href="${css}">` : ''}</head><body><script src="${script}"></script></body></html>\n`;
await writeFile(path.join(extension, 'offscreen.html'), html('AnonTranslator 语音', 'offscreen.js'));
console.log(`完成 v${version}：dist/extension 和 dist/tampermonkey`);
