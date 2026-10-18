const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
const defaultSearch = 'https://www.google.com/search?q={word}';

export function buildDictionarySearchURL(template, word) {
  word = String(word || '').trim();
  if (!word) return null;
  try {
    template = String(template || defaultSearch);
    if (!template.includes('{word}')) return null;
    const url = new URL(template.replaceAll('{word}', encodeURIComponent(word)));
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

// The preferred axis follows the text direction, keeping the clicked word and
// its next word clear. Only the visible size is reduced when space is limited.
export function placeDictionaryPopup(anchor, viewport, requested, writingMode = 'horizontal-tb', fixedSide = null) {
  const gap = 8, viewWidth = Math.max(1, viewport.right - viewport.left), viewHeight = Math.max(1, viewport.bottom - viewport.top);
  const width = Math.min(requested.width, viewWidth), height = Math.min(requested.height, viewHeight);
  const minWidth = Math.min(180, viewWidth), minHeight = Math.min(160, viewHeight);
  const vertical = /^(vertical|sideways)/.test(writingMode);
  const primary = vertical ? ['right', 'left'] : ['below', 'above'];;
  const order = [...primary, ...(vertical ? ['below', 'above'] : ['right', 'left'])];
  const candidates = order.map(side => {
    const horizontal = side === 'left' || side === 'right';
    const space = Math.max(0, side === 'left' ? anchor.left - gap - viewport.left : side === 'right' ? viewport.right - anchor.right - gap : side === 'above' ? anchor.top - gap - viewport.top : viewport.bottom - anchor.bottom - gap);
    const w = horizontal ? Math.min(width, space) : width, h = horizontal ? height : Math.min(height, space);
    return { side, width: w, height: h,
      left: side === 'left' ? anchor.left - gap - w : side === 'right' ? anchor.right + gap : clamp(anchor.left, viewport.left, viewport.right - w),
      top: side === 'above' ? anchor.top - gap - h : side === 'below' ? anchor.bottom + gap : clamp(anchor.top, viewport.top, viewport.bottom - h),
      full: w >= width && h >= height, usable: w >= minWidth && h >= minHeight };
  });
  const preferred = candidates.filter(candidate => primary.includes(candidate.side));
  const chosen = candidates.find(candidate => candidate.side === fixedSide && candidate.usable)
    || preferred.find(candidate => candidate.full)
    || preferred.filter(candidate => candidate.usable).sort((a, b) => b.width * b.height - a.width * a.height)[0]
    || candidates.find(candidate => candidate.full)
    || candidates.filter(candidate => candidate.usable).sort((a, b) => b.width * b.height - a.width * a.height)[0]
    || candidates.sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const { side, left, top, width: displayedWidth, height: displayedHeight } = chosen;
  return { side, left, top, width: displayedWidth, height: displayedHeight };
}

