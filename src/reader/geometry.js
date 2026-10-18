// All rectangles here use viewport coordinates, never document/scroll offsets.
export function topDocument(doc) {
  try { while (doc.defaultView.parent !== doc.defaultView && doc.defaultView.parent.document.documentElement) doc = doc.defaultView.parent.document; }
  catch { /* Cross-origin frames keep their own viewport. */ }
  return doc;
}

export function viewportRect(win) {
  const viewport = win.visualViewport, left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
  return { left, top, right: left + (viewport?.width || win.innerWidth), bottom: top + (viewport?.height || win.innerHeight) };
}

const clipRect = (rect, bounds, x = true, y = true) => ({
  left: x ? Math.max(rect.left, bounds.left) : rect.left, right: x ? Math.min(rect.right, bounds.right) : rect.right,
  top: y ? Math.max(rect.top, bounds.top) : rect.top, bottom: y ? Math.min(rect.bottom, bounds.bottom) : rect.bottom
});
const pixels = value => Number.parseFloat(value) || 0;

// iframe client boxes INCLUDE padding, whereas the child viewport starts at
// the content box. Bibi places its page margins on the iframe itself.
export function frameContentBox(frame) {
  const rect = frame.getBoundingClientRect(), style = frame.ownerDocument.defaultView.getComputedStyle(frame);
  const scaleX = rect.width / (frame.offsetWidth || rect.width || 1), scaleY = rect.height / (frame.offsetHeight || rect.height || 1);
  const left = rect.left + (frame.clientLeft + pixels(style.paddingLeft)) * scaleX;
  const top = rect.top + (frame.clientTop + pixels(style.paddingTop)) * scaleY;
  return { left, top, right: left + (frame.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight)) * scaleX,
    bottom: top + (frame.clientHeight - pixels(style.paddingTop) - pixels(style.paddingBottom)) * scaleY, scaleX, scaleY };
}

function clipAncestors(rect, element) {
  const doc = element.ownerDocument, win = doc.defaultView;
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    // Root overflow belongs to the viewport. Its bounding rect moves when the
    // document scrolls and its client size describes only one screen.
    if (ancestor === doc.documentElement || ancestor === doc.scrollingElement) continue;
    const style = win.getComputedStyle(ancestor);
    if (ancestor === doc.body) {
      const rootStyle = win.getComputedStyle(doc.documentElement);
      if (rootStyle.overflowX === 'visible' && rootStyle.overflowY === 'visible') continue;
    }
    // Non-replaced inline boxes don't clip overflow and have zero client sizes.
    if (style.display === 'inline' || style.display === 'contents') continue;
    const x = /^(hidden|clip|scroll|auto)$/.test(style.overflowX), y = /^(hidden|clip|scroll|auto)$/.test(style.overflowY);
    if (!x && !y) continue;
    const bounds = ancestor.getBoundingClientRect();
    const scaleX = bounds.width / (ancestor.offsetWidth || bounds.width || 1), scaleY = bounds.height / (ancestor.offsetHeight || bounds.height || 1);
    rect = clipRect(rect, { left: bounds.left + ancestor.clientLeft * scaleX, right: bounds.left + (ancestor.clientLeft + ancestor.clientWidth) * scaleX,
      top: bounds.top + ancestor.clientTop * scaleY, bottom: bounds.top + (ancestor.clientTop + ancestor.clientHeight) * scaleY }, x, y);
  }
  return rect;
}

export function readingViewport(element) {
  const win = element.ownerDocument.defaultView;
  let viewport = clipAncestors(viewportRect(win), element);
  try {
    const frame = win.frameElement;
    if (frame) {
      const box = frameContentBox(frame), outer = clipRect(readingViewport(frame), box);
      if (box.scaleX > 0 && box.scaleY > 0) viewport = clipRect(viewport, {
        left: (outer.left - box.left) / box.scaleX, right: (outer.right - box.left) / box.scaleX,
        top: (outer.top - box.top) / box.scaleY, bottom: (outer.bottom - box.top) / box.scaleY
      });
    }
  } catch { /* Cross-origin parent. */ }
  return viewport;
}

export function anchorRect(anchor, hostDoc, point) {
  const rects = [...anchor.getClientRects()];
  const rect = point && rects.find(rect => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom)
    || rects[0] || anchor.getBoundingClientRect();
  let result = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, win = anchor.ownerDocument.defaultView;
  try {
    while (win !== hostDoc.defaultView) {
      const frame = win.frameElement;
      if (!frame) break;
      const box = frameContentBox(frame);
      result = { left: box.left + result.left * box.scaleX, right: box.left + result.right * box.scaleX,
        top: box.top + result.top * box.scaleY, bottom: box.top + result.bottom * box.scaleY };
      win = win.parent;
    }
  } catch { /* Keep the nearest accessible viewport. */ }
  return result;
}
