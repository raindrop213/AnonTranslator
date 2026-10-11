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
  if (element.classList.contains('at-split') || element.querySelector('img,a,button,input,textarea,select,[contenteditable]')) return;
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

