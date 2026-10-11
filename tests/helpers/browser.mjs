import { readFile, mkdir } from 'node:fs/promises';
import { root, extensionPath, userscriptPath, version, release } from '../../scripts/paths.mjs';

export const results = `${root}/test-results`;
await mkdir(results, { recursive: true });

// Only platform boundaries are mocked. The built settings, reader and service code run unchanged.
export async function installPlatform(doc, platform, values = {}) {
  await doc.evaluate(({ platform, values, version, release }) => {
    const watchers = [], gmWatchers = new Map(), grants = new Set(['https://api.github.com/*']);
    const state = window.testState = { values: { pluginSwitch: true, scrollSwitch: false, ...values }, copies: [], requests: [], menus: [], writes: [], delays: {}, grants: [] };
    const write = patch => {
      const changes = {};
      for (const [key, value] of Object.entries(patch)) {
        changes[key] = { oldValue: state.values[key], newValue: value };
        state.values[key] = value;
        gmWatchers.get(key)?.(key, changes[key].oldValue, value, false);
      }
      state.writes.push(patch); watchers.forEach(fn => fn(changes, 'local'));
    };
    state.patch = write;
    state.updateChecks = 0;
    state.revokeUpdates = () => grants.delete('https://api.github.com/*');
    const request = (url, body) => {
      const provider = url.includes('m.youdao.com') ? 'youdao' : 'google';
      const text = provider === 'youdao' ? new URLSearchParams(body).get('inputtext') : JSON.parse(body)[0][0][0];
      const call = { provider, text, aborted: false }; state.requests.push(call);
      return call;
    };
    window.GM_getValue = (key, fallback) => state.values[key] ?? fallback;
    window.GM_setValue = (key, value) => write({ [key]: value });
    window.GM_addValueChangeListener = (key, fn) => gmWatchers.set(key, fn);
    window.GM_setClipboard = text => state.copies.push(text);
    window.GM_registerMenuCommand = (_name, fn) => state.menus.push(fn);
    window.GM_addStyle = css => { const style = document.createElement('style'); style.textContent = css; document.head.append(style); };
    window.GM_xmlhttpRequest = options => {
      if (options.url.includes('api.github.com')) {
        state.updateChecks++;
        const timer = setTimeout(() => options.onload({ status: state.releaseStatus || 200, responseText: JSON.stringify({ tag_name: state.releaseTag || `v${version}`, draft: false, prerelease: false }) }), 5);
        return { abort() { clearTimeout(timer); } };
      }
      if (options.url.includes('/voice/speakers')) {
        const timer = setTimeout(() => state.voiceFailure ? options.onerror() : options.onload({ status: 200, responseText: JSON.stringify({ VITS: [{ id: 42, name: '测试声音', lang: ['ja'] }] }) }), 5);
        return { abort() { clearTimeout(timer); } };
      }
      const call = request(options.url, options.data);
      const timer = setTimeout(() => options.onload({ status: 200, responseText: call.provider === 'youdao'
        ? `<ul id="translateResult"><li>有道：${call.text}</li></ul>` : JSON.stringify([[`Google：${call.text}`]]) }), state.delays[call.provider] || 5);
      return { abort() { call.aborted = true; clearTimeout(timer); } };
    };
    // Force the HTTP/frame-compatible clipboard fallback even on HTTPS fixtures.
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard blocked in frame'); } } });
    document.execCommand = command => { if (command !== 'copy') return false; state.copies.push(document.activeElement.value); return true; };
    window.chrome = {
      permissions: {
        contains: async ({ origins }) => origins.every(origin => grants.has(origin)),
        request: async ({ origins }) => { origins.forEach(origin => grants.add(origin)); state.grants.push(...origins); return true; },
        onAdded: { addListener() {}, removeListener() {} }, onRemoved: { addListener() {}, removeListener() {} }
      },
      storage: { local: { set: async patch => write(patch) }, onChanged: { addListener: fn => watchers.push(fn) } },
      runtime: { sendMessage: async message => {
        if (message.type === 'getSettings') return state.values;
        if (message.action === 'cancel_translation') return {};
        if (message.action === 'check_update') {
          state.updateChecks++;
          if (state.releaseStatus === 503) return { error: '测试网络失败' };
          return state.updateResult || { state: 'current', version, url: release.page };
        }
        if (message.action === 'vits_speakers') {
          if (state.voiceFailure) return { error: '测试连接失败' };
          return { voices: [{ id: 42, name: '测试声音', lang: ['ja'] }] };
        }
        const call = { provider: message.translator, text: message.text }; state.requests.push(call);
        await new Promise(resolve => setTimeout(resolve, state.delays[call.provider] || 5));
        return { translatedText: state.result?.[call.provider] ?? `${call.provider === 'youdao' ? '有道' : 'Google'}：${message.text}` };
      } }
    };
    state.spoken = [];
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ name: '测试声音', lang: 'ja-JP' }], addEventListener() {}, removeEventListener() {},
      speak: utterance => { state.spoken.push(utterance.text); state.utterance = utterance; }, cancel: () => { state.utterance = null; }
    } });
  }, { platform, values, version, release });
}

export async function startReader(doc, platform, values) {
  await installPlatform(doc, platform, values);
  if (platform === 'extension') await doc.addStyleTag({ path: `${root}/${extensionPath}/reader.css` });
  await doc.addScriptTag({ path: platform === 'extension' ? `${root}/${extensionPath}/content.js` : `${root}/${userscriptPath}` });
  await doc.waitForFunction(() => !!document.querySelector('.at-notification'));
}

export async function fixture(browser, name, platform = 'tampermonkey', values) {
  const page = await browser.newPage({ viewport: { width: 760, height: 740 } });
  page.setDefaultTimeout(4000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const html = await readFile(new URL(`../fixtures/${name}.html`, import.meta.url), 'utf8');
  const url = name === 'ttsu' ? 'https://reader.ttsu.app/b?id=fixture' : `http://reader.test/${name}`;
  await page.route('**/*', route => route.request().url() === url ? route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }) : route.abort());
  await page.goto(url);
  let doc = page;
  if (['bibi', 'calibre-web'].includes(name)) {
    await page.frameLocator('#chapter').locator('[data-first]').waitFor();
    doc = page.frames().find(frame => frame !== page.mainFrame());
  }
  await startReader(doc, platform, values);
  return { page, doc, errors };
}

export async function settings(browser, platform) {
  if (platform === 'tampermonkey') {
    const result = await fixture(browser, 'kakuyomu', platform);
    await result.doc.evaluate(() => window.testState.menus[0]());
    return result;
  }
  const page = await browser.newPage({ viewport: { width: 380, height: 900 } });
  page.setDefaultTimeout(4000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.abort());
  await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
  await installPlatform(page, platform);
  await page.addStyleTag({ path: `${root}/${extensionPath}/settings.css` });
  await page.addScriptTag({ path: `${root}/${extensionPath}/popup.js` });
  await page.locator('.at-settings').waitFor();
  return { page, doc: page, errors };
}

export const copied = doc => doc.evaluate(() => window.testState.copies.at(-1));
export const patch = (doc, values) => doc.evaluate(values => window.testState.patch(values), values);
export async function translated(doc) {
  await doc.waitForFunction(() => [...document.querySelectorAll('.at-translation-row')].length === 2 && [...document.querySelectorAll('.at-translation-row')].every(row => !row.textContent.includes('翻译中')));
}
