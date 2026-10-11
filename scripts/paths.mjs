import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { versionParts } from '../src/core/version.js';

export const root = fileURLToPath(new URL('..', import.meta.url));
export const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (versionParts(version).join('.') !== version) throw new Error('package.json 版本号必须为 X.X.X，不带 v 前缀');
export const extensionPath = 'dist/extension';
export const userscriptPath = 'dist/tampermonkey/AnonTranslator.user.js';
export const chromeDir = path.join(root, extensionPath);
export const userscriptDir = path.join(root, 'dist', 'tampermonkey');
export const projectURL = 'https://github.com/raindrop213/AnonTranslator';
export const release = {
  page: `${projectURL}/releases/latest`,
  listing: `${projectURL}/releases`,
  api: 'https://api.github.com/repos/raindrop213/AnonTranslator/releases/latest'
};
