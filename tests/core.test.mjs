import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, normalizeSetting, normalizeSettings } from '../src/settings/settings.js';
import { ankiDraftFields, plainText } from '../src/services/anki-fields.js';
import { ankiFields } from '../src/services/anki-model.js';
import { ankiPreviewFields, ankiPreviewDocument, ankiPreviewSpeech } from '../src/settings/anki-preview.js';
import { createSpeaker } from '../src/services/speech.js';
import { createAnkiService } from '../src/services/anki.js';
import { buildDictionarySearchURL, placeDictionaryPopup } from '../src/reader/dictionary-layout.js';
import { hiragana, readingParts } from '../src/reader/word-reading.js';
import { cachedTranslation, cancelTranslation } from '../src/services/translate.js';

test('numeric preferences accept their boundaries and preserve a fully hidden docked icon', () => {
  for (const key of ['dockedIconOpacity', 'panelTransparency', 'posOpacity']) {
    assert.equal(normalizeSetting(key, '0'), 0);
    assert.equal(normalizeSetting(key, 100), 100);
    for (const value of [-1, 101, 0.5, '', NaN, Infinity]) {
      assert.throws(() => normalizeSetting(key, value), undefined, `${key}: ${value}`);
    }
  }
  assert.equal(normalizeSettings({ dockedIconOpacity: '0' }).dockedIconOpacity, 0);
  assert.equal(normalizeSetting('panelBlur', 20), 20);
  assert.throws(() => normalizeSetting('panelBlur', 21));
  assert.equal(normalizeSetting('rate', 0.1), 0.1);
  assert.throws(() => normalizeSetting('rate', 0));
});

test('service addresses require explicit HTTP URLs and reject credentials or unintended URL parts', () => {
  for (const key of ['ankiURL', 'vitsAPI']) {
    assert.equal(normalizeSetting(key, ' http://127.0.0.1:8765/ '), 'http://127.0.0.1:8765');
    assert.equal(normalizeSetting(key, 'https://speech.example/api/'), 'https://speech.example/api');
    for (const value of ['127.0.0.1:8765', '//speech.example', 'javascript:alert(1)',
      'file:///book.html', 'https://user:password@speech.example',
      'https://speech.example/?token=x', 'https://speech.example/#fragment']) {
      assert.throws(() => normalizeSetting(key, value), undefined, `${key}: ${value}`);
    }
  }
  assert.equal(normalizeSetting('vitsCustomAPI', ''), '');
  assert.equal(normalizeSetting('vitsCustomAPI', 'https://speech.example/voice?id=2&lang=ja'),
    'https://speech.example/voice?id=2&lang=ja');
  assert.throws(() => normalizeSetting('vitsCustomAPI', 'https://user:password@speech.example/voice'));
});

test('Anki fields preserve editable HTML while plain fields and speech text are handled safely', () => {
  const draft = { word: '猫 & <犬>', reading: 'ネコ<いぬ>',
    sentence: '<b>猫</b>と犬。\n次の文<br>続き', translation: '<i>猫和狗</i>\n第二行',
    sourceURL: 'https://example.com/read?a=1&b=2', sourceTitle: '<物語> & 小説' };
  const fields = ankiDraftFields(draft);
  assert.deepEqual(Object.keys(fields), ankiFields);
  assert.equal(fields.Word, '猫 &amp; &lt;犬&gt;');
  assert.equal(fields.Reading, 'ネコ&lt;いぬ&gt;');
  assert.equal(fields.Sentence, draft.sentence);
  assert.equal(fields.Translation, draft.translation);
  assert.equal(fields.SourceURL, 'https://example.com/read?a=1&amp;b=2');
  assert.equal(fields.SourceTitle, '&lt;物語&gt; &amp; 小説');
  assert.equal(fields.WordAudio + fields.SentenceAudio + fields.Image, '');
  for (const sourceURL of ['javascript:alert(1)', 'data:text/html,test', 'file:///book.html', 'invalid']) {
    assert.equal(ankiDraftFields({ sourceURL }).SourceURL, '');
  }
  assert.equal(plainText('  <b>猫</b>&nbsp;&amp; 犬<br>次<BR />行\n&#x3042;&#12356;  '), '猫 & 犬\n次\n行\nあい');
  assert.equal(plainText('&lt;b&gt;猫&lt;/b&gt; &amp;lt; &bogus; &#99999999;'), '<b>猫</b> &lt; &bogus; &#99999999;');
});

test('dictionary export escapes JSON once, preserves provider order and rejects invalid or oversized content', () => {
  const entries = [
    { id: 'moji', name: 'MOJi', html: '<p>猫 &amp; 犬</p>', styles: 'p{color:red}' },
    { id: 'weblio', name: 'Weblio', html: '<script>example()</script><img src="https://example.com/猫.png">', styles: '' }
  ];
  const before = structuredClone(entries), data = ankiDraftFields({ dictionaries: entries }).DictionaryData;
  assert(!data.includes('<script>'));
  assert.deepEqual(JSON.parse(plainText(data)), entries);
  assert.deepEqual(entries, before);
  const reversed = [...entries].reverse();
  assert.deepEqual(JSON.parse(plainText(ankiDraftFields({ dictionaries: reversed }).DictionaryData)), reversed);
  for (const dictionaries of ['[]', {}, [null], [[]], new Array(9).fill({})]) {
    assert.throws(() => ankiDraftFields({ dictionaries }), /词典内容格式无效/);
  }
  for (const entry of [{ html: 'x'.repeat(3 * 1024 * 1024 + 1) }, { styles: 'x'.repeat(1024 * 1024 + 1) }]) {
    assert.throws(() => ankiDraftFields({ dictionaries: [entry] }), /词典内容过大/);
  }
});

test('Anki preview uses the current draft, renders template fields and isolates local media and styles', () => {
  const draft = { word: '猫 & <犬>', reading: 'ねこ', sentence: '<b>猫</b>&amp;犬。',
    translation: '<i>猫和狗。</i>', sourceURL: 'https://example.com/?a=1&b=2', sourceTitle: '物語',
    dictionaries: [{ id: 'moji', name: 'MOJi', html: '<p>猫。</p>', styles: '' }] };
  assert.deepEqual(ankiPreviewFields(draft), ankiDraftFields(draft));
  assert.equal(ankiPreviewFields({}).Word, '');
  const sample = ankiPreviewFields();
  assert.equal(sample.Word, '図書館');
  assert.match(sample.Sentence, /<b>図書館<\/b>/);
  assert.equal(JSON.parse(plainText(sample.DictionaryData)).length, 2);

  const front = '{{#Word}}<b>{{Word}}</b>{{#Reading}}<em>{{Reading}}</em>{{/Reading}}{{/Word}}'
    + '{{^Image}}<span>no image</span>{{/Image}}{{! hidden comment}}';
  const back = '{{FrontSide}}<hr>{{text:Sentence}}|{{#Translation}}{{Translation}}{{/Translation}}'
    + '{{^WordAudio}}silent{{/WordAudio}}{{#WordAudio}}unexpected{{/WordAudio}}';
  const frontHTML = '<b>猫 &amp; &lt;犬&gt;</b><em>ねこ</em><span>no image</span>';
  const body = html => html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
  assert.equal(body(ankiPreviewDocument(front, back, '', 'ankiFront', draft)), frontHTML);
  const document = ankiPreviewDocument(front, back, '.card{color:red}</STYLE><script>escape()</script>',
    'ankiBack', draft, { nightMode: true });
  assert.equal(body(document), frontHTML + '<hr>猫&amp;犬。|<i>猫和狗。</i>silent');
  assert.match(document, /http-equiv="Content-Security-Policy"/);
  for (const directive of ["default-src &#39;none&#39;", "connect-src &#39;none&#39;",
    "img-src data:", "base-uri &#39;none&#39;"]) assert(document.includes(directive));
  assert.equal((document.match(/<\/style\s*>/gi) || []).length, 1);
  assert(document.toLowerCase().includes('<\\/style>'));
  assert.match(document, /<body class="card nightMode">/);

  const image = { mime: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlK0loAAAAASUVORK5CYII=' };
  assert.match(ankiPreviewFields({ ...draft, image }).Image, /^<img[^>]+src="data:image\/png;base64,[A-Za-z\d+/=]+">$/);
  for (const invalid of [{ ...image, mime: 'image/svg+xml' }, { ...image, mime: 'image/png" onerror="alert(1)' },
    { ...image, data: 'https://example.com/image.png' }, { ...image, data: '%' }, { ...image, data: 'x' },
    { ...image, data: 'A'.repeat(28 * 1024 * 1024 + 4) }]) {
    const fields = ankiPreviewFields({ ...draft, image: invalid });
    assert.equal(fields.Image, '');
    assert.equal(fields.Word, '猫 &amp; &lt;犬&gt;');
  }
  assert.equal(sample.WordAudio + sample.SentenceAudio, '');
});

test('Anki preview playback follows each export audio service and translation accepts no providers', async () => {
  assert.deepEqual(normalizeSettings({ ankiTranslationServices: [] }).ankiTranslationServices, []);
  assert.deepEqual(normalizeSetting('ankiTranslationServices', []), []);
  const fields = ankiPreviewFields({ word: '猫 & 犬', sentence: '<b>猫</b>がいる。<br>犬も。' });
  const settings = { ...defaults, ankiWordAudioService: 'vits', ankiSentenceAudioService: 'huosh', useWindowsTTS: true, huoshRate: 2 };
  const calls = [], previousWindow = globalThis.window;
  globalThis.window = {};
  const speaker = createSpeaker({
    async send(message) { calls.push(message); return { audio: 'YXVkaW8=', mime: 'audio/wav' }; },
    async playAudio(response, rate) { calls.push({ response, rate }); },
    async stopAudio() {}
  });
  try {
    for (const kind of ['word', 'sentence']) {
      const job = ankiPreviewSpeech(kind, fields, settings);
      assert.equal(job.settings.useWindowsTTS, false);
      await speaker.speak(job.text, job.settings);
    }
    assert.deepEqual(calls.filter(call => call.action).map(call => [call.action, call.text]), [
      ['vits_audio', '猫 & 犬'], ['huosh_audio', '猫がいる。\n犬も。']
    ]);
    assert(calls.filter(call => call.response).every(call => call.rate === 1));
    assert.equal(ankiPreviewSpeech('word', fields, { ...settings, ankiWordAudioService: 'none' }), null);
    assert.equal(ankiPreviewSpeech('sentence', fields, { ...settings, ankiSentenceAudioService: 'none' }), null);
    assert.equal(ankiPreviewSpeech('invalid', fields, settings), null);
    const html = ankiPreviewDocument(defaults.ankiFront, defaults.ankiBack, defaults.ankiCSS, 'ankiBack', null, { playbackToken: 'preview-test' });
    assert.match(html, /data-at-preview-play="word"/);
    assert.match(html, /data-at-preview-play="sentence"/);
    assert.match(html, /parent.postMessage/);
    assert.match(html, /preview-test/);
    const silent = ankiPreviewDocument(defaults.ankiFront, defaults.ankiBack, defaults.ankiCSS, 'ankiBack', null, { playbackToken: 'preview-test', wordAudio: false, sentenceAudio: false, translationEnabled: false });
    assert.doesNotMatch(silent, /data-at-preview-play="(?:word|sentence)"/);
    assert.doesNotMatch(silent, /今天在图书馆读书/);
  } finally { speaker.destroy(); if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
});

test('dictionary search encodes the whole word in every placeholder and rejects unsafe destinations', () => {
  const word = '濡らし & 猫', encoded = encodeURIComponent(word);
  assert.equal(buildDictionarySearchURL('https://example.com/?q={word}&repeat={word}', ` ${word} `),
    `https://example.com/?q=${encoded}&repeat=${encoded}`);
  for (const template of ['javascript:{word}', 'https://user:password@example.com/?q={word}', 'https://example.com/no-placeholder']) {
    assert.equal(buildDictionarySearchURL(template, word), null);
  }
  assert.equal(buildDictionarySearchURL(undefined, ''), null);
});

test('dictionary placement follows writing direction, avoids the word and fits small viewports', () => {
  const viewport = { left: 8, top: 8, right: 1192, bottom: 792 }, requested = { width: 424, height: 470 };
  const cases = [
    [{ left: 500, top: 150, right: 560, bottom: 180 }, viewport, 'horizontal-tb', 'below'],
    [{ left: 500, top: 730, right: 560, bottom: 760 }, viewport, 'horizontal-tb', 'above'],
    [{ left: 500, top: 150, right: 530, bottom: 210 }, viewport, 'vertical-rl', 'right'],
    [{ left: 1000, top: 150, right: 1030, bottom: 210 }, viewport, 'vertical-rl', 'left'],
    [{ left: 110, top: 110, right: 140, bottom: 140 }, { left: 8, top: 8, right: 292, bottom: 292 }, 'horizontal-tb', null]
  ];
  for (const [anchor, view, mode, side] of cases) {
    const popup = placeDictionaryPopup(anchor, view, requested, mode);
    if (side) assert.equal(popup.side, side);
    assert(popup.width > 0 && popup.height > 0);
    assert(popup.left >= view.left && popup.top >= view.top);
    assert(popup.left + popup.width <= view.right && popup.top + popup.height <= view.bottom);
    assert(!(popup.left < anchor.right && popup.left + popup.width > anchor.left
      && popup.top < anchor.bottom && popup.top + popup.height > anchor.top));
  }
  assert.deepEqual(requested, { width: 424, height: 470 });
});

test('furigana annotates kanji without covering inflection kana and handles missing or misaligned readings', () => {
  assert.equal(hiragana('ヌラシ'), 'ぬらし');
  assert.deepEqual(readingParts('濡らし', 'ヌラシ'), [
    { text: '濡', start: 0, end: 1, reading: 'ぬ' },
    { text: 'らし', start: 1, end: 3, reading: '' }
  ]);
  assert.deepEqual(readingParts('取り戻す', 'トリモドス').map(part => [part.text, part.reading]),
    [['取', 'と'], ['り', ''], ['戻', 'もど'], ['す', '']]);
  for (const [word, reading] of [['食べ', '*'], ['タオル', 'タオル']]) {
    assert.equal(readingParts(word, reading)[0].reading, '');
  }
  assert.deepEqual(readingParts('今日も', 'キョウ'), [{ text: '今日も', start: 0, end: 3, reading: 'きょう' }]);
});

test('translation consumers share pending and completed work while changed inputs and failures remain independent', async () => {
  const message = { translator: 'google', text: '猫がいる。', from: 'ja', to: 'zh-CN' };
  let calls = 0, enter, release;
  const started = new Promise(resolve => { enter = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const request = async () => { calls++; enter(); await gate; return { json: async () => [['有猫。']] }; };
  const scope = 'core-shared-translation';
  try {
    const reading = cachedTranslation({ ...message, scope }, request);
    await started;
    const exporting = cachedTranslation(message, request);
    release();
    assert.deepEqual(await Promise.all([reading, exporting]), [{ translatedText: '有猫。' }, { translatedText: '有猫。' }]);
    assert.equal((await cachedTranslation(message, request)).translatedText, '有猫。');
    assert.equal(calls, 1);
    await cachedTranslation({ ...message, to: 'en' }, request);
    await cachedTranslation(message, (...args) => request(...args));
    assert.equal(calls, 3);
  } finally { release(); cancelTranslation(scope); }
  let attempts = 0;
  const retryable = async () => {
    if (++attempts === 1) throw new Error('temporary service failure');
    return { json: async () => [['重试成功']] };
  };
  await assert.rejects(cachedTranslation(message, retryable), /temporary service failure/);
  assert.equal((await cachedTranslation(message, retryable)).translatedText, '重试成功');
  assert.equal(attempts, 2);
});

test('Anki duplicate prompts do not write, confirmed adds preserve draft fields and undo deletes only the new note', async () => {
  const settings = { ...defaults, ankiEnabled: true, ankiModel: 'core-model', ankiDecks: '日语', ankiTags: '生词' };
  const draft = { word: '猫', reading: 'ねこ', sentence: '猫と<b>猫</b>を見た。', translation: '看见了猫。' };
  const noteInfo = (id, note) => ({ noteId: id, modelName: note.modelName, tags: [...note.tags], cards: [id + 1],
    fields: Object.fromEntries(ankiFields.map((name, order) => [name, { value: note.fields[name], order }])) });
  const notes = new Map([[100, noteInfo(100, { modelName: settings.ankiModel, tags: ['既存'], fields: ankiDraftFields(draft) })]]);
  const calls = [], readResponses = { version: 6, deckNames: ['日语'], modelNames: [settings.ankiModel],
    modelFieldNames: ankiFields, modelTemplates: { Japanese: { Front: settings.ankiFront, Back: settings.ankiBack } },
    modelStyling: { css: settings.ankiCSS } };
  const request = async (_url, options) => {
    const call = JSON.parse(options.body), { action, params } = call;
    assert.equal(call.version, 6);
    calls.push(call);
    let result;
    if (action === 'findNotes') result = [...notes.keys()];
    else if (action === 'notesInfo') result = params.notes.map(id => notes.get(id));
    else if (action === 'addNote') { notes.set(200, noteInfo(200, params.note)); result = 200; }
    else if (action === 'deleteNotes') { params.notes.forEach(id => notes.delete(id)); result = null; }
    else if (Object.hasOwn(readResponses, action)) result = readResponses[action];
    else assert.fail(`Unexpected AnkiConnect action: ${action}`);
    return { json: async () => ({ result, error: null }) };
  };
  const service = createAnkiService(request);
  assert.deepEqual(await service.add(settings, draft, 'ask'), { status: 'duplicate', noteIds: [100] });
  assert(calls.every(call => ['version', 'deckNames', 'modelNames', 'modelFieldNames', 'findNotes', 'notesInfo'].includes(call.action)));
  assert.deepEqual([...notes.keys()], [100]);
  assert.deepEqual(await service.add(settings, draft, 'duplicate'), { status: 'added', noteId: 200, undoAvailable: true });
  const added = calls.find(call => call.action === 'addNote').params.note;
  assert.deepEqual(Object.keys(added.fields), ankiFields);
  assert.deepEqual([added.fields.Word, added.fields.Reading, added.fields.Sentence, added.fields.Translation],
    [draft.word, draft.reading, draft.sentence, draft.translation]);
  assert.equal(added.deckName, '日语');
  assert.equal(added.options.allowDuplicate, true);
  await assert.rejects(service.undo(settings, false, 200), /先确认/);
  assert(!calls.some(call => call.action === 'deleteNotes'));
  assert.deepEqual(await service.undo(settings, true, 200), { status: 'undone', noteId: 200, undoAvailable: false });
  assert.deepEqual(calls.filter(call => call.action === 'deleteNotes').map(call => call.params), [{ notes: [200] }]);
  assert.deepEqual([...notes.keys()], [100]);
  assert.equal((await service.undoInfo(settings)).undoAvailable, false);
});
