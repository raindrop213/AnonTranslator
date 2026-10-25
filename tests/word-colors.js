import { mountReaderSession } from '../src/reader/reader.js';
import { createSettingsStore } from '../src/settings/settings.js';
import readerCSS from '../src/reader/reader.css';

const button = document.querySelector('#run'), status = document.querySelector('#status');
const results = document.querySelector('#results'), frame = document.querySelector('#chapter');
const source = '猫が走る。';
const tokens = [
  { surface: '猫', start: 0, end: 1, pos: '名詞', reading: 'ネコ', base: '猫' },
  { surface: 'が', start: 1, end: 2, pos: '助詞', reading: 'ガ', base: 'が' },
  { surface: '走る', start: 2, end: 4, pos: '動詞', reading: 'ハシル', base: '走る' },
  { surface: '。', start: 4, end: 5, pos: '記号', reading: '*', base: '。' }
];
const chapter = `<!doctype html><html lang="ja"><meta charset="utf-8">
<style>body{margin:24px;font:30px/2 serif}#book-content{padding:10px}p{margin:0}</style>
<style id="reader-night-rule" media="not all">#book-content :not(img):not(svg):not(path){color:inherit!important;background-color:transparent!important}</style>
<body><div id="book-content"><p>${source}</p></div></body></html>`;
let session, store, running = false, report = [];
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
async function waitFor(predicate) {
  const end = performance.now() + 4000;
  while (!predicate()) {
    if (performance.now() > end) throw new Error('等待真实阅读会话或分词结果超时');
    await nextFrame();
  }
}
function memoryPlatform() {
  const saved = {
    copy: false, scrollSwitch: false, dictionaryEnabled: true, dictionaryFurigana: false,
    posGlass: false, posNounColor: '#2868c4', posVerbColor: '#d46a28', posOpacity: 100,
    nightPosNounColor: '#976bd4', nightPosVerbColor: '#d4a628', nightPosOpacity: 100
  }, listeners = new Set();
  const emit = patch => { for (const listener of listeners) listener(patch); };
  return {
    async getSettings() { return { ...saved }; },
    async setSettings(patch) { Object.assign(saved, patch); emit(patch); },
    async removeSettings(keys) { for (const key of keys) delete saved[key]; emit(Object.fromEntries(keys.map(key => [key, undefined]))); },
    watchSettings(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async send(message) {
      if (message.action === 'tokenize') {
        if (message.text !== source) throw new Error('测试正文与固定分词不一致');
        return { tokens: tokens.map(token => ({ ...token })) };
      }
      if (message.action === 'cancel_translation') return {};
      throw new Error('检测不应请求在线服务：' + message.action);
    }
  };
}
function pixel(cssColor) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = cssColor; context.fillRect(0, 0, 1, 1);
  return [...context.getImageData(0, 0, 1, 1).data];
}
function expectColor(element, color, opacity = 100) {
  const actualCSS = frame.contentWindow.getComputedStyle(element).backgroundColor;
  const actual = pixel(actualCSS);
  const expected = opacity === 0 ? [0, 0, 0, 0] : [
    ...[1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16)),
    Math.round(opacity * 255 / 100)
  ];
  if (actual.some((channel, index) => Math.abs(channel - expected[index]) > 1)) {
    throw new Error(`背景颜色：期望 ${color} / ${opacity}%，实际 ${actualCSS} [${actual.join(', ')}]`);
  }
}
function expect(condition, message) { if (!condition) throw new Error(message); }
async function change(key, value) {
  if (key === 'nightMode') {
    frame.contentDocument.querySelector('#reader-night-rule').media = value ? 'all' : 'not all';
    frame.contentDocument.body.style.background = value ? '#252720' : '#fff';
    frame.contentDocument.body.style.color = value ? '#d8d5cb' : '#29313b';
  }
  await store.set(key, value); await nextFrame();
}
async function check(name, action) {
  const row = document.createElement('li'); results.append(row);
  try {
    await action(); report.push({ name, passed: true }); row.className = 'pass'; row.textContent = '通过 · ' + name;
  } catch (error) {
    const message = error.message || String(error);
    report.push({ name, passed: false, message }); row.className = 'fail'; row.textContent = '失败 · ' + name;
    const detail = document.createElement('small'); detail.textContent = message; row.append(detail);
  }
}
async function run() {
  if (running) return;
  running = true; button.disabled = true; results.replaceChildren(); report = [];
  document.documentElement.dataset.auditStatus = 'running'; status.textContent = '检测中…';
  session?.destroy(); store?.destroy(); session = store = undefined;
  try {
    const loaded = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
    frame.srcdoc = chapter; await loaded;
    const platform = memoryPlatform(); store = createSettingsStore(platform, { siteURL: location.href });
    // Mark the outer harness as UI so an installed extension cannot take over
    // this isolated session. Only the test store owns the chapter's reader.
    await store.init(); session = mountReaderSession(platform, store, frame.contentDocument, readerCSS);
    await store.set('pluginSwitch', true);
    await waitFor(() => frame.contentDocument.documentElement.hasAttribute('data-at-reader'));
    const doc = frame.contentDocument, paragraph = doc.querySelector('p');
    const range = doc.createRange(); range.setStart(paragraph.firstChild, 0); range.setEnd(paragraph.firstChild, 1);
    const rect = range.getBoundingClientRect();
    paragraph.dispatchEvent(new frame.contentWindow.MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2
    }));
    await waitFor(() => paragraph.querySelectorAll('[data-at-word]').length === tokens.length);
    const noun = paragraph.querySelector('[data-at-pos="名詞"]');
    const verb = paragraph.querySelector('[data-at-pos="動詞"]');
    const punctuation = paragraph.querySelector('[data-at-pos="記号"]');
    const assertPunctuation = () => {
      expectColor(punctuation, '#000000', 0);
      expect(frame.contentWindow.getComputedStyle(punctuation).backgroundImage === 'none', '标点不应出现玻璃高光');
    };
    await check('日间按词性显示独立颜色', () => { expectColor(noun, '#2868c4'); expectColor(verb, '#d46a28'); assertPunctuation(); });
    await check('修改日间颜色立即更新已有分词', async () => {
      await change('posNounColor', '#125a96'); expectColor(noun, '#125a96');
      expect(paragraph.querySelector('[data-at-pos="名詞"]') === noun, '颜色修改不应替换分词节点');
    });
    for (const opacity of [0, 50, 100]) await check(`日间底色不透明度 ${opacity}%`, async () => {
      await change('posOpacity', opacity); expectColor(noun, '#125a96', opacity); assertPunctuation();
    });
    await check('日间统一底色应用到不同词性', async () => {
      await change('posUniformColorValue', '#289c64'); await change('posUniformColor', true);
      expectColor(noun, '#289c64'); expectColor(verb, '#289c64'); assertPunctuation();
    });
    await check('关闭统一底色恢复词性颜色', async () => {
      await change('posUniformColor', false); expectColor(noun, '#125a96'); expectColor(verb, '#d46a28');
    });
    await check('夜间颜色抵御阅读器强制透明背景', async () => {
      await change('nightMode', true); expectColor(noun, '#976bd4'); expectColor(verb, '#d4a628'); assertPunctuation();
    });
    await check('修改夜间颜色立即更新已有分词', async () => {
      await change('nightPosNounColor', '#bd5795'); expectColor(noun, '#bd5795');
    });
    for (const opacity of [0, 50, 100]) await check(`夜间底色不透明度 ${opacity}%`, async () => {
      await change('nightPosOpacity', opacity); expectColor(noun, '#bd5795', opacity); assertPunctuation();
    });
    await check('夜间统一底色应用到不同词性', async () => {
      await change('nightPosUniformColorValue', '#b79c46'); await change('posUniformColor', true);
      expectColor(noun, '#b79c46'); expectColor(verb, '#b79c46'); assertPunctuation();
    });
    await check('打开玻璃效果保留颜色与标点透明', async () => {
      await change('posGlass', true); expectColor(noun, '#b79c46'); assertPunctuation();
      expect(frame.contentWindow.getComputedStyle(noun).backgroundImage.includes('gradient'), '应显示玻璃高光');
    });
    await check('关闭玻璃效果保留底色', async () => {
      await change('posGlass', false); expectColor(noun, '#b79c46');
      expect(frame.contentWindow.getComputedStyle(noun).backgroundImage === 'none', '玻璃高光应移除');
    });
    await check('切回日间恢复保存的独立配色', async () => {
      await change('posUniformColor', false); await change('nightMode', false);
      expectColor(noun, '#125a96'); expectColor(verb, '#d46a28'); assertPunctuation();
    });
  } catch (error) {
    await check('初始化真实阅读会话', () => { throw error; });
  } finally {
    const failed = report.filter(item => !item.passed).length;
    document.documentElement.dataset.auditStatus = failed ? 'failed' : 'passed';
    status.textContent = failed ? `${failed} 项失败，${report.length - failed} 项通过` : `${report.length} 项全部通过`;
    status.className = failed ? 'fail' : 'pass'; button.disabled = false; running = false;
  }
  return report.map(item => ({ ...item }));
}
button.addEventListener('click', () => { void run(); });
window.wordColorAudit = { run, get results() { return report.map(item => ({ ...item })); } };
