// Fixed fields keep the dictionary UI, settings, and AnkiConnect model in sync.
export const ankiFields = ['Word', 'Reading', 'Sentence', 'Translation', 'WordAudio',
  'SentenceAudio', 'Image', 'DictionaryData', 'SourceURL', 'SourceTitle'];

// Each template stays self-contained after being copied into Anki.
// HTML5 audio keeps sentence playback out of Anki's automatic sound-tag queue.
const playbackCode = `
  function playAudio(kind) {
    var container = root.querySelector('[data-at-audio="' + kind + '"]');
    if (!container) return;
    var audio = container.querySelector('audio');
    if (audio) {
      root.querySelectorAll('audio').forEach(function (item) { item.pause(); });
      try { audio.currentTime = 0; } catch (_) {}
      var playing = audio.play();
      if (playing && playing.catch) playing.catch(function () {});
      return;
    }
    // Existing notes may still contain Anki's standard sound replay buttons.
    var replay = container.querySelector('.replay-button,.soundLink,a,button');
    if (replay) replay.click();
  }
  root.querySelectorAll('[data-at-play]').forEach(function (element) {
    element.onclick = function () {
      playAudio(element.getAttribute('data-at-play'));
    };
    element.onkeydown = function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      playAudio(element.getAttribute('data-at-play'));
    };
  });
`;
const hiddenAudio = `<div class="at-anki-hidden" aria-hidden="true">
    <div data-at-audio="word">{{WordAudio}}</div>
    <div data-at-audio="sentence">{{SentenceAudio}}</div>
  </div>`;

export const defaultAnkiFront = `<main class="at-anki-card at-anki-question">
  ${hiddenAudio}
  <div class="at-anki-word" data-at-play="word" role="button" tabindex="0" title="播放单词">{{Word}}</div>
  {{#Sentence}}
  <div class="at-anki-sentence" data-at-play="sentence" role="button" tabindex="0" title="播放例句">{{Sentence}}</div>
  {{/Sentence}}
</main>
<script>
(function () {
  var root = document.querySelector('.at-anki-question');
  if (!root) return;
${playbackCode}
})();
</script>`;

export const defaultAnkiBack = `<main class="at-anki-card at-anki-answer">
  ${hiddenAudio}
  <header class="at-anki-header">
    <span class="at-anki-search-space" aria-hidden="true">Google ↗</span>
    <div class="at-anki-word" data-at-play="word" role="button" tabindex="0" title="播放单词">
      <ruby>
        <span class="at-anki-spelling">{{Word}}</span>
        {{#Reading}}<rt class="at-anki-reading">{{Reading}}</rt>{{/Reading}}
      </ruby>
    </div>
    <a class="at-anki-search" href="https://www.google.com/search" target="_blank" rel="noreferrer" title="Google 搜索当前单词">Google ↗</a>
  </header>
  {{#Sentence}}
  <div class="at-anki-sentence" data-at-play="sentence" role="button" tabindex="0" title="播放例句">{{Sentence}}</div>
  {{/Sentence}}
  {{#Translation}}
  <div class="at-anki-translation">{{Translation}}</div>
  {{/Translation}}
  {{#Image}}
  <div class="at-anki-image">{{Image}}</div>
  {{/Image}}
  <section class="at-anki-dictionaries">
    <nav class="at-anki-tabs"></nav>
    <div class="at-anki-panels"></div>
  </section>
  <div class="at-anki-data" hidden>{{DictionaryData}}</div>
  {{#SourceURL}}
  <footer><a href="{{SourceURL}}" target="_blank" rel="noreferrer">{{SourceTitle}}</a></footer>
  {{/SourceURL}}
</main>
<script>
(function () {
  var root = document.querySelector('.at-anki-answer');
  if (!root) return;
${playbackCode}
  var spelling = root.querySelector('.at-anki-spelling');
  var plainWord = (spelling || root.querySelector('.at-anki-word')).textContent.trim();
  var reading = root.querySelector('.at-anki-reading');
  if (reading && reading.textContent.trim() === plainWord) reading.remove();
  var search = root.querySelector('.at-anki-search');
  if (search) {
    search.href = 'https://www.google.com/search?q=' + encodeURIComponent(plainWord);
  }
  if (!root.hasAttribute('data-at-word-autoplay') && root.querySelector('[data-at-audio="word"] audio')) {
    root.setAttribute('data-at-word-autoplay', '');
    setTimeout(function () {
      if (root.isConnected) playAudio('word');
    }, 100);
  }
  var entries;
  try { entries = JSON.parse(root.querySelector('.at-anki-data').textContent || '[]'); }
  catch (_) { return; }
  var tabs = root.querySelector('.at-anki-tabs');
  var panels = root.querySelector('.at-anki-panels');
  function prepare(entry) {
    var doc = new DOMParser().parseFromString(entry.html || '', 'text/html');
    doc.querySelectorAll('script,iframe,object,embed,form,input,textarea,button,link,meta,base').forEach(function (node) {
      node.remove();
    });
    doc.querySelectorAll('a').forEach(function (link) {
      if (!/^(https?:|#)/i.test(link.getAttribute('href') || '')) link.removeAttribute('href');
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
    // Sandbox and CSP keep even manually edited dictionary fields scriptless.
    var policy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; "
      + "img-src 'self' https: data: file: http://127.0.0.1:* http://localhost:*; "
      + "font-src 'self' https: data:; base-uri 'none'; form-action 'none'";
    var styles = [
      entry.styles || '',
      'html, body { margin: 0 !important; min-width: 0 !important; width: auto !important; background: white !important; }',
      'body { padding: 6px; overflow-wrap: anywhere; }',
      '#base { width: auto !important; min-width: 0 !important; }',
      'img { max-width: 100%; height: auto; }'
    ].join('\\n').replace(new RegExp('</style', 'gi'), '< /style');
    return '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="'
      + policy + '"><style>' + styles + '</style></head><body>' + doc.body.innerHTML + '</body></html>';
  }
  function activate(index) {
    Array.from(tabs.children).forEach(function (tab, i) {
      tab.setAttribute('aria-selected', String(i === index));
    });
    Array.from(panels.children).forEach(function (panel, i) {
      panel.hidden = i !== index;
    });
  }
  (Array.isArray(entries) ? entries : []).forEach(function (entry, index) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = entry.name || entry.id || '词典';
    button.setAttribute('role', 'tab');
    button.onclick = function () { activate(index); };
    tabs.appendChild(button);
    var frame = document.createElement('iframe');
    frame.title = button.textContent;
    frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
    frame.srcdoc = prepare(entry);
    panels.appendChild(frame);
  });
  activate(0);
})();
</script>`;

export const defaultAnkiCSS = `
/* Card layout */
.card {
  --at-anki-accent: #a33b35;
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;
  font-size: 19px;
  text-align: center;
  color: #243044;
  background: #fff;
}

.at-anki-card {
  position: relative;
  max-width: 900px;
  margin: auto;
  padding: 0;
}

.at-anki-hidden {
  display: none !important;
}

/* Word and reading */
.at-anki-header {
  display: grid;
  grid-template-columns: minmax(64px,1fr) minmax(0,auto) minmax(64px,1fr);
  align-items: center;
  gap: 4px;
}

.at-anki-word {
  min-width: 0;
  font-size: 36px;
  font-weight: 600;
  line-height: 1.4;
  text-align: center;
  overflow-wrap: anywhere;
}

.at-anki-word ruby {
  ruby-position: over;
}

.at-anki-reading {
  font-size: .36em;
  font-weight: 400;
  line-height: 1.1;
  color: #697386;
}

/* Playback and search */
.at-anki-card [data-at-play] {
  cursor: pointer;
}

.at-anki-card [data-at-play]:focus-visible {
  outline: 1px solid var(--at-anki-accent);
  outline-offset: 2px;
}

.at-anki-search,
.at-anki-search-space {
  font-size: 12px;
  white-space: nowrap;
  text-decoration: none;
}

.at-anki-search {
  justify-self: end;
  color: var(--at-anki-accent);
}

.at-anki-search-space {
  justify-self: start;
  visibility: hidden;
}

/* Sentence, translation and image */
.at-anki-sentence {
  white-space: pre-wrap;
  margin: 6px 0 0;
  font-size: 19px;
  line-height: 1.55;
  text-align: center;
}

.at-anki-sentence b {
  background-color: #fff0a8;
}

.nightMode .at-anki-sentence b {
  color: inherit;
  background-color: #4a3d18;
}

.at-anki-translation {
  white-space: pre-wrap;
  margin: 3px 0 6px;
  color: #697386;
  font-size: 16px;
  line-height: 1.5;
  text-align: center;
}

.at-anki-image {
  text-align: center;
}

.at-anki-image img {
  display: block;
  max-width: 100%;
  max-height: 400px;
  margin: auto;
  object-fit: contain;
}

/* Dictionary tabs */
.at-anki-tabs {
  display: flex;
  gap: 4px;
  margin: 8px 0 3px;
  border-bottom: 1px solid #d8dee8;
}

.at-anki-tabs button {
  border: 0;
  background: transparent;
  padding: 5px 8px;
  color: #697386;
  cursor: pointer;
}

.at-anki-tabs button[aria-selected="true"] {
  color: var(--at-anki-accent);
  border-bottom: 2px solid var(--at-anki-accent);
}

.at-anki-panels iframe {
  display: block;
  width: 100%;
  height: 440px;
  max-height: 65vh;
  border: 0;
  background: white;
}

.at-anki-panels iframe[hidden] {
  display: none;
}

/* Source and night mode */
.at-anki-card footer {
  font-size: 12px;
  margin-top: 6px;
}

.at-anki-card footer a {
  color: #697386;
}

.nightMode,
.nightMode .card {
  --at-anki-accent: #e99c91;
}

.nightMode .at-anki-card {
  color: #e6e8ee;
}

.nightMode .at-anki-reading,
.nightMode .at-anki-translation {
  color: #afb7c7;
}
`;
