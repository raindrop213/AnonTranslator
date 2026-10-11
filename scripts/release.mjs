import { readFile, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { version } from './paths.mjs';
import { versionParts } from '../src/core/version.js';

export function releaseVersion(message, expectedVersion) {
  const title = message.split(/\r?\n/, 1)[0];
  if (!title.startsWith('v')) return null;
  let selected;
  try { selected = versionParts(title).join('.'); } catch { return null; }
  if (selected !== expectedVersion) throw new Error(`提交标题 ${title} 与 package.json 版本 ${expectedVersion} 不一致`);
  return selected;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const publish = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'
    || releaseVersion(event.head_commit?.message || '', version) !== null;
  console.log(publish ? `Release v${version}` : 'Skip: commit title must be vX.X.X');
  await appendFile(process.env.GITHUB_OUTPUT, `publish=${publish}\nversion=${version}\n`);
}
