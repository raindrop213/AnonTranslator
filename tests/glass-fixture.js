import { createWordReader } from '../src/reader/words.js';
import { normalizeSettings } from '../src/settings/settings.js';

// Real rendering code, isolated demo data. This entry is bundled by the local
// preview server only; it is never included in either installation artifact.
const preview = window.anonPreview;
const settings = () => ({ ...normalizeSettings(preview.readSettings()), pluginSwitch: true, dictionaryEnabled: true, dictionaryFurigana: false, dictionaryPopupMode: 'page' });
const platform = { send: message => preview.send(message), setSettings: async patch => preview.updateSettings(patch) };
const stage = document.createElement('section'); stage.dataset.atUi = ''; stage.className = 'glass-demo';
stage.innerHTML = '<div class="glass-demo-tools"><span>真实组件 · 本地释义</span><button type="button" data-glass-example>打开查词样例</button><button type="button" data-glass-direction>横排 / 竖排</button><label><input type="checkbox" data-glass-anki>制卡区</label></div><p>静かな午後、彼女は窓のそばで本を読んでいた。</p>';
const style = document.createElement('style');
style.textContent = '.glass-demo{margin:18px 0 28px;padding:16px 0;border-top:1px solid #8883;border-bottom:1px solid #8883}.glass-demo-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font:11px/1.6 system-ui;color:#68717d}.glass-demo-tools button{font:inherit;padding:3px 8px}.glass-demo-tools label{display:flex;align-items:center;gap:3px}.glass-demo p{font:22px/2.2 Georgia,"Yu Mincho",serif;margin:14px 0}.glass-demo[data-vertical] p{writing-mode:vertical-rl;height:260px;width:100%;margin:18px 0 0}.glass-demo[data-night]{color:#e2e7ed;background:#252a3180}.glass-demo[data-night] .glass-demo-tools{color:#d0d5dc}';
document.head.append(style); document.querySelector('main h1').after(stage);
const paragraph = stage.querySelector('p');
const existingPopups = new Set(document.querySelectorAll('[data-at-dictionary-popup]'));
const words = createWordReader(platform, settings, document, { show(message) { document.querySelector('#events').textContent = message; } });
const popup = [...document.querySelectorAll('[data-at-dictionary-popup]')].find(host => !existingPopups.has(host));
popup.dataset.glassFixture = '';
// Keep the tuning sample beside its controls, rather than detaching it into
// another browser window. The installed reader keeps its normal window button.
popup.shadowRoot.querySelector('.detach').hidden = true;
paragraph.addEventListener('click', event => { words.handleClick(event); });
const ready = words.render(paragraph);
const refresh = () => {
  const value = settings();
  paragraph.style.setProperty('--at-word-opacity', `${value.nightMode ? value.nightPosOpacity : value.posOpacity}%`); stage.toggleAttribute('data-night', value.nightMode);
  stage.querySelector('[data-glass-anki]').checked = value.ankiEnabled; words.refresh();
};
let queued = false;
preview.subscribe(() => {
  if (queued) return; queued = true;
  queueMicrotask(() => { queued = false; refresh(); });
});
preview.showExample = async () => {
  await ready; refresh();
  if (popup.hidden) [...paragraph.querySelectorAll('.at-word')].find(word => word.textContent === '午後')?.click();
};
stage.querySelector('[data-glass-example]').addEventListener('click', () => { void preview.showExample(); });
stage.querySelector('[data-glass-direction]').addEventListener('click', () => stage.toggleAttribute('data-vertical'));
stage.querySelector('[data-glass-anki]').addEventListener('change', event => preview.updateSettings({ ankiEnabled: event.target.checked }));
refresh();
