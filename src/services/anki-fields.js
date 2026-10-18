export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function plainText(html) {
  return String(html ?? '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, code) => {
      if (code[0] === '#') {
        const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : match;
      }
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[code.toLowerCase()];
    }).trim();
}

function dictionaryData(entries) {
  if (!Array.isArray(entries) || entries.length > 8 || entries.some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
    throw new Error('词典内容格式无效');
  }
  return escapeHTML(JSON.stringify(entries.map(entry => {
    const html = String(entry.html || ''), styles = String(entry.styles || '');
    if (html.length > 3 * 1024 * 1024 || styles.length > 1024 * 1024) throw new Error('词典内容过大，请减少导出的内容');
    return { id: String(entry.id || ''), name: String(entry.name || entry.id || '词典'), html, styles };
  })));
}

// Preview and export share this mapping; editable HTML is already finalized in the draft.
export function ankiDraftFields(draft = {}) {
  let sourceURL = '';
  try {
    const url = new URL(draft.sourceURL);
    if (['http:', 'https:'].includes(url.protocol)) sourceURL = url.href;
  } catch { /* Local Blob URLs are not useful after import. */ }
  return {
    Word: escapeHTML(draft.word || ''),
    Reading: escapeHTML(draft.reading || ''),
    Sentence: String(draft.sentence || ''),
    Translation: String(draft.translation || ''),
    WordAudio: '', SentenceAudio: '', Image: '',
    DictionaryData: dictionaryData(draft.dictionaries || []),
    SourceURL: escapeHTML(sourceURL),
    SourceTitle: escapeHTML(draft.sourceTitle || sourceURL)
  };
}
