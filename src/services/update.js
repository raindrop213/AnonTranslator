import metadata from '../../package.json' with { type: 'json' };
import { fetchRequest } from './request.js';

export async function checkLatestVersion(request = fetchRequest) {
  const response = await request('https://api.github.com/repos/raindrop213/AnonTranslator/releases/latest', {
    timeout: 3000, headers: { Accept: 'application/vnd.github+json' }
  });
  const data = await response.json();
  const version = typeof data?.tag_name === 'string' ? data.tag_name.replace(/^v/, '') : '';
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('版本信息无效');
  const latest = version.split('.').map(Number), current = metadata.version.split('.').map(Number);
  const difference = latest.findIndex((part, index) => part !== current[index]);
  return { version, available: difference >= 0 && latest[difference] > current[difference] };
}
