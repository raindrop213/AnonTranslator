import { readFile, mkdir, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const defaults = JSON.parse(await read('src/config/defaultSettings.json'));
const context = vm.createContext({ fetch, AbortSignal, AbortController, URL, URLSearchParams, Uint8Array, btoa, atob, setTimeout, clearTimeout });
vm.runInContext(`const App = ${JSON.stringify({ defaults })}`, context);
for (const file of ['shortcuts', 'settings', 'services']) vm.runInContext(await read(`src/core/${file}.js`), context);
const app = vm.runInContext('App', context);
const start = performance.now();
const request = (url, options) => app.fetchRequest(url, { ...options, timeout: 15000 });
try {
  const audio = await app.handleServiceMessage({ action: 'huosh_audio', text: 'こんにちは。これは音声のテストです。', settings: defaults }, request);
  const bytes = Buffer.from(audio.audio, 'base64');
  await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
  await writeFile(new URL('../test-results/huoshan-test.mp3', import.meta.url), bytes);
  console.log(JSON.stringify({ milliseconds: Math.round(performance.now() - start), bytes: bytes.length, mime: audio.mime }));
} catch (error) {
  console.log(JSON.stringify({ milliseconds: Math.round(performance.now() - start), error: error.message, cause: error.cause?.code }));
  process.exitCode = 1;
}
