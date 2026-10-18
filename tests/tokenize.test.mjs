import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTokenizer } from '../src/services/tokenize.js';

let loads = 0;
const load = async file => { loads++; return readFile(new URL(`../node_modules/kuromoji/dict/${file}`, import.meta.url)); };
const tokenize = createTokenizer(load);

test('IPADIC separates the requested inflections and exposes lookup forms', async () => {
  const result = await tokenize('濡らした。滑らしる。');
  assert.deepEqual(result.tokens.map(t => t.surface), ['濡らし','た','。','滑らし','る','。']);
  assert.equal(result.tokens[0].base, '濡らす');
  assert.equal(result.tokens[3].base, '滑らす');
  assert.equal(result.tokens[0].reading, 'ヌラシ');
  assert.equal(result.tokens[0].pos, '動詞');
});
test('DOM offsets remain correct across whitespace, supplementary characters and lines', async () => {
  const text = '😀 彼は\n濡らした。';
  const { tokens } = await tokenize(text);
  assert(tokens.some(t => t.surface === '濡らし'));
  for (const token of tokens) assert.equal(text.slice(token.start, token.end), token.surface);
  assert.equal(tokens.find(t => t.surface === '彼').start, text.indexOf('彼'));
  assert.equal(loads, 12, 'an initialized dictionary is reused');
});
test('failed initialization can be retried', async () => {
  let fail = true;
  const retry = createTokenizer(async file => { if (fail) throw new Error('offline'); return load(file); });
  await assert.rejects(retry('猫'), /offline/);
  fail = false;
  assert.equal((await retry('猫')).tokens[0].surface, '猫');
});
