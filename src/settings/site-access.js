// One storage key per website avoids read/modify/write races between tabs.
export const siteStoragePrefix = 'at-site:';

export function siteIdentity(url) {
  try {
    const address = new URL(url);
    if (address.protocol === 'file:') return { key: `${siteStoragePrefix}file`, label: '本地文件' };
    if (!['http:', 'https:'].includes(address.protocol)) return { key: null, label: '' };
    const hostname = address.hostname.toLowerCase().replace(/\.$/, '');
    if (!hostname) return { key: null, label: '' };
    return { key: siteStoragePrefix + hostname, label: hostname };
  } catch { return { key: null, label: '' }; }
}

export const siteStorageKey = url => siteIdentity(url).key;

// Embedded chapters, including opaque EPUB frames, follow the website which
// owns their tab. ancestorOrigins is ordered from nearest parent to top page.
export function resolveSiteURL({ url, ancestorOrigins = [], referrer = '', isTop = true } = {}) {
  const ancestors = Array.from(ancestorOrigins || []);
  const candidates = isTop ? [url] : [ancestors.at(-1), referrer, url];
  return candidates.find(candidate => siteStorageKey(candidate)) || undefined;
}
