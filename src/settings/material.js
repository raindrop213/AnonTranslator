import { defaults } from './settings.js';

export function mountMaterial(env) {
  const { document, localStorage } = env;
  const root = document.documentElement;
  root.dataset.readerMode = 'true';
  const shell = document.querySelector('.settings-shell');
  const storageKey = 'anon-glass-material-v3';
  const initialState = () => ({ transparency: defaults.panelTransparency, blur: defaults.panelBlur });
  let state = initialState();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Number.isFinite(saved?.transparency)) state.transparency = Math.max(0, Math.min(100, saved.transparency));
    if (Number.isFinite(saved?.blur)) state.blur = Math.max(0, Math.min(20, saved.blur));
  } catch { /* The controls remain usable without storage. */ }
  const controls = document.createElement('div');
  controls.className = 'widget-surface-controls';
  controls.innerHTML = `<label for="widget-transparency"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4v16m0-13 5 5m-5 0 4 4m-4-8 4 4"/></svg><span>背景透明度</span></label><input type="range" id="widget-transparency" data-surface-transparency min="0" max="100" step="1" aria-label="背景透明度"><output data-surface-transparency-output for="widget-transparency"></output>`;
  shell.querySelector('.settings-footer').append(controls);
  function apply(save = true) {
    const alpha = (100 - state.transparency) / 100;
    root.style.setProperty('--surface-alpha', alpha.toFixed(3));
    root.style.setProperty('--surface-card-alpha', (alpha * .36).toFixed(3));
    root.style.setProperty('--surface-input-alpha', (alpha * .50).toFixed(3));
    root.style.setProperty('--surface-tint-alpha', (alpha * .45).toFixed(3));
    root.style.setProperty('--surface-shine-alpha', (alpha * .40).toFixed(3));
    root.style.setProperty('--surface-blur', state.blur + 'px');
    shell.querySelectorAll('input[data-surface-transparency]').forEach(input => { input.value = String(state.transparency); });
    document.querySelectorAll('[data-surface-transparency-output]').forEach(output => { output.textContent = state.transparency + '%'; });
    document.querySelectorAll('[data-surface-blur]').forEach(input => { input.value = String(state.blur); });
    document.querySelectorAll('[data-surface-blur-output]').forEach(output => { output.textContent = state.blur + ' px'; });
    root.dataset.surfaceTransparency = String(state.transparency);
    if (save) try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Session-only preview. */ }
  }
  shell.addEventListener('input', event => {
    if (event.target.matches('input[data-surface-transparency]')) state.transparency = Number(event.target.value);
    else if (event.target.matches('input[data-surface-blur]')) state.blur = Number(event.target.value);
    else return;
    apply();
  });
  document.addEventListener('glass:reset', () => {
    state = initialState();
    apply();
  });
  apply(false);
  return { refresh: () => apply(false) };
}
