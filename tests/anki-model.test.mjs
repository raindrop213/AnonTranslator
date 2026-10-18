import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { defaultAnkiFront, defaultAnkiBack, defaultAnkiCSS } from '../src/services/anki-model.js';

function cardRuntime(word, pronunciation, entries = []) {
  const attributes = new Map(), timers = [], calls = { word: 0, sentence: 0 };
  const audios = Object.fromEntries(['word', 'sentence'].map(kind => [kind, { pause() {}, play() { calls[kind]++; return Promise.resolve(); } }]));
  let readingRemoved = false;
  const reading = { textContent: pronunciation, remove() { readingRemoved = true; } };
  const wordNode = { get textContent() { return word + (readingRemoved ? '' : pronunciation); }, getAttribute() { return 'word'; } };
  const sentenceNode = { getAttribute() { return 'sentence'; } }, search = { href: '' };
  const container = () => ({ children: [], appendChild(node) { this.children.push(node); } });
  const tabs = container(), panels = container();
  const root = {
    isConnected: true,
    hasAttribute: key => attributes.has(key), setAttribute: (key, value) => attributes.set(key, value),
    querySelector(selector) {
      if (selector === '.at-anki-spelling') return { textContent: word };
      if (selector === '.at-anki-word') return wordNode;
      if (selector === '.at-anki-reading') return readingRemoved ? null : reading;
      if (selector === '.at-anki-search') return search;
      if (selector === '.at-anki-data') return { textContent: JSON.stringify(entries) };
      if (selector === '.at-anki-tabs') return tabs;
      if (selector === '.at-anki-panels') return panels;
      const kind = selector.match(/^\[data-at-audio="(word|sentence)"\]( audio)?$/);
      if (kind) return kind[2] ? audios[kind[1]] : { querySelector: name => name === 'audio' ? audios[kind[1]] : null };
      return null;
    },
    querySelectorAll(selector) { return selector === '[data-at-play]' ? [wordNode, sentenceNode] : selector === 'audio' ? Object.values(audios) : []; }
  };
  const context = vm.createContext({
    document: {
      querySelector: () => root,
      createElement(tag) { return { tagName: tag, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }; }
    },
    DOMParser: class { parseFromString(html) { return { body: { innerHTML: html }, querySelectorAll() { return []; } }; } },
    setTimeout: callback => timers.push(callback)
  });
  const execute = () => vm.runInContext(defaultAnkiBack.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  return { execute, search, timers, calls, tabs, panels, wordNode, sentenceNode, readingRemoved: () => readingRemoved };
}

test('back uses ruby while the front keeps the reading hidden, with compact centered content', () => {
  assert.match(defaultAnkiBack, /<ruby>\s*<span class="at-anki-spelling">\{\{Word\}\}<\/span>\s*\{\{#Reading\}\}<rt class="at-anki-reading">/);
  assert.doesNotMatch(defaultAnkiFront, /\{\{Reading\}\}/);
  assert.match(defaultAnkiCSS, /grid-template-columns:\s*minmax\(64px,1fr\) minmax\(0,auto\) minmax\(64px,1fr\)/);
  assert.match(defaultAnkiCSS, /font-size:\s*\.36em/);
  assert.doesNotMatch(defaultAnkiCSS, /padding-top:\s*20px/);
});

test('ruby equality removes only the annotation and search queries the visible word without its reading', () => {
  const same = cardRuntime('かな', 'かな'); same.execute();
  assert.equal(same.readingRemoved(), true);
  assert.equal(same.wordNode.textContent, 'かな');
  const different = cardRuntime('猫 & 犬', 'ねこ と いぬ'); different.execute();
  assert.equal(different.readingRemoved(), false);
  assert.equal(different.search.href, 'https://www.google.com/search?q=' + encodeURIComponent('猫 & 犬'));
});

test('word autoplay remains once per answer root and both word and sentence stay playable', () => {
  const runtime = cardRuntime('猫', 'ねこ'); runtime.execute(); runtime.execute();
  assert.equal(runtime.timers.length, 1);
  runtime.timers[0]();
  assert.deepEqual(runtime.calls, { word: 1, sentence: 0 });
  runtime.wordNode.onclick();
  let prevented = false;
  runtime.sentenceNode.onkeydown({ key: 'Enter', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(runtime.calls, { word: 2, sentence: 1 });
});

test('dictionary tabs stay isolated, with a scriptless CSP and escaped stylesheet closing tags', () => {
  const runtime = cardRuntime('猫', 'ねこ', [
    { id: 'weblio', name: 'Weblio', html: '<p>词条一</p><img src="local.png">', styles: 'p{color:red}</STYLE><script>parent.attack()</script>' },
    { id: 'moji', name: 'MOJi', html: '<p>词条二</p>' }
  ]);
  runtime.execute();
  assert.equal(runtime.tabs.children.length, 2);
  const frame = runtime.panels.children[0];
  assert.doesNotMatch(frame.attributes.sandbox, /allow-scripts|allow-same-origin/);
  assert.match(frame.srcdoc, /Content-Security-Policy/);
  assert.match(frame.srcdoc, /default-src 'none'; script-src 'none'/);
  assert.match(frame.srcdoc, /base-uri 'none'; form-action 'none'/);
  assert.match(frame.srcdoc, /< \/style><script>parent\.attack\(\)<\/script>/);
  assert.match(frame.srcdoc, /<img src="local.png">/);
  runtime.tabs.children[1].onclick();
  assert.equal(runtime.panels.children[0].hidden, true);
  assert.equal(runtime.panels.children[1].hidden, false);
});
