import test from 'node:test';
import assert from 'node:assert/strict';
import { cropCoordinates, captureRegion } from '../src/reader/screenshot-region.js';

test('region selection maps CSS coordinates to device pixels in either drag direction', () => {
  const viewport = { width: 1000, height: 800 }, image = { width: 2000, height: 1600 };
  assert.deepEqual(cropCoordinates({ x: 100, y: 150 }, { x: 400, y: 500 }, viewport, image), { x: 200, y: 300, width: 600, height: 700 });
  assert.deepEqual(cropCoordinates({ x: 400, y: 500 }, { x: 100, y: 150 }, viewport, image), { x: 200, y: 300, width: 600, height: 700 });
});

test('dragging beyond the viewport and fractional scaling never adds pixels outside the image', () => {
  assert.deepEqual(cropCoordinates({ x: -20, y: -10 }, { x: 1200, y: 900 }, { width: 1000, height: 800 }, { width: 1500, height: 1200 }), { x: 0, y: 0, width: 1500, height: 1200 });
  const region = cropCoordinates({ x: 1, y: 0 }, { x: 4, y: 4 }, { width: 4, height: 4 }, { width: 2, height: 2 });
  assert.equal(region.x + region.width, 2);
  assert.equal(region.height, 2);
});

test('userscript sharing is requested by the clicked window while the source remains the crop target', async () => {
  const attributes = new Set(), stop = new Error('picker cancelled');
  const doc = { documentElement: { hasAttribute: key => attributes.has(key), setAttribute: key => attributes.add(key), removeAttribute: key => attributes.delete(key) },
    defaultView: { navigator: { mediaDevices: { getDisplayMedia() { assert.fail('source window must not request sharing for a detached click'); } } } } };
  let requested = null;
  const clickedWindow = { navigator: { mediaDevices: { async getDisplayMedia(options) { requested = options; throw stop; } } } };
  await assert.rejects(captureRegion(doc, {}, clickedWindow), error => error === stop);
  assert.equal(requested.preferCurrentTab, false);
  assert.equal(requested.selfBrowserSurface, 'exclude');
  assert.equal(attributes.size, 0);
});
