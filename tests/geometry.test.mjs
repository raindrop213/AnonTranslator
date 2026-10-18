import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorRect, readingViewport, frameContentBox, topDocument } from '../src/reader/geometry.js';

const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
function document(width = 1000, height = 800) {
  const win = { innerWidth: width, innerHeight: height, getComputedStyle: el => el.style, frameElement: null };
  const doc = { defaultView: win }; win.parent = win; win.document = doc;
  doc.documentElement = element(doc, rect(0, 0, width, height));
  doc.body = element(doc, rect(0, 0, width, height), doc.documentElement);
  doc.scrollingElement = doc.documentElement;
  return doc;
}
function element(doc, bounds, parent = null, style = {}) {
  return { ownerDocument: doc, parentElement: parent, style: { display: 'block', overflowX: 'visible', overflowY: 'visible', ...style },
    clientLeft: 0, clientTop: 0, clientWidth: bounds.width, clientHeight: bounds.height, offsetWidth: bounds.width, offsetHeight: bounds.height,
    getBoundingClientRect: () => bounds, getClientRects: () => [bounds] };
}
function childFrame(doc, { scale = 1, left = 0, top = 0 } = {}) {
  const child = document(600, 400), frame = element(doc, rect(left, top, 652 * scale, 476 * scale), doc.body,
    { paddingLeft: '24px', paddingRight: '24px', paddingTop: '48px', paddingBottom: '24px' });
  Object.assign(frame, { clientLeft: 2, clientTop: 2, clientWidth: 648, clientHeight: 472, offsetWidth: 652, offsetHeight: 476 });
  child.defaultView.parent = doc.defaultView; child.defaultView.frameElement = frame;
  return child;
}

test('syosetu root overflow uses the viewport after a long document has scrolled', () => {
  const doc = document();
  Object.assign(doc.documentElement, { getBoundingClientRect: () => rect(0, -4000, 1000, 9000), offsetHeight: 9000 });
  Object.assign(doc.documentElement.style, { overflowX: 'auto', overflowY: 'scroll' });
  const word = element(doc, rect(220, 540, 50, 24), doc.body);
  assert.deepEqual(readingViewport(word), { left: 0, right: 1000, top: 0, bottom: 800 });
  assert.deepEqual(anchorRect(word, doc), { left: 220, right: 270, top: 540, bottom: 564 });
});

test('body overflow propagated to a visible root is not a second viewport', () => {
  const doc = document();
  Object.assign(doc.body, { getBoundingClientRect: () => rect(0, -4000, 1000, 9000), offsetHeight: 9000, clientHeight: 800 });
  doc.body.style.overflowY = 'auto';
  const word = element(doc, rect(220, 540, 50, 24), doc.body);
  assert.deepEqual(readingViewport(word), { left: 0, right: 1000, top: 0, bottom: 800 });
});

test('inline overflow with zero client dimensions does not hide real text', () => {
  const doc = document(), inline = element(doc, rect(20, 30, 200, 30), doc.body, { display: 'inline', overflowX: 'hidden', overflowY: 'hidden' });
  inline.clientWidth = inline.clientHeight = 0;
  const word = element(doc, rect(50, 30, 30, 24), inline);
  assert.deepEqual(readingViewport(word), { left: 0, right: 1000, top: 0, bottom: 800 });
});

test('reading viewport clips nested overflow containers in each axis', () => {
  const doc = document(), outer = element(doc, rect(90, 80, 180, 240), doc.body, { overflowX: 'hidden' });
  const scroller = element(doc, rect(100, 100, 300, 200), outer, { overflowY: 'auto' });
  const word = element(doc, rect(120, 290, 40, 24), scroller);
  assert.deepEqual(readingViewport(word), { left: 90, right: 270, top: 100, bottom: 300 });
  assert.deepEqual(anchorRect(word, doc), { left: 120, right: 160, top: 290, bottom: 314 });
});

test('Bibi iframe padding, border and scale map the child content origin exactly once', () => {
  const doc = document(), child = childFrame(doc, { scale: .5, left: 100, top: 50 });
  const word = element(child, rect(200, 100, 40, 30), child.body);
  assert.deepEqual(frameContentBox(child.defaultView.frameElement), { left: 113, top: 75, right: 413, bottom: 275, scaleX: .5, scaleY: .5 });
  assert.deepEqual(anchorRect(word, doc), { left: 213, right: 233, top: 125, bottom: 140 });
});

test('nested padded frames map both ancestor coordinate systems and retain the reading viewport', () => {
  const doc = document(), child = childFrame(doc, { left: -100, top: -50 }), inner = childFrame(child, { scale: .5, left: 100, top: 50 });
  const word = element(inner, rect(200, 100, 40, 30), inner.body);
  assert.equal(topDocument(inner), doc);
  assert.deepEqual(anchorRect(word, doc), { left: 139, right: 159, top: 125, bottom: 140 });
  assert.deepEqual(readingViewport(child.body), { left: 74, right: 600, top: 0, bottom: 400 });
});

test('fragmented words choose the clicked line or the first fragment', () => {
  const doc = document(), word = element(doc, rect(10, 50, 800, 50), doc.body);
  word.getClientRects = () => [rect(10, 50, 20, 20), rect(700, 80, 30, 20)];
  assert.deepEqual(anchorRect(word, doc, { x: 710, y: 90 }), { left: 700, right: 730, top: 80, bottom: 100 });
  assert.deepEqual(anchorRect(word, doc), { left: 10, right: 30, top: 50, bottom: 70 });
});

test('visual viewport clips reading bounds while anchors keep local coordinates with inaccessible parents', () => {
  const doc = document(); doc.defaultView.visualViewport = { offsetLeft: 100, offsetTop: 200, width: 300, height: 400 };
  Object.defineProperty(doc.defaultView, 'frameElement', { get() { throw new Error('cross origin'); } });
  const word = element(doc, rect(80, 220, 50, 24), doc.body);
  assert.deepEqual(readingViewport(word), { left: 100, right: 400, top: 200, bottom: 600 });
  assert.deepEqual(anchorRect(word, doc), { left: 80, right: 130, top: 220, bottom: 244 });
});
