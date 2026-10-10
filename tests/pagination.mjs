// Reproduce TTsu's CSS columns and synchronous native page-position handler.
// Requests are fulfilled locally; this never opens a personal book/profile.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
export async function testPagination(browser, root) {
  const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
  await page.route('https://reader.ttsu.app/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; overflow: hidden; }
    .book-content { margin: 32px auto; width: 659px; height: 608px; overflow: hidden; writing-mode: vertical-rl;
      --book-content-child-height: 608px; --book-content-child-width: 659px; font: 20px/1.6 serif; }
    .book-content-container { width: 100%; height: auto; column-width: 608px; column-count: 1; column-gap: 40px; column-fill: auto; }
    p { margin: 0; }
    </style><div class="book-content book-content--writing-vertical-rl"><div class="book-content-container"><p>${'これは長い段落の中の文章です。'.repeat(250)}</p></div></div>` }));
  await page.goto('https://reader.ttsu.app/b?id=fixture');
  await page.addScriptTag({ content: `var App = {};\n${await readFile(`${root}/src/core/text.js`, 'utf8')}\n${await readFile(`${root}/src/core/scroll.js`, 'utf8')}` });
  const results = await page.evaluate(() => {
    const book = document.querySelector('.book-content'), p = book.querySelector('p');
    window.virtualPage = 0; window.pageEvents = [];
    window.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.code)) return;
      window.pageEvents.push(event.code);
      window.virtualPage += event.code === 'ArrowDown' ? 1 : -1;
      book.scrollTo({ top: window.virtualPage * 648 });
    });
    App.wrapSentences(p, { sentenceDelimiters: '。/！/？' });
    const groups = App.sentenceGroups(p), first = groups[0];
    const onSecondPage = groups.find(group => {
      const r = group.fragments[0].getClientRects()[0];
      return r.top >= 680 && r.bottom < 1280;
    });
    if (!onSecondPage) throw new Error('Fixture has no second-page sentence');
    App.scrollToReadingTarget(p, first, 'instant');
    const unchanged = book.scrollTop === 0 && window.pageEvents.length === 0;
    App.scrollToReadingTarget(p, onSecondPage, 'instant');
    const forward = book.scrollTop;
    App.scrollToReadingTarget(p, onSecondPage, 'instant');
    const samePageEvents = window.pageEvents.length;
    App.scrollToReadingTarget(p, first, 'instant');
    return { unchanged, forward, samePageEvents, back: book.scrollTop, events: window.pageEvents, virtualPage: window.virtualPage };
  });
  assert.deepEqual(results, { unchanged: true, forward: 648, samePageEvents: 1, back: 0, events: ['ArrowDown', 'ArrowUp'], virtualPage: 0 });
  const defaults = JSON.parse(await readFile(`${root}/src/config/defaultSettings.json`, 'utf8'));
  await page.evaluate(values => { App.defaults = values; }, defaults);
  for (const file of ['shortcuts', 'settings', 'audio', 'reader']) await page.addScriptTag({ path: `${root}/src/core/${file}.js` });
  const shortcut = await page.evaluate(() => {
    const s = App.normalizeSettings({ pluginSwitch: true, copy: false, scrollIntoView: 'instant', shortcutNextParagraph: 'Digit1', shortcutNextSentence: 'ArrowDown' });
    App.createReader({ copy: async () => {}, send: async () => {} }, { values: s, subscribe() {} });
    const sentence = document.querySelector('.at-sentence');
    sentence.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    const before = window.pageEvents.length;
    sentence.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true, cancelable: true }));
    return { extraPages: window.pageEvents.length - before, index: document.querySelector('.at-sentence-selected').dataset.atSentence };
  });
  assert.deepEqual(shortcut, { extraPages: 0, index: '1' });
  await page.close();
}
