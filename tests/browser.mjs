// Real DOM / audio regression with mocked platform APIs; no personal profile.
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { testPagination } from './pagination.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const root = fileURLToPath(new URL('..', import.meta.url));
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
try {
  await page.setContent(`<!doctype html><html><body>
    <p id="first" style="color:red;outline:1px dotted blue;border-radius:3px">「<ruby>日本語<rt>にほんご</rt></ruby>。短い文章！」</p>
    <section><div><p id="second">二番目の文章です。</p></div></section>
    <article><p id="third">最後の文章です。</p></article>
    <p id="markup"><em id="live">生きた要素。</em>追加。</p>
    <p id="complex"><span id="preserved">一番。<b>二<ruby>番<rt>ばん。</rt></ruby></b>です！三番？</span></p>
    <input id="editor"><div contenteditable="true" id="editable">編集</div>
  </body></html>`);
  await page.evaluate(() => {
    const values = { pluginSwitch: true, scrollSwitch: false, ignoreSymbolPairs: true };
    const watchers = new Map();
    window.testState = { values, copies: [], writes: [], requests: [], menus: [], liveClicks: 0 };
    window.GM_getValue = (key, fallback) => values[key] ?? fallback;
    window.GM_setValue = (key, value) => {
      const old = values[key]; values[key] = value;
      window.testState.writes.push({ key, value });
      watchers.get(key)?.(key, old, value, false);
    };
    window.GM_addValueChangeListener = (key, callback) => watchers.set(key, callback);
    window.GM_setClipboard = text => window.testState.copies.push(text);
    window.GM_addStyle = css => { const style = document.createElement('style'); style.textContent = css; document.head.append(style); };
    window.GM_registerMenuCommand = (_title, callback) => window.testState.menus.push(callback);
    window.GM_xmlhttpRequest = options => {
      window.testState.requests.push({ url: options.url, body: options.data, responseType: options.responseType });
      if (options.url.includes('/voice/speakers')) {
        if (window.testState.voiceFailure) setTimeout(() => options.onerror(), 10);
        else setTimeout(() => options.onload({ status: 200, responseText: '{"VITS":[{"id":342,"name":"在线声音","lang":["ja"]}]}' }), 10);
      } else if (options.responseType === 'arraybuffer') {
        const bytes = Uint8Array.from(atob(window.audioFixture), char => char.charCodeAt(0));
        setTimeout(() => options.onload({ status: 200, response: bytes.buffer, responseHeaders: `Content-Type: ${window.audioMime}\r\n` }), 10);
      } else if (options.url.includes('translate.volcengine.com')) {
        setTimeout(() => options.onload({ status: 200, responseText: JSON.stringify({ audio: { data: window.huoshAudioFixture || window.audioFixture } }) }), 10);
      } else {
        const reply = () => options.onload({ status: 200, responseText: options.url.includes('m.youdao.com') ? '<ul id="translateResult"><li>有道译文</li></ul>' : JSON.stringify([['訳文 &amp; 100%']]) });
        if (options.url.includes('translate-pa.googleapis.com') && window.testState.holdGoogle) window.testState.releaseGoogle = reply;
        else setTimeout(reply, 10);
      }
    };
    document.getElementById('live').addEventListener('click', () => window.testState.liveClicks++);
    window.originalInline = document.getElementById('preserved');
  });
  await page.addScriptTag({ path: `${root}/dist/userscript/AnonTranslator.user.js` });
  await page.waitForFunction(() => window.testState.menus.length === 1);
  const copied = () => page.evaluate(() => window.testState.copies.at(-1));
  await page.locator('#first').click();
  assert.equal(await copied(), '日本語。短い文章！');
  assert.equal(await page.locator('.at-notification').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.at-notification')).opacity) === .5);
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => document.getElementById('second').classList.contains('at-selected'));
  assert.equal(await page.locator('#first').evaluate(el => el.style.outline), 'blue dotted 1px');
  assert.equal(await page.locator('#first').evaluate(el => el.style.color), 'red');
  await page.locator('#editor').focus();
  await page.keyboard.type('hello world'); await page.keyboard.press('Digit4');
  assert.equal(await page.locator('#editor').inputValue(), 'hello world4');
  assert.equal(await page.locator('#second').evaluate(el => el.classList.contains('at-selected')), true);

  await page.locator('#first ruby').click({ button: 'right' });
  assert.equal(await copied(), '「日本語。');
  assert.ok(await page.locator('#first .at-sentence-selected').count() > 0);
  assert.equal(await page.locator('#first').evaluate(el => el.classList.contains('at-paragraph-context')), true);
  await page.mouse.move(900, 500);
  assert.ok(await page.locator('#first .at-sentence-selected').count() > 0);

  await page.evaluate(() => window.testState.menus[0]());
  assert.equal(await page.locator('.at-header-art').evaluate(async img => { await img.decode(); return img.naturalWidth > 0; }), true);
  assert.equal(await page.locator('.at-save-status').isVisible(), false);
  assert.equal(await page.locator('input[name=symbolPairs]').locator('..').locator('span').evaluate(el => el.classList.contains('at-sr-only')), true);
  await page.getByRole('tab', { name: '语音', exact: true }).click();
  assert.equal(await page.getByRole('tabpanel').locator('input').first().getAttribute('name'), 'readingInterval');
  await page.locator('input[name=readingInterval]').fill('20');
  await page.waitForFunction(() => window.testState.values.readingInterval === 20);
  await page.locator('input[name=readingInterval]').fill('-1');
  assert.equal(await page.evaluate(() => window.testState.values.readingInterval), 20);
  assert.match(await page.locator('.at-save-status').textContent(), /保留上次有效值/);
  await page.locator('input[name=readingInterval]').fill('100');
  await page.waitForFunction(() => window.testState.values.readingInterval === 100);
  await page.getByRole('tab', { name: '复制', exact: true }).click();
  await page.locator('input[name=ignoreSymbolPairs]').uncheck();
  assert.equal(await page.locator('input[name=symbolPairs]').isDisabled(), true);
  await page.locator('.at-close').click();
  await page.locator('#first').click();
  assert.equal(await copied(), '「日本語。短い文章！」');
  await page.evaluate(() => window.testState.menus[0]());
  await page.locator('input[name=ignoreSymbolPairs]').check();
  await page.locator('.at-close').click();
  await page.locator('#first ruby').click({ button: 'right' });
  assert.equal(await page.locator('#first .at-sentence-selected').first().evaluate(el => getComputedStyle(el).outlineStyle), 'none');
  await page.evaluate(() => window.testState.menus[0]());
  assert.equal(await page.getByRole('tab', { name: '语音', exact: true }).count(), 1);
  assert.equal(await page.locator('input[name=deepl],input[name=caiyun]').count(), 0);
  await page.getByRole('tab', { name: '外观', exact: true }).click();
  await page.locator('input[name=selectedBorderColor]').evaluate(el => { el.value = '#123456'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => document.getElementById('first').style.outlineColor === 'rgb(18, 52, 86)');
  await page.locator('.at-theme-toggle').click();
  await page.waitForFunction(() => window.testState.values.nightMode === true);
  assert.equal(await page.locator('.at-settings').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(25, 30, 34)');
  assert.equal(await page.locator('#first').evaluate(el => el.style.outlineColor), 'rgb(180, 201, 130)');
  await page.screenshot({ path: `${root}/test-results/settings-night.png`, fullPage: true });
  await page.locator('.at-theme-toggle').click();
  await page.waitForFunction(() => document.getElementById('first').style.outlineColor === 'rgb(18, 52, 86)');
  await page.getByRole('tab', { name: '翻译', exact: true }).click();
  await page.locator('input[name=google]').check();
  await page.waitForFunction(() => document.querySelector('#first .at-translation')?.textContent.includes('訳文 & 100%'));
  assert.equal(await page.evaluate(() => JSON.parse(window.testState.requests.find(request => request.url.includes('translate-pa.googleapis.com')).body)[0][0][0]), '「日本語。');
  assert.equal(await page.locator('#first .at-translation').evaluate(el => el.previousElementSibling.dataset.atSentence), '0');
  await page.locator('input[name=youdao]').check();
  await page.waitForFunction(() => document.querySelector('#first .at-translation')?.textContent.includes('有道译文'));
  const translationLines = await page.locator('#first .at-translation').evaluate(el => {
    const rows = [...el.querySelectorAll('.at-translation-row')];
    return { display: getComputedStyle(el).display, rows: rows.map(row => getComputedStyle(row).display), wraps: rows[1].getBoundingClientRect().top >= rows[0].getBoundingClientRect().bottom };
  });
  assert.deepEqual(translationLines, { display: 'block', rows: ['block', 'block'], wraps: true });
  // A pending Google response must not prevent Youdao from starting or rendering.
  const requestStart = await page.evaluate(() => {
    window.testState.holdGoogle = true;
    const paragraph = document.createElement('p'); paragraph.id = 'parallel'; paragraph.textContent = '翻訳の並列テスト用です。'; document.body.append(paragraph);
    return window.testState.requests.length;
  });
  await page.locator('.at-close').click();
  await page.locator('#parallel').click();
  await page.waitForFunction(() => document.querySelector('#parallel [data-provider=youdao]')?.textContent.includes('有道译文') && typeof window.testState.releaseGoogle === 'function');
  assert.deepEqual(await page.locator('#parallel .at-translation-row').evaluateAll(rows => rows.map(row => row.dataset.provider)), ['youdao', 'google']);
  assert.match(await page.locator('#parallel [data-provider=google]').textContent(), /翻译中/);
  assert.deepEqual(await page.evaluate(start => window.testState.requests.slice(start).map(request => new URL(request.url).hostname), requestStart), ['m.youdao.com', 'translate-pa.googleapis.com']);
  await page.evaluate(() => { window.testState.holdGoogle = false; window.testState.releaseGoogle(); });
  await page.waitForFunction(() => document.querySelector('#parallel [data-provider=google]')?.textContent.includes('訳文 & 100%'));
  await page.evaluate(() => document.getElementById('parallel').remove());
  await page.locator('#first ruby').click({ button: 'right' });
  await page.evaluate(() => window.testState.menus[0]());
  await page.locator('input[name=youdao]').uncheck();
  await page.locator('.at-close').click();
  await page.keyboard.press('Digit4');
  assert.equal(await copied(), '短い文章！」');
  await page.keyboard.press('Numpad4');
  assert.equal(await copied(), '二番目の文章です。');
  await page.keyboard.press('Digit5');
  assert.equal(await copied(), '短い文章！」');
  await page.keyboard.press('Digit1');
  assert.equal(await copied(), '二番目の文章です。');
  assert.equal(await page.locator('.at-sentence-selected').count(), 0);
  await page.keyboard.press('Digit2');
  assert.equal(await copied(), '日本語。短い文章！');

  await page.evaluate(() => window.testState.menus[0]());
  await page.getByRole('tab', { name: '快捷键', exact: true }).click();
  const nextKey = page.locator('input[name=shortcutNextSentence]');
  await nextKey.fill('Digit1');
  assert.match(await page.locator('.at-save-status').textContent(), /已用于/);
  assert.notEqual(await page.evaluate(() => window.testState.values.shortcutNextSentence), 'Digit1');
  await nextKey.locator('..').getByRole('button', { name: '录制', exact: true }).click();
  await page.keyboard.press('Control+ArrowRight');
  await page.waitForFunction(() => window.testState.values.shortcutNextSentence === 'Ctrl+ArrowRight');
  assert.equal(await nextKey.inputValue(), 'Ctrl+ArrowRight');
  await page.locator('.at-close').click();
  await page.evaluate(() => window.testState.menus[0]());
  assert.equal(await page.getByRole('tab', { name: '快捷键', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('input[name=shortcutNextSentence]').isVisible(), true);
  await page.locator('.at-close').click();
  await page.keyboard.press('Control+ArrowRight');
  assert.equal(await copied(), '「日本語。');
  await page.keyboard.press('Control+ArrowRight');
  assert.equal(await copied(), '短い文章！」');

  await page.evaluate(() => { GM_setValue('google', false); GM_setValue('pluginSwitch', false); });
  assert.equal(await page.locator('.at-sentence').count(), 0);
  assert.equal(await page.locator('.at-selected').count(), 0);
  const before = await page.evaluate(() => window.testState.copies.length);
  await page.locator('#first').click(); assert.equal(await page.evaluate(() => window.testState.copies.length), before);
  await page.evaluate(() => GM_setValue('pluginSwitch', true));
  await page.locator('#live').click();
  assert.equal(await page.evaluate(() => window.testState.liveClicks), 1);
  await page.locator('#complex').click();
  assert.equal(await page.evaluate(() => document.getElementById('preserved') === window.originalInline), true);
  await page.keyboard.press('Control+ArrowRight'); assert.equal(await copied(), '一番。');
  await page.keyboard.press('Control+ArrowRight'); assert.equal(await copied(), '二番です！');
  await page.keyboard.press('Control+ArrowRight'); assert.equal(await copied(), '三番？');
  await page.locator('#first ruby').click({ button: 'right' });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.testState.copies.at(-1) === '短い文章！」');
  await page.keyboard.press('Escape');
  const stoppedCount = await page.evaluate(() => window.testState.copies.length);
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(await page.evaluate(() => window.testState.copies.length), stoppedCount);

  // Decode / play real MP3 from the optional local probe, otherwise a silent WAV.
  let fixture, mime;
  try { fixture = await readFile(`${root}/test-results/vits-test.mp3`); mime = 'audio/mp3'; }
  catch {
    fixture = Buffer.alloc(44 + 16000); fixture.write('RIFF'); fixture.writeUInt32LE(fixture.length - 8, 4); fixture.write('WAVEfmt ', 8); fixture.writeUInt32LE(16, 16); fixture.writeUInt16LE(1, 20); fixture.writeUInt16LE(1, 22); fixture.writeUInt32LE(8000, 24); fixture.writeUInt32LE(16000, 28); fixture.writeUInt16LE(2, 32); fixture.writeUInt16LE(16, 34); fixture.write('data', 36); fixture.writeUInt32LE(16000, 40); mime = 'audio/wav';
  }
  let huoshFixture;
  try { huoshFixture = await readFile(`${root}/test-results/huoshan-test.mp3`); } catch { huoshFixture = fixture; }
  await page.evaluate(({ audio, mime, huoshAudio }) => {
    window.audioFixture = audio; window.audioMime = mime; window.huoshAudioFixture = huoshAudio; window.audioInstances = [];
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(url) { super(url); this.muted = true; window.audioInstances.push(this); }
    };
    GM_setValue('useVITS', true);
  }, { audio: fixture.toString('base64'), mime, huoshAudio: huoshFixture.toString('base64') });
  await page.locator('#first ruby').click({ button: 'right' });
  await page.waitForFunction(() => window.audioInstances.some(audio => !audio.paused && audio.duration > 0));
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.audioInstances.every(audio => audio.paused)), true);
  const audioCount = await page.evaluate(() => window.audioInstances.length);
  await page.locator('#complex').click();
  await page.waitForFunction(count => window.audioInstances.length === count + 1, audioCount);
  const vitsText = () => page.evaluate(() => new URL(window.testState.requests.filter(request => request.responseType === 'arraybuffer').at(-1).url).searchParams.get('text'));
  assert.equal(await vitsText(), '一番。');
  await page.evaluate(() => window.audioInstances.at(-1).onended());
  await page.waitForFunction(count => window.audioInstances.length === count + 2, audioCount);
  assert.equal(await vitsText(), '二番です！');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.audioInstances.at(-1).onended());
  assert.equal(await page.evaluate(() => window.audioInstances.length), audioCount + 2);
  await page.evaluate(() => GM_setValue('useVITS', false));
  await page.evaluate(() => window.testState.menus[0]());
  await page.getByRole('tab', { name: '语音', exact: true }).click();
  await page.locator('select[name=vitsVoice]:not(:disabled)').waitFor({ state: 'visible' });
  assert.equal(await page.locator('select[name=vitsVoice] option').count(), 1);
  await page.evaluate(() => { window.testState.voiceFailure = true; });
  await page.getByRole('button', { name: '刷新声音列表', exact: true }).click();
  await page.locator('select[name=vitsVoice]:disabled').filter({ hasText: '获取失败' }).waitFor({ state: 'visible' });
  await page.evaluate(() => { window.testState.voiceFailure = false; });
  await page.getByRole('button', { name: '刷新声音列表', exact: true }).click();
  await page.locator('select[name=vitsVoice]:not(:disabled)').waitFor({ state: 'visible' });
  assert.equal(await page.locator('select[name=vitsVoice] option').count(), 1);
  await page.locator('input[name=useWindowsTTS]').check();
  await page.locator('input[name=useVITS]').check();
  await page.waitForFunction(() => window.testState.values.useVITS === true && window.testState.values.useWindowsTTS === false);
  await page.locator('input[name=useHuoshTTS]').check();
  await page.waitForFunction(() => window.testState.values.useHuoshTTS === true && window.testState.values.useVITS === false);
  assert.equal(await page.locator('input[name=useWindowsTTS]').isChecked(), false);
  assert.equal(await page.locator('input[name=huoshRate]').getAttribute('type'), 'range');
  await page.locator('input[name=huoshRate]').evaluate(input => { input.value = '1.5'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => window.testState.values.huoshRate === 1.5);
  assert.equal(await page.locator('input[name=huoshRate]').locator('..').locator('output').textContent(), '1.5');
  await page.locator('.at-close').click();
  const huoshAudioCount = await page.evaluate(() => window.audioInstances.length);
  await page.locator('#first ruby').click({ button: 'right' });
  await page.waitForFunction(count => window.audioInstances.length > count && !window.audioInstances.at(-1).paused && window.audioInstances.at(-1).duration > 0, huoshAudioCount);
  const huoshPayload = await page.evaluate(() => JSON.parse(window.testState.requests.filter(request => request.url.includes('translate.volcengine.com')).at(-1).body));
  assert.equal(huoshPayload.speaker, 'jp_female_mai');
  assert.equal(huoshPayload.text, '「日本語。');
  assert.deepEqual(await page.evaluate(() => ({ rate: window.audioInstances.at(-1).playbackRate, pitch: window.audioInstances.at(-1).preservesPitch })), { rate: 1.5, pitch: true });
  await page.evaluate(() => GM_setValue('huoshRate', 0.8));
  await page.waitForFunction(() => window.audioInstances.at(-1).playbackRate === 0.8);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.audioInstances.at(-1).paused), true);
  await page.evaluate(() => GM_setValue('useHuoshTTS', false));
  // Control utterance completion to verify sequencing and cancellation without
  // relying on the machine's installed voices or elapsed playback time.
  await page.evaluate(() => {
    window.utterances = [];
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel() {}, getVoices() { return []; }, addEventListener() {}, removeEventListener() {},
      speak(utterance) { window.utterances.push(utterance); }
    } });
    GM_setValue('useWindowsTTS', true);
  });
  await page.locator('#first').click();
  await page.waitForFunction(() => window.utterances.length === 1);
  assert.equal(await page.evaluate(() => window.utterances[0].text), '「日本語。');
  assert.equal(await copied(), '日本語。短い文章！');
  assert.equal(await page.locator('#first .at-sentence-speaking').first().textContent(), '「');
  await page.evaluate(() => window.utterances[0].onend());
  await page.waitForFunction(() => window.utterances.length === 2);
  assert.equal(await page.evaluate(() => window.utterances[1].text), '短い文章！」');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.at-sentence-speaking').count(), 0);
  await page.evaluate(() => window.utterances[1].onend());
  assert.equal(await page.evaluate(() => window.utterances.length), 2);
  await page.evaluate(() => GM_setValue('splitSpeech', false));
  await page.locator('#first').click();
  await page.waitForFunction(() => window.utterances.length === 3);
  assert.equal(await page.evaluate(() => window.utterances[2].text), '日本語。短い文章！');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { GM_setValue('splitSpeech', true); GM_setValue('useWindowsTTS', false); });

  // Vertical Japanese layout with inline sentence translation.
  await page.evaluate(() => { document.getElementById('first').style.writingMode = 'vertical-rl'; document.getElementById('first').style.height = '240px'; GM_setValue('google', true); });
  await page.locator('#first ruby').click({ button: 'right' });
  await page.waitForFunction(() => document.querySelector('#first .at-sentence-translation')?.textContent.includes('訳文'));
  assert.equal(await copied(), '「日本語。');
  await page.screenshot({ path: `${root}/test-results/sentence-selection.png`, fullPage: true });
  await page.evaluate(() => window.testState.menus[0]());
  assert.equal(await page.locator('.at-settings').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await page.screenshot({ path: `${root}/test-results/settings.png`, fullPage: true });

  const popup = await browser.newPage({ viewport: { width: 380, height: 720 } }); popup.on('pageerror', error => errors.push(error.message));
  await popup.setContent('<!doctype html><html lang="zh-CN"><body></body></html>');
  await popup.addStyleTag({ path: `${root}/dist/chrome/settings.css` });
  await popup.evaluate(() => {
    let handler; const watchers = [], local = { pluginSwitch: true, rate: 1.6, pitch: 0, vitsVoice: 42 }, granted = new Set(), permissionWatchers = [];
    window.chromeTest = { local, writes: [], permissionRequests: [], granted, allowPermission: false, fetches: [] };
    window.fetch = async url => { window.chromeTest.fetches.push(url); return { ok: true, json: async () => ({ VITS: [] }), text: async () => '<ul id="translateResult"><li>已授权译文</li></ul>' }; };
    window.chrome = {
      permissions: {
        contains: async ({ origins }) => origins.every(origin => granted.has(origin)),
        request: ({ origins }) => {
          window.chromeTest.permissionRequests.push({ origins, active: navigator.userActivation.isActive });
          if (!window.chromeTest.allowPermission) return Promise.resolve(false);
          for (const origin of origins) granted.add(origin);
          permissionWatchers.forEach(watch => watch({ origins }));
          return Promise.resolve(true);
        },
        onAdded: { addListener: callback => permissionWatchers.push(callback), removeListener() {} },
        onRemoved: { addListener() {}, removeListener() {} }
      },
      storage: {
        local: {
          get: async () => ({ ...local }), set: async patch => {
            window.chromeTest.writes.push(patch);
            const changes = Object.fromEntries(Object.entries(patch).map(([key, newValue]) => [key, { oldValue: local[key], newValue }]));
            Object.assign(local, patch); for (const watch of watchers) watch(changes, 'local');
          }
        }, onChanged: { addListener: callback => watchers.push(callback) }
      }, runtime: { onMessage: { addListener: callback => { handler = callback; } }, sendMessage: message => new Promise(resolve => handler(message, {}, resolve)) }
    };
  });
  await popup.addScriptTag({ path: `${root}/dist/chrome/background.js` }); await popup.addScriptTag({ path: `${root}/dist/chrome/popup.js` });
  await popup.waitForSelector('input[name=pluginSwitch]');
  assert.equal(await popup.locator('input[name=pluginSwitch]').isChecked(), true);
  assert.equal(await popup.locator('input[name=rate]').inputValue(), '1.6');
  assert.equal(await popup.locator('input[name=pitch]').inputValue(), '0');
  await popup.getByRole('tab', { name: '翻译', exact: true }).click();
  const denied = await popup.evaluate(() => chrome.runtime.sendMessage({ action: 'translate', translator: 'youdao', text: '日本語', from: 'auto', to: 'zh-CHS' }));
  assert.match(denied.error, /Chrome 未授权.*授权 有道 接口/);
  assert.equal(await popup.evaluate(() => window.chromeTest.fetches.length), 0);
  const googleGrant = popup.locator('[data-at-service=google] button');
  await googleGrant.click();
  await popup.waitForFunction(() => window.chromeTest.permissionRequests.length === 1);
  assert.equal(await googleGrant.isDisabled(), false);
  assert.match(await popup.locator('.at-save-status').textContent(), /未授权/);
  await popup.evaluate(() => { window.chromeTest.allowPermission = true; });
  await googleGrant.click();
  await popup.waitForFunction(() => window.chromeTest.granted.has('https://translate-pa.googleapis.com/*'));
  assert.equal(await googleGrant.isDisabled(), true);
  assert.deepEqual(await popup.evaluate(() => window.chromeTest.permissionRequests.at(-1)), {
    origins: ['https://translate-pa.googleapis.com/*'], active: true
  });
  assert.equal(await popup.evaluate(() => window.chromeTest.granted.has('<all_urls>')), false);
  assert.equal(await popup.locator('[data-at-service=youdao] button').isDisabled(), false);
  await popup.screenshot({ path: `${root}/test-results/chrome-service-permissions.png`, fullPage: true });
  await popup.locator('[data-at-service=youdao] button').click();
  await popup.waitForFunction(() => window.chromeTest.granted.has('https://m.youdao.com/*'));
  const permitted = await popup.evaluate(() => chrome.runtime.sendMessage({ action: 'translate', translator: 'youdao', text: '日本語', from: 'auto', to: 'zh-CHS' }));
  assert.equal(permitted.translatedText, '已授权译文');
  assert.equal(await popup.evaluate(() => window.chromeTest.fetches.length), 1);
  assert.equal(await popup.locator('.at-version').textContent(), `Ver ${JSON.parse(await readFile(`${root}/package.json`)).version}`);
  assert.equal(await popup.locator('.at-header-art').evaluate(async img => { await img.decode(); return img.naturalWidth; }), 700);
  const onImage = await popup.locator('.at-header-art').getAttribute('src');
  assert.equal(await popup.locator('.at-header-art').getAttribute('data-state'), 'on');
  await popup.getByRole('tab', { name: '帮助', exact: true }).click();
  assert.deepEqual(await popup.getByRole('tab').allTextContents(), ['复制', '语音', '翻译', '外观', '快捷键', '帮助']);
  assert.equal(await popup.getByRole('tabpanel').count(), 1);
  assert.match(await popup.getByRole('tabpanel').textContent(), /左键选择整段.*右键选择句子/);
  const tabTops = await popup.getByRole('tab').evaluateAll(tabs => tabs.map(tab => tab.getBoundingClientRect().top));
  assert.equal(new Set(tabTops).size, 1);
  for (const selector of ['.at-theme-toggle', '.at-reset']) {
    assert.deepEqual(await popup.locator(selector).evaluate(button => ({ background: getComputedStyle(button).backgroundColor, border: getComputedStyle(button).borderTopWidth })), { background: 'rgba(0, 0, 0, 0)', border: '0px' });
  }
  await popup.getByRole('tab', { name: '帮助', exact: true }).press('Home');
  assert.equal(await popup.getByRole('tab', { name: '复制', exact: true }).getAttribute('aria-selected'), 'true');
  await popup.getByRole('tab', { name: '复制', exact: true }).press('ArrowLeft');
  assert.equal(await popup.getByRole('tab', { name: '帮助', exact: true }).getAttribute('aria-selected'), 'true');
  await popup.locator('.at-settings').screenshot({ path: `${root}/test-results/settings-header-on.png` });
  await popup.getByRole('tab', { name: '语音', exact: true }).click();
  const vitsAddress = popup.getByLabel('VITS 服务地址', { exact: true });
  assert.equal(await vitsAddress.getAttribute('type'), 'text');
  assert.equal(await vitsAddress.inputValue(), 'http://127.0.0.1:23456');
  await vitsAddress.fill('http://localhost:23456/');
  await popup.waitForFunction(() => window.chromeTest.local.vitsAPI === 'http://localhost:23456');
  const vitsGrant = popup.locator('[data-at-service=vits] button');
  await popup.waitForFunction(() => document.querySelector('[data-at-service=vits] button').title === 'localhost');
  await vitsGrant.click();
  assert.deepEqual(await popup.evaluate(() => window.chromeTest.permissionRequests.at(-1)), { origins: ['http://localhost/*'], active: true });
  await popup.locator('[data-at-service=huosh] button').click();
  await popup.waitForFunction(() => window.chromeTest.granted.has('https://translate.volcengine.com/*'));
  assert.deepEqual(await popup.evaluate(() => window.chromeTest.permissionRequests.at(-1)), { origins: ['https://translate.volcengine.com/*'], active: true });
  await popup.locator('.at-settings').screenshot({ path: `${root}/test-results/settings-vits-address.png` });
  await popup.getByRole('tab', { name: '外观', exact: true }).click();
  assert.equal(await popup.locator('.at-color-pair').count(), 5);
  assert.equal(await popup.locator('.at-color-pair').first().locator('input[type=color]').count(), 2);
  await popup.locator('.at-theme-toggle').click();
  await popup.waitForFunction(() => window.chromeTest.local.nightMode === true);
  assert.equal(await popup.locator('.at-theme-toggle').textContent(), '☾');
  await popup.screenshot({ path: `${root}/test-results/settings-colors-night.png`, fullPage: true });
  await popup.locator('.at-theme-toggle').click();
  await popup.waitForFunction(() => window.chromeTest.local.nightMode === false);
  await popup.getByRole('tab', { name: '外观', exact: true }).click();
  popup.once('dialog', dialog => dialog.dismiss());
  await popup.locator('.at-reset').click();
  assert.equal(await popup.locator('input[name=pluginSwitch]').isChecked(), true);
  assert.equal(await popup.locator('input[name=rate]').inputValue(), '1.6');
  popup.once('dialog', dialog => { assert.match(dialog.message(), /重置所有设置/); return dialog.accept(); });
  await popup.locator('.at-reset').click();
  await popup.waitForFunction(() => window.chromeTest.local.pluginSwitch === false && window.chromeTest.local.rate === 1);
  assert.equal(await popup.locator('input[name=rate]').inputValue(), '1');
  assert.equal(await popup.locator('select[name=vitsVoice]').inputValue(), '0');
  assert.equal(await popup.locator('.at-header-art').getAttribute('data-state'), 'off');
  assert.notEqual(await popup.locator('.at-header-art').getAttribute('src'), onImage);
  await popup.locator('.at-header-art').evaluate(img => img.decode());
  await popup.screenshot({ path: `${root}/test-results/settings-header-off.png`, fullPage: true });
  // Click the printed ON/OFF area, then verify the invisible control also
  // remains operable by keyboard without covering the theme/reset buttons.
  const box = await popup.locator('.at-header-art').boundingBox();
  await popup.mouse.click(box.x + box.width * .88, box.y + box.height * .73);
  await popup.waitForFunction(() => window.chromeTest.local.pluginSwitch === true);
  assert.equal(await popup.locator('.at-header-art').getAttribute('src'), onImage);
  await popup.locator('input[name=pluginSwitch]').focus();
  await popup.keyboard.press('Space');
  await popup.waitForFunction(() => window.chromeTest.local.pluginSwitch === false);
  assert.equal(await popup.evaluate(() => Object.keys(window.chromeTest.writes.at(-1)).join()), 'pluginSwitch');
  assert.equal(await popup.locator('.at-settings').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await popup.screenshot({ path: `${root}/test-results/chrome-popup.png`, fullPage: true });
  await popup.getByRole('tab', { name: '快捷键', exact: true }).click();
  await popup.waitForFunction(() => window.chromeTest.local.settingsTab === '快捷键');
  await popup.evaluate(() => document.body.replaceChildren());
  await popup.addScriptTag({ path: `${root}/dist/chrome/popup.js` });
  await popup.locator('input[name=shortcutNextSentence]').waitFor({ state: 'visible' });
  assert.equal(await popup.getByRole('tab', { name: '快捷键', exact: true }).getAttribute('aria-selected'), 'true');
  await popup.close();
  assert.deepEqual(errors, []);
  await testPagination(browser, root);
  console.log('Browser regressions passed: restricted API permissions, targeted grant/refusal with active gesture, worker translation retry, ON/OFF images, reset, paired colors, multiline translation, copy notice, speech/stop, pagination, local settings.');
} finally { await browser.close(); }
