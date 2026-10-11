import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { version, release } from '../../scripts/paths.mjs';

export const defaults = JSON.parse(await readFile(new URL('../../src/config/defaultSettings.json', import.meta.url)));
export const plain = value => JSON.parse(JSON.stringify(value));
export async function load(files, extra = {}) {
  const context = vm.createContext({ console, URL, URLSearchParams, TextDecoder, TextEncoder,
    Uint8Array, atob, btoa, AbortSignal, AbortController, setTimeout, clearTimeout, ...extra });
  vm.runInContext(`const App = ${JSON.stringify({ defaults, version, release })};`, context);
  for (const file of ['core/version', 'core/shortcuts', ...files]) {
    vm.runInContext((await readFile(new URL(`../../src/${file}.js`, import.meta.url), 'utf8')).replace(/^export /gm, ''), context);
  }
  return vm.runInContext('App', context);
}
