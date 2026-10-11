import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, writeFile, access, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { load, plain } from './helpers/core.mjs';
import { root, extensionPath, userscriptPath, version, release } from '../scripts/paths.mjs';
import { versionParts, compareVersions } from '../src/core/version.js';
import { releaseVersion } from '../scripts/release.mjs';

const message = (translator, text = '文章。', scope) => ({ action: 'translate', translator, text, scope, from: 'ja', to: 'zh-CN' });
const youdaoReply = text => ({ text: async () => `<ul id="translateResult"><li>${text}</li></ul>` });

test('Google：公开接口请求格式、原有换行和实体解码', async () => {
  const app = await load(['core/services']);
  const calls = [];
  const result = await app.translateText(message('google', '最初。\n\n次。'), async (url, options) => {
    calls.push({ url, options });
    return { json: async () => [['译文 &amp; &lt;b&gt;']] };
  });
  assert.equal(result, '译文 & <b>\n\n译文 & <b>');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://translate-pa.googleapis.com/v1/translateHtml');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), [[['最初。'], 'ja', 'zh-CN'], 'wt_lib']);
  await assert.rejects(app.translateText(message('google'), async () => ({ json: async () => [] })), /未返回翻译结果/);
  await assert.rejects(app.translateText(message('deepl'), async () => {}), /不支持/);
});

test('有道：长文本分块、413 重试，不引入额外换行', async () => {
  const app = await load(['core/services']);
  const text = '文章です。'.repeat(35) + '\r\n\r\n最後。', sent = [];
  let retry = true;
  const result = await app.translateText(message('youdao', text), async (url, options) => {
    assert.equal(url, 'https://m.youdao.com/translate');
    assert.equal(options.method, 'POST');
    const part = new URLSearchParams(options.body).get('inputtext');
    assert.ok(Array.from(part).length <= 180);
    if (retry) { retry = false; throw app.httpError(413); }
    sent.push(part);
    const middle = Math.floor(part.length / 2);
    return { text: async () => `<ul id="translateResult"><li>${part.slice(0, middle)}</li><li>${part.slice(middle)}</li></ul>` };
  });
  assert.equal(sent.join(''), text.replace(/[\r\n]/g, ''));
  assert.equal(result, text.replace(/\r\n/g, '\n'));
  assert.equal(app.translationChunks('😀'.repeat(7), 3).join(''), '😀'.repeat(7));
  await assert.rejects(app.translateText(message('youdao'), async () => ({ text: async () => '<html>error</html>' })), /未返回/);
});

test('VITS：在线声音列表、完整地址、合成参数和音频校验', async () => {
  const app = await load(['core/settings', 'core/services']);
  const settings = { vitsAPI: 'https://tts.example/vits/', vitsVoice: 42, max: 70 };
  const voices = await app.handleServiceMessage({ action: 'vits_speakers', settings }, async url => {
    assert.equal(url, 'https://tts.example/vits/voice/speakers');
    return { json: async () => ({ VITS: [{ id: 42, name: '测试声音', lang: ['ja'] }] }) };
  });
  assert.equal(voices.voices[0].id, 42);
  const audio = await app.handleServiceMessage({ action: 'vits_audio', settings, text: 'こんにちは。' }, async (url, options) => {
    const address = new URL(url);
    assert.equal(address.pathname, '/vits/voice/vits');
    assert.equal(address.searchParams.get('text'), 'こんにちは。');
    assert.equal(address.searchParams.get('id'), '42');
    assert.equal(address.searchParams.get('segment_size'), '70');
    assert.equal(options.binary, true);
    return { headers: { get: () => 'audio/mpeg' }, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer };
  });
  assert.deepEqual(plain(audio), { audio: 'AQID', mime: 'audio/mpeg' });
  await assert.rejects(app.handleServiceMessage({ action: 'vits_speakers', settings }, async () => ({ json: async () => ({}) })), /未返回声音/);
  await assert.rejects(app.handleServiceMessage({ action: 'vits_audio', settings, text: '文' }, async () => ({ headers: { get: () => 'application/json' } })), /未返回音频/);
});

test('火山：所选声音和音频响应校验', async () => {
  const app = await load(['core/settings', 'core/services']);
  const input = { action: 'huosh_audio', text: 'こんにちは。', settings: { huoshVoice: 'jp_male_satoshi' } };
  const result = await app.handleServiceMessage(input, async (url, options) => {
    assert.equal(url, 'https://translate.volcengine.com/crx/tts/v1/');
    assert.deepEqual(JSON.parse(options.body), { text: 'こんにちは。', speaker: 'jp_male_satoshi' });
    return { json: async () => ({ audio: { data: 'AQID' } }) };
  });
  assert.deepEqual(plain(result), { audio: 'AQID', mime: 'audio/mpeg' });
  await assert.rejects(app.handleServiceMessage(input, async () => ({ json: async () => ({ audio: { data: '$invalid' } }) })), /有效音频/);
});

test('快速切换：未执行的任务取消，只请求最新文本', async () => {
  const app = await load(['core/services']);
  const sent = [], cancelled = [];
  const request = async (_url, options) => { sent.push(new URLSearchParams(options.body).get('inputtext')); return youdaoReply('译文'); };
  for (const text of ['旧段落', '中间段落']) {
    cancelled.push(assert.rejects(app.handleServiceMessage(message('youdao', text, 'A'), request), { name: 'AbortError' }));
  }
  assert.equal((await app.handleServiceMessage(message('youdao', '最新段落', 'A'), request)).translatedText, '译文');
  await Promise.all(cancelled);
  assert.deepEqual(sent, ['最新段落']);
});

test('请求中的任务可取消，两个服务和不同阅读页互不等待', async () => {
  const app = await load(['core/services']);
  let started, aborted = false;
  const ready = new Promise(resolve => { started = resolve; });
  const slow = app.handleServiceMessage(message('google', '旧文本', 'A'), async (_url, options) => {
    started();
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => { aborted = true; reject(options.signal.reason); }, { once: true }));
  });
  const cancelled = assert.rejects(slow, { name: 'AbortError' });
  await ready;
  const other = await app.handleServiceMessage(message('youdao', '独立文本', 'A'), async () => youdaoReply('有道先返回'));
  assert.equal(other.translatedText, '有道先返回');
  const newest = app.handleServiceMessage(message('google', '最新文本', 'A'), async () => ({ json: async () => [['新译文']] }));
  const otherPage = app.handleServiceMessage(message('google', '另一个页面', 'B'), async () => ({ json: async () => [['另一译文']] }));
  await cancelled;
  assert.equal(aborted, true);
  assert.deepEqual(plain(await Promise.all([newest, otherPage])), [{ translatedText: '新译文' }, { translatedText: '另一译文' }]);
});

test('缓存仅保留成功结果；Google 429 暂停继续请求', async () => {
  const app = await load(['core/services']);
  let count = 0;
  const request = async () => { count++; return youdaoReply('译文'); };
  const input = message('youdao', '相同文本', 'A');
  await Promise.all([app.handleServiceMessage(input, request), app.handleServiceMessage(input, request)]);
  await app.handleServiceMessage(input, request);
  assert.equal(count, 1);
  await assert.rejects(app.handleServiceMessage(message('youdao', '失败文本', 'A'), async () => { throw app.httpError(500); }), /500/);
  await app.handleServiceMessage(message('youdao', '失败文本', 'A'), request);
  assert.equal(count, 2);
  const limited = async () => { count++; throw app.httpError(429); };
  for (const text of ['文本1', '文本2']) await assert.rejects(app.handleServiceMessage(message('google', text, 'A'), limited), /429/);
  assert.equal(count, 3);
});

test('Chrome：接口授权与阅读网站权限独立，VITS 只允许配置的服务路径', async () => {
  const granted = new Set(['https://reader.ttsu.app/*']);
  let calls = 0;
  const app = await load(['core/settings', 'core/services', 'platform/chromePermissions'], {
    chrome: { permissions: { contains: async ({ origins }) => origins.every(origin => granted.has(origin)) } },
    fetch: async () => { calls++; return { ok: true, text: async () => 'ok' }; }
  });
  await assert.rejects(app.chromeServiceRequest('https://m.youdao.com/translate'), /Chrome 未授权/);
  assert.equal(calls, 0);
  granted.add('https://m.youdao.com/*');
  assert.equal(await (await app.chromeServiceRequest('https://m.youdao.com/translate')).text(), 'ok');
  assert.deepEqual(plain(app.serviceOrigins('vits', { vitsAPI: 'https://tts.example/api/' })), ['https://tts.example/*']);
  granted.add('https://tts.example/*');
  await app.chromeServiceRequest('https://tts.example/api/voice/speakers', { vitsBase: 'https://tts.example/api' });
  await assert.rejects(app.chromeServiceRequest('https://tts.example/other', { vitsBase: 'https://tts.example/api' }), /不支持/);
  app.fetchRequest = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(app.chromeServiceRequest('https://m.youdao.com/translate'), /接口连接失败/);
});

test('油猴：跨域请求解析、超时和实际传输取消', async () => {
  let options, aborted = false;
  const app = await load(['core/services', 'platform/userscript'], {
    GM_xmlhttpRequest: input => { options = input; return { abort() { aborted = true; } }; }
  });
  const result = app.gmRequest('https://tts.example', { method: 'POST', body: '{}' });
  assert.equal(options.method, 'POST');
  options.onload({ status: 200, responseText: '{"ok":true}' });
  assert.equal((await (await result).json()).ok, true);
  const timeout = app.gmRequest('https://tts.example'); options.ontimeout();
  await assert.rejects(timeout, /超时/);
  const controller = new AbortController();
  const pending = app.gmRequest('https://tts.example', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(aborted, true);
});

test('平台产物：入口可解析、资源完整，声明嵌套阅读页与接口权限', async () => {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const manifest = JSON.parse(await read(`${extensionPath}/manifest.json`));
  assert.equal(manifest.version, version);
  assert.equal(manifest.content_scripts[0].all_frames, true);
  assert.equal(manifest.content_scripts[0].match_origin_as_fallback, true);
  for (const host of ['https://m.youdao.com/*', 'https://translate-pa.googleapis.com/*', 'https://translate.volcengine.com/*', 'https://api.github.com/*']) assert.ok(manifest.host_permissions.includes(host));
  for (const path of [...Object.values(manifest.icons), manifest.action.default_popup, manifest.background.service_worker, ...manifest.content_scripts.flatMap(item => [...item.js, ...item.css])]) await access(new URL(`../${extensionPath}/${path}`, import.meta.url));
  for (const path of [`${extensionPath}/content.js`, `${extensionPath}/popup.js`, `${extensionPath}/background.js`, userscriptPath]) new vm.Script(await read(path));
  const script = await read(userscriptPath);
  for (const grant of ['GM_xmlhttpRequest', 'GM_setClipboard', 'GM_registerMenuCommand']) assert.ok(script.includes(`// @grant        ${grant}`));
  const metadata = script.slice(0, script.indexOf('// ==/UserScript=='));
  assert.doesNotMatch(metadata, /@(?:updateURL|downloadURL)/);
  assert.ok(metadata.includes(`// @version      ${version}`));
  await assert.rejects(read('dist/tampermonkey/AnonTranslator.meta.js'), { code: 'ENOENT' });
});

test('版本检查：只读取正式发布，按数字比较完整版本，缓存并可手动刷新', async () => {
  const app = await load(['core/updates', 'core/services']);
  assert.equal(app.compareVersions('v2.10.0', '2.9.9'), 1);
  assert.equal(app.compareVersions('2.0.1', '2.0.0'), 1);
  assert.throws(() => app.compareVersions('2.0.0-beta.1', '2.0.0'));
  let tag = `v${version}`, calls = 0;
  const request = async (url, options) => {
    assert.equal(url, release.api); assert.equal(options.timeout, 8000); calls++;
    return { json: async () => ({ tag_name: tag, draft: false, prerelease: false, html_url: 'https://unrelated.example' }) };
  };
  const message = { action: 'check_update' };
  const responses = await Promise.all([app.handleServiceMessage(message, request), app.handleServiceMessage(message, request)]);
  assert.equal(responses[0].state, 'current'); assert.equal(calls, 1);
  tag = 'v99.0.0';
  assert.equal((await app.handleServiceMessage(message, request)).state, 'current');
  const newer = await app.handleServiceMessage({ ...message, force: true }, request);
  assert.deepEqual(plain(newer), { state: 'available', version: '99.0.0', url: release.page });
  tag = 'v0.1.0';
  assert.equal((await app.handleServiceMessage({ ...message, force: true }, request)).state, 'current');
});

test('版本规则：构建与运行时共用解析，小版本提交可发布，标题与包内版本必须一致', () => {
  assert.deepEqual(versionParts('v2.0.1'), [2, 0, 1]);
  assert.deepEqual(versionParts('65535.0.1'), [65535, 0, 1]);
  assert.equal(compareVersions('2.10.0', '2.9.9'), 1);
  assert.equal(compareVersions('v2.0.0', '2.0.0'), 0);
  for (const invalid of ['0.0.0', '01.2.3', '2.0', '2.0.0-beta', '65536.0.0', '2.0.0\n', ' 2.0.0']) assert.throws(() => versionParts(invalid), /版本号/);
  for (const current of ['2.0.1', '2.1.0', '3.0.0']) assert.equal(releaseVersion(`v${current}`, current), current);
  assert.equal(releaseVersion('v2.0.1\n\n修复说明', '2.0.1'), '2.0.1');
  for (const title of ['修复翻译', 'release v2.0.1', 'v2.0.1 fix', 'v2.0', 'v2.0.1-beta', 'v02.0.1', ' v2.0.1', 'v2.0.1 ']) assert.equal(releaseVersion(title, '2.0.1'), null);
  assert.throws(() => releaseVersion('v2.0.1', '2.0.0'), /不一致/);
});

test('发布入口：读取推送最后一条提交，普通提交跳过，手动发布及不一致报错', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'anon-release-'));
  const eventFile = path.join(folder, 'event.json'), outputFile = path.join(folder, 'output.txt');
  const run = async (message, eventName = 'push') => {
    await writeFile(eventFile, JSON.stringify({ head_commit: message === null ? null : { message } }));
    await writeFile(outputFile, '');
    execFileSync(process.execPath, ['scripts/release.mjs'], { cwd: root, stdio: 'pipe', env: { ...process.env, GITHUB_EVENT_NAME: eventName, GITHUB_EVENT_PATH: eventFile, GITHUB_OUTPUT: outputFile } });
    return readFile(outputFile, 'utf8');
  };
  try {
    assert.equal(await run(`v${version}`), `publish=true\nversion=${version}\n`);
    assert.equal(await run('普通修改'), `publish=false\nversion=${version}\n`);
    assert.equal(await run(null), `publish=false\nversion=${version}\n`);
    assert.equal(await run(null, 'workflow_dispatch'), `publish=true\nversion=${version}\n`);
    await assert.rejects(run('v99.0.0'), /不一致/);
    const workflow = await readFile(path.join(root, '.github/workflows/release.yml'), 'utf8');
    assert.doesNotMatch(workflow, /paths:|fetch-depth:/);
    assert.match(workflow, /github\.event\.head_commit\.message/);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('版本检查：无公开发布和联网失败不误报最新，失败可重试', async () => {
  const app = await load(['core/updates', 'core/services']);
  assert.deepEqual(plain(await app.checkForUpdate(async () => { throw app.httpError(404); })), { state: 'unpublished', url: release.listing });
  await assert.rejects(app.checkForUpdate(async () => { throw app.httpError(503); }, true), /503/);
  for (const data of [{ tag_name: 'invalid' }, { tag_name: 'v99.0.0', prerelease: true }, { tag_name: 'v99.0.0', draft: true }]) {
    await assert.rejects(app.checkForUpdate(async () => ({ json: async () => data })), /版本/);
  }
  assert.equal((await app.checkForUpdate(async () => ({ json: async () => ({ tag_name: `v${version}` }) }))).state, 'current');
});

test('Chrome 后台接收版本检查，并通过已有的接口授权适配请求', async () => {
  let listener, checked = 0;
  await load(['core/updates', 'core/services', 'platform/chromePermissions', 'entries/background'], {
    chrome: { runtime: { onMessage: { addListener: fn => { listener = fn; } } }, permissions: { contains: async () => true } },
    fetch: async url => { assert.equal(url, release.api); checked++; return { ok: true, json: async () => ({ tag_name: `v${version}` }) }; }
  });
  const result = await new Promise(resolve => assert.equal(listener({ action: 'check_update' }, {}, resolve), true));
  assert.equal(result.state, 'current'); assert.equal(checked, 1);
});
