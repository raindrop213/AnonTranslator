import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDictionarySearchURL, placeDictionaryPopup } from '../src/reader/dictionary-layout.js';

const viewport = { left: 8, top: 8, right: 1192, bottom: 792 };
const requested = { width: 424, height: 470 };
const overlaps = (popup, word) => popup.left < word.right && popup.left + popup.width > word.left && popup.top < word.bottom && popup.top + popup.height > word.top;

test('horizontal text uses above/below, clearing selected and following words', () => {
  const word = { left: 500, top: 150, right: 560, bottom: 180 };
  const popup = placeDictionaryPopup(word, viewport, requested);
  assert.equal(popup.side, 'below');
  assert.equal(overlaps(popup, word), false);
  assert.equal(overlaps(popup, { left: 560, top: 150, right: 700, bottom: 180 }), false);
  assert.equal(placeDictionaryPopup({ left: 500, top: 730, right: 560, bottom: 760 }, viewport, requested).side, 'above');
});

test('vertical text uses the side of the selected column', () => {
  const word = { left: 500, top: 150, right: 530, bottom: 210 };
  const popup = placeDictionaryPopup(word, viewport, requested, 'vertical-rl');
  assert.equal(popup.side, 'left');
  assert.equal(overlaps(popup, word), false);
  assert.equal(overlaps(popup, { left: 500, top: 210, right: 530, bottom: 300 }), false);
  assert.equal(placeDictionaryPopup(word, viewport, requested, 'vertical-lr').side, 'right');
});

test('small requested windows retain their dimensions in either writing direction', () => {
  const word = { left: 600, top: 150, right: 630, bottom: 210 };
  const popup = placeDictionaryPopup(word, viewport, { width: 220, height: 160 }, 'vertical-rl');
  assert.equal(popup.width, 220);
  assert.equal(popup.height, 160);
  assert.equal(overlaps(popup, word), false);
});

test('limited space clamps only displayed dimensions and keeps a resize on its side', () => {
  const word = { left: 110, top: 110, right: 140, bottom: 140 }, small = { left: 8, top: 8, right: 292, bottom: 292 };
  const popup = placeDictionaryPopup(word, small, requested);
  assert.ok(popup.left >= small.left && popup.top >= small.top);
  assert.ok(popup.left + popup.width <= small.right && popup.top + popup.height <= small.bottom);
  assert.equal(overlaps(popup, word), false);
  assert.deepEqual(requested, { width: 424, height: 470 });
  const resized = placeDictionaryPopup({ left: 500, top: 400, right: 560, bottom: 430 }, viewport, { width: 500, height: 600 }, 'horizontal-tb', 'below');
  assert.equal(resized.side, 'below');
  assert.equal(resized.height, 354);
});

test('network search uses the current encoded query and rejects unsafe templates', () => {
  assert.equal(buildDictionarySearchURL('https://example.com/?q={word}&repeat={word}', ' 濡らし & 猫 '), 'https://example.com/?q=%E6%BF%A1%E3%82%89%E3%81%97%20%26%20%E7%8C%AB&repeat=%E6%BF%A1%E3%82%89%E3%81%97%20%26%20%E7%8C%AB');
  for (const template of ['javascript:{word}', 'https://user:password@example.com/?q={word}', 'https://example.com/no-placeholder']) assert.equal(buildDictionarySearchURL(template, '猫'), null);
  assert.equal(buildDictionarySearchURL(undefined, ''), null);
});
