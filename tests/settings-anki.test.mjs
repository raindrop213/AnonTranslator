import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, normalizeSetting, normalizeSettings, createSettingsStore, serviceOrder, colorsFor } from '../src/settings/settings.js';
import { ankiPreviewFields, ankiPreviewDocument } from '../src/settings/anki-panel.js';
import { legacyAnkiTemplates } from '../src/settings/legacy-anki-templates.js';
import { ankiDraftFields } from '../src/services/anki-fields.js';

test('sentence highlight color is saved and selected for night mode', () => {
  const nightSentenceColor = '#8FA85D';
  const settings = normalizeSettings({ nightMode: true, nightSentenceColor });
  assert.equal(settings.nightSentenceColor, nightSentenceColor);
  assert.equal(colorsFor(settings).sentenceColor, nightSentenceColor);
  assert.equal(colorsFor({ ...settings, nightMode: false }).sentenceColor, defaults.sentenceColor);
});

test('Anki services are independent of reader enable switches', () => {
  const settings = normalizeSettings({ ankiTranslationService: 'youdao', ankiWordAudioService: 'vits', ankiSentenceAudioService: 'huosh', google: false, youdao: false, useVITS: false, useHuoshTTS: false });
  assert.equal(settings.ankiTranslationService, 'youdao');
  assert.equal(settings.ankiWordAudioService, 'vits');
  assert.equal(settings.ankiSentenceAudioService, 'huosh');
  assert.equal(defaults.ankiTranslationService, 'google');
  assert.equal(defaults.ankiWordAudioService, 'none');
  for (const key of ['ankiTranslationService', 'ankiWordAudioService', 'ankiSentenceAudioService']) assert.throws(() => normalizeSetting(key, 'system'));
});

test('Anki translation services support independent multiple and empty choices', () => {
  assert.deepEqual(defaults.ankiTranslationServices, ['google', 'youdao']);
  assert.deepEqual(normalizeSetting('ankiTranslationServices', ['youdao', 'google', 'youdao']), ['youdao', 'google']);
  assert.deepEqual(normalizeSetting('ankiTranslationServices', []), []);
  assert.deepEqual(normalizeSettings({ ankiTranslationServices: ['google', 'youdao'], google: false, youdao: false }).ankiTranslationServices, ['youdao', 'google']);
  assert.throws(() => normalizeSetting('ankiTranslationServices', 'google'));
  assert.throws(() => normalizeSetting('ankiTranslationServices', ['none']));
});

test('singular translation preferences migrate once without overriding explicit multiple choices', async () => {
  assert.deepEqual(normalizeSettings({ ankiTranslationService: 'none' }).ankiTranslationServices, []);
  assert.deepEqual(normalizeSettings({ ankiTranslationService: 'google' }).ankiTranslationServices, ['google']);
  assert.deepEqual(normalizeSettings({ ankiTranslationService: 'youdao' }).ankiTranslationServices, ['youdao']);
  assert.deepEqual(normalizeSettings({ ankiTranslationService: 'google', ankiTranslationServices: [] }).ankiTranslationServices, []);
  const saved = { ankiTranslationService: 'youdao' }, writes = [];
  const store = createSettingsStore({ watchSettings() {}, async getSettings() { return { ...saved }; }, async setSettings(patch) { writes.push(patch); Object.assign(saved, patch); } });
  await store.init();
  assert.deepEqual(saved.ankiTranslationServices, ['youdao']);
  let patch;
  store.subscribe((_settings, changed) => { patch = changed; });
  await store.set('nightMode', true);
  assert.deepEqual(patch, { nightMode: true });
  const before = writes.length;
  await store.set('ankiTranslationServices', ['youdao']);
  assert.equal(writes.length, before);
});

test('legacy audio choices migrate only when new service selectors are absent', () => {
  assert.equal(normalizeSettings({ ankiWordAudio: true, useVITS: true }).ankiWordAudioService, 'vits');
  assert.equal(normalizeSettings({ ankiSentenceAudio: true, useHuoshTTS: true }).ankiSentenceAudioService, 'huosh');
  assert.equal(normalizeSettings({ ankiWordAudio: true, useWindowsTTS: true }).ankiWordAudioService, 'none');
  assert.equal(normalizeSettings({ ankiWordAudio: true, useVITS: true, ankiWordAudioService: 'none' }).ankiWordAudioService, 'none');
});

test('migrated audio choices persist across later changes to reader services', async () => {
  const saved = { ankiWordAudio: true, ankiSentenceAudio: true, useVITS: true };
  const platform = { watchSettings() {}, async getSettings() { return { ...saved }; }, async setSettings(patch) { Object.assign(saved, patch); } };
  const first = createSettingsStore(platform); await first.init();
  assert.equal(saved.ankiWordAudioService, 'vits');
  assert.equal(saved.ankiSentenceAudioService, 'vits');
  saved.useVITS = false; saved.useHuoshTTS = true;
  const reopened = createSettingsStore(platform); await reopened.init();
  assert.equal(reopened.values.ankiWordAudioService, 'vits');
  assert.equal(reopened.values.ankiSentenceAudioService, 'vits');
});

test('live preview uses exactly the exported draft fields except for a local screenshot', () => {
  const draft = { word: '濡らす<img onerror="bad()">', reading: 'ヌラス', sentence: '彼はタオルを<b>濡らした</b>。\n次の行。', selectedText: '濡らし', translation: '<em>他把毛巾弄湿了。</em>\n保留换行。',
    image: { mime: 'image/png', data: 'aGVsbG8=' }, sourceURL: 'javascript:bad()', sourceTitle: '<b>本</b>',
    dictionaries: [{ id: 'weblio', name: 'Weblio', html: '<p>現在の内容</p><script>bad()</script>', styles: 'p{color:red}' }] };
  const fields = ankiPreviewFields(draft, { ankiBoldWord: true, ankiWordAudioService: 'vits', ankiSentenceAudioService: 'none' });
  const exported = ankiDraftFields(draft);
  assert.deepEqual({ ...fields, Image: exported.Image }, exported);
  assert.equal(fields.Reading, 'ヌラス');
  assert.equal(Object.hasOwn(fields, 'ReadingKatakana'), false);
  assert.equal(fields.Sentence, draft.sentence);
  assert(fields.Word.includes('&lt;img'));
  assert.equal(fields.Translation, draft.translation);
  assert(fields.Image.includes('data:image/png;base64,aGVsbG8='));
  assert(fields.DictionaryData.includes('現在の内容'));
  assert(!fields.DictionaryData.includes('<script>'));
  assert.equal(fields.SourceURL, '');
  assert.equal(fields.SourceTitle, '&lt;b&gt;本&lt;/b&gt;');
  assert.equal(fields.WordAudio, '');
  assert.equal(fields.SentenceAudio, '');
  assert.equal(ankiPreviewFields({ ...draft, image: { mime: 'text/html', data: 'aGVsbG8=' } }).Image, '');
  assert.equal(ankiPreviewFields({ ...draft, image: { mime: 'image/png', data: '" onerror="bad()' } }).Image, '');
});

test('preview falls back to examples and uses only the edited native card CSS', () => {
  assert.equal(ankiPreviewFields(null).Word, '濡らす');
  assert.equal(Object.hasOwn(ankiPreviewFields(null), 'ReadingKatakana'), false);
  const css = '.card {\n  background: ivory;\n  padding: 3px;\n}\n';
  const live = ankiPreviewDocument('<p>{{Word}}</p>', '{{FrontSide}}<div>{{Translation}}</div>', css, 'ankiBack', { word: '猫', translation: '猫的释义' }, { nightMode: true });
  assert(live.includes('<p>猫</p><div>猫的释义</div>'));
  assert.equal(live.match(/<style>([\s\S]*?)<\/style>/)[1], css);
  assert(live.includes('class="card"'));
  assert(!live.includes('nightMode'));
  assert(!live.includes('#e99c91'));
  assert(!live.includes('padding:12px'));
  assert(live.includes('connect-src &apos;none&apos;'));
});

test('preview preserves the canonical draft dictionary order without reordering it', () => {
  const dictionaries = [{ id: 'weblio', html: '<p>Weblio</p>' }, { id: 'moji', html: '<p>MOJi</p>' }];
  const settings = { dictionaryOrder: ['moji', 'weblio'] };
  const live = ankiPreviewFields({ word: '猫', dictionaries }, settings).DictionaryData;
  assert(live.indexOf('&quot;weblio&quot;') < live.indexOf('&quot;moji&quot;'));
  assert.deepEqual(dictionaries.map(entry => entry.id), ['weblio', 'moji']);
});

test('static preview contains no audio bridge, remote media or API credentials', () => {
  const html = ankiPreviewDocument('<div data-at-play="word">{{Word}}</div>', '<div data-at-play="sentence">{{Sentence}}</div>', '', 'ankiBack',
    { word: '猫', sentence: '猫がいる。' }, { ankiWordAudioService: 'vits', ankiAPIKey: 'private-anki-key', vitsCustomAPI: 'https://voice.example/?key=private-voice-key' });
  assert(!html.includes('at-anki-preview-play'));
  assert(!html.includes('postMessage'));
  assert(!html.includes('private-anki-key'));
  assert(!html.includes('private-voice-key'));
  assert(!html.includes('voice.example'));
  assert(html.includes("connect-src &apos;none&apos;"));
  assert.equal(ankiPreviewFields(null).WordAudio, '');
  assert.equal(ankiPreviewFields(null).SentenceAudio, '');
});

test('service orders reject duplicates and unknown items while filling missing services', () => {
  assert.deepEqual(defaults.translationOrder, ['youdao', 'google']);
  assert.deepEqual(defaults.dictionaryOrder, ['weblio', 'moji']);
  assert.deepEqual(normalizeSetting('translationOrder', ['google']), ['google', 'youdao']);
  assert.deepEqual(normalizeSetting('dictionaryOrder', ['moji']), ['moji', 'weblio']);
  assert.deepEqual(normalizeSetting('translationOrder', []), ['youdao', 'google']);
  assert.throws(() => normalizeSetting('translationOrder', ['google', 'google']));
  assert.throws(() => normalizeSetting('dictionaryOrder', ['other']));
  assert.deepEqual(serviceOrder({ translationOrder: ['google', 'unknown', 'google'] }, 'translationOrder'), ['google', 'youdao']);
  assert.deepEqual(serviceOrder({}, 'dictionaryOrder'), ['weblio', 'moji']);
});

test('reordering services preserves enable switches and determines selected Anki output order', async () => {
  const saved = {};
  const store = createSettingsStore({ watchSettings() {}, async getSettings() { return {}; }, async setSettings(patch) { Object.assign(saved, patch); } });
  await store.init();
  assert.deepEqual(store.values.ankiTranslationServices, ['youdao', 'google']);
  await store.set('translationOrder', ['google', 'youdao']);
  await store.set('dictionaryOrder', ['moji', 'weblio']);
  assert.deepEqual(store.values.ankiTranslationServices, ['google', 'youdao']);
  assert.deepEqual(saved.translationOrder, ['google', 'youdao']);
  assert.deepEqual(saved.dictionaryOrder, ['moji', 'weblio']);
  assert.equal(store.values.google, false);
  assert.equal(store.values.youdao, false);
  assert.equal(store.values.dictionaryWeblio, true);
  assert.equal(store.values.dictionaryMoji, true);
  await store.set('ankiTranslationServices', ['youdao']);
  await store.set('translationOrder', ['youdao', 'google']);
  assert.deepEqual(store.values.ankiTranslationServices, ['youdao']);
});

test('only exact previously shipped Anki templates migrate to the current defaults', async () => {
  for (const [key, previous] of Object.entries(legacyAnkiTemplates)) {
    for (const template of previous) {
      assert.equal(normalizeSettings({ [key]: template })[key], defaults[key]);
      const custom = template + '\n<!-- custom edit -->';
      assert.equal(normalizeSettings({ [key]: custom })[key], custom);
    }
  }
  const customBack = legacyAnkiTemplates.ankiBack[0] + '\n';
  const saved = { ankiFront: legacyAnkiTemplates.ankiFront[0], ankiBack: customBack, ankiCSS: legacyAnkiTemplates.ankiCSS.at(-1) };
  const platform = { watchSettings() {}, async getSettings() { return { ...saved }; }, async setSettings(patch) { Object.assign(saved, patch); } };
  const store = createSettingsStore(platform); await store.init();
  assert.equal(saved.ankiFront, defaults.ankiFront);
  assert.equal(saved.ankiCSS, defaults.ankiCSS);
  assert.equal(saved.ankiBack, customBack);
  assert.equal(store.values.ankiBack, customBack);
});

test('popup dimensions allow the compact 220 by 160 size', () => {
  assert.equal(normalizeSetting('dictionaryPopupWidth', 220), 220);
  assert.equal(normalizeSetting('dictionaryPopupHeight', 160), 160);
  assert.throws(() => normalizeSetting('dictionaryPopupWidth', 219));
  assert.throws(() => normalizeSetting('dictionaryPopupHeight', 159));
});

test('native window position survives restart and supports monitors left of the primary screen', async () => {
  const saved = {};
  const platform = { watchSettings() {}, async getSettings() { return { ...saved }; }, async setSettings(patch) { Object.assign(saved, patch); } };
  const store = createSettingsStore(platform); await store.init();
  assert.equal(store.values.dictionaryWindowLeft, '');
  await store.set('dictionaryWindowLeft', -800);
  await store.set('dictionaryWindowTop', 220);
  const reopened = createSettingsStore(platform); await reopened.init();
  for (const [key, value] of Object.entries(saved)) assert.equal(reopened.values[key], value);
  assert.throws(() => normalizeSetting('dictionaryWindowLeft', Infinity));
  assert.throws(() => normalizeSetting('dictionaryWindowTop', null));
});

test('swapped mouse actions are optional and persist across reader restarts', async () => {
  assert.equal(defaults.swapMouseButtons, false);
  assert.equal(normalizeSettings().swapMouseButtons, false);
  assert.equal(normalizeSetting('swapMouseButtons', 'true'), true);
  assert.equal(normalizeSetting('swapMouseButtons', 'false'), false);
  const saved = {};
  const platform = { watchSettings() {}, async getSettings() { return { ...saved }; }, async setSettings(patch) { Object.assign(saved, patch); } };
  const store = createSettingsStore(platform); await store.init();
  await store.set('swapMouseButtons', true);
  assert.equal(saved.swapMouseButtons, true);
  const reopened = createSettingsStore(platform); await reopened.init();
  assert.equal(reopened.values.swapMouseButtons, true);
  await reopened.set('swapMouseButtons', false);
  assert.equal(saved.swapMouseButtons, false);
});

test('popup mode and close-after-add preserve defaults and validate saved preferences', async () => {
  assert.equal(defaults.dictionaryPopupMode, 'page');
  assert.equal(defaults.ankiCloseAfterAdd, false);
  assert.equal(normalizeSetting('dictionaryPopupMode', 'independent'), 'independent');
  assert.throws(() => normalizeSetting('dictionaryPopupMode', 'floating'));
  assert.equal(normalizeSettings({ dictionaryPopupMode: 'floating' }).dictionaryPopupMode, 'page');
  const saved = {};
  const store = createSettingsStore({ watchSettings() {}, async getSettings() { return {}; }, async setSettings(patch) { Object.assign(saved, patch); } });
  await store.init();
  await store.set('dictionaryPopupMode', 'independent');
  await store.set('ankiCloseAfterAdd', true);
  assert.equal(store.values.dictionaryPopupMode, 'independent');
  assert.equal(store.values.ankiCloseAfterAdd, true);
  assert.equal(saved.dictionaryPopupMode, 'independent');
  assert.equal(saved.ankiCloseAfterAdd, true);
  assert.equal(normalizeSettings(saved).ankiCloseAfterAdd, true);
});
