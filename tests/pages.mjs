import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fixture, copied, patch, translated, results } from './helpers/browser.mjs';
import { root } from '../scripts/paths.mjs';

export const pageCases = [];
const original = '「空を見た。星が光った！」';
for (const platform of ['extension', 'tampermonkey']) {
  for (const name of ['ttsu', 'bibi', 'calibre-web', 'kakuyomu', 'syosetu']) {
    pageCases.push({
      name: `正文 / ${platform} / ${name}：提取、段句导航和译文插入`,
      open: browser => fixture(browser, name, platform, { google: true, youdao: true }),
      async run({ page, doc }) {
        const first = doc.locator('[data-first]'), second = doc.locator('[data-second]');
        const source = await first.textContent();
        await doc.evaluate(() => {
          window.liveNode = document.querySelector('[data-live]'); window.liveClicks = 0;
          window.liveNode.addEventListener('click', () => window.liveClicks++);
        });
        await first.locator('ruby').click(); await translated(doc);
        assert.equal(await copied(doc), original);
        assert.deepEqual(await first.locator('.at-translation-row').evaluateAll(rows => rows.map(row => row.dataset.provider)), ['youdao', 'google']);
        assert.equal(await first.locator('.at-translation').evaluate(el => getComputedStyle(el).display === 'block' && [...el.children].every(row => getComputedStyle(row).display === 'block')), true, '服务译文应各占一行');
        assert.equal(await first.locator('.at-translation').evaluate(el => el.parentElement.hasAttribute('data-first') && el === el.parentElement.lastElementChild), true);
        await first.locator('ruby').click(); await translated(doc);
        assert.equal(await copied(doc), original, '重复选择不得把译文或注音再次提取');
        assert.equal(await doc.locator('.at-translation').count(), 1);
        await first.locator('.at-sentence').first().click({ button: 'right' }); await translated(doc);
        assert.equal(await copied(doc), '「空を見た。');
        assert.equal(await first.locator('.at-translation').evaluate(el => el.previousElementSibling.dataset.atSentence), '0');
        assert.equal(await first.locator('.at-sentence-selected').first().evaluate(el => getComputedStyle(el).outlineStyle), 'none');
        await doc.locator('body').press('Digit4'); await translated(doc);
        assert.equal(await copied(doc), '星が光った！」');
        await doc.locator('body').press('Digit4');
        assert.equal(await copied(doc), '次の朝。', '句子导航应跨段');
        await doc.locator('body').press('Digit5');
        assert.equal(await copied(doc), '星が光った！」');
        await doc.locator('body').press('Digit1'); await translated(doc);
        assert.equal(await copied(doc), '次の朝。旅に出た。', '段落导航应恢复整段模式');
        assert.equal(await first.locator('.at-translation').count(), 0);
        await second.locator('[data-live]').click();
        assert.equal(await doc.evaluate(() => window.liveNode === document.querySelector('[data-live]') && window.liveClicks === 1), true, '包装句子应保留原节点和事件');
        await doc.locator('body').press('Digit2');
        assert.equal(await copied(doc), original);
        await patch(doc, { ignoreFurigana: false, ignoreSymbolPairs: true }); await first.locator('ruby').click();
        assert.equal(await copied(doc), '空(そら)を見た。星が光った！');
        if (await doc.locator('[data-break]').count()) {
          await doc.locator('[data-break]').click(); await translated(doc);
          assert.equal(await copied(doc), '最初の行。\n次の行。');
        }
        assert.equal(await doc.locator('textarea[data-at-ui]').count(), 0, '临时复制节点应清理');
        await page.screenshot({ path: `${results}/${name}-${platform}.png` });
        await patch(doc, { pluginSwitch: false });
        assert.equal(await doc.locator('.at-sentence,.at-translation,.at-selected').count(), 0);
        assert.equal(await first.textContent(), source, '关闭后应恢复原文');
      }
    });
  }
}

pageCases.push({
  name: '正文 / 复杂内联标记、插件界面排除与原样恢复',
  open: browser => fixture(browser, 'kakuyomu', 'extension', { google: true, youdao: true }),
  async run({ doc }) {
    await doc.evaluate(() => {
      const p = document.createElement('p'); p.id = 'complex';
      p.style.cssText = 'outline:1px dotted blue;border-radius:3px';
      p.innerHTML = '<span data-preserved>最初。<b>次の<ruby>空<rt>そら。</rt></ruby></b>です！最後？</span><span data-at-ui>界面。</span><script type="text/plain">除外。</script><style>/* 除外。 */</style>';
      document.body.append(p);
      window.savedNode = p.querySelector('[data-preserved]'); window.savedHtml = p.innerHTML; window.savedStyle = p.style.cssText;
    });
    await doc.locator('#complex [data-preserved]').click(); await translated(doc);
    assert.equal(await copied(doc), '最初。次の空です！最後？');
    await doc.locator('#complex .at-sentence').first().click({ button: 'right' });
    await doc.locator('body').press('Digit4'); await translated(doc);
    assert.equal(await copied(doc), '次の空です！', '内联节点之间应属于同一句，rt 标点不参与断句');
    assert.equal(await doc.evaluate(() => window.savedNode === document.querySelector('[data-preserved]')), true);
    assert.equal(await doc.locator('#complex [data-at-ui] .at-sentence').count(), 0);
    assert.equal(await doc.locator('.at-notification').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    await doc.waitForFunction(() => getComputedStyle(document.querySelector('.at-notification')).opacity === '0.5');
    await patch(doc, { pluginSwitch: false });
    assert.equal(await doc.evaluate(() => document.getElementById('complex').innerHTML === window.savedHtml && document.getElementById('complex').style.cssText === window.savedStyle), true);
  }
});
pageCases.push({
  name: '正文 / 自定义标签和输入区避让',
  open: browser => fixture(browser, 'kakuyomu'),
  async run({ page, doc }) {
    await patch(doc, { targetTags: 'li' });
    await doc.evaluate(() => {
      const list = document.createElement('ul'); list.innerHTML = '<li data-custom>最初の項目。次の文。</li><li>次の項目。</li>'; document.body.append(list);
    });
    await doc.locator('[data-custom]').click(); assert.equal(await copied(doc), '最初の項目。次の文。');
    await doc.locator('body').press('Digit1'); assert.equal(await copied(doc), '次の項目。');
    await patch(doc, { targetTags: 'p' }); await doc.locator('[data-first]').click();
    await page.locator('input').fill('編集中'); await page.locator('input').press('Digit4');
    assert.equal(await page.locator('input').inputValue(), '編集中4'); assert.equal(await copied(doc), original);
  }
});
pageCases.push({
  name: '正文 / 旧响应不覆盖新选择，译文按纯文本插入',
  open: browser => fixture(browser, 'kakuyomu', 'extension', { google: true, youdao: true }),
  async run({ doc }) {
    await doc.evaluate(() => { window.testState.delays.google = 300; window.testState.result = { google: '<img src=x onerror=alert(1)>' }; });
    await doc.locator('[data-first]').click(); await doc.locator('[data-second]').click(); await translated(doc);
    assert.equal(await doc.locator('.at-translation').count(), 1);
    assert.equal(await doc.locator('[data-first] .at-translation').count(), 0);
    assert.equal(await doc.locator('.at-translation [data-provider=google]').textContent(), '<img src=x onerror=alert(1)>');
    assert.equal(await doc.locator('.at-translation img').count(), 0);
  }
});
pageCases.push({
  name: '正文 / TTsu：可见句子不滚动，跨页按阅读器翻页',
  open: browser => fixture(browser, 'ttsu', 'extension'),
  async run({ doc }) {
    await doc.addScriptTag({ content: `var App = {};\n${await readFile(`${root}/src/core/scroll.js`, 'utf8')}` });
    await doc.locator('[data-long]').dispatchEvent('mouseover');
    const result = await doc.evaluate(() => {
      const p = document.querySelector('[data-long]'), book = document.querySelector('.book-content');
      book.scrollTop = 0; window.fixturePages.length = 0;
      const groups = [...p.querySelectorAll('.at-sentence')].map(fragment => ({ fragments: [fragment] }));
      const visible = groups.find(group => { const r = group.fragments[0].getClientRects()[0]; return r.top >= 32 && r.bottom < 640; });
      const next = groups.find(group => { const r = group.fragments[0].getClientRects()[0]; return r.top >= 680 && r.bottom < 1280; });
      if (!visible || !next) throw new Error('模拟页缺少可见句子或第二页句子');
      App.scrollToReadingTarget(p, visible, 'instant'); const stayed = window.fixturePages.length === 0;
      App.scrollToReadingTarget(p, next, 'instant'); const forward = book.scrollTop;
      App.scrollToReadingTarget(p, next, 'instant'); const count = window.fixturePages.length;
      App.scrollToReadingTarget(p, visible, 'instant');
      return { stayed, forward, count, back: book.scrollTop };
    });
    assert.deepEqual(result, { stayed: true, forward: 648, count: 1, back: 0 });
  }
});
pageCases.push({
  name: '正文 / 语音按句播放、标记当前句，停止后不继续',
  open: browser => fixture(browser, 'kakuyomu', 'extension', { useWindowsTTS: true, splitSpeech: true }),
  async run({ doc }) {
    await doc.locator('[data-first]').click(); await doc.waitForFunction(() => window.testState.spoken.length === 1);
    assert.equal(await doc.evaluate(() => window.testState.spoken[0]), '「空を見た。');
    assert.ok(await doc.locator('.at-sentence-speaking').count());
    await doc.evaluate(() => window.testState.utterance.onend()); await doc.waitForFunction(() => window.testState.spoken.length === 2);
    assert.equal(await doc.evaluate(() => window.testState.spoken[1]), '星が光った！」');
    await doc.locator('body').press('Escape'); assert.equal(await doc.locator('.at-sentence-speaking').count(), 0);
    await patch(doc, { splitSpeech: false }); await doc.locator('[data-first]').click(); await doc.waitForFunction(() => window.testState.spoken.length === 3);
    assert.equal(await doc.evaluate(() => window.testState.spoken[2]), original);
  }
});
