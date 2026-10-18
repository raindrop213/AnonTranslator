import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const bundle = buildSync({ entryPoints: [fileURLToPath(new URL('../src/reader/anki-panel.js', import.meta.url))], bundle: true, format: 'esm', write: false, loader: { '.css': 'text' } });
const { imageDimensions, validateImageDimensions, toHiragana, sentenceMarkup } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64'));

test('sentence editor starts with editable bold markup at the selected occurrence', () => {
  const context = { sentence: '猫と猫 & <本>', selectedText: '猫', sentenceRange: [2, 3] };
  assert.equal(sentenceMarkup(context), '猫と<b>猫</b> &amp; &lt;本&gt;');
  assert.equal(sentenceMarkup(context, false), '猫と猫 &amp; &lt;本&gt;');
  assert.equal(sentenceMarkup({ sentence: '彼は濡らした。', word: '濡らす', selectedText: '濡らし' }), '彼は<b>濡らし</b>た。');
  assert.equal(sentenceMarkup({ sentence: '彼は濡らした。', word: '不明' }), '彼は濡らした。');
});

test('reading fields convert to hiragana without changing kanji', () => {
  assert.equal(toHiragana('ヌラシ・日本語'), 'ぬらし・日本語');
});

test('image headers expose dimensions before expensive native decoding', () => {
  const png = new Uint8Array(32), pngView = new DataView(png.buffer);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]); pngView.setUint32(16, 1920); pngView.setUint32(20, 1080);
  assert.deepEqual(imageDimensions(png, 'image/png'), { width: 1920, height: 1080 });
  const gif = new Uint8Array(16); gif.set(new TextEncoder().encode('GIF89a')); new DataView(gif.buffer).setUint16(6, 640, true); new DataView(gif.buffer).setUint16(8, 480, true);
  assert.deepEqual(imageDimensions(gif, 'image/gif'), { width: 640, height: 480 });
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 8, 8, 1, 0xe0, 2, 0x80, 0]);
  assert.deepEqual(imageDimensions(jpeg, 'image/jpeg'), { width: 640, height: 480 });
  const webp = new Uint8Array(32); webp.set(new TextEncoder().encode('RIFF'), 0); webp.set(new TextEncoder().encode('WEBPVP8X'), 8); webp.set([0x7f, 2, 0], 24); webp.set([0xdf, 1, 0], 27);
  assert.deepEqual(imageDimensions(webp, 'image/webp'), { width: 640, height: 480 });
  assert.throws(() => imageDimensions(new Uint8Array([1, 2, 3]), 'image/png'), /无法识别/);
});

test('oversized image dimensions are rejected before native bitmap allocation', () => {
  assert.doesNotThrow(() => validateImageDimensions({ width: 3840, height: 2160 }));
  for (const size of [{ width: 0, height: 1 }, { width: 9000, height: 1 }, { width: 8192, height: 8192 }]) assert.throws(() => validateImageDimensions(size), /图片尺寸过大/);
});
