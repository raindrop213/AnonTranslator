import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedTranslation, cancelTranslation } from '../src/services/translate.js';

const message = { translator: 'google', text: '猫がいる。', from: 'ja', to: 'zh-CN' };

test('card panel joins an in-progress reader translation and reuses its completed result', async () => {
  let calls = 0, entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const request = async () => {
    calls++; entered(); await new Promise(resolve => { release = resolve; });
    return { json: async () => [['有猫。']] };
  };
  const reading = cachedTranslation({ ...message, scope: 'reader-share' }, request);
  await started;
  const exporting = cachedTranslation(message, request);
  release(); assert.equal((await reading).translatedText, '有猫。');
  assert.equal((await exporting).translatedText, '有猫。');
  assert.equal((await cachedTranslation(message, request)).translatedText, '有猫。');
  assert.equal(calls, 1);
});

test('reader cancellation cannot abort card panel translation; a failed request remains retryable', async () => {
  let calls = 0, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const request = async (_url, options) => {
    calls++;
    if (calls === 1) {
      entered();
      await new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
    }
    if (calls === 2) throw new Error('temporary translation error');
    return { json: async () => [['独立翻译。']] };
  };
  const reading = cachedTranslation({ ...message, scope: 'reader-cancel' }, request);
  await started;
  const exporting = cachedTranslation(message, request);
  cancelTranslation('reader-cancel');
  await assert.rejects(reading, error => error.name === 'AbortError');
  await assert.rejects(exporting, /temporary translation error/);
  assert.equal((await cachedTranslation(message, request)).translatedText, '独立翻译。');
  assert.equal(calls, 3);
});

test('translation results stay separate for provider language settings and transport context', async () => {
  let calls = 0;
  const request = async () => { calls++; return { json: async () => [['译文']] }; };
  await cachedTranslation(message, request); await cachedTranslation(message, request);
  await cachedTranslation({ ...message, to: 'en' }, request);
  await cachedTranslation(message, async (...args) => request(...args));
  assert.equal(calls, 3);
});
