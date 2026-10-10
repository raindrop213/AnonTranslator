import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const defaults = JSON.parse(await readFile(new URL('../src/config/defaultSettings.json', import.meta.url)));
async function load(files, extra = {}) {
  const context = vm.createContext({ console, URL, URLSearchParams, TextDecoder, TextEncoder, Uint8Array, atob, btoa, AbortSignal, AbortController, setTimeout, clearTimeout, ...extra });
  vm.runInContext(`const App = ${JSON.stringify({ defaults })};`, context);
  vm.runInContext(await readFile(new URL('../src/core/shortcuts.js', import.meta.url), 'utf8'), context);
  for (const file of files) vm.runInContext(await readFile(new URL(`../src/${file}.js`, import.meta.url), 'utf8'), context);
  return { app: vm.runInContext('App', context), context };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('Huosh speed applies after synthesis, updates live and leaves VITS at normal speed', async () => {
  const players = [];
  class Audio {
    constructor() { players.push(this); }
    play() { return Promise.resolve(); }
    pause() {}
    removeAttribute() {}
    load() {}
  }
  const { app } = await load(['core/settings', 'core/audio'], { Audio, Blob, window: {} });
  let respond;
  const speaker = app.createSpeaker({ send: () => new Promise(resolve => { respond = resolve; }) });
  const settings = app.normalizeSettings({ useHuoshTTS: true, huoshRate: 1.5 });
  const playing = speaker.speak('文章。', settings);
  speaker.setPlaybackRate(0.8);
  respond({ audio: btoa('audio'), mime: 'audio/mpeg' });
  await new Promise(setImmediate);
  assert.equal(players[0].playbackRate, 0.8);
  assert.equal(players[0].preservesPitch, true);
  speaker.setPlaybackRate(1.7);
  assert.equal(players[0].playbackRate, 1.7);
  speaker.stop();
  await playing;
  const vits = speaker.speak('文章。', app.normalizeSettings({ useVITS: true, huoshRate: 1.7 }));
  respond({ audio: btoa('audio'), mime: 'audio/mpeg' });
  await new Promise(setImmediate);
  assert.equal(players[1].playbackRate, 1);
  players[1].onended();
  await vits;
  assert.throws(() => app.normalizeSetting('huoshRate', 0.4));
  assert.throws(() => app.normalizeSetting('huoshRate', 2.1));
});

test('speech switches are mutually exclusive in one write and can all be off', async () => {
  const { app } = await load(['core/settings']);
  const writes = [];
  let watch;
  const store = app.createSettingsStore({ getSettings: async () => ({}), watchSettings(fn) { watch = fn; }, async setSettings(patch) { writes.push(plain(patch)); } });
  await store.init();
  for (const key of app.speechSwitches) {
    await store.set(key, true);
    assert.deepEqual(plain(app.speechSwitches.filter(name => store.values[name])), [key]);
    assert.equal(app.speechSwitches.filter(name => writes.at(-1)[name]).length, 1);
  }
  assert.equal(writes.length, 3);
  watch({ useVITS: true });
  assert.deepEqual(plain(app.speechSwitches.filter(name => store.values[name])), ['useVITS']);
  await store.set('useVITS', false);
  assert.equal(app.speechSwitches.some(name => store.values[name]), false);
  assert.equal(app.speechSwitches.some(name => app.normalizeSettings({ useVITS: true, useHuoshTTS: true })[name]), false);
});

test('Huosh adapter sends the selected speaker and validates base64 audio', async () => {
  const { app } = await load(['core/settings', 'core/services']);
  let sent;
  const message = { action: 'huosh_audio', text: 'こんにちは。', settings: { huoshVoice: 'jp_male_satoshi' } };
  const result = await app.handleServiceMessage(message, async (url, options) => {
    sent = { url, options };
    return { json: async () => ({ audio: { data: 'AQID' } }) };
  });
  assert.equal(sent.url, 'https://translate.volcengine.com/crx/tts/v1/');
  assert.equal(sent.options.method, 'POST');
  assert.deepEqual(JSON.parse(sent.options.body), { text: 'こんにちは。', speaker: 'jp_male_satoshi' });
  assert.deepEqual(plain(result), { audio: 'AQID', mime: 'audio/mpeg' });
  assert.throws(() => app.normalizeSetting('huoshVoice', 'unknown'), /有效选项/);
  for (const data of [{}, { audio: { data: '' } }, { audio: { data: '$invalid' } }]) {
    await assert.rejects(app.handleServiceMessage(message, async () => ({ json: async () => data })), /火山语音未返回有效音频/);
  }
});

test('VITS addresses normalize trailing slashes and reject invalid addresses', async () => {
  const { app } = await load(['core/settings']);
  for (const address of ['http://127.0.0.1:23456', 'http://127.0.0.1:23456/', ' http://127.0.0.1:23456/// ']) {
    assert.equal(app.normalizeSetting('vitsAPI', address), 'http://127.0.0.1:23456');
  }
  assert.equal(app.normalizeSetting('vitsAPI', 'https://tts.example/vits/'), 'https://tts.example/vits');
  for (const address of ['', '23456', 'localhost:23456', 'http:localhost', 'ftp://localhost', 'http://localhost:65536', 'http://user:secret@localhost', 'http://localhost/?token=x', 'http://localhost/#']) {
    assert.throws(() => app.normalizeSetting('vitsAPI', address), /完整的 HTTP/);
  }
});

test('VITS uses custom base addresses for voices and synthesis without double slashes', async () => {
  const { app } = await load(['core/settings', 'core/services']);
  const urls = [];
  const request = async (url, options) => {
    urls.push(url);
    assert.equal(options.vitsBase, 'https://tts.example/vits');
    return { json: async () => ({ VITS: [] }), headers: { get: () => 'audio/mpeg' }, arrayBuffer: async () => new Uint8Array([1]).buffer };
  };
  await app.handleServiceMessage({ action: 'vits_speakers', settings: { vitsAPI: 'https://tts.example/vits/' } }, request);
  await app.handleServiceMessage({ action: 'vits_audio', text: 'こんにちは。', settings: { vitsAPI: 'https://tts.example/vits/' } }, request);
  assert.equal(urls[0], 'https://tts.example/vits/voice/speakers');
  assert.equal(new URL(urls[1]).pathname, '/vits/voice/vits');
});

test('Chrome grants only the configured VITS host and enforces the service base path', async () => {
  let granted = false, calls = 0;
  const { app } = await load(['core/settings', 'core/services', 'platform/chromePermissions'], {
    chrome: { permissions: { contains: async ({ origins }) => granted && origins[0] === 'https://tts.example/*' } },
    fetch: async () => { calls++; return { ok: true, json: async () => ({ VITS: [] }) }; }
  });
  const message = { action: 'vits_speakers', settings: { vitsAPI: 'https://tts.example/vits/' } };
  assert.deepEqual(plain(app.serviceOrigins('vits', message.settings)), ['https://tts.example/*']);
  await assert.rejects(app.handleServiceMessage(message, app.chromeServiceRequest), /未授权.*tts.example/);
  assert.equal(calls, 0);
  granted = true;
  assert.deepEqual(plain(await app.handleServiceMessage(message, app.chromeServiceRequest)), { voices: [] });
  assert.equal(calls, 1);
  await assert.rejects(app.chromeServiceRequest('https://unrelated.example/voice/speakers', { vitsBase: 'https://tts.example/vits' }), /不支持/);
});

test('Google uses only the new protobuf JSON endpoint and decodes entities', async () => {
  const { app } = await load(['core/services']);
  const calls = [];
  const result = await app.translateText({ translator: 'google', text: '日本語 & ?\n\n次の行', from: 'auto', to: 'zh-CN' }, async (url, options) => {
    calls.push({ url, options });
    return { json: async () => [['100% &amp; &#x4E2D;&#25991; &lt;b&gt;']] };
  });
  assert.equal(result, '100% & 中文 <b>\n\n100% & 中文 <b>');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://translate-pa.googleapis.com/v1/translateHtml');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json+protobuf');
  assert.ok(calls[0].options.headers['X-Goog-Api-Key']);
  assert.deepEqual(JSON.parse(calls[0].options.body), [[['日本語 & ?'], 'auto', 'zh-CN'], 'wt_lib']);
  await assert.rejects(app.translateText({ translator: 'google', text: 'x', from: 'ja', to: 'zh-CN' }, async () => ({ json: async () => [] })), /新接口未返回/);
});

test('Chrome new Google endpoint requires its own grant and succeeds after authorization', async () => {
  let granted = false, calls = 0;
  const { app } = await load(['core/services', 'platform/chromePermissions'], {
    chrome: { permissions: { contains: async ({ origins }) => granted && origins[0] === 'https://translate-pa.googleapis.com/*' } },
    fetch: async () => { calls++; return { ok: true, json: async () => [['新接口译文']] }; }
  });
  const message = { action: 'translate', translator: 'google', text: '日本語', from: 'auto', to: 'zh-CN' };
  await assert.rejects(app.handleServiceMessage(message, app.chromeServiceRequest), /未授权.*translate-pa\.googleapis\.com/);
  assert.equal(calls, 0);
  granted = true;
  assert.equal((await app.handleServiceMessage(message, app.chromeServiceRequest)).translatedText, '新接口译文');
  assert.equal(calls, 1);
});

test('Google new endpoint propagates timeout and cancellation without using old endpoints', async () => {
  const { app } = await load(['core/services']);
  const message = { translator: 'google', text: '文章', from: 'ja', to: 'zh-CN' };
  for (const name of ['TimeoutError', 'AbortError']) {
    let requests = 0;
    await assert.rejects(app.translateText(message, async url => {
      requests++;
      assert.equal(new URL(url).hostname, 'translate-pa.googleapis.com');
      throw Object.assign(new Error(name), { name });
    }), error => error.name === name);
    assert.equal(requests, 1);
  }
});

test('rapid selections discard pending translations and only start the newest', async () => {
  const { app } = await load(['core/services']);
  const requests = [];
  const request = async (_url, options) => {
    requests.push(new URLSearchParams(options.body).get('inputtext'));
    return { text: async () => '<ul id="translateResult"><li>最新译文</li></ul>' };
  };
  const message = { action: 'translate', scope: 'reader-A', translator: 'youdao', from: 'ja', to: 'zh-CHS' };
  const old = app.handleServiceMessage({ ...message, text: '第一段' }, request);
  const firstCancelled = assert.rejects(old, error => error.name === 'AbortError');
  const middle = app.handleServiceMessage({ ...message, text: '第二段' }, request);
  const secondCancelled = assert.rejects(middle, error => error.name === 'AbortError');
  const newest = app.handleServiceMessage({ ...message, text: '第三段' }, request);
  assert.equal((await newest).translatedText, '最新译文');
  await Promise.all([firstCancelled, secondCancelled]);
  assert.deepEqual(requests, ['第三段']);
});

test('new selection aborts in-flight work without blocking latest or other readers', async () => {
  const { app } = await load(['core/services']);
  const message = { action: 'translate', translator: 'youdao', from: 'ja', to: 'zh-CHS' };
  let started, wasAborted = false;
  const ready = new Promise(resolve => { started = resolve; });
  const slow = app.handleServiceMessage({ ...message, scope: 'A', text: '旧的长段落' }, async (_url, options) => {
    started();
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
      wasAborted = true; reject(options.signal.reason);
    }, { once: true }));
  });
  const cancelled = assert.rejects(slow, error => error.name === 'AbortError');
  await ready;
  const request = async () => ({ text: async () => '<ul id="translateResult"><li>译文</li></ul>' });
  const other = app.handleServiceMessage({ ...message, scope: 'B', text: '另一个标签页' }, request);
  const newest = app.handleServiceMessage({ ...message, scope: 'A', text: '最新段落' }, request);
  assert.equal(wasAborted, true);
  await cancelled;
  assert.deepEqual(plain(await Promise.all([other, newest])), [{ translatedText: '译文' }, { translatedText: '译文' }]);
  let fetched = false;
  assert.equal((await app.handleServiceMessage({ ...message, scope: 'A', text: '最新段落' }, async () => { fetched = true; })).translatedText, '译文');
  assert.equal(fetched, false);
});

test('cancel command stops pending translation when the reader is disabled', async () => {
  const { app } = await load(['core/services']);
  let requests = 0;
  const pending = app.handleServiceMessage({ action: 'translate', scope: 'A', translator: 'google', text: '文章', from: 'ja', to: 'zh-CN' }, async () => { requests++; });
  const cancelled = assert.rejects(pending, error => error.name === 'AbortError');
  await app.handleServiceMessage({ action: 'cancel_translation', scope: 'A' });
  await cancelled;
  assert.equal(requests, 0);
});

test('GM cancellation aborts the actual transport and rejects immediately', async () => {
  let aborted = false;
  const { app } = await load(['core/services', 'platform/userscript'], {
    GM_xmlhttpRequest: () => ({ abort() { aborted = true; } })
  });
  const controller = new AbortController();
  const pending = app.gmRequest('https://translate-pa.googleapis.com/v1/translateHtml', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(aborted, true);
});
test('Chrome blocks unauthorized API requests and succeeds after a targeted grant', async () => {
  const granted = new Set(['https://reader.ttsu.app/*']);
  let calls = 0;
  const chrome = { permissions: { contains: async ({ origins }) => origins.every(origin => granted.has(origin)) } };
  const { app } = await load(['core/settings', 'core/services', 'platform/chromePermissions'], {
    chrome, fetch: async () => { calls++; return { ok: true, text: async () => '<ul id="translateResult"><li>中文译文</li></ul>' }; }
  });
  const message = { action: 'translate', translator: 'youdao', text: '日本語', from: 'auto', to: 'zh-CHS' };
  await assert.rejects(app.handleServiceMessage(message, app.chromeServiceRequest), /Chrome 未授权.*m\.youdao\.com.*授权 有道 接口/);
  assert.equal(calls, 0);
  granted.add('https://m.youdao.com/*');
  assert.equal((await app.handleServiceMessage(message, app.chromeServiceRequest)).translatedText, '中文译文');
  assert.equal(calls, 1);
  await assert.rejects(app.chromeServiceRequest('https://unrelated.example/'), /不支持/);
});
test('Chrome distinguishes revoked host access from a permitted network failure', async () => {
  let allowed = true;
  const { app } = await load(['core/services', 'platform/chromePermissions'], {
    chrome: { permissions: { contains: async () => allowed } },
    fetch: async () => { throw new TypeError('Failed to fetch'); }
  });
  await assert.rejects(app.chromeServiceRequest('https://m.youdao.com/translate'), /接口连接失败.*网络/);
  app.fetchRequest = async () => { allowed = false; throw new TypeError('Failed to fetch'); };
  await assert.rejects(app.chromeServiceRequest('http://127.0.0.1:23456/voice/speakers'), /Chrome 未授权.*VITS/);
});

test('reset restores all defaults in one write including customized shortcuts', async () => {
  const { app } = await load(['core/settings']);
  const writes = [];
  const store = app.createSettingsStore({
    watchSettings() {},
    async getSettings() { return { pluginSwitch: true, nightMode: true, shortcutNextSentence: defaults.shortcutNextParagraph, shortcutNextParagraph: '' }; },
    async setSettings(patch) { writes.push(plain(patch)); }
  });
  await store.init();
  await store.reset();
  assert.deepEqual(plain(store.values), defaults);
  assert.deepEqual(writes, [defaults]);
});
test('new reading switches default correctly and day/night palettes stay independent', async () => {
  const { app } = await load(['core/settings']);
  const s = app.normalizeSettings({ selectedBorderColor: '#123456', nightSelectedBorderColor: '#abcdef' });
  assert.equal(s.ignoreSymbolPairs, false);
  assert.equal(s.splitSpeech, true);
  assert.equal(app.colorsFor(s).selectedBorderColor, '#123456');
  assert.equal(app.colorsFor({ ...s, nightMode: true }).selectedBorderColor, '#abcdef');
  assert.throws(() => app.normalizeSetting('nightSentenceColor', 'red'));
});

test('settings validate numbers, preserve zero pitch and ignore unknown keys', async () => {
  const { app } = await load(['core/settings']);
  const values = app.normalizeSettings({ rate: '1.4', pitch: '0', vitsAPI: '', pluginSwitch: true, tab1: true, deepl: true });
  assert.equal(values.rate, 1.4);
  assert.equal(values.pitch, 0);
  assert.equal(values.vitsAPI, 'http://127.0.0.1:23456');
  assert.equal(values.deepl, undefined);
  assert.equal(values.pluginSwitch, true);
  assert.equal(values.tab1, undefined);
  assert.throws(() => app.normalizeSetting('vitsAPI', '65536'));
  assert.throws(() => app.normalizeSetting('rate', 'abc'));
  assert.throws(() => app.normalizeSetting('symbolPairs', '「'));
  assert.throws(() => app.normalizeSetting('sentenceDelimiters', '。/'));
  assert.throws(() => app.normalizeSetting('tab1', true));
  assert.throws(() => app.normalizeSetting('scrollIntoView', 'invalid'));
});

test('store handles changes during initialization and only writes changed fields', async () => {
  const { app } = await load(['core/settings']);
  const writes = [];
  let watcher;
  const store = app.createSettingsStore({
    watchSettings(fn) { watcher = fn; },
    async getSettings() { watcher({ pluginSwitch: true }); return { rate: '1.5' }; },
    async setSettings(patch) { writes.push(plain(patch)); }
  });
  await store.init();
  assert.equal(store.values.pluginSwitch, true);
  assert.equal(store.values.rate, 1.5);
  await store.set('pitch', '0');
  assert.deepEqual(writes, [{ pitch: 0 }]);
  watcher({ sentenceColor: '#123456' });
  assert.equal(store.values.sentenceColor, '#123456');
});

test('a local change and its storage notification publish only once', async () => {
  const { app } = await load(['core/settings']);
  let watcher, updates = 0;
  const store = app.createSettingsStore({
    watchSettings(fn) { watcher = fn; }, getSettings: async () => ({}),
    async setSettings(patch) { watcher(patch); }
  });
  await store.init();
  store.subscribe(() => updates++);
  await store.set('google', true);
  await store.set('google', true);
  watcher({ google: true });
  assert.equal(updates, 1);
});

test('worker reads local settings without migration or writes', async () => {
  let handler;
  const local = { rate: 1.8, pluginSwitch: false, vitsAPI: 'http://localhost:23456' };
  const chrome = {
    storage: { local: { async get() { return local; } } },
    runtime: { onMessage: { addListener(fn) { handler = fn; } } }
  };
  await load(['core/settings', 'core/services', 'entries/background'], { chrome });
  const result = await new Promise(resolve => handler({ type: 'getSettings' }, {}, resolve));
  assert.deepEqual(plain(result), local);
});
test('removed providers are rejected and have no configuration or service code', async () => {
  const { app } = await load(['core/settings', 'core/services']);
  assert.deepEqual(plain(app.providerNames), ['youdao', 'google']);
  await assert.rejects(app.translateText({ translator: 'caiyun', text: 'x', from: 'ja', to: 'zh' }, () => {}), /不支持/);
  assert.equal(app.decodeCaiyun, undefined);
});

test('VITS uses the synthesis port, correct segmentation parameter and binary audio', async () => {
  const { app } = await load(['core/settings', 'core/services']);
  const message = { action: 'vits_audio', text: 'こんにちは。', settings: { vitsAPI: 'http://127.0.0.1:23456', max: 70, vitsVoice: 42 } };
  let requested;
  const result = await app.handleServiceMessage(message, async (url, options) => {
    requested = { url, options };
    return { headers: { get: () => 'audio/mpeg' }, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
  });
  assert.equal(new URL(requested.url).origin, 'http://127.0.0.1:23456');
  assert.equal(new URL(requested.url).searchParams.get('segment_size'), '70');
  assert.equal(new URL(requested.url).searchParams.get('max'), null);
  assert.equal(result.audio, 'AQID');
  await assert.rejects(app.handleServiceMessage(message, async () => ({ headers: { get: () => 'application/json' } })), /未返回音频/);
});

test('GM adapter sends requests, rejects timeout and propagates cross-tab settings', async () => {
  let request, watch;
  const { app } = await load(['core/settings', 'core/services', 'platform/userscript'], {
    GM_getValue: (_key, fallback) => fallback,
    GM_setValue: () => {}, GM_setClipboard: () => {},
    GM_xmlhttpRequest: options => { request = options; },
    GM_addValueChangeListener: (key, callback) => { if (key === 'pluginSwitch') watch = callback; }
  });
  const pending = app.gmRequest('http://127.0.0.1:8666/play', { method: 'POST', body: '{}' });
  request.onload({ status: 200, responseText: '{"status":"completed"}' });
  assert.equal((await (await pending).json()).status, 'completed');
  const timedOut = app.gmRequest('https://translate-pa.googleapis.com/v1/translateHtml');
  request.ontimeout();
  await assert.rejects(timedOut, /超时/);
  const platform = app.createUserscriptPlatform();
  let patch;
  platform.watchSettings(value => { patch = value; });
  watch('pluginSwitch', false, true, true);
  assert.deepEqual(plain(patch), { pluginSwitch: true });
});

test('Youdao splits long text and recursively retries smaller pieces on 413', async () => {
  const { app } = await load(['core/settings', 'core/services']);
  const text = 'これは長い文章です。'.repeat(40);
  const pieces = [];
  let first = true;
  const result = await app.translateText({ translator: 'youdao', text, from: 'ja', to: 'zh-CHS' }, async (_url, options) => {
    const piece = new URLSearchParams(options.body).get('inputtext');
    assert.ok(Array.from(piece).length <= 180);
    if (first) { first = false; throw app.httpError(413); }
    pieces.push(piece);
    return { text: async () => `<ul id="translateResult"><li>${piece}</li><li>译文</li></ul>` };
  });
  assert.equal(pieces.join(''), text);
  assert.ok(result.includes('译文'));
  assert.equal(app.translationChunks('😀'.repeat(7), 3).join(''), '😀'.repeat(7));
});

test('identical translation requests are coalesced; failures are not permanently cached', async () => {
  const { app } = await load(['core/settings', 'core/services']);
  const message = { action: 'translate', translator: 'youdao', text: '同じ文章。', from: 'ja', to: 'zh-CHS' };
  let requests = 0;
  const request = async () => { requests++; return { text: async () => '<ul id="translateResult"><li>相同文章。</li></ul>' }; };
  await Promise.all([app.handleServiceMessage(message, request), app.handleServiceMessage(message, request)]);
  await app.handleServiceMessage(message, request);
  assert.equal(requests, 1);
  const failed = { ...message, text: '最初に失敗する文章。' };
  await assert.rejects(app.handleServiceMessage(failed, async () => { throw app.httpError(500); }), /500/);
  await app.handleServiceMessage(failed, request);
  assert.equal(requests, 2);
});

test('Google pauses further network requests after the new endpoint returns 429', async () => {
  const { app } = await load(['core/settings', 'core/services']);
  let count = 0;
  const request = async () => { count++; throw app.httpError(429); };
  const message = { action: 'translate', translator: 'google', text: '文章。', from: 'ja', to: 'zh-CN' };
  await assert.rejects(app.handleServiceMessage(message, request), /429/);
  await assert.rejects(app.handleServiceMessage({ ...message, text: '別の文章。' }, request), /429/);
  assert.equal(count, 1);
});

test('shortcut recording normalization, modifiers, conflicts and disabling', async () => {
  const { app } = await load(['core/settings']);
  assert.equal(app.normalizeShortcut(' Shift+Ctrl+KeyJ / Numpad4 '), 'Ctrl+Shift+KeyJ/Numpad4');
  assert.equal(app.shortcutAction({ code: 'Digit4' }, defaults), 'nextSentence');
  assert.equal(app.shortcutAction({ code: 'Digit4', ctrlKey: true }, defaults), undefined);
  assert.throws(() => app.validateShortcuts({ ...defaults, shortcutNextSentence: 'Digit1' }), /已用于/);
  assert.equal(app.normalizeSetting('shortcutNextSentence', ''), '');
  assert.throws(() => app.normalizeShortcut('Control+1'));
});
