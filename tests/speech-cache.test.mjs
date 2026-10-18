import test from 'node:test';
import assert from 'node:assert/strict';
import { vitsAudio, huoshanAudio } from '../src/services/speech.js';

function audioRequest() {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    return { headers: { get: () => 'audio/mpeg' }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      json: async () => ({ audio: { data: 'AQID' } }) };
  };
  return { request, calls };
}

test('playback/export audio deduplicates in-flight synthesis and retries failed requests', async () => {
  let release, calls = 0, fail = true;
  const request = async () => {
    calls++; await new Promise(resolve => { release = resolve; });
    if (fail) throw new Error('temporary failure');
    return { json: async () => ({ audio: { data: 'AQID' } }) };
  };
  const first = huoshanAudio('并发语音', {}, request), second = huoshanAudio('并发语音', {}, request);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 1);
  release(); await assert.rejects(first, /temporary failure/); await assert.rejects(second, /temporary failure/);
  fail = false;
  const retry = huoshanAudio('并发语音', {}, request); await new Promise(resolve => setImmediate(resolve)); release();
  assert.deepEqual(await retry, { audio: 'AQID', mime: 'audio/mpeg' });
  assert.deepEqual(await huoshanAudio('并发语音', {}, request), { audio: 'AQID', mime: 'audio/mpeg' });
  assert.equal(calls, 2);
});

test('VITS cache keys include every generated output parameter and custom API query', async () => {
  const { request, calls } = audioRequest();
  const config = { vitsAPI: 'http://localhost:23456', vitsVoice: 0, vitsLang: 'ja', length: 1, noise: .33, noisew: .4, max: 50 };
  await vitsAudio('声の確認', config, request);
  await vitsAudio('声の確認', { ...config, useWindowsTTS: true, ankiEnabled: true }, request);
  assert.equal(calls.length, 1);
  for (const patch of [{ vitsAPI: 'http://localhost:23457' }, { vitsVoice: 2 }, { vitsLang: 'zh' },
    { length: 1.1 }, { noise: .5 }, { noisew: .7 }, { max: 100 }]) {
    await vitsAudio('声の確認', { ...config, ...patch }, request);
  }
  await vitsAudio('別の文', config, request);
  await vitsAudio('声の確認', { ...config, vitsCustomAPI: 'http://localhost:23456/custom?id=1&lang=ja' }, request);
  await vitsAudio('声の確認', { ...config, vitsCustomAPI: 'http://localhost:23456/custom?id=2&lang=ja' }, request);
  assert.equal(calls.length, 11);
  assert.equal(new Set(calls.map(call => call.url)).size, 11);
});

test('Huosh synthesis keys isolate text and voice, while playback rate reuses the same raw audio', async () => {
  const { request, calls } = audioRequest();
  await huoshanAudio('音声', { huoshVoice: 'jp_female_mai' }, request);
  await huoshanAudio('音声', { huoshVoice: 'jp_female_mai', huoshRate: 1.5 }, request);
  await huoshanAudio('音声', { huoshVoice: 'jp_male_satoshi' }, request);
  await huoshanAudio('文章', { huoshVoice: 'jp_female_mai' }, request);
  assert.equal(calls.length, 3);
});

test('audio expires after ten minutes and bounded memory evicts older large results', async () => {
  const originalNow = Date.now;
  let now = originalNow(), calls = 0;
  const request = async () => {
    calls++;
    return { headers: { get: () => 'audio/mpeg' }, arrayBuffer: async () => new Uint8Array(5 * 1024 * 1024).buffer };
  };
  Date.now = () => now;
  try {
    await vitsAudio('大音声1', {}, request); await vitsAudio('大音声2', {}, request); await vitsAudio('大音声3', {}, request);
    assert.equal(calls, 3);
    await vitsAudio('大音声3', {}, request); assert.equal(calls, 3);
    await vitsAudio('大音声1', {}, request); assert.equal(calls, 4);
    now += 10 * 60 * 1000 + 1;
    await vitsAudio('大音声1', {}, request); assert.equal(calls, 5);
  } finally { Date.now = originalNow; }
});
