import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { interfaceCases } from './interface.mjs';
import { pageCases } from './pages.mjs';
import { results } from './helpers/browser.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const { name, open, run } of [...interfaceCases, ...pageCases]) {
    await test(name, { timeout: 20000 }, async () => {
      const context = await open(browser);
      try {
        await run(context);
        assert.deepEqual(context.errors, [], '页面不应产生未处理异常');
      } catch (error) {
        await context.page.screenshot({ path: `${results}/failure-${name.replace(/[^a-z0-9-]/gi, '_')}.png` });
        throw error;
      } finally { await context.page.context().close(); }
    });
  }
} finally { await browser.close(); }
