// Read individual line rectangles: a multi-column paragraph's bounding box can
// cover several pages, including space where no text is actually visible.
function scrollToReadingTarget(paragraph, group, behavior) {
  const doc = paragraph.ownerDocument, win = doc.defaultView;
  let viewport = { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight };
  for (let node = paragraph.parentElement; node; node = node.parentElement) {
    const style = win.getComputedStyle(node), rect = node.getBoundingClientRect();
    if (style.overflowX !== 'visible') {
      viewport.left = Math.max(viewport.left, rect.left + node.clientLeft);
      viewport.right = Math.min(viewport.right, rect.left + node.clientLeft + node.clientWidth);
    }
    if (style.overflowY !== 'visible') {
      viewport.top = Math.max(viewport.top, rect.top + node.clientTop);
      viewport.bottom = Math.min(viewport.bottom, rect.top + node.clientTop + node.clientHeight);
    }
  }
  const fragments = group?.fragments || [paragraph.querySelector('.at-sentence') || paragraph];
  const rects = fragments.flatMap(fragment => [...fragment.getClientRects()]).filter(rect => rect.width && rect.height);
  const visible = rect => rect.left >= viewport.left - 1 && rect.right <= viewport.right + 1 && rect.top >= viewport.top - 1 && rect.bottom <= viewport.bottom + 1;
  if (!rects.length || rects.some(visible)) return;

  const book = paragraph.closest('.book-content');
  const columns = book?.querySelector(':scope > .book-content-container');
  if (doc.location?.hostname === 'reader.ttsu.app' && columns && win.getComputedStyle(columns).columnFill === 'auto') {
    // TTsu maintains a separate page position, so native scrollIntoView desyncs
    // its controls. Invoke its existing window pagination handler instead.
    const vertical = book.classList.contains('book-content--writing-vertical-rl');
    const style = win.getComputedStyle(book), rect = book.getBoundingClientRect();
    const size = parseFloat(style.getPropertyValue(vertical ? '--book-content-child-height' : '--book-content-child-width'));
    const gap = parseFloat(win.getComputedStyle(columns).columnGap) || 0;
    if (size > 0) {
      const target = rects[0];
      const offset = vertical ? target.top - rect.top : target.left - rect.left;
      const pages = Math.floor((offset + 1) / (size + gap));
      for (let i = 0; i < Math.abs(pages); i++) win.dispatchEvent(new win.KeyboardEvent('keydown', { code: pages > 0 ? 'ArrowDown' : 'ArrowUp' }));
      return;
    }
  }
  const rect = paragraph.getBoundingClientRect();
  const fits = rect.width <= viewport.right - viewport.left && rect.height <= viewport.bottom - viewport.top;
  // Ordinary short paragraphs use their paragraph position. Long paragraphs
  // use the sentence's first line and move only as far as needed.
  (fits ? paragraph : fragments[0]).scrollIntoView({ behavior, block: fits ? 'center' : 'nearest', inline: 'nearest' });
}
App.scrollToReadingTarget = scrollToReadingTarget;
