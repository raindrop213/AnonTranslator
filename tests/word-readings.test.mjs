import test from 'node:test';
import assert from 'node:assert/strict';
import { hiragana, readingParts } from '../src/reader/word-reading.js';

test('furigana follows kanji while visible inflection kana remains unannotated', () => {
  assert.deepEqual(readingParts('濡らし', 'ヌラシ'), [
    { text: '濡', start: 0, end: 1, reading: 'ぬ' },
    { text: 'らし', start: 1, end: 3, reading: '' }
  ]);
  assert.deepEqual(readingParts('取り戻す', 'トリモドス').map(part => [part.text, part.reading]), [['取', 'と'], ['り', ''], ['戻', 'もど'], ['す', '']]);
  assert.deepEqual(readingParts('日曜日', 'ニチヨウビ').map(part => [part.text, part.reading]), [['日曜日', 'にちようび']]);
});

test('missing readings, kana-only words and inconsistent kana alignment remain safe', () => {
  assert.equal(hiragana('ヌラシ'), 'ぬらし');
  assert.equal(readingParts('食べ', '*')[0].reading, '');
  assert.equal(readingParts('タオル', 'タオル')[0].reading, '');
  assert.deepEqual(readingParts('今日も', 'キョウ'), [{ text: '今日も', start: 0, end: 3, reading: 'きょう' }]);
});
