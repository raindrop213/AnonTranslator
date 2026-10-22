import { ankiDraftFields, escapeHTML, plainText } from '../services/anki-fields.js';

const sampleDraft = {
  word: '図書館', reading: 'としょかん',
  sentence: '今日は<b>図書館</b>で本を読みます。', translation: '今天在图书馆读书。',
  dictionaries: [
    { id: 'weblio', name: 'Weblio', html: '<h2>図書館（としょかん）</h2><p>本を集め、読書や調査に利用する施設。</p>', styles: '' },
    { id: 'moji', name: 'MOJi', html: '<h2>図書館</h2><p>图书馆。</p>', styles: '' }
  ]
};

// Use exactly the export mapping; screenshots stay local.
export function ankiPreviewFields(draft) {
  const value = draft && typeof draft === 'object' ? draft : sampleDraft;
  const fields = ankiDraftFields(value), { mime, data } = value.image || {};
  if (/^image\/(?:png|jpeg|webp|gif)$/.test(mime || '') && typeof data === 'string'
    && data.length <= 28 * 1024 * 1024 && /^[A-Za-z\d+/]+={0,2}$/.test(data) && data.length % 4 !== 1) {
    try {
      if (atob(data).length) fields.Image = `<img alt="当前卡片截图" src="data:${mime};base64,${data}">`;
    } catch { /* Invalid image data does not prevent a text preview. */ }
  }
  return fields;
}

export function ankiPreviewSpeech(kind, fields, settings) {
  if (!['word', 'sentence'].includes(kind)) return null;
  const provider = settings[kind === 'word' ? 'ankiWordAudioService' : 'ankiSentenceAudioService'];
  const text = plainText(fields[kind === 'word' ? 'Word' : 'Sentence']).trim();
  if (!['vits', 'huosh'].includes(provider) || !text) return null;
  return { text, settings: { ...settings, useWindowsTTS: false, useVITS: provider === 'vits', useHuoshTTS: provider === 'huosh', huoshRate: 1 } };
}

// Sections are boolean field checks; a stack also handles nested/repeated names.
function renderTemplate(template, fields) {
  const source = String(template ?? ''), stack = [];
  const tokens = /{{\s*![\s\S]*?}}|{{{?\s*([#^/]?)(?:(text|type):)?([A-Za-z][A-Za-z0-9]*)\s*}?}}/g;
  let result = '', cursor = 0, active = true;
  for (const match of source.matchAll(tokens)) {
    if (active) result += source.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    if (/^{{\s*!/.test(match[0])) continue;
    const [, condition, filter, name] = match, value = fields[name];
    if (condition === '#' || condition === '^') {
      stack.push({ name, active });
      active = active && (condition === '#' ? Boolean(value) : !value);
    } else if (condition === '/' && stack.at(-1)?.name === name) {
      active = stack.pop().active;
    } else if (active) {
      result += condition === '/' || value === undefined ? match[0]
        : filter ? escapeHTML(plainText(value)) : value;
    }
  }
  if (active) result += source.slice(cursor);
  return result;
}

// The caller must use iframe sandbox="allow-scripts", without allow-same-origin.
// That opaque sandbox plus this CSP allows card scripts and local srcdoc tabs.
export function ankiPreviewDocument(front, back, css, side = 'ankiBack', draft = null, { nightMode = false, playbackToken = '', wordAudio = true, sentenceAudio = true, translationEnabled = true } = {}) {
  const fields = ankiPreviewFields(draft);
  if (!draft && !translationEnabled) fields.Translation = '';
  if (playbackToken) {
    if (wordAudio) fields.WordAudio = '<button type="button" data-at-preview-play="word">播放单词</button>';
    if (sentenceAudio) fields.SentenceAudio = '<button type="button" data-at-preview-play="sentence">播放例句</button>';
  }
  const frontSide = renderTemplate(front, fields);
  const body = side === 'ankiFront' ? frontSide : renderTemplate(back, { ...fields, FrontSide: frontSide });
  const safeCSS = String(css ?? '').replace(/<\/style/gi, '<\\/style');
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
    + "img-src data:; frame-src about:; connect-src 'none'; form-action 'none'; base-uri 'none'";
  return '<!doctype html><html lang="ja" data-at-ui' + (nightMode ? ' class="nightMode"' : '') + '><head>'
    + '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta http-equiv="Content-Security-Policy" content="' + escapeHTML(policy) + '">'
    + '<style>:root{color-scheme:' + (nightMode ? 'dark' : 'light') + '}\n' + safeCSS + '</style>'
    + '</head><body class="card' + (nightMode ? ' nightMode' : '') + '">' + body
    + (playbackToken ? '<script>document.addEventListener("click",function(e){var b=e.target.closest("[data-at-preview-play]");if(b)parent.postMessage({type:"at-anki-play",kind:b.getAttribute("data-at-preview-play"),token:' + JSON.stringify(playbackToken).replace(/</g, '\\u003c') + '},"*");});</script>' : '')
    + '</body></html>';
}
