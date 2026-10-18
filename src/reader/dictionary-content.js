// Dictionary markup stays in its own document: source CSS cannot style the book.
const allowedTags = new Set('div p span br hr b strong i em small h1 h2 h3 h4 h5 h6 ul ol li dl dt dd table thead tbody tfoot tr th td caption colgroup col ruby rt rp blockquote sup sub a img figure figcaption pre code cite abbr time mark s del ins u font section article header footer aside nav details summary'.split(' '));
const blockedTags = new Set('script style link iframe object embed svg video audio form input button select textarea noscript base meta'.split(' '));
const attributes = 'class id style colspan rowspan align width height title lang dir scope span start value color size face open'.split(' ');
const installedStyles = new WeakMap(), imageListeners = new WeakSet();

function safeURL(value, base) {
  try { const url = new URL(value, base); return ['http:', 'https:'].includes(url.protocol) ? url : null; }
  catch { return null; }
}

function safeStyle(value) {
  // Static source styling is retained; execution and remote stylesheet imports are not.
  return String(value || '').replace(/@import\s+[^;]+;/gi, '').replace(/expression\s*\([^)]*\)/gi, '').replace(/(?:behavior|-moz-binding)\s*:[^;}]+[;}]/gi, '').replace(/url\(\s*['"]?\s*(?:javascript|vbscript):[^)]*\)/gi, 'url("")');
}

function safeNode(node, doc, baseURL) {
  if (node.nodeType === 3) return doc.createTextNode(node.textContent);
  const tag = node.localName;
  if (node.nodeType !== 1 || blockedTags.has(tag) || node.hidden || node.getAttribute('aria-hidden') === 'true' || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(node.getAttribute('style') || '')) return doc.createDocumentFragment();
  const out = allowedTags.has(tag) ? doc.createElement(tag) : doc.createDocumentFragment();
  if (out.nodeType === 1) for (const attribute of attributes) {
    if (node.hasAttribute(attribute)) out.setAttribute(attribute, attribute === 'style' ? safeStyle(node.getAttribute(attribute)) : node.getAttribute(attribute));
  }
  if (tag === 'img') {
    if (node.classList.contains('lgDictSp')) return doc.createDocumentFragment();
    const source = node.getAttribute('data-src') || node.getAttribute('data-original') || node.getAttribute('src');
    let url = source && safeURL(source, baseURL);
    if (!url) return doc.createDocumentFragment();
    if ((url.hostname === 'weblio.jp' || url.hostname.endsWith('.weblio.jp')) && url.pathname.endsWith('/redirect')) url = safeURL(url.searchParams.get('url'), baseURL) || url;
    if (url.hostname === 'thumb.wikimedia.org') url.hostname = 'upload.wikimedia.org';
    if (url.protocol === 'http:') url.protocol = 'https:';
    out.src = url.href; out.alt = node.getAttribute('alt') || '';
    out.loading = 'lazy'; out.decoding = 'async'; out.referrerPolicy = 'no-referrer';
    return out;
  }
  if (tag === 'a') {
    const href = node.getAttribute('href'), url = href && safeURL(href, baseURL);
    if (href?.startsWith('#')) out.href = href;
    else if (url) {
      out.href = url.href; out.target = '_blank'; out.rel = 'noopener noreferrer';
      if (['weblio.jp', 'www.weblio.jp'].includes(url.hostname) && url.pathname.startsWith('/content/')) {
        try { out.dataset.lookup = decodeURIComponent(url.pathname.slice('/content/'.length)); out.removeAttribute('target'); } catch { /* Invalid source URI. */ }
      }
    }
    if (node.classList.contains('point') && node.textContent.trim()) { out.href = '#'; out.dataset.lookup = node.textContent.trim(); }
  }
  node.childNodes.forEach(child => out.append(safeNode(child, doc, baseURL)));
  return out;
}

function renderWeblio(doc, data) {
  const source = new DOMParser().parseFromString(data.html || '', 'text/html'), fragment = doc.createDocumentFragment();
  for (const content of source.querySelectorAll('div.kijiWrp')) {
    const article = doc.createElement('article'); article.className = 'at-dictionary-entry';
    let heading = content.previousElementSibling;
    while (heading && !heading.matches('.pbarT,.kijiWrp')) heading = heading.previousElementSibling;
    if (heading?.matches('.pbarT')) article.append(safeNode(heading, doc, data.url));
    article.append(safeNode(content, doc, data.url)); fragment.append(article);
  }
  if (!fragment.textContent.trim()) { const empty = doc.createElement('p'); empty.textContent = '未找到词条，可调整查询词或打开原词条。'; fragment.append(empty); }
  return fragment;
}

function renderMoji(doc, data) {
  const fragment = doc.createDocumentFragment();
  const plain = value => new DOMParser().parseFromString(String(value ?? ''), 'text/html').body.textContent || '';
  const add = (parent, tag, value, className) => {
    const element = doc.createElement(tag); element.textContent = plain(value);
    if (className) element.className = className;
    parent.append(element); return element;
  };
  const word = data.detail?.word?.[0];
  if (word) {
    const article = doc.createElement('article'); article.className = 'cloud-result';
    add(article, 'div', [word.spell, word.pron, word.accent].filter(value => value !== undefined && value !== '').join('｜'), 'spell');
    if (word.excerpt) add(article, 'p', word.excerpt, 'type');
    const groups = new Map();
    for (const detail of data.detail.subdetails || []) { const key = detail.relaId ?? groups.size; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(detail.title); }
    const list = doc.createElement('ol');
    for (const titles of groups.values()) add(list, 'li', titles.join(' / '));
    article.append(list); fragment.append(article);
  }
  for (const match of data.matches || []) {
    const article = doc.createElement('article'); article.className = 'at-dictionary-entry';
    const title = plain(match.title), term = plain(match.spell || match.word || '').trim() || title.split(/[|｜]/)[0].trim();
    const link = add(article, 'a', title); link.href = '#'; link.dataset.lookup = term;
    add(article, 'p', match.excerpt); fragment.append(article);
  }
  if (!fragment.childNodes.length) add(fragment, 'p', '未找到 MOJi 词条。');
  for (const warning of data.warnings || []) add(fragment, 'p', '部分结果未获取：' + warning);
  return fragment;
}

// Export the same static, cleaned content used by the lookup frame. Anki stores
// it as data and displays each dictionary in its own sandboxed document.
export function serializeDictionaryContent(provider, data, doc = document) {
  const target = doc.implementation.createHTMLDocument('');
  const base = target.createElement('div'); base.id = 'base';
  base.append(provider === 'moji' ? renderMoji(target, data) : renderWeblio(target, data));
  target.body.append(base);
  return { id: provider, name: provider === 'moji' ? 'MOJi' : 'Weblio', html: target.body.innerHTML,
    styles: safeStyle(data.styles || '') + '\nhtml,body{margin:0;min-width:0!important;width:auto!important}body{padding:7px;font:14px/1.5 sans-serif;overflow-wrap:anywhere}#base{min-width:0!important;width:auto!important;margin:0!important}img{max-width:100%;height:auto}pre{white-space:pre-wrap}' };
}

export function renderDictionaryDocument(doc, provider, data, onLookup, night = false, onEscape = () => {}) {
  doc.documentElement.lang = 'ja';
  doc.head.querySelectorAll('style[data-at-dictionary-style]').forEach(style => style.remove());
  const oldSheets = installedStyles.get(doc) || [];
  doc.adoptedStyleSheets = (doc.adoptedStyleSheets || []).filter(sheet => !oldSheets.includes(sheet));
  const sheets = []; installedStyles.set(doc, sheets);
  const appendStyle = text => {
    try { const sheet = new doc.defaultView.CSSStyleSheet(); sheet.replaceSync(safeStyle(text)); doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet]; sheets.push(sheet); }
    catch { const style = doc.createElement('style'); style.dataset.atDictionaryStyle = ''; style.textContent = safeStyle(text); doc.head.append(style); }
  };
  appendStyle(data.styles || '');
  // Only sizing is adapted; source typography, tables, logos and illustrations survive.
  appendStyle(`html,body{margin:0!important;min-width:0!important;width:auto!important;background:#fff!important}body{padding:7px;font-size:14px;line-height:1.5;overflow-wrap:anywhere}#base{min-width:0!important;width:auto!important;margin:0!important}.kijiWrp,.pbarT{max-width:100%;box-sizing:border-box}.at-dictionary-entry{margin-bottom:10px}.cloud-result{padding:0}.cloud-result .spell{margin-bottom:5px;font-size:18px}.cloud-result p{margin:3px 0}.cloud-result li{margin-bottom:4px}ol,ul{padding-left:23px}a[data-lookup]{cursor:pointer}img{max-width:100%;height:auto}pre{white-space:pre-wrap}${night ? 'html{color-scheme:light}' : ''}`);
  const base = doc.createElement('div'); base.id = 'base';
  base.append(provider === 'moji' ? renderMoji(doc, data) : renderWeblio(doc, data));
  if (data.styleWarnings?.length) { const warning = doc.createElement('p'); warning.textContent = '部分原站样式未加载。'; base.prepend(warning); }
  doc.body.replaceChildren(base);
  doc.onclick = event => {
    const link = event.target.closest?.('a[data-lookup]');
    if (!link) return;
    event.preventDefault(); onLookup(link.dataset.lookup);
  };
  doc.onkeydown = event => {
    if (event.key !== 'Escape' || event.isComposing) return;
    event.preventDefault(); event.stopPropagation(); onEscape();
  };
  if (!imageListeners.has(doc)) doc.addEventListener('error', event => {
    const image = event.target;
    if (image.tagName !== 'IMG' || !image.isConnected) return;
    const fallback = doc.createElement('a'); fallback.href = image.src; fallback.target = '_blank'; fallback.rel = 'noopener noreferrer';
    fallback.textContent = image.alt ? `[图片未加载：${image.alt}]` : '[图片未加载，打开查看]'; image.replaceWith(fallback);
  }, true);
  imageListeners.add(doc);
}

