export function cleanParagraph(element, settings) {
  const plain = [], annotated = [];
  // Read once without cloning or modifying the page; generated UI never becomes source text.
  const visit = node => {
    if (node.nodeType === 3) { plain.push(node.textContent); annotated.push(node.textContent); return; }
    if (node.nodeType !== 1) return;
    if (node.matches('.at-translation,[data-at-ui],rp,script,style')) return;
    if (node.tagName === 'RT') { annotated.push(`(${node.textContent})`); return; }
    if (node.tagName === 'BR') { plain.push('\n'); annotated.push('\n'); return; }
    node.childNodes.forEach(visit);
  };
  visit(element);
  const original = plain.join('');
  const space = original.slice(0, original.length - original.trimStart().length);
  let text = original.trim(), furigana = annotated.join('').trim();
  const pair = settings.ignoreSymbolPairs && settings.symbolPairs.split('/').map(value => Array.from(value)).find(([left, right]) => text.startsWith(left) && text.endsWith(right));
  if (pair) {
    text = text.slice(pair[0].length, -pair[1].length).trim();
    furigana = furigana.slice(pair[0].length, -pair[1].length).trim();
  }
  return { text, furigana, space, pair };
}

// Caret APIs snap to nearby text even over padding or the empty end of a line.
// Confirm the actual character box before treating a pointer as a text click.
export function textAtPoint(root, x, y) {
  if (!root || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const doc = root.ownerDocument;
  const inside = rect => rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  const usable = node => node?.nodeType === 3 && root.contains(node) && !node.parentElement?.closest('.at-translation,[data-at-ui],script,style');
  const hit = (node, offset) => {
    if (!usable(node)) return null;
    for (let index of [offset, offset - 1]) {
      if (index < 0 || index >= node.length) continue;
      if (/[\uDC00-\uDFFF]/.test(node.data[index]) && index > 0) index--;
      const character = String.fromCodePoint(node.data.codePointAt(index));
      if (/\s/u.test(character)) continue;
      const range = doc.createRange(); range.setStart(node, index); range.setEnd(node, index + character.length);
      if ([...range.getClientRects()].some(inside)) return node;
    }
    return null;
  };
  const position = doc.caretPositionFromPoint?.(x, y);
  const caret = position ? null : doc.caretRangeFromPoint?.(x, y);
  const node = position?.offsetNode || caret?.startContainer, offset = position?.offset ?? caret?.startOffset;
  const found = hit(node, offset);
  if (found) return found;
  // Ruby hit testing differs between engines. Limit this fallback to the
  // element under the pointer rather than scanning the entire paragraph.
  const target = doc.elementFromPoint(x, y)?.closest('.at-word,ruby');
  if (!target || !root.contains(target)) return null;
  const walker = doc.createTreeWalker(target, 4);
  for (let text; (text = walker.nextNode());) {
    if (!usable(text)) continue;
    const range = doc.createRange(); range.selectNodeContents(text);
    if (![...range.getClientRects()].some(inside)) continue;
    for (let index = 0; index < text.length; index++) if (hit(text, index)) return text;
  }
  return null;
}

export function unwrapSentences(element) {
  element.querySelectorAll('.at-sentence').forEach(span => span.replaceWith(...span.childNodes));
  element.classList.remove('at-split');
  element.normalize();
}
export function sentenceGroups(paragraph) {
  const groups = new Map();
  paragraph.querySelectorAll('.at-sentence').forEach(fragment => {
    const index = Number(fragment.dataset.atSentence);
    if (!groups.has(index)) groups.set(index, { paragraph, index, fragments: [] });
    groups.get(index).fragments.push(fragment);
  });
  return [...groups.values()].filter(group => group.fragments.some(fragment => fragment.textContent.trim()));
}
export function sentenceElement(group) {
  const element = group.paragraph.ownerDocument.createElement('span');
  element.append(...group.fragments.map(fragment => fragment.cloneNode(true)));
  return element;
}
export function wrapSentences(element, settings) {
  if (element.classList.contains('at-split') || element.querySelector('img,button,input,textarea,select,[contenteditable]')) return;
  const endings = new Set(settings.sentenceDelimiters.split('/'));
  const closers = new Set(Array.from('」』”’）)】》〉』"'));
  const doc = element.ownerDocument;
  let index = 0, boundary = false;
  const begin = text => {
    if (boundary && text.trim() && !endings.has(text[0]) && !closers.has(text[0])) { index++; boundary = false; }
  };
  const fragment = (sentenceIndex = index) => {
    const span = doc.createElement('span');
    span.className = 'at-sentence'; span.dataset.atSentence = sentenceIndex;
    return span;
  };
  // Wrap text fragments inside their existing ancestors. A sentence can span
  // several fragments; ruby remains atomic and existing element listeners survive.
  const visit = parent => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === 3) {
        const replacement = doc.createDocumentFragment();
        let buffer = '', bufferIndex = index;
        const flush = () => {
          if (!buffer) return;
          const span = fragment(bufferIndex);
          span.textContent = buffer; replacement.append(span); buffer = '';
        };
        for (const char of node.textContent) {
          begin(char);
          if (buffer && bufferIndex !== index) flush();
          bufferIndex = index; buffer += char;
          if (endings.has(char)) boundary = true;
        }
        flush(); node.replaceWith(replacement);
      } else if (node.nodeType === 1) {
        if (node.matches('.at-translation,[data-at-ui],rt,rp,script,style')) continue;
        if (node.tagName === 'RUBY') {
          const clone = node.cloneNode(true);
          clone.querySelectorAll('rt,rp').forEach(annotation => annotation.remove());
          begin(clone.textContent);
          const span = fragment();
          node.before(span); span.append(node);
          if (endings.has(clone.textContent.trim().slice(-1))) boundary = true;
        } else if (node.tagName === 'BR') boundary = true;
        else visit(node);
      }
    }
  };
  visit(element);
  element.classList.add('at-split');
}

