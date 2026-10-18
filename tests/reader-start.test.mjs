import test from 'node:test';
import assert from 'node:assert/strict';
import { isReaderUIFrame, startReader } from '../src/reader/reader.js';

test('owned dictionary frames stop before settings subscriptions or reader UI creation', async () => {
  const doc = { defaultView: { frameElement: { hasAttribute: name => name === 'data-at-ui' } } };
  const platform = new Proxy({}, { get() { assert.fail('UI frame must not initialize platform services'); } });
  assert.equal(await startReader(platform, doc), undefined);
});

test('detached dictionary documents do not initialize a second reader', async () => {
  const doc = { documentElement: { hasAttribute: name => name === 'data-at-ui' } };
  const platform = new Proxy({}, { get() { assert.fail('detached UI must not initialize reader services'); } });
  assert.equal(await startReader(platform, doc), undefined);
});

test('accessible EPUB frames leave initialization to their outer reader realm', async () => {
  const parent = {};
  parent.parent = parent;
  parent.document = { defaultView: parent, documentElement: {} };
  const doc = { documentElement: { hasAttribute: () => false }, defaultView: { parent, frameElement: { hasAttribute: () => false } } };
  const platform = new Proxy({}, { get() { assert.fail('same-origin chapter must use the parent reader'); } });
  assert.equal(await startReader(platform, doc), undefined);
});

test('real chapter and inaccessible-parent frames still initialize their reader', async () => {
  const crossOriginView = { get frameElement() { throw new DOMException('Cross-origin access', 'SecurityError'); } };
  for (const defaultView of [
    { frameElement: null },
    { frameElement: { hasAttribute: () => false } },
    crossOriginView
  ]) {
    const doc = { defaultView }, stop = new Error('settings reached');
    assert.equal(isReaderUIFrame(doc), false);
    let subscribed = false;
    await assert.rejects(startReader({
      watchSettings() { subscribed = true; },
      getSettings() { throw stop; }
    }, doc), error => error === stop);
    assert.equal(subscribed, true);
  }
});
