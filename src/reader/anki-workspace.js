import { createAnkiPanel } from './anki-panel.js';

export const ankiWorkspaceCSS = `
  .anki-workspace{display:flex;flex:1;min-height:0;min-width:0;overflow:hidden}
  .dictionary-pane{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;overflow:hidden}
  .anki-workspace[data-enabled]{display:grid}
  .anki-workspace>[hidden]{display:none!important}
  .anki-divider{position:relative;z-index:1;background:#e5e9ef;touch-action:none;border:0;padding:0;min-width:2px;min-height:2px;border-radius:0;cursor:row-resize}
  .anki-divider:after{content:'';position:absolute;inset:-2px 0;cursor:inherit}
  .anki-workspace[data-layout=right]>.anki-divider{cursor:col-resize}
  .anki-workspace[data-layout=right]>.anki-divider:after{inset:0 -2px}
  .anki-workspace[data-splitting] iframe{pointer-events:none}
  .anki-workspace[data-splitting]{user-select:none}
  :host([data-night]) .anki-divider{background:#444d59}
`;

export function createAnkiWorkspace(platform, getSettings, doc, callbacks = {}) {
  const element = doc.createElement('div'); element.className = 'anki-workspace';
  const dictionaryPane = doc.createElement('div'); dictionaryPane.className = 'dictionary-pane';
  const divider = doc.createElement('button'); divider.type = 'button'; divider.className = 'anki-divider';
  divider.setAttribute('role', 'separator'); divider.setAttribute('aria-label', '调整词典和制卡区域比例');
  const panel = createAnkiPanel(platform, getSettings, doc, callbacks);
  element.append(dictionaryPane, divider, panel.element);
  let ratio = getSettings().ankiSplit ?? .55, side = false, drag = null;
  const clamp = value => Math.max(.2, Math.min(.8, value));
  const apply = () => {
    element.dataset.layout = side ? 'right' : 'below';
    element.style.gridTemplateColumns = side ? `minmax(0,${ratio}fr) 2px minmax(0,${1 - ratio}fr)` : 'minmax(0,1fr)';
    element.style.gridTemplateRows = side ? 'minmax(0,1fr)' : `minmax(0,${ratio}fr) 2px minmax(0,${1 - ratio}fr)`;
    divider.setAttribute('aria-orientation', side ? 'vertical' : 'horizontal');
    divider.setAttribute('aria-valuemin', '20'); divider.setAttribute('aria-valuemax', '80'); divider.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  };
  const save = () => { void platform.setSettings({ ankiSplit: ratio }).catch(error => callbacks.show?.(error.message)); };
  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); divider.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, rect: element.getBoundingClientRect() }; element.setAttribute('data-splitting', '');
  });
  divider.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    ratio = clamp(side ? (event.clientX - drag.rect.left) / drag.rect.width : (event.clientY - drag.rect.top) / drag.rect.height);
    apply();
  });
  const end = event => {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null; element.removeAttribute('data-splitting'); save();
  };
  divider.addEventListener('pointerup', end); divider.addEventListener('pointercancel', end);
  divider.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    ratio = clamp(ratio + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -.05 : .05)); apply(); save();
  });
  return {
    ...panel, element, dictionaryPane, get busy() { return panel.busy; },
    reflow() { side = getSettings().ankiLayout === 'right'; apply(); },
    refresh() {
      const enabled = !!getSettings().ankiEnabled;
      element.toggleAttribute('data-enabled', enabled); divider.hidden = panel.element.hidden = !enabled;
      side = getSettings().ankiLayout === 'right';
      if (!drag) ratio = getSettings().ankiSplit ?? .55;
      apply(); panel.refresh();
    },
    destroy() { drag = null; panel.destroy(); element.remove(); }
  };
}
