// Exercise the actual shared service implementation, not a parallel adapter.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const defaults = JSON.parse(await read('src/config/defaultSettings.json'));
const context = vm.createContext({ fetch, AbortSignal, AbortController, URL, URLSearchParams, Uint8Array, btoa, atob, setTimeout, clearTimeout });
vm.runInContext(`const App = ${JSON.stringify({ defaults })}`, context);
for (const file of ['shortcuts', 'settings', 'services']) vm.runInContext(await read(`src/core/${file}.js`), context);
const app = vm.runInContext('App', context);
const text = 'これは翻訳のテストです。';
const cases = process.argv.includes('--youdao-fixed')
  ? [['youdao', text.repeat(70)]]
  : [['google', text], ['youdao', text], ['youdao', text.repeat(70)]];
const results = [];
for (const [translator, input] of cases) {
  const start = performance.now();
  let result;
  try {
    const { translatedText } = await app.handleServiceMessage({ action: 'translate', translator, text: input, from: 'ja', to: translator === 'google' ? 'zh-CN' : 'zh-CHS' });
    result = { translator, inputCharacters: input.length, milliseconds: Math.round(performance.now() - start), translatedCharacters: translatedText.length, sample: translatedText.slice(0, 160) };
  } catch (error) {
    result = { translator, inputCharacters: input.length, milliseconds: Math.round(performance.now() - start), error: error.message, cause: error.cause?.code };
  }
  results.push(result);
  console.log(JSON.stringify(result));
}
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
await writeFile(new URL('../test-results/services-probe.json', import.meta.url), JSON.stringify(results, null, 2));
