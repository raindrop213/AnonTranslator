import { normalizeSetting } from './settings.js';

export async function migratePanelPreferences(store, storage) {
  const records = [
    ['anon-glass-material-v3', { transparency: 'panelTransparency', blur: 'panelBlur' }],
    ['anon-glass-background-options-v1', { fit: 'panelBackgroundFit' }]
  ];
  for (const [recordKey, fields] of records) {
    const text = storage.getItem(recordKey);
    if (text === null) continue;
    let saved;
    try { saved = JSON.parse(text); } catch { /* Invalid old records have no usable values. */ }
    for (const [field, key] of Object.entries(fields)) {
      if (saved?.[field] === undefined) continue;
      let value;
      try { value = normalizeSetting(key, saved[field]); } catch { continue; }
      await store.set(key, value);
    }
    // Only remove the duplicate record after all useful values were saved.
    storage.removeItem(recordKey);
  }
}

export function mountMaterial(env) {
  const { document, preferences } = env;
  const root = document.documentElement;
  root.dataset.readerMode = 'true';
  const shell = document.querySelector('.settings-shell');
  const controls = document.createElement('div');
  controls.className = 'widget-surface-controls';
  controls.innerHTML = `<label for="widget-transparency"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v16m0-13 5 5m-5 0 4 4m-4-8 4 4"/></svg><span>背景透明度</span></label><input type="range" id="widget-transparency" data-surface-transparency min="0" max="100" step="1" aria-label="背景透明度"><output data-surface-transparency-output for="widget-transparency"></output>`;
  shell.querySelector('.settings-footer').append(controls);
  function apply() {
    const state = { transparency: preferences.get('panelTransparency'), blur: preferences.get('panelBlur') };
    const alpha = (100 - state.transparency) / 100;
    root.style.setProperty('--surface-alpha', alpha.toFixed(3));
    root.style.setProperty('--surface-blur', state.blur + 'px');
    shell.querySelectorAll('input[data-surface-transparency]').forEach(input => { input.value = String(state.transparency); });
    document.querySelectorAll('[data-surface-transparency-output]').forEach(output => { output.textContent = state.transparency + '%'; });
    document.querySelectorAll('[data-surface-blur]').forEach(input => { input.value = String(state.blur); });
    document.querySelectorAll('[data-surface-blur-output]').forEach(output => { output.textContent = state.blur + ' px'; });
    root.dataset.surfaceTransparency = String(state.transparency);
  }
  shell.addEventListener('input', event => {
    const key = event.target.matches('input[data-surface-transparency]') ? 'panelTransparency'
      : event.target.matches('input[data-surface-blur]') ? 'panelBlur' : null;
    if (key) void preferences.set(key, Number(event.target.value)).catch(() => {});
  });
  document.addEventListener('glass:reset', apply);
  apply();
  return { refresh: apply };
}
