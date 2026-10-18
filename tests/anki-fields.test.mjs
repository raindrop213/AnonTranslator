import test from 'node:test';
import assert from 'node:assert/strict';
import { ankiDraftFields, escapeHTML, plainText } from '../src/services/anki-fields.js';
import { ankiFields } from '../src/services/anki-model.js';

test('shared draft fields preserve editable HTML and newlines while escaping plain fields', () => {
  const draft = {
    word: '猫 & 犬', reading: 'ネコ<いぬ>',
    sentence: '<b>猫</b>と犬。\n次の文<br>続き', translation: '  <i>猫和狗</i>\n第二行  ',
    sourceURL: 'https://example.com/read?a=1&b=2', sourceTitle: '<物語> & 小説'
  };
  const fields = ankiDraftFields(draft);
  assert.deepEqual(Object.keys(fields), ankiFields);
  assert.equal(fields.Word, '猫 &amp; 犬');
  assert.equal(fields.Reading, 'ネコ&lt;いぬ&gt;');
  assert.equal(fields.Sentence, draft.sentence);
  assert.equal(fields.Translation, draft.translation);
  assert.equal(fields.SourceURL, 'https://example.com/read?a=1&amp;b=2');
  assert.equal(fields.SourceTitle, '&lt;物語&gt; &amp; 小説');
  assert.equal(fields.WordAudio, ''); assert.equal(fields.SentenceAudio, ''); assert.equal(fields.Image, '');
  assert.equal(ankiDraftFields({ translation: '' }).Translation, '');
});

test('dictionary JSON encodes once without reordering or altering the source entries', () => {
  const entries = [
    { id: 'moji', name: 'MOJi', html: '<p>猫 &amp; 犬</p>', styles: 'p{color:red}' },
    { id: 'weblio', name: 'Weblio', html: '<img src="https://example.com/猫.png">', styles: '' }
  ];
  const copy = structuredClone(entries), fields = ankiDraftFields({ dictionaries: entries });
  assert.deepEqual(JSON.parse(plainText(fields.DictionaryData)), entries);
  assert.deepEqual(entries, copy);
  assert.deepEqual(JSON.parse(plainText(ankiDraftFields({ dictionaries: [...entries].reverse() }).DictionaryData)), [...entries].reverse());
});

test('draft mapping rejects malformed and oversized dictionaries', () => {
  for (const dictionaries of ['[]', {}, [null], [[]], new Array(9).fill({})]) {
    assert.throws(() => ankiDraftFields({ dictionaries }), /词典内容格式无效/);
  }
  assert.throws(() => ankiDraftFields({ dictionaries: [{ html: 'x'.repeat(3 * 1024 * 1024 + 1) }] }), /词典内容过大/);
  assert.throws(() => ankiDraftFields({ dictionaries: [{ styles: 'x'.repeat(1024 * 1024 + 1) }] }), /词典内容过大/);
});

test('source links accept only HTTP and HTTPS and safely escape fallback titles', () => {
  for (const sourceURL of ['javascript:alert(1)', 'data:text/html,test', 'file:///book.html', 'blob:https://example.com/id', 'invalid']) {
    const fields = ankiDraftFields({ sourceURL });
    assert.equal(fields.SourceURL, ''); assert.equal(fields.SourceTitle, '');
  }
  assert.equal(ankiDraftFields({ sourceURL: 'http://example.com/?a=1&b=2' }).SourceTitle, 'http://example.com/?a=1&amp;b=2');
});

test('plain text for speech strips formatting, preserves line breaks and decodes entities once', () => {
  assert.equal(plainText('  <b>猫</b>&nbsp;&amp; 犬<br>次<BR />行<br/>終\n&#x3042;&#12356;  '), '猫 & 犬\n次\n行\n終\nあい');
  assert.equal(plainText('&lt;b&gt;猫&lt;/b&gt; &amp;lt; &bogus; &#99999999;'), '<b>猫</b> &lt; &bogus; &#99999999;');
  assert.equal(escapeHTML('"\'<>&'), '&quot;&#39;&lt;&gt;&amp;');
});
