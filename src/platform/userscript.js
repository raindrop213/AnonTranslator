import { defaults, createSettingsStore } from '../settings/settings.js';
import { gmRequest } from '../services/request.js';
import { cachedTranslation, cancelTranslation } from '../services/translate.js';
import { vitsSpeakers, vitsAudio, huoshanAudio } from '../services/speech.js';
import { checkLatestVersion } from '../services/update.js';
import { createReader } from '../reader/reader.js';
import { mountSettings } from '../settings/panel.js';
import readerCss from '../reader/reader.css';
import panelCss from '../settings/panel.css';

const platform = {
  updateURL: 'https://greasyfork.org/zh-CN/scripts/599752-anontranslator',
  useWebAudio: true,
  async getSettings() {
    return Object.fromEntries(Object.keys(defaults).map(key => [key, GM_getValue(key, defaults[key])]));
  },
  async setSettings(patch) {
    for (const [key, value] of Object.entries(patch)) GM_setValue(key, value);
  },
  watchSettings(listener) {
    for (const key of Object.keys(defaults)) GM_addValueChangeListener(key, (_key, _old, value) => listener({ [key]: value }));
  },
  async send(message) {
    switch (message.action) {
      case 'check_update': return checkLatestVersion(gmRequest);
      case 'cancel_translation': return cancelTranslation(message.scope);
      case 'translate': return cachedTranslation(message, gmRequest);
      case 'vits_speakers': return vitsSpeakers(message.settings, gmRequest);
      case 'vits_audio': return vitsAudio(message.text, message.settings, gmRequest);
      case 'huosh_audio': return huoshanAudio(message.text, message.settings, gmRequest);
      default: throw new Error('未知请求');
    }
  },
  async copy(text) { GM_setClipboard(text, 'text'); }
};

// EPUB readers put chapters in Blob or sandboxed frames where Tampermonkey
// cannot start a separate script. The parent can still bind their documents.
function mountReaders(store) {
  const documents = new Map(), frames = new Map();
  const scan = () => {
    const liveDocuments = new Set(), liveFrames = new Set();
    const visit = doc => {
      if (!doc?.documentElement || liveDocuments.has(doc)) return;
      liveDocuments.add(doc);
      if (!documents.has(doc)) {
        let reader, style;
        if (!doc.documentElement.hasAttribute('data-at-reader')) {
          style = doc.createElement('style'); style.textContent = readerCss;
          (doc.head || doc.documentElement).append(style);
          reader = createReader(platform, store, doc);
        }
        const observer = new MutationObserver(records => {
          const hasFrame = node => node.nodeType === 1 && (node.matches('iframe,frame') || node.querySelector('iframe,frame'));
          if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(hasFrame))) scan();
        });
        observer.observe(doc.documentElement, { childList: true, subtree: true });
        documents.set(doc, { reader, observer, style });
      }
      for (const frame of doc.querySelectorAll('iframe,frame')) {
        liveFrames.add(frame);
        if (!frames.has(frame)) {
          frame.addEventListener('load', scan); frames.set(frame, scan);
        }
        try { visit(frame.contentDocument); } catch { /* Cross-origin frames run their own userscript. */ }
      }
    };
    visit(document);
    for (const [doc, entry] of documents) {
      if (liveDocuments.has(doc)) continue;
      entry.observer.disconnect(); entry.reader?.destroy(); entry.style?.remove(); documents.delete(doc);
    }
    for (const [frame, listener] of frames) {
      if (liveFrames.has(frame)) continue;
      frame.removeEventListener('load', listener); frames.delete(frame);
    }
  };
  scan();
}

(async () => {
  // Same-origin chapters share their parent's settings and event handlers.
  if (window.parent !== window) {
    try { if (window.parent.document) return; } catch { /* Independent cross-origin reader. */ }
  }
  const store = createSettingsStore(platform);
  await store.init();
  mountReaders(store);
  let panel;
  GM_registerMenuCommand('AnonTranslator 设置', () => {
    if (panel) return;
    const host = document.createElement('div');
    host.setAttribute('data-at-ui', '');
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = panelCss;
    const overlay = document.createElement('div'); overlay.className = 'at-dialog';
    const box = document.createElement('div'); box.className = 'at-dialog-panel';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'AnonTranslator 设置');
    const button = document.createElement('button'); button.className = 'at-close'; button.textContent = '关闭 ×';
    const unmount = mountSettings(box, store, platform);
    const close = () => { unmount(); host.remove(); panel = null; document.removeEventListener('keydown', onEscape); };
    const onEscape = event => { if (event.code === 'Escape') close(); };
    button.addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', onEscape);
    box.prepend(button); overlay.append(box); root.append(style, overlay);
    document.documentElement.append(host); panel = host;
    button.focus();
  });
})().catch(error => console.error('AnonTranslator:', error));
