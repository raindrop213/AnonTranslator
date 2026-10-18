const weblioHosts = new Set(['www.weblio.jp', 'weblio.jp', 'cdn.weblio.jp', 'c.weblio.jp']);
const resultCache = new Map(), pending = new Map(), cssCache = new Map();
// randomUUID is unavailable on HTTP pages where the userscript also runs.
const installationId = globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
  const random = Math.floor(Math.random() * 16);
  return (character === 'x' ? random : (random & 3) | 8).toString(16);
});
const mojiStyles = `.cloud-result{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft Yahei",sans-serif;color:#3d454c}.cloud-result p{margin:0 0 6px}.cloud-result .spell{display:flex;align-items:center;font-size:18px;margin-bottom:8px}.cloud-result .type{color:#8b8787}.cloud-result ol{margin:6px 0;padding-left:22px}.cloud-result li{margin:0 0 5px}.entry p{margin:3px 0 8px}`;

function remember(cache, key, value, limit) {
  cache.set(key, value);
  if (cache.size > limit) cache.delete(cache.keys().next().value);
}

function decodeAttribute(value) {
  return value.replace(/&amp;/gi, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function cssURL(value, base) {
  try {
    const url = new URL(decodeAttribute(value), base);
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' && weblioHosts.has(url.hostname) ? url.href : null;
  } catch { return null; }
}

function absoluteCss(css, base) {
  return css.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (match, _quote, value) => {
    if (value.startsWith('data:') || value.startsWith('#')) return match;
    try {
      const url = new URL(value, base);
      if (url.protocol === 'http:') url.protocol = 'https:';
      return url.protocol === 'https:' ? `url(${JSON.stringify(url.href)})` : 'url("")';
    } catch { return 'url("")'; }
  });
}

async function readText(response, limit = 8 * 1024 * 1024) {
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > limit) throw new Error('词典返回内容过大');
  const charset = response.headers.get('content-type')?.match(/charset=([^;\s]+)/i)?.[1]?.replace(/["']/g, '') || 'utf-8';
  try { return new TextDecoder(charset).decode(bytes); }
  catch { return new TextDecoder().decode(bytes); }
}

async function weblioStyles(html, pageURL, request) {
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => absoluteCss(match[1], pageURL));
  const urls = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0])
    .filter(tag => /rel\s*=\s*["'][^"']*\bstylesheet\b[^"']*["']/i.test(tag))
    .map(tag => tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1]).filter(Boolean)
    .map(href => cssURL(href, pageURL)).filter(Boolean);
  const visited = new Set(), warnings = [];
  async function load(url, depth = 0) {
    if (visited.has(url) || visited.size >= 24) return '';
    visited.add(url);
    let css = cssCache.get(url);
    if (!css) {
      const response = await request(url, { binary: true, timeout: 20000, credentials: 'omit' });
      css = await readText(response, 2 * 1024 * 1024);
      remember(cssCache, url, css, 48);
    }
    const imports = [];
    const withoutImports = css.replace(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*([^;]*);/gi, (_, href, media) => {
      const target = cssURL(href, url);
      if (target && depth < 2) imports.push({ url: target, media: media.trim() });
      return '';
    }).replace(/@import\s+[^;]+;/gi, '');
    const children = await Promise.all(imports.map(async entry => {
      try {
        const child = await load(entry.url, depth + 1);
        return entry.media ? `@media ${entry.media}{${child}}` : child;
      } catch (error) { warnings.push(error.message); return ''; }
    }));
    return children.join('\n') + '\n' + absoluteCss(withoutImports, url);
  }
  const loaded = await Promise.allSettled([...new Set(urls)].map(url => load(url)));
  for (const result of loaded) {
    if (result.status === 'fulfilled') styles.push(result.value);
    else warnings.push(result.reason.message);
  }
  return { styles: styles.join('\n'), styleWarnings: warnings };
}

async function weblioLookup(word, request) {
  const url = `https://www.weblio.jp/content/${encodeURIComponent(word)}`;
  let response;
  try {
    response = await request(url, { binary: true, timeout: 20000, credentials: 'omit',
      headers: { Accept: 'text/html', 'Accept-Language': 'ja,zh-CN;q=0.9' } });
  } catch (error) {
    if (error.status === 404) return { html: '', styles: '', url, styleWarnings: [] };
    throw error;
  }
  const html = await readText(response);
  return { html, url, ...await weblioStyles(html, url, request) };
}

async function mojiLookup(word, request) {
  const common = { _ClientVersion: 'js3.4.1', _ApplicationId: 'E62VyFVLMiW7kvbtVq3p',
    g_os: 'PCWeb', g_ver: 'v4.8.8.20240829', _InstallationId: installationId };
  async function call(name, params, contentType) {
    const response = await request(`https://api.mojidict.com/parse/functions/${name}`, {
      method: 'POST', timeout: 20000, credentials: 'omit',
      headers: { Accept: '*/*', 'Content-Type': contentType },
      body: JSON.stringify({ ...params, ...common })
    });
    const data = await response.json();
    if (data.error) throw new Error(String(data.error));
    return data;
  }
  const responses = await Promise.allSettled([
    call('word-clickSearchV2', { searchText: word, langEnv: 'zh-CN_ja' }, 'application/json'),
    call('union-api', { functions: [{ name: 'search-all', params: { text: word, types: [102, 106, 103] } }] }, 'text/plain')
  ]);
  const detail = responses[0].status === 'fulfilled' ? responses[0].value.result?.result : null;
  const matches = responses[1].status === 'fulfilled' ? responses[1].value.result?.results?.['search-all']?.result?.word?.searchResult || [] : [];
  const warnings = responses.filter(response => response.status === 'rejected').map(response => response.reason.message);
  if (warnings.length === responses.length) throw new Error(warnings.join('；'));
  return { detail, matches, warnings, styles: mojiStyles, url: `https://www.mojidict.com/searchText/${encodeURIComponent(word)}` };
}

// Requests come from fixed provider endpoints; webpage URLs are never accepted.
export function lookupWord({ provider, word }, request) {
  if (!['weblio', 'moji'].includes(provider)) throw new Error('不支持的词典');
  if (typeof word !== 'string' || !word.trim() || word.length > 100) throw new Error('查询词为空或超过 100 个字符');
  word = word.trim();
  const key = JSON.stringify([provider, word]), hit = resultCache.get(key);
  if (hit?.expires > Date.now()) return Promise.resolve(hit.value);
  if (pending.has(key)) return pending.get(key);
  const promise = (provider === 'weblio' ? weblioLookup : mojiLookup)(word, request).then(value => {
    // A permission grant or retry should immediately recover partial results.
    if (!value.warnings?.length && !value.styleWarnings?.length) remember(resultCache, key, { value, expires: Date.now() + 300000 }, 60);
    return value;
  }).finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
