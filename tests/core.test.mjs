import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, normalizeSetting, normalizeSettings, wordColorFor } from '../src/settings/settings.js';
import { ankiDraftFields, plainText } from '../src/services/anki-fields.js';
import { ankiFields } from '../src/services/anki-model.js';
import { ankiPreviewFields, ankiPreviewDocument, ankiPreviewSpeech } from '../src/settings/anki-preview.js';
import { createSpeaker } from '../src/services/speech.js';
import { createAnkiService } from '../src/services/anki.js';
import { buildDictionarySearchURL, placeDictionaryPopup } from '../src/reader/dictionary-layout.js';
import { hiragana, readingParts } from '../src/reader/word-reading.js';
import { cachedTranslation, cancelTranslation } from '../src/services/translate.js';
import { aiDefaults, aiSettings, aiEndpoint, validateAISettings, resolveAIProtocol, legacyAIPrompts } from '../src/services/ai.js';
import { serviceOrigins, createChromePlatform } from '../src/platform/chrome.js';
import { fetchRequest, gmRequest } from '../src/services/request.js';

const sseEvent = (data, event = '') => `${event ? `event: ${event}\r\n` : ''}data: ${typeof data === 'string' ? data : JSON.stringify(data)}\r\n\r\n`;
const streamSettings = protocol => ({ ...aiDefaults, aiProtocol: protocol, aiStream: true,
  aiURL: protocol === 'gemini' ? 'https://ai.example/v1beta/models/{model}:generateContent' : `https://ai.example/${protocol}`,
  aiModel: 'test-model' });
const streamMessage = protocol => ({ translator: 'ai', text: '猫がいる。', from: 'ja', to: 'zh-CN', settings: streamSettings(protocol) });

test('AI streaming parses split SSE for all three protocols and emits only cumulative translation text', async () => {
  const fixtures = {
    openai: sseEvent({ choices: [{ delta: { reasoning_content: 'hidden' } }] })
      + sseEvent({ choices: [{ delta: { content: '猫' } }] })
      + sseEvent({ choices: [{ delta: { content: '在这里。' }, finish_reason: 'stop' }] }) + sseEvent('[DONE]'),
    claude: sseEvent({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hidden' } }, 'content_block_delta')
      + sseEvent({ type: 'content_block_delta', delta: { type: 'text_delta', text: '猫' } }, 'content_block_delta')
      + sseEvent({ type: 'content_block_delta', delta: { type: 'text_delta', text: '在这里。' } }, 'content_block_delta')
      + sseEvent({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }, 'message_delta')
      + sseEvent({ type: 'message_stop' }, 'message_stop'),
    gemini: sseEvent({ candidates: [{ content: { parts: [{ thought: true, text: 'hidden' }, { text: '猫' }] } }] })
      + sseEvent({ candidates: [{ content: { parts: [{ text: '在这里。' }] }, finishReason: 'STOP' }] })
  };
  for (const protocol of Object.keys(fixtures)) {
    const updates = [];
    const request = async (url, options) => {
      assert.equal(typeof options.onChunk, 'function');
      const body = JSON.parse(options.body);
      if (protocol === 'gemini') {
        assert.equal(new URL(url).pathname, '/v1beta/models/test-model:streamGenerateContent');
        assert.equal(new URL(url).searchParams.get('alt'), 'sse');
        assert(!Object.hasOwn(body, 'stream'));
      } else assert.equal(body.stream, true);
      const data = ': heartbeat\r\n\r\n' + fixtures[protocol];
      // A network chunk can end inside any field, CRLF separator or JSON string.
      for (let i = 0; i < data.length; i += 3) options.onChunk(data.slice(i, i + 3));
      return { text: async () => data, json: async () => assert.fail('SSE is not a complete JSON document') };
    };
    const result = await cachedTranslation({ ...streamMessage(protocol), onUpdate: value => updates.push(value) }, request);
    assert.equal(result.translatedText, '猫在这里。');
    assert(updates.length >= 2, `${protocol} must update before completion`);
    assert.equal(updates[0], '猫');
    assert.equal(updates.at(-1), result.translatedText);
    assert(updates.every(value => !value.includes('hidden')));
    const count = updates.length;
    assert.equal((await cachedTranslation({ ...streamMessage(protocol), onUpdate: value => updates.push(value) }, request)).translatedText, result.translatedText);
    assert(updates.length <= count + 1, 'A cached result cannot replay old stream fragments');
  }
  const qwenUpdates = [];
  const qwenRequest = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.messages[0].content, '猫がいる。');
    assert.deepEqual(body.translation_options, { source_lang: 'Japanese', target_lang: 'Chinese' });
    options.onChunk(sseEvent({ choices: [{ delta: { content: '有' } }] })
      + sseEvent({ choices: [{ delta: { content: '有一只' } }] })
      + sseEvent({ choices: [{ delta: { content: '有一只猫。' }, finish_reason: 'stop' }] }));
    return {};
  };
  const message = streamMessage('openai');
  message.settings.aiModel = 'qwen-mt-turbo';
  assert.equal((await cachedTranslation({ ...message, onUpdate: value => qwenUpdates.push(value) }, qwenRequest)).translatedText, '有一只猫。');
  assert.deepEqual(qwenUpdates, ['有', '有一只', '有一只猫。']);
  for (const model of ['qwen-mt-flash', 'qwen-mt-lite']) {
    const request = async (_url, options) => {
      options.onChunk(sseEvent({ choices: [{ delta: { content: '有' } }] })
        + sseEvent({ choices: [{ delta: { content: '猫。' }, finish_reason: 'stop' }] }));
      return {};
    };
    assert.equal((await cachedTranslation({ ...message, settings: { ...message.settings, aiModel: model } }, request)).translatedText, '有猫。');
  }
});

test('AI streaming rejects interrupted, failed and truncated results without caching partial text, and accepts complete JSON fallback', async () => {
  const partial = sseEvent({ choices: [{ delta: { content: '部分' } }] });
  const failures = [partial, partial + sseEvent({ error: { message: 'provider error' } }, 'error'),
    partial + sseEvent({ choices: [{ delta: {}, finish_reason: 'length' }] }) + sseEvent('[DONE]')];
  for (const failure of failures) {
    let calls = 0;
    const request = async (_url, options) => {
      calls++;
      const text = calls === 1 ? failure : sseEvent({ choices: [{ delta: { content: '完整' }, finish_reason: 'stop' }] }) + sseEvent('[DONE]');
      options.onChunk(text);
      return { text: async () => text };
    };
    await assert.rejects(cachedTranslation(streamMessage('openai'), request));
    assert.equal((await cachedTranslation(streamMessage('openai'), request)).translatedText, '完整');
    assert.equal(calls, 2);
  }
  for (const protocol of ['openai', 'claude', 'gemini']) {
    const fixtures = { openai: { choices: [{ message: { content: '完整译文' }, finish_reason: 'stop' }] },
      claude: { content: [{ type: 'text', text: '完整译文' }], stop_reason: 'end_turn' },
      gemini: { candidates: [{ content: { parts: [{ text: '完整译文' }] }, finishReason: 'STOP' }] } };
    const request = async (_url, options) => {
      const text = JSON.stringify(fixtures[protocol]);
      for (let i = 0; i < text.length; i += 2) options.onChunk(text.slice(i, i + 2));
      return { text: async () => text, json: async () => fixtures[protocol] };
    };
    assert.equal((await cachedTranslation(streamMessage(protocol), request)).translatedText, '完整译文');
  }
  const settings = { ...streamSettings('openai'), aiBody: '{"stream":false}' };
  const request = async (_url, options) => {
    assert.equal(JSON.parse(options.body).stream, false, 'An explicit custom stream field overrides the switch');
    assert.equal(options.onChunk, undefined);
    return { json: async () => ({ choices: [{ message: { content: '普通响应' } }] }) };
  };
  assert.equal((await cachedTranslation({ ...streamMessage('openai'), settings }, request)).translatedText, '普通响应');
});

test('Chrome fetch and userscript transport preserve UTF-8 and stream progress without repeating final text', async () => {
  const previousFetch = globalThis.fetch, previousGM = globalThis.GM_xmlhttpRequest, previousChrome = globalThis.chrome;
  const text = 'data: {"text":"猫🐈在这里。"}\r\n\r\n', bytes = new TextEncoder().encode(text);
  try {
    globalThis.fetch = async (_url, options) => {
      assert(!Object.hasOwn(options, 'onChunk'), 'Transport callbacks must not be passed as fetch init fields');
      return new Response(new ReadableStream({
        start(controller) {
          for (let i = 0; i < bytes.length; i++) controller.enqueue(bytes.slice(i, i + 1));
          controller.close();
        }
      }), { headers: { 'content-type': 'text/event-stream' } });
    };
    const chunks = [];
    const response = await fetchRequest('https://ai.example/stream', { onChunk: value => chunks.push(value) });
    assert.equal(chunks.join(''), text);
    assert(!chunks.join('').includes('\uFFFD'));
    assert.equal(await response.text(), text);

    let status = 200;
    globalThis.GM_xmlhttpRequest = options => {
      queueMicrotask(() => {
        options.onprogress({ status, responseText: text.slice(0, 7) });
        options.onprogress({ status, responseText: text.slice(0, 12) });
        options.onload({ status, responseText: text, responseHeaders: 'Content-Type: text/event-stream\r\n' });
      });
      return { abort() { options.onabort?.(); } };
    };
    const progress = [];
    const gmResponse = await gmRequest('https://ai.example/stream', { onChunk: value => progress.push(value) });
    assert.equal(progress.join(''), text);
    assert.equal(await gmResponse.text(), text);
    assert(progress.length >= 2);
    status = 401;
    const failedProgress = [];
    await assert.rejects(gmRequest('https://ai.example/stream', { onChunk: value => failedProgress.push(value) }), error => error.status === 401);
    assert.deepEqual(failedProgress, [], 'HTTP error bodies must not appear as translation progress');

    let aborted = 0;
    globalThis.GM_xmlhttpRequest = options => ({ abort() { aborted++; options.onabort?.(); } });
    const controller = new AbortController();
    const pending = gmRequest('https://ai.example/stream', { signal: controller.signal, onChunk() {} });
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(aborted, 1);

    const listeners = new Set(), updates = [];
    let rejectMessage = false;
    globalThis.chrome = { runtime: {
      getURL: path => `chrome-extension://test/${path}`,
      onMessage: { addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener) },
      async sendMessage(message) {
        for (const listener of listeners) {
          listener({ action: 'translation_progress', progressId: 'other-request', translatedText: 'stale' });
          listener({ action: 'translation_progress', progressId: message.progressId, translatedText: '当前' });
        }
        if (rejectMessage) throw new Error('background disconnected');
        return { translatedText: '当前译文' };
      }
    } };
    const platform = createChromePlatform();
    assert.deepEqual(await platform.send({ action: 'translate', translator: 'ai' }, text => updates.push(text)), { translatedText: '当前译文' });
    assert.deepEqual(updates, ['当前']);
    assert.equal(listeners.size, 0, 'A completed request releases its progress listener');
    rejectMessage = true;
    await assert.rejects(platform.send({ action: 'translate', translator: 'ai' }, () => {}), /disconnected/);
    assert.equal(listeners.size, 0, 'A failed request also releases its progress listener');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousGM === undefined) delete globalThis.GM_xmlhttpRequest;
    else globalThis.GM_xmlhttpRequest = previousGM;
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  }
});

test('AI translation uses each native protocol, literal prompt substitutions and custom JSON fields', async () => {
  const text = '猫は{{to}}と言った。\n次の行。', calls = [];
  const fixtures = {
    openai: { choices: [{ message: { content: '猫说了。\n下一行。' } }] },
    claude: { content: [{ type: 'thinking', thinking: 'hidden' }, { type: 'text', text: '猫说了。\n下一行。' }] },
    gemini: { candidates: [{ content: { parts: [{ thought: true, text: 'hidden' }, { text: '猫说了。\n下一行。' }] } }] }
  };
  for (const protocol of ['openai', 'claude', 'gemini']) {
    const config = { ...aiDefaults, aiProtocol: protocol, aiURL: protocol === 'gemini'
      ? 'https://ai.example/v1/models/{model}:generateContent' : 'https://ai.example/' + protocol,
      aiModel: 'test-model', aiAPIKey: 'test-only-key', aiPrompt: '{{from}} → {{to}}\n{{text}}',
      aiBody: JSON.stringify(protocol === 'gemini' ? { generationConfig: { temperature: 0.3 }, safetySettings: [] } : { temperature: 0.3 }),
      aiHeaders: '{"X-Custom":"yes"}' };
    const request = async (url, options) => {
      calls.push({ url, options });
      return { json: async () => fixtures[protocol] };
    };
    const result = await cachedTranslation({ translator: 'ai', text, from: 'ja', to: 'zh-CN', settings: config }, request);
    assert.equal(result.translatedText, '猫说了。\n下一行。');
    const { url, options } = calls.at(-1), body = JSON.parse(options.body);
    assert.equal(options.method, 'POST');
    assert.equal(options.aiBase, url);
    assert.equal(options.headers['X-Custom'] ?? options.headers['x-custom'], 'yes');
    assert.equal(options.headers['Content-Type'] ?? options.headers['content-type'], 'application/json');
    assert(!JSON.stringify(body).includes('test-only-key'));
    const prompt = protocol === 'gemini' ? body.contents[0].parts[0].text : body.messages[0].content;
    assert(prompt.includes(text), 'Original text must remain literal and be sent in one request');
    if (protocol === 'gemini') {
      assert.equal(url, 'https://ai.example/v1/models/test-model:generateContent');
      assert.equal(options.headers['x-goog-api-key'], 'test-only-key');
      assert.equal(body.generationConfig.temperature, 0.3);
    } else {
      assert.equal(body.model, 'test-model');
      assert.equal(body.stream, false);
      assert.equal(body.temperature, 0.3);
      if (protocol === 'claude') {
        assert(body.max_tokens > 0);
        assert.equal(options.headers['x-api-key'], 'test-only-key');
      } else assert.equal(options.headers.Authorization ?? options.headers.authorization, 'Bearer test-only-key');
    }
  }
  assert.equal(calls.length, 3);
  await cachedTranslation({ translator: 'ai', text, from: 'ja', to: 'zh-CN',
    settings: { ...aiDefaults, aiURL: 'https://test.openai.azure.com', aiModel: 'deployment-name', aiAPIKey: 'test-only-azure-key' } },
  async (url, options) => {
    assert.equal(url, 'https://test.openai.azure.com/openai/v1/chat/completions');
    assert.equal(options.headers['api-key'], 'test-only-azure-key');
    assert.equal(options.headers.Authorization, undefined);
    return { json: async () => fixtures.openai };
  });
});

test('AI settings validate custom endpoints and JSON, and preserve service choices during migration', () => {
  assert.equal(defaults.aiProtocol, 'auto');
  assert.equal(normalizeSetting('aiProtocol', 'auto'), 'auto');
  for (const [url, protocol] of [
    ['https://api.deepseek.com', 'openai'], ['http://localhost:1234/v1', 'openai'],
    ['https://api.anthropic.com', 'claude'], ['https://proxy.example/custom/v1/messages', 'claude'],
    ['https://generativelanguage.googleapis.com', 'gemini'], ['https://proxy.example/v1beta/models/', 'gemini'],
    ['https://proxy.example/models/test:streamGenerateContent?alt=sse', 'gemini']
  ]) assert.equal(resolveAIProtocol({ aiURL: url }), protocol);
  assert.equal(resolveAIProtocol({ aiProtocol: 'openai', aiURL: 'https://proxy.example/v1/messages' }), 'openai');
  assert.equal(resolveAIProtocol({ aiProtocol: 'claude', aiURL: 'https://proxy.example/custom-api' }), 'claude');
  assert.equal(aiEndpoint({ aiURL: 'https://proxy.example/v1beta', aiModel: 'test-model', aiStream: true }),
    'https://proxy.example/v1beta/models/test-model:streamGenerateContent?alt=sse');
  // Background validation receives an already resolved endpoint, not settings.
  assert.equal(aiEndpoint({ aiProtocol: 'openai', aiURL: 'https://proxy.example/v1beta/models/test-model:streamGenerateContent?alt=sse' }),
    'https://proxy.example/v1beta/models/test-model:streamGenerateContent?alt=sse');
  for (const prompt of legacyAIPrompts) assert.equal(normalizeSettings({ aiPrompt: prompt }).aiPrompt, defaults.aiPrompt);
  const customPrompt = 'My own translator: {{from}} -> {{to}}\n{{text}}';
  assert.equal(normalizeSettings({ aiPrompt: customPrompt }).aiPrompt, customPrompt);
  assert.equal(aiEndpoint({ aiURL: 'https://api.deepseek.com' }), 'https://api.deepseek.com/chat/completions');
  assert.equal(aiEndpoint({ aiURL: 'https://api.deepseek.com/v1/' }), 'https://api.deepseek.com/v1/chat/completions');
  assert.equal(aiEndpoint({ aiURL: 'https://api.openai.com' }), 'https://api.openai.com/v1/chat/completions');
  assert.equal(aiEndpoint({ aiURL: 'https://api.mistral.ai' }), 'https://api.mistral.ai/v1/chat/completions');
  assert.equal(aiEndpoint({ aiURL: 'https://api.cohere.com' }), 'https://api.cohere.com/compatibility/v1/chat/completions');
  assert.equal(aiEndpoint({ aiURL: 'https://example.openai.azure.com' }), 'https://example.openai.azure.com/openai/v1/chat/completions');
  for (const base of ['https://dashscope.aliyuncs.com/compatible-mode/v1', 'https://open.bigmodel.cn/api/paas/v4', 'https://proxy.example/v2/']) {
    assert.equal(aiEndpoint({ aiURL: base }), base.replace(/\/$/, '') + '/chat/completions');
  }
  for (const path of ['', '/v1', '/v1/']) {
    assert.equal(aiEndpoint({ aiProtocol: 'claude', aiURL: 'https://api.anthropic.com' + path }), 'https://api.anthropic.com/v1/messages');
  }
  for (const path of ['', '/v1beta', '/v1beta/', '/v1beta/models', '/v1beta/models/']) {
    assert.equal(aiEndpoint({ aiProtocol: 'gemini', aiURL: 'https://generativelanguage.googleapis.com' + path, aiModel: 'gemini-test' }),
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
  }
  assert.equal(aiEndpoint({ aiProtocol: 'claude', aiURL: 'https://proxy.example/custom/messages?version=1' }), 'https://proxy.example/custom/messages?version=1');
  assert.equal(defaults.ai, false);
  assert.equal(defaults.aiStream, false);
  assert.equal(normalizeSetting('aiStream', true), true);
  assert.throws(() => validateAISettings({ ...aiDefaults, aiModel: 'model', aiBody: '{"stream":"yes"}' }), /布尔/);
  assert.deepEqual(normalizeSettings({ translationOrder: ['google', 'youdao'], ankiTranslationServices: [] }).translationOrder,
    ['google', 'youdao', 'ai']);
  assert.deepEqual(normalizeSettings({ ankiTranslationServices: [] }).ankiTranslationServices, []);
  assert.deepEqual(normalizeSetting('ankiTranslationServices', ['ai']), ['ai']);
  assert(!defaults.ankiTranslationServices.includes('ai'));
  assert.deepEqual(serviceOrigins('ai', { aiURL: 'http://localhost:1234/v1/chat/completions' }), ['http://localhost/*']);
  assert.deepEqual(serviceOrigins('ai', { aiURL: 'https://ai.example/v1/models/{model}:generateContent' }), ['https://ai.example/*']);
  for (const url of ['javascript:alert(1)', '//ai.example/path', 'https://user:secret@ai.example/api', 'https://ai.example/api#fragment']) {
    assert.throws(() => normalizeSetting('aiURL', url));
  }
  assert.equal(normalizeSetting('aiURL', ' https://ai.example/api?api-version=1 '), 'https://ai.example/api?api-version=1');
  for (const value of ['[]', 'null', '{bad', '{"__proto__":{"polluted":true}}']) assert.throws(() => normalizeSetting('aiBody', value));
  assert.throws(() => normalizeSetting('aiPrompt', 'Missing source placeholder'));
  assert.equal(normalizeSetting('aiAPIKey', ''), '');
  assert.throws(() => validateAISettings(aiDefaults), /模型/);
  assert.equal(aiEndpoint({ ...aiDefaults, aiURL: 'https://ai.example/models/{model}:generateContent', aiModel: 'models/a b' }),
    'https://ai.example/models/a%20b:generateContent');
});

test('AI auto mode sends the matching request format and uses English source language instructions', async () => {
  const text = '猫は{{from}}と{{text}}を見た。';
  const cases = [
    ['https://api.deepseek.com', 'openai', { choices: [{ message: { content: '译文' } }] }],
    ['https://api.anthropic.com', 'claude', { content: [{ type: 'text', text: '译文' }] }],
    ['https://proxy.example/v1beta', 'gemini', { candidates: [{ content: { parts: [{ text: '译文' }] } }] }]
  ];
  for (const [aiURL, protocol, response] of cases) {
    const request = async (_url, options) => {
      const body = JSON.parse(options.body);
      const prompt = protocol === 'gemini' ? body.contents[0].parts[0].text : body.messages[0].content;
      assert(prompt.includes('Source language: auto-detect.'));
      assert(prompt.includes('Simplified Chinese'));
      assert(!/[\u3400-\u9fff]/u.test(prompt.slice(0, prompt.indexOf(text))), 'Default instructions should be entirely English');
      assert(prompt.includes(text), 'Placeholders in source text must remain literal');
      if (protocol === 'claude') assert(body.max_tokens > 0);
      return { json: async () => response };
    };
    assert.equal((await cachedTranslation({ translator: 'ai', text, from: 'auto', to: 'zh-CN',
      settings: { ...aiDefaults, aiURL, aiModel: 'test-model' } }, request)).translatedText, '译文');
  }
  for (const [from, aiPrompt, expected] of [
    ['ja', aiDefaults.aiPrompt, 'Source language: Japanese.'],
    ['auto', '{{from}} -> {{to}}\n{{text}}', 'auto-detect -> Simplified Chinese']
  ]) {
    await cachedTranslation({ translator: 'ai', text, from, to: 'zh-CN', settings: { ...aiDefaults, aiModel: 'test-model', aiPrompt } },
      async (_url, options) => {
        const prompt = JSON.parse(options.body).messages[0].content;
        assert(prompt.includes(expected));
        assert(prompt.includes(text));
        assert(!prompt.includes('自动识别语言'));
        return { json: async () => ({ choices: [{ message: { content: '译文' } }] }) };
      });
  }
});

test('AI cache follows configuration changes, failed calls retry and explicit refresh bypasses cached results', async () => {
  const settings = { ...aiDefaults, aiURL: 'https://ai.example/chat/completions', aiModel: 'test-model' };
  let calls = 0, fail = false;
  const request = async () => {
    calls++;
    if (fail) { const error = new Error('HTTP 401'); error.status = 401; throw error; }
    return { json: async () => ({ choices: [{ message: { content: String(calls) } }] }) };
  };
  const message = { translator: 'ai', text: '今日は晴れ。', from: 'ja', to: 'zh-CN', settings };
  assert.equal((await cachedTranslation(message, request)).translatedText, '1');
  assert.equal((await cachedTranslation(message, request)).translatedText, '1');
  for (const [key, value] of Object.entries({ aiModel: 'another-model', aiPrompt: '{{text}} 请翻译', aiURL: 'https://other.example/api',
    aiHeaders: '{"X-Test":"1"}', aiBody: '{"temperature":0.7}', aiAPIKey: 'changed-test-key' })) {
    settings[key] = value;
    const before = calls;
    await cachedTranslation({ ...message, settings: aiSettings(settings) }, request);
    assert.equal(calls, before + 1, `${key} must invalidate old translations`);
  }
  const before = calls;
  await cachedTranslation({ ...message, refresh: true }, request);
  assert.equal(calls, before + 1);
  fail = true;
  const failure = { ...message, text: '失敗。' };
  await assert.rejects(cachedTranslation(failure, request), /401/);
  fail = false;
  await cachedTranslation(failure, request);
  assert.equal(calls, before + 3, 'Failed requests must not remain cached');
});

test('numeric preferences accept their boundaries and preserve a fully hidden docked icon', () => {
  for (const key of ['dockedIconOpacity', 'panelTransparency', 'posOpacity', 'nightPosOpacity', 'dictionaryPopupTransparency']) {
    assert.equal(normalizeSetting(key, '0'), 0);
    assert.equal(normalizeSetting(key, 100), 100);
    for (const value of [-1, 101, 0.5, '', NaN, Infinity]) {
      assert.throws(() => normalizeSetting(key, value), undefined, `${key}: ${value}`);
    }
  }
  assert.equal(normalizeSettings({ dockedIconOpacity: '0' }).dockedIconOpacity, 0);
  assert.equal(normalizeSettings({ posOpacity: 0 }).posGlass, true);
  assert.equal(normalizeSettings().posOpacity, 100);
  assert.equal(normalizeSettings().nightPosOpacity, 75);
  assert.equal(normalizeSettings({ posOpacity: 0 }).nightPosOpacity, 0);
  assert.equal(normalizeSettings({ posOpacity: 42 }).nightPosOpacity, 42);
  assert.equal(normalizeSettings({ posOpacity: 42, nightPosOpacity: 73 }).nightPosOpacity, 73);
  assert.equal(normalizeSettings({ posOpacity: 'invalid' }).nightPosOpacity, 75);
  const palette = { posNounColor: '#123456', posVerbColor: '#abcdef', nightPosNounColor: '#654321',
    posUniformColorValue: '#112233', nightPosUniformColorValue: '#334455' };
  assert.equal(wordColorFor(palette, '名詞'), '#123456');
  assert.equal(wordColorFor({ ...palette, posUniformColor: true }, '名詞'), '#112233');
  assert.equal(wordColorFor({ ...palette, posUniformColor: true }, '動詞'), '#112233');
  assert.equal(wordColorFor({ ...palette, posUniformColor: true, nightMode: true }, '名詞'), '#334455');
  assert.equal(wordColorFor({ ...palette, posUniformColor: false, nightMode: true }, '名詞'), '#654321');
  assert.equal(wordColorFor({ ...palette, posUniformColor: true }, '記号'), 'transparent');
  assert.equal(normalizeSettings({ posGlass: false, posOpacity: 0 }).posGlass, false);
  assert.equal(normalizeSetting('posGlass', 'false'), false);
  assert.equal(normalizeSettings().dictionaryPopupGlass, true);
  assert.equal(normalizeSettings({ dictionaryPopupGlass: false, dictionaryPopupTransparency: 100, dictionaryPopupBlur: 0 }).dictionaryPopupGlass, false);
  for (const key of ['panelBlur', 'dictionaryPopupBlur']) {
    assert.equal(normalizeSetting(key, '0'), 0);
    assert.equal(normalizeSetting(key, 20), 20);
    for (const value of [-1, 21, 0.5, '', NaN, Infinity]) assert.throws(() => normalizeSetting(key, value));
  }
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

test('Anki joining a cancelled AI reading request cannot trigger an independent paid retry', async () => {
  let calls = 0, begin;
  const started = new Promise(resolve => { begin = resolve; });
  const request = async (_url, options) => {
    calls++;
    if (!options.signal) return { json: async () => ({ choices: [{ message: { content: 'Unexpected retry' } }] }) };
    begin();
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  };
  const message = { translator: 'ai', text: '古い設定。', from: 'ja', to: 'zh-CN',
    settings: { ...aiDefaults, aiURL: 'https://ai.example/cancel-test', aiModel: 'test-model' } };
  const reading = cachedTranslation({ ...message, scope: 'ai-configuration-change' }, request);
  await started;
  const card = cachedTranslation(message, request);
  cancelTranslation('ai-configuration-change');
  await Promise.all([assert.rejects(reading, { name: 'AbortError' }), assert.rejects(card, { name: 'AbortError' })]);
  assert.equal(calls, 1, 'Cancelling old AI work must not issue a new request');
});
