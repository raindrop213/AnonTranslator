import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnkiService, normalizeAnkiURL } from '../src/services/anki.js';
import { ankiFields, defaultAnkiFront, defaultAnkiBack } from '../src/services/anki-model.js';
import { vitsAudio } from '../src/services/speech.js';
import { readFile } from 'node:fs/promises';

const settings = { ankiEnabled: true, ankiURL: 'http://127.0.0.1:8765', ankiAPIKey: 'test-key',
  ankiModel: 'AnonTranslator Japanese', ankiDecks: '日语::单词', ankiTags: '日语\n生词', ankiBoldWord: true };
const draft = { word: '猫', reading: 'ねこ', readingKatakana: 'ネコ', sentence: '猫と猫を見た。', selectedText: '猫',
  sentenceRange: [2, 3], originalSentence: '猫と猫を見た。', translation: '看见了猫。', deck: '日语::单词', tags: ['生词'],
  dictionaries: [{ id: 'weblio', name: 'Weblio', html: '<div class="kijiWrp">猫</div>', styles: '.kijiWrp{color:red}' }],
  sourceURL: 'https://reader.example/book', sourceTitle: '小说' };
const note = (id = 100, overrides = {}) => ({ noteId: id, modelName: settings.ankiModel, tags: ['原有标签'], cards: [id + 1],
  fields: { ...Object.fromEntries(ankiFields.map((name, order) => [name, { value: '', order }])), Word: { value: '猫', order: 0 }, Image: { value: '<img src="old.png">', order: 7 },
    WordAudio: { value: '[sound:old.mp3]', order: 5 }, SentenceAudio: { value: '', order: 6 }, Extra: { value: '保持不变', order: 11 } }, ...overrides });

function mock(overrides = {}, options) {
  const calls = [], notes = new Map();
  const defaults = { version: 6, deckNames: ['日语::单词'], modelNames: [settings.ankiModel], modelFieldNames: [...ankiFields, 'Extra'],
    findNotes: [], notesInfo: params => params.notes.map(id => notes.get(id) || {}), createDeck: 123, createModel: {}, modelTemplates: { Japanese: { Front: 'OLD', Back: 'OLD' }, Other: { Front: 'KEEP', Back: 'KEEP' } }, modelStyling: { css: 'OLD' },
    storeMediaFile: params => params.filename, addNote: 200, updateNoteFields: null, updateNoteTags: null, changeDeck: null,
    updateModelTemplates: null, updateModelStyling: null, deleteMediaFile: null, deleteNotes: null };
  const request = async (url, requestOptions) => {
    const payload = JSON.parse(requestOptions.body);
    calls.push({ url, options: requestOptions, ...payload });
    const handler = Object.hasOwn(overrides, payload.action) ? overrides[payload.action] : defaults[payload.action];
    const value = typeof handler === 'function' ? await handler(payload.params, payload, calls) : handler;
    if (payload.action === 'addNote' && Number.isSafeInteger(value)) {
      const added = payload.params.note;
      notes.set(value, { noteId: value, modelName: added.modelName, tags: [...added.tags], cards: [value + 1],
        fields: Object.fromEntries(Object.entries(added.fields).map(([name, content], order) => [name, { value: content, order }])) });
    }
    if (payload.action === 'updateNoteFields' && !value?.apiError && notes.has(payload.params.note.id)) {
      const existing = notes.get(payload.params.note.id);
      for (const [name, content] of Object.entries(payload.params.note.fields)) existing.fields[name] = { ...existing.fields[name], value: content };
    }
    if (payload.action === 'deleteNotes' && !value?.apiError) payload.params.notes.forEach(id => notes.delete(id));
    if (value?.invalidEnvelope) return { json: async () => value.invalidEnvelope };
    return { json: async () => value?.apiError ? { result: null, error: value.apiError } : { result: value, error: null } };
  };
  return { service: createAnkiService(request, options), calls, notes, request };
}

const actionNames = calls => calls.map(call => call.action);
const writeActions = new Set(['createDeck', 'createModel', 'updateModelTemplates', 'updateModelStyling', 'storeMediaFile', 'addNote', 'updateNoteFields', 'updateNoteTags', 'changeDeck', 'deleteMediaFile', 'deleteNotes']);

test('read-only connection uses v6 envelope, separate API key and custom endpoint', async () => {
  const { service, calls } = mock();
  const value = await service.info({ ...settings, ankiURL: 'https://anki.example/api' });
  assert.deepEqual(value, { version: 6, decks: ['日语::单词'], models: [settings.ankiModel] });
  assert.ok(calls.every(call => call.version === 6 && call.key === 'test-key' && call.url === 'https://anki.example/api'));
  assert.ok(calls.every(call => call.options.ankiBase === call.url && call.options.timeout === 20000));
  assert.equal(calls.some(call => writeActions.has(call.action)), false);
  assert.throws(() => normalizeAnkiURL('http://name:secret@localhost:8765'), /API 密钥/);
});

test('duplicate ask is precise and never creates models, decks, media or notes', async () => {
  const { service, calls } = mock({ findNotes: [1, 2, 3, 4], notesInfo: [note(4), note(1), note(2, { modelName: 'Other' }), note(3, { fields: { Word: { value: '猫咪', order: 0 } } })] });
  const value = await service.add({ ...settings, ankiWordAudio: true }, { ...draft, image: { mime: 'image/png', data: 'aGVsbG8=' } }, 'ask');
  assert.deepEqual(value, { status: 'duplicate', noteIds: [1, 4] });
  assert.equal(calls.some(call => writeActions.has(call.action)), false);
  assert.match(calls.find(call => call.action === 'findNotes').params.query, /^note:"AnonTranslator Japanese" Word:"猫"$/);
});

test('overwrite updates earliest exact model match, preserves extra fields and existing media/tags', async () => {
  const { service, calls } = mock({ findNotes: [200, 100], notesInfo: [note(200), note(100)] });
  const value = await service.add(settings, draft, 'overwrite');
  assert.equal(value.status, 'updated'); assert.equal(value.noteId, 100); assert.equal(value.warnings.length, 1);
  const update = calls.find(call => call.action === 'updateNoteFields').params.note;
  assert.equal(update.id, 100); assert.equal(Object.hasOwn(update.fields, 'Extra'), false);
  assert.equal(update.fields.WordAudio, '[sound:old.mp3]'); assert.equal(update.fields.Image, '<img src="old.png">');
  assert.equal(update.fields.Sentence, draft.sentence);
  assert.deepEqual(calls.find(call => call.action === 'updateNoteTags').params, { note: 100, tags: ['原有标签', '生词'] });
  assert.deepEqual(calls.find(call => call.action === 'changeDeck').params, { cards: [101], deck: '日语::单词' });
  assert.equal(actionNames(calls).includes('addNote'), false);
});

test('confirmed adds use fixed fields and automatically sync templates before writing notes', async () => {
  const first = mock({ modelNames: [], deckNames: [] });
  const created = await first.service.add(settings, draft, 'ask');
  assert.equal(created.status, 'added');
  assert.deepEqual(first.calls.find(call => call.action === 'createModel').params.inOrderFields, ankiFields);
  assert.equal(first.calls.find(call => call.action === 'createDeck').params.deck, '日语::单词');
  const fields = first.calls.find(call => call.action === 'addNote').params.note.fields;
  assert.equal(fields.Reading, 'ねこ'); assert.equal(Object.hasOwn(fields, 'ReadingKatakana'), false);
  assert.ok(fields.DictionaryData.includes('&lt;div')); assert.ok(fields.DictionaryData.includes('.kijiWrp'));
  const second = mock({ findNotes: [100], notesInfo: [note()] });
  await second.service.add(settings, draft, 'duplicate');
  assert.equal(second.calls.find(call => call.action === 'addNote').params.note.options.allowDuplicate, true);
  assert.equal(second.calls.some(call => call.action === 'updateNoteFields'), false);
  assert.ok(actionNames(second.calls).indexOf('updateModelTemplates') < actionNames(second.calls).indexOf('addNote'));
  assert.ok(actionNames(second.calls).indexOf('updateModelStyling') < actionNames(second.calls).indexOf('addNote'));
  assert.deepEqual(Object.keys(second.calls.find(call => call.action === 'updateModelTemplates').params.model.templates), ['Japanese']);
});

test('template update is explicit, only touches the selected model template and styling', async () => {
  const { service, calls } = mock();
  await service.setup({ ...settings, ankiFront: 'FRONT', ankiBack: 'BACK', ankiCSS: 'CSS' });
  assert.equal(actionNames(calls).includes('updateModelTemplates'), false);
  await service.setup({ ...settings, ankiFront: 'FRONT', ankiBack: 'BACK', ankiCSS: 'CSS' }, true);
  assert.deepEqual(calls.find(call => call.action === 'updateModelTemplates').params.model,
    { name: settings.ankiModel, templates: { Japanese: { Front: 'FRONT', Back: 'BACK' } } });
  assert.deepEqual(calls.find(call => call.action === 'updateModelStyling').params.model, { name: settings.ankiModel, css: 'CSS' });
});

test('repeated adds reuse validated model state and templates, while edits and explicit setup sync immediately', async () => {
  const current = mock();
  await current.service.add(settings, draft);
  const firstCount = current.calls.length;
  assert.equal(current.calls.filter(call => call.action === 'modelFieldNames').length, 1);
  await current.service.add(settings, draft, 'duplicate');
  assert.deepEqual(actionNames(current.calls.slice(firstCount)), ['findNotes', 'addNote', 'notesInfo']);
  assert.equal(firstCount, 11);
  await current.service.add({ ...settings, ankiFront: 'edited front' }, draft, 'duplicate');
  assert.equal(current.calls.filter(call => call.action === 'updateModelTemplates').length, 2);
  await current.service.setup(settings, true);
  assert.equal(current.calls.filter(call => call.action === 'updateModelTemplates').length, 3);
  assert.equal(current.calls.filter(call => call.action === 'modelFieldNames').length, 2);
});

test('matching remote templates need no writes; validation expires and failed operations invalidate it', async () => {
  const config = { ...settings, ankiFront: 'same front', ankiBack: 'same back', ankiCSS: 'same css' };
  let fields = [...ankiFields];
  const current = mock({ modelTemplates: { Japanese: { Front: config.ankiFront, Back: config.ankiBack } },
    modelStyling: { css: config.ankiCSS }, modelFieldNames: () => fields });
  await current.service.add(config, draft);
  assert.equal(current.calls.some(call => ['updateModelTemplates', 'updateModelStyling'].includes(call.action)), false);
  const originalNow = Date.now;
  Date.now = () => originalNow() + 10001;
  try {
    fields = ['Bad'];
    await assert.rejects(current.service.add(config, draft), /Word 为首字段/);
  } finally { Date.now = originalNow; }
  assert.equal(current.calls.filter(call => call.action === 'addNote').length, 1);
  let broken = false;
  const failing = mock({ addNote: () => ({ apiError: 'retry write' }), modelFieldNames: () => broken ? ['Bad'] : ankiFields });
  await assert.rejects(failing.service.add(settings, draft), /retry write/);
  broken = true;
  await assert.rejects(failing.service.add(settings, draft), /Word 为首字段/);
  assert.equal(failing.calls.filter(call => call.action === 'modelFieldNames').length, 2);
});

test('playback audio is reused by actual Anki export and after a failed card write', async () => {
  let audioCalls = 0, fail = true;
  const current = mock({ addNote: () => fail ? { apiError: 'retry note' } : 200 });
  const request = async (url, options) => {
    if (url === settings.ankiURL + '/') return current.request(url, options);
    audioCalls++;
    return { headers: { get: () => 'audio/mpeg' }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };
  const service = createAnkiService(request), config = { ...settings, ankiWordAudioService: 'vits' };
  await vitsAudio(draft.word, config, request);
  await assert.rejects(service.add(config, draft), /retry note/);
  fail = false; await service.add(config, draft);
  assert.equal(audioCalls, 1);
  assert.equal(current.calls.filter(call => call.action === 'storeMediaFile').length, 2);
});

test('both selected audio fields generate concurrently without rebuilding translations', async () => {
  const entered = [], release = [];
  const current = mock({}, { audio: async (text, _settings, _request, provider) => {
    entered.push([text, provider]); await new Promise(resolve => release.push(resolve));
    return { audio: 'AQID', mime: 'audio/mpeg' };
  } });
  const adding = current.service.add({ ...settings, ankiTranslationServices: ['google', 'youdao'], ankiWordAudioService: 'vits', ankiSentenceAudioService: 'huosh' }, {
    ...draft, sentence: '猫と<b>猫</b>を見た。', translation: '<b>现成译文</b>\n第二行'
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(entered, [['猫', 'vits'], ['猫と猫を見た。', 'huosh']]);
  release.forEach(resolve => resolve());
  assert.equal((await adding).status, 'added');
  const fields = current.calls.find(call => call.action === 'addNote').params.note.fields;
  assert.equal(fields.Sentence, '猫と<b>猫</b>を見た。');
  assert.equal(fields.Translation, '<b>现成译文</b>\n第二行');
});

test('card dictionary order preserves the incoming draft regardless of current settings', async () => {
  const current = mock(), entries = [...draft.dictionaries, { id: 'moji', name: 'MOJi', html: '<p>猫 &amp; 犬</p>', styles: 'p{}' }];
  const decode = value => JSON.parse(value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  await current.service.add({ ...settings, dictionaryOrder: ['moji', 'weblio'] }, { ...draft, dictionaries: entries });
  const first = current.calls.find(call => call.action === 'addNote').params.note.fields.DictionaryData;
  assert.deepEqual(decode(first), entries);
  await current.service.add({ ...settings, dictionaryOrder: ['weblio', 'moji'] }, { ...draft, dictionaries: [...entries].reverse() }, 'duplicate');
  const last = current.calls.filter(call => call.action === 'addNote').at(-1).params.note.fields.DictionaryData;
  assert.deepEqual(decode(last), [...entries].reverse());
  assert.deepEqual(entries.map(entry => entry.id), ['weblio', 'moji']);
});

test('export preserves editable sentence and translation HTML exactly, including cleared fields', async () => {
  const current = mock();
  for (const translation of ['  <b>谷歌先</b>\n有道后  ', '', '<br>']) {
    const sentence = '<ruby>猫<rt>ねこ</rt></ruby>と<b>猫</b>。\n第二行';
    await current.service.add({ ...settings, ankiTranslationServices: ['youdao', 'google'], translationOrder: ['youdao', 'google'], ankiBoldWord: false }, {
      ...draft, sentence, translation
    }, 'duplicate');
    const fields = current.calls.filter(call => call.action === 'addNote').at(-1).params.note.fields;
    assert.equal(fields.Sentence, sentence);
    assert.equal(fields.Translation, translation);
  }
});

test('media upload uses file data, never overwrites old media and is referenced by the note', async () => {
  const audioCalls = [], { service, calls } = mock({}, { audio: async text => { audioCalls.push(text); return { audio: 'aGVsbG8=', mime: 'audio/wav' }; } });
  await service.add({ ...settings, useVITS: true, ankiWordAudio: true, ankiSentenceAudio: true }, { ...draft, image: { mime: 'image/webp', data: 'aGVsbG8=' } });
  assert.deepEqual(audioCalls, ['猫', draft.sentence]);
  const uploads = calls.filter(call => call.action === 'storeMediaFile'); assert.equal(uploads.length, 3);
  assert.ok(uploads.every(call => call.params.data === 'aGVsbG8=' && call.params.deleteExisting === false));
  assert.equal(new Set(uploads.map(call => call.params.filename)).size, 3);
  const fields = calls.find(call => call.action === 'addNote').params.note.fields;
  assert.match(fields.Image, /^<img src="at_.+\.webp">$/); assert.match(fields.WordAudio, /^<audio src="at_.+\.wav" preload="none"><\/audio>$/);
  assert.equal(actionNames(calls).includes('deleteMediaFile'), false);
});

test('independent word/sentence audio selectors reuse parameters without requiring reader switches', async () => {
  const requested = [], { service, calls } = mock({}, { audio: async (text, values, _request, provider) => {
    requested.push({ text, values, provider }); return { audio: 'aGVsbG8=', mime: 'audio/mpeg' };
  } });
  await service.add({ ...settings, useWindowsTTS: true, useVITS: false, useHuoshTTS: false, vitsVoice: 23, huoshVoice: 'custom-voice',
    ankiWordAudioService: 'vits', ankiSentenceAudioService: 'huosh' }, draft);
  assert.deepEqual(requested.map(item => [item.text, item.provider]), [['猫', 'vits'], [draft.sentence, 'huosh']]);
  assert.equal(requested[0].values.vitsVoice, 23); assert.equal(requested[1].values.huoshVoice, 'custom-voice');
  assert.equal(requested[0].values.useVITS, true); assert.equal(requested[0].values.useWindowsTTS, false);
  assert.equal(requested[1].values.useHuoshTTS, true); assert.equal(requested[1].values.useVITS, false);
  assert.equal(calls.filter(call => call.action === 'storeMediaFile').length, 2);
  const disabled = mock({}, { audio: async () => assert.fail('none must not generate audio') });
  await disabled.service.add({ ...settings, ankiWordAudio: true, useVITS: true, ankiWordAudioService: 'none', ankiSentenceAudioService: 'none' }, draft);
  assert.equal(disabled.calls.some(call => call.action === 'storeMediaFile'), false);
});

test('selected translation services never trigger requests or refill a cleared export field', async () => {
  const current = mock();
  await current.service.add({ ...settings, google: true, youdao: true, ankiTranslationServices: ['google', 'youdao'] }, { ...draft, translation: '' });
  assert.equal(current.calls.find(call => call.action === 'addNote').params.note.fields.Translation, '');
  assert.ok(current.calls.every(call => call.url === settings.ankiURL + '/'));
  const duplicate = mock({ findNotes: [100], notesInfo: [note()] });
  assert.equal((await duplicate.service.add({ ...settings, ankiTranslationServices: ['google'] }, { ...draft, translation: '' })).status, 'duplicate');
  assert.equal(duplicate.calls.some(call => writeActions.has(call.action)), false);
});

test('overwrite applies current templates but preserves existing audio when new audio selectors are none', async () => {
  const { service, calls } = mock({ findNotes: [100], notesInfo: [note()] });
  await service.add({ ...settings, ankiWordAudioService: 'none', ankiSentenceAudioService: 'none', ankiFront: 'NEW FRONT', ankiBack: 'NEW BACK', ankiCSS: 'NEW CSS' }, draft, 'overwrite');
  assert.equal(calls.find(call => call.action === 'updateNoteFields').params.note.fields.WordAudio, '[sound:old.mp3]');
  assert.deepEqual(calls.find(call => call.action === 'updateModelTemplates').params.model.templates.Japanese, { Front: 'NEW FRONT', Back: 'NEW BACK' });
  assert.equal(calls.find(call => call.action === 'updateModelStyling').params.model.css, 'NEW CSS');
  assert.ok(actionNames(calls).indexOf('updateModelTemplates') < actionNames(calls).indexOf('updateNoteFields'));
});

test('failed note/media writes clean up new uploads only; old media is never deleted', async () => {
  for (const overrides of [{ addNote: { apiError: 'bad note' } }, { storeMediaFile: { apiError: 'disk full' } }]) {
    const { service, calls } = mock(overrides);
    await assert.rejects(service.add(settings, { ...draft, image: { mime: 'image/png', data: 'aGVsbG8=' } }), /AnkiConnect/);
    const names = calls.filter(call => call.action === 'deleteMediaFile').map(call => call.params.filename);
    assert.equal(names.length, 1); assert.match(names[0], /^at_.+\.png$/); assert.equal(names.includes('old.png'), false);
  }
});

test('post-write tag/deck failures return success warnings and retain referenced media', async () => {
  const { service, calls } = mock({ findNotes: [100], notesInfo: [note()], updateNoteTags: { apiError: 'tag error' }, changeDeck: { apiError: 'deck error' } });
  const result = await service.add(settings, { ...draft, image: { mime: 'image/png', data: 'aGVsbG8=' } }, 'overwrite');
  assert.equal(result.status, 'updated'); assert.equal(result.warnings.length, 2);
  assert.equal(actionNames(calls).includes('deleteMediaFile'), false);
});

test('uncertain transport failures retain new media instead of deleting possibly committed attachments', async () => {
  const { service, calls } = mock({ addNote: () => { throw new TypeError('connection lost'); } });
  await assert.rejects(service.add(settings, { ...draft, image: { mime: 'image/png', data: 'aGVsbG8=' } }), /写入结果未能确认/);
  assert.equal(actionNames(calls).includes('deleteMediaFile'), false);
});

test('system speech export, incompatible model and API errors are actionable and never write notes', async () => {
  const system = mock();
  await assert.rejects(system.service.add({ ...settings, useWindowsTTS: true, ankiWordAudio: true }, draft), /系统语音不能导出/);
  assert.equal(system.calls.some(call => writeActions.has(call.action)), false);
  const model = mock({ modelFieldNames: ['Front', 'Back'] });
  await assert.rejects(model.service.add(settings, draft), /Word 为首字段/);
  assert.equal(model.calls.some(call => writeActions.has(call.action)), false);
  await assert.rejects(mock({ version: 5 }).service.info(settings), /API v6/);
  await assert.rejects(mock({ version: { apiError: 'valid api key must be provided' } }).service.info(settings), /API 密钥/);
  await assert.rejects(mock({ version: { invalidEnvelope: { unexpected: true } } }).service.info(settings), /响应格式无效/);
});

test('concurrent adds serialize check and write so a second ask sees the first note', async () => {
  let added = false;
  const { service, calls } = mock({ findNotes: () => added ? [100] : [], notesInfo: [note()], addNote: () => { added = true; return 100; } });
  const [first, second] = await Promise.all([service.add(settings, draft), service.add(settings, draft)]);
  assert.equal(first.status, 'added'); assert.equal(second.status, 'duplicate');
  assert.equal(calls.filter(call => call.action === 'addNote').length, 1);
});

test('undo requires confirmation and expected note ID, deletes only the last created note and preserves its media', async () => {
  const { service, calls, notes } = mock({}, { audio: async () => ({ audio: 'aGVsbG8=', mime: 'audio/mpeg' }) });
  const added = await service.add({ ...settings, ankiWordAudioService: 'vits' }, { ...draft, image: { mime: 'image/png', data: 'aGVsbG8=' } });
  assert.equal(added.undoAvailable, true); assert.equal(notes.size, 1);
  assert.deepEqual(await service.undoInfo(settings), { undoAvailable: true, noteId: 200, word: '猫' });
  await assert.rejects(service.undo(settings, false, 200), /先确认/);
  await assert.rejects(service.undo(settings, true, 199), /已改变/);
  assert.equal(calls.some(call => call.action === 'deleteNotes'), false);
  assert.deepEqual(await service.undo(settings, true, 200), { status: 'undone', noteId: 200, undoAvailable: false });
  assert.deepEqual(calls.find(call => call.action === 'deleteNotes').params, { notes: [200] });
  assert.equal(calls.some(call => call.action === 'deleteMediaFile'), false);
  assert.equal(notes.size, 0);
  assert.equal((await service.undoInfo(settings)).undoAvailable, false);
  await assert.rejects(service.undo(settings, true, 200), /没有可以撤回/);
  assert.equal(calls.filter(call => call.action === 'deleteNotes').length, 1);
});

test('undo has one slot with no history; overwrite invalidates an older newly-created note', async () => {
  let id = 200;
  const current = mock({ addNote: () => id++ });
  await current.service.add(settings, draft);
  await current.service.add(settings, draft, 'duplicate');
  assert.equal((await current.service.undoInfo(settings)).noteId, 201);
  await assert.rejects(current.service.undo(settings, true, 200), /已改变/);
  await current.service.undo(settings, true, 201);
  assert.ok(current.notes.has(200)); assert.equal((await current.service.undoInfo(settings)).undoAvailable, false);
  const updated = mock({ findNotes: () => updated.notes.has(200) ? [200] : [] });
  await updated.service.add(settings, draft);
  const result = await updated.service.add(settings, draft, 'overwrite');
  assert.equal(result.status, 'updated'); assert.equal(result.undoAvailable, false); assert.match(result.undoReason, /覆盖/);
  await assert.rejects(updated.service.undo(settings, true, 200), /没有可以撤回/);
  assert.equal(updated.calls.some(call => call.action === 'deleteNotes'), false);
});

test('undo refuses scope changes and any field, tag or card-list modification', async () => {
  for (const modify of [note => { note.fields.Sentence.value = '手动修改'; }, note => note.tags.push('changed'), note => note.cards.push(900)]) {
    const current = mock(); await current.service.add(settings, draft); modify(current.notes.get(200));
    await assert.rejects(current.service.undo(settings, true, 200), /已被修改或删除/);
    assert.equal(current.calls.some(call => call.action === 'deleteNotes'), false);
    assert.equal((await current.service.undoInfo(settings)).undoAvailable, false);
  }
  const scoped = mock(); await scoped.service.add(settings, draft);
  const different = { ...settings, ankiURL: 'http://127.0.0.1:9999' };
  assert.equal((await scoped.service.undoInfo(different)).undoAvailable, false);
  await assert.rejects(scoped.service.undo(different, true, 200), /接口或模型已改变/);
  await assert.rejects(scoped.service.undo({ ...settings, ankiModel: 'Other' }, true, 200), /接口或模型已改变/);
  assert.equal((await scoped.service.undoInfo(settings)).undoAvailable, true);
});

test('undo snapshot survives service restart without persisting note content and accepts legacy audio safely', async () => {
  let stored = null;
  const undoStorage = { async get() { return structuredClone(stored); }, async set(value) { stored = structuredClone(value); } };
  const current = mock({ addNote(params) { params.note.fields.WordAudio = '[sound:legacy.mp3]'; return 200; } }, { undoStorage });
  await current.service.add(settings, draft);
  assert.equal(stored.noteId, 200); assert.match(stored.signature, /^sha256:/); assert.ok(JSON.stringify(stored).length < 500);
  assert.equal(JSON.stringify(stored).includes('legacy.mp3'), false);
  const restarted = createAnkiService(current.request, { undoStorage });
  assert.equal((await restarted.undoInfo(settings)).undoAvailable, true);
  await restarted.undo(settings, true, 200);
  assert.equal(stored, null); assert.equal(current.calls.some(call => call.action === 'deleteMediaFile'), false);
});

test('failed additions and duplicate prompts do not replace the last successful undo record', async () => {
  let fail = false;
  const current = mock({ addNote: () => fail ? { apiError: 'failed add' } : 200, findNotes: () => fail ? [200] : [] });
  await current.service.add(settings, draft); fail = true;
  assert.equal((await current.service.add(settings, draft)).status, 'duplicate');
  await assert.rejects(current.service.add(settings, draft, 'duplicate'), /failed add/);
  assert.equal((await current.service.undoInfo(settings)).noteId, 200);
  await current.service.undo(settings, true, 200);
});

test('new schema omits Katakana while an existing legacy field remains untouched on overwrite', async () => {
  const legacy = note(100); legacy.fields.ReadingKatakana = { order: 2, value: 'ネコ' };
  const current = mock({ findNotes: [100], notesInfo: [legacy], modelFieldNames: ['Word', 'Reading', 'ReadingKatakana', ...ankiFields.slice(2), 'Extra'] });
  await current.service.add(settings, draft, 'overwrite');
  const updated = current.calls.find(call => call.action === 'updateNoteFields').params.note.fields;
  assert.equal(Object.hasOwn(updated, 'ReadingKatakana'), false); assert.equal(legacy.fields.ReadingKatakana.value, 'ネコ');
  assert.equal(ankiFields.includes('ReadingKatakana'), false);
});

test('uncertain undo clears its slot without attempting another deletion or media cleanup', async () => {
  const current = mock({ deleteNotes: () => { throw new TypeError('lost reply'); } });
  await current.service.add(settings, draft);
  await assert.rejects(current.service.undo(settings, true, 200), /撤回结果未确认/);
  assert.equal((await current.service.undoInfo(settings)).undoAvailable, false);
  await assert.rejects(current.service.undo(settings, true, 200), /没有可以撤回/);
  assert.equal(current.calls.filter(call => call.action === 'deleteNotes').length, 1);
  assert.equal(current.calls.some(call => call.action === 'deleteMediaFile'), false);
});

test('front/back click the requested audio; back schedules one word playback and encodes Google search', async () => {
  const { Script, createContext } = await import('node:vm');
  function fixture(legacy = false) {
    const played = [], timers = [], attributes = new Set();
    const audio = kind => ({ pause() {}, play() { played.push(kind); return { catch() {} }; }, currentTime: 0 });
    const wordAudio = legacy ? null : audio('word'), sentenceAudio = audio('sentence');
    const targets = ['word', 'sentence'].map(kind => ({ textContent: '猫 & 犬', getAttribute() { return kind; } }));
    const search = {}, container = kind => ({ querySelector(selector) { return selector === 'audio' ? (kind === 'word' ? wordAudio : sentenceAudio) : { click() { played.push('legacy'); } }; } });
    const root = { isConnected: true, hasAttribute(name) { return attributes.has(name); }, setAttribute(name) { attributes.add(name); },
      querySelector(selector) {
        if (selector === '.at-anki-word') return targets[0];
        if (selector === '.at-anki-spelling') return { textContent: '猫 & 犬' };
        if (selector === '.at-anki-reading') return null;
        if (selector === '.at-anki-search') return search;
        if (selector === '.at-anki-data') return { textContent: '[]' };
        if (selector === '.at-anki-tabs' || selector === '.at-anki-panels') return { children: [] };
        if (selector === '[data-at-audio="word"] audio') return wordAudio;
        return container(selector.includes('"word"') ? 'word' : 'sentence');
      }, querySelectorAll(selector) { return selector === '[data-at-play]' ? targets : [wordAudio, sentenceAudio].filter(Boolean); } };
    return { played, timers, targets, search, context: createContext({ document: { querySelector() { return root; } }, setTimeout(fn) { timers.push(fn); } }) };
  }
  const front = fixture(), frontCode = defaultAnkiFront.match(/<script>([\s\S]*)<\/script>/)[1];
  new Script(frontCode).runInContext(front.context);
  assert.equal(front.timers.length, 0); front.targets[0].onclick(); front.targets[1].onclick();
  assert.deepEqual(front.played, ['word', 'sentence']);
  const back = fixture(), backCode = defaultAnkiBack.match(/<script>([\s\S]*)<\/script>/)[1];
  new Script(backCode).runInContext(back.context); new Script(backCode).runInContext(back.context);
  assert.equal(back.timers.length, 1); back.timers[0](); assert.deepEqual(back.played, ['word']);
  assert.equal(back.search.href, 'https://www.google.com/search?q=' + encodeURIComponent('猫 & 犬'));
  const legacy = fixture(true); new Script(frontCode).runInContext(legacy.context); legacy.targets[0].onclick();
  assert.deepEqual(legacy.played, ['legacy']);
});

test('default card script parses and keeps source dictionary rendering inside sandboxed frames', async () => {
  const { Script } = await import('node:vm');
  const script = defaultAnkiBack.match(/<script>([\s\S]*)<\/script>/)[1];
  assert.doesNotThrow(() => new Script(script));
  assert.match(defaultAnkiBack, /allow-popups allow-popups-to-escape-sandbox/);
  assert.doesNotMatch(defaultAnkiBack, /allow-scripts/);
});

test('Chrome template preview accepts only its parent and keeps editable templates in an opaque sandbox', async () => {
  const { Script, createContext } = await import('node:vm');
  const html = await readFile(new URL('../src/platform/anki-preview.html', import.meta.url), 'utf8');
  const source = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const messages = [], parent = { postMessage(data, origin) { messages.push({ data: JSON.parse(JSON.stringify(data)), origin }); } }, rendered = [];
  let listener;
  const context = createContext({ window: { parent, addEventListener(_type, fn) { listener = fn; } }, document: {
    createElement() { return { contentWindow: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }; },
    body: { replaceChildren(frame) { rendered.push(frame); } }
  } });
  new Script(source).runInContext(context);
  listener({ source: {}, data: { type: 'at-anki-preview', channel: 'one', html: '<script>untrusted</script>' } });
  assert.equal(rendered.length, 0);
  listener({ source: parent, data: { type: 'at-anki-preview', html: '<p>preview</p>' } });
  assert.equal(rendered.length, 1); assert.equal(rendered[0].srcdoc, '<p>preview</p>');
  assert.equal(rendered[0].attributes.sandbox, 'allow-scripts');
  listener({ source: {}, data: { type: 'at-anki-preview-play', channel: 'one', kind: 'word' } });
  listener({ source: rendered[0].contentWindow, data: { type: 'at-anki-preview-play', channel: 'stale', kind: 'word' } });
  assert.equal(messages.length, 0);
  listener({ source: rendered[0].contentWindow, data: { type: 'at-anki-preview-play', channel: 'one', kind: 'word' } });
  listener({ source: parent, data: { type: 'at-anki-preview-play', channel: 'one', kind: 'sentence' } });
  assert.equal(messages.length, 0);
  assert.equal(rendered.length, 1);
  const manifest = JSON.parse(await readFile(new URL('../src/platform/manifest.json', import.meta.url), 'utf8'));
  assert.ok(manifest.sandbox.pages.includes('anki-preview.html'));
  assert.match(manifest.content_security_policy.sandbox, /connect-src 'none'/);
  assert.doesNotMatch(manifest.content_security_policy.extension_pages, /script-src[^;]*'unsafe-inline'/);
});
