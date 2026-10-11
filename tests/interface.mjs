import assert from 'node:assert/strict';
import { settings, installPlatform, results } from './helpers/browser.mjs';
import { root, extensionPath, version } from '../scripts/paths.mjs';

export const interfaceCases = [];
for (const platform of ['extension', 'tampermonkey']) {
  const add = (name, run) => interfaceCases.push({ name: `界面 / ${platform} / ${name}`, open: browser => settings(browser, platform), run });
  add('布局、主题、ON/OFF 图片及截图', async ({ page }) => {
    assert.deepEqual(await page.getByRole('tab').allTextContents(), ['复制', '语音', '翻译', '外观', '快捷键', '帮助']);
    assert.equal(await page.locator('.at-version').textContent(), `Ver ${version}`);
    assert.equal(await page.locator('.at-header-art').evaluate(async img => { await img.decode(); return img.naturalWidth > 0; }), true);
    const tabs = await page.getByRole('tab').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
    assert.equal(new Set(tabs).size, 1);
    assert.equal(await page.locator('.at-save-status').isVisible(), false);
    assert.equal(await page.locator('.at-theme-toggle').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    await page.screenshot({ path: `${results}/settings-${platform}-day.png` });
    await page.locator('.at-theme-toggle').click(); await page.waitForFunction(() => window.testState.values.nightMode);
    assert.equal(await page.locator('.at-settings').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(25, 30, 34)');
    await page.getByRole('tab', { name: '外观', exact: true }).click();
    assert.equal(await page.locator('.at-color-guide').textContent(), '☀ 日间 | ☾ 夜间');
    assert.equal(await page.locator('.at-color-guide').evaluate(el => getComputedStyle(el).textAlign), 'right');
    assert.equal(await page.locator('.at-color-pair').count(), 5);
    await page.screenshot({ path: `${results}/settings-${platform}-night.png` });
    await page.locator('input[name=pluginSwitch]').uncheck();
    assert.equal(await page.locator('.at-header-art').getAttribute('data-state'), 'off');
    await page.screenshot({ path: `${results}/settings-${platform}-off.png` });
  });
  add('即刻保存、输入校验、快捷键与栏目记忆', async ({ page, doc }) => {
    await page.locator('input[name=targetTags]').fill('p, li'); await doc.waitForFunction(() => window.testState.values.targetTags === 'p,li');
    await page.locator('input[name=targetTags]').fill('p > span');
    assert.equal(await doc.evaluate(() => window.testState.values.targetTags), 'p,li');
    assert.match(await page.locator('.at-save-status').textContent(), /保留上次有效值/);
    await page.getByRole('tab', { name: '快捷键', exact: true }).click();
    await page.locator('input[name=shortcutNextSentence]').locator('..').getByRole('button', { name: '录制', exact: true }).click();
    await page.locator('input[name=shortcutNextSentence]').press('Control+j');
    await doc.waitForFunction(() => window.testState.values.shortcutNextSentence === 'Ctrl+KeyJ');
    assert.equal(await doc.evaluate(() => window.testState.values.settingsTab), '快捷键');
    if (platform === 'tampermonkey') {
      await page.locator('.at-close').click(); await doc.evaluate(() => window.testState.menus[0]());
    } else {
      const saved = await doc.evaluate(() => window.testState.values);
      await page.setContent('<body></body>'); await installPlatform(page, platform, saved);
      await page.addStyleTag({ path: `${root}/${extensionPath}/settings.css` });
      await page.addScriptTag({ path: `${root}/${extensionPath}/popup.js` });
    }
    await page.getByRole('tab', { name: '快捷键', exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: '快捷键', exact: true }).getAttribute('aria-selected'), 'true');
  });
  add('互斥语音、速度滑杆、在线声音列表和连接失败', async ({ page, doc }) => {
    await page.getByRole('tab', { name: '语音', exact: true }).click();
    assert.equal(await page.getByRole('tabpanel').locator('input').first().getAttribute('name'), 'readingInterval');
    for (const key of ['useWindowsTTS', 'useVITS', 'useHuoshTTS']) {
      await page.locator(`input[name=${key}]`).check(); await doc.waitForFunction(key => window.testState.values[key] === true, key);
      assert.equal(await page.locator('input[name=useWindowsTTS]:checked,input[name=useVITS]:checked,input[name=useHuoshTTS]:checked').count(), 1);
    }
    assert.equal(await page.locator('input[name=huoshRate]').getAttribute('type'), 'range');
    await page.locator('input[name=huoshRate]').fill('1.5'); await doc.waitForFunction(() => window.testState.values.huoshRate === 1.5);
    await page.locator('input[name=vitsAPI]').fill('http://127.0.0.1:23456/'); await page.locator('.at-refresh-voices').click();
    await page.locator('select[name=vitsVoice] option[value="42"]').waitFor({ state: 'attached' });
    await doc.evaluate(() => { window.testState.voiceFailure = true; }); await page.locator('.at-refresh-voices').click();
    await page.locator('select[name=vitsVoice] option').filter({ hasText: /失败/ }).waitFor({ state: 'attached' });
    assert.equal(await page.locator('select[name=vitsVoice]').isDisabled(), true);
  });
  add('重置必须确认，取消保留设置', async ({ page, doc }) => {
    await page.locator('.at-theme-toggle').click(); await doc.waitForFunction(() => window.testState.values.nightMode === true);
    page.once('dialog', dialog => dialog.dismiss()); await page.locator('.at-reset').click();
    assert.equal(await doc.evaluate(() => window.testState.values.nightMode), true);
    page.once('dialog', dialog => dialog.accept()); await page.locator('.at-reset').click();
    await doc.waitForFunction(() => window.testState.values.pluginSwitch === false && window.testState.values.nightMode === false);
    assert.equal(await page.getByRole('tab', { name: '复制', exact: true }).getAttribute('aria-selected'), 'true');
  });
  add('版本号附近显示最新状态和新版入口', async ({ page, doc }) => {
    const link = page.locator('.at-update');
    await link.filter({ hasText: '当前为最新版本' }).waitFor();
    await doc.evaluate(() => {
      window.testState.releaseTag = 'v99.0.0';
      window.testState.updateResult = { state: 'available', version: '99.0.0', url: 'https://github.com/raindrop213/AnonTranslator/releases/latest' };
    });
    await link.click(); await link.filter({ hasText: '建议更新v99.0.0' }).waitFor();
    assert.equal(await link.getAttribute('href'), 'https://github.com/raindrop213/AnonTranslator/releases/latest');
    assert.equal(await link.getAttribute('target'), '_blank');
    const boxes = await page.locator('.at-header').evaluate(el => {
      const version = el.querySelector('.at-version').getBoundingClientRect(), update = el.querySelector('.at-update').getBoundingClientRect(), actions = el.querySelector('.at-header-actions').getBoundingClientRect();
      return { below: update.top >= version.bottom, clear: update.right < actions.left };
    });
    assert.deepEqual(boxes, { below: true, clear: true });
    await page.screenshot({ path: `${results}/settings-${platform}-update.png` });
  });
  add('版本检查失败可重试，不误报最新', async ({ page, doc }) => {
    const link = page.locator('.at-update'); await link.filter({ hasText: '当前为最新版本' }).waitFor();
    await doc.evaluate(() => { window.testState.releaseStatus = 503; });
    await link.click(); await link.filter({ hasText: '检查失败' }).waitFor();
    await doc.evaluate(() => { window.testState.releaseStatus = 200; });
    await link.click(); await link.filter({ hasText: '当前为最新版本' }).waitFor();
    assert.equal(await doc.evaluate(() => window.testState.updateChecks), 3);
  });
}
interfaceCases.push({
  name: '界面 / extension / 网站限制下在版本号旁授权检查更新',
  open: browser => settings(browser, 'extension'),
  async run({ page, doc }) {
    const link = page.locator('.at-update'); await link.filter({ hasText: '当前为最新版本' }).waitFor();
    await doc.evaluate(() => window.testState.revokeUpdates());
    await link.click(); await link.filter({ hasText: '授权检查更新' }).waitFor();
    await link.click(); await link.filter({ hasText: '当前为最新版本' }).waitFor();
    assert.deepEqual(await doc.evaluate(() => window.testState.grants), ['https://api.github.com/*']);
  }
});
interfaceCases.push({
  name: '界面 / extension / 每个服务的授权指示位于自己的框内',
  open: browser => settings(browser, 'extension'),
  async run({ page, doc }) {
    await page.getByRole('tab', { name: '翻译', exact: true }).click();
    for (const [id, name] of [['google', 'Google'], ['youdao', '有道']]) {
      const row = page.locator(`[data-at-service=${id}]`);
      assert.equal(await row.evaluate(el => el.closest('fieldset').querySelector('legend').textContent), name);
      await row.getByRole('button').click(); await row.getByText(/已授权/).waitFor();
    }
    assert.deepEqual(await doc.evaluate(() => window.testState.grants), ['https://translate-pa.googleapis.com/*', 'https://m.youdao.com/*']);
  }
});
