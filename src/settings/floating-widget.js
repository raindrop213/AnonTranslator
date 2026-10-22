// Floating avatar, docking and panel transitions for one settings instance.
export function mountFloatingWidget(env) {
  const { window, document, localStorage, icon, requestAnimationFrame, cancelAnimationFrame, getComputedStyle, CustomEvent, ResizeObserver, performance } = env;
  const panel = document.querySelector('.settings-shell');
  const handle = panel && panel.querySelector('.settings-header');
  if (!panel || !handle) return null;
  const panelScroll = panel.querySelector('#panel-scroll, .panel-scroll');
  const storageKey = 'anon-glass-floating-widget-v1';
  const orbSize = 44;
  const imageSize = 36;
  const margin = 12;
  const tuck = orbSize - 18;
  const dockDistance = 40;
  const panelDockDistance = 24;
  const docks = ['', 'left', 'right', 'top', 'bottom'];
  const clamp = (value, low, high) => Math.min(Math.max(low, value), Math.max(low, high));
  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let saved;
  try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}
  const hasSavedOrb = Boolean(saved && saved.orb && finite(saved.orb.x) && finite(saved.orb.y));
  const initialViewport = viewport();
  const state = {
    mode: saved && saved.mode === 'collapsed' ? 'collapsed' : 'open',
    followOrb: Boolean(saved && saved.followOrb),
    panel: {
      x: saved && saved.panel && finite(saved.panel.x) ? saved.panel.x : initialViewport.width - 440 - 28,
      y: saved && saved.panel && finite(saved.panel.y) ? saved.panel.y : 80
    },
    orb: {
      x: hasSavedOrb ? saved.orb.x : initialViewport.width - orbSize - 28,
      y: hasSavedOrb ? saved.orb.y : 104,
      dock: saved && saved.orb && docks.includes(saved.orb.dock) ? saved.orb.dock : ''
    }
  };
  let phase = '';
  let transition = null;
  let drag = null;
  let suppressClickUntil = 0;
  let resizeFrame = 0;
  let scrollRestoreFrame = 0;
  let savedScrollTop = null;

  panel.id = 'floating-settings';
  panel.tabIndex = -1;
  document.body.append(panel);
  handle.title = '拖动标题栏或头像移动设置；拖到屏幕边缘后自动收起';

  // This empty, noninteractive slot reserves header space. It never owns an image.
  const oldBrand = handle.querySelector('.app-icon, #widget-brand-toggle, #widget-avatar-anchor');
  const avatarAnchor = document.createElement('div');
  avatarAnchor.id = 'widget-avatar-anchor';
  avatarAnchor.className = 'app-icon widget-avatar-anchor';
  avatarAnchor.setAttribute('aria-hidden', 'true');
  if (oldBrand) oldBrand.replaceWith(avatarAnchor);
  else handle.prepend(avatarAnchor);
  const obsoleteCollapse = handle.querySelector('#collapse-settings');
  if (obsoleteCollapse) obsoleteCollapse.remove();

  // Exactly one real avatar button and one image exist throughout every state.
  const orb = document.createElement('button');
  orb.id = 'settings-orb';
  orb.type = 'button';
  orb.className = 'glass settings-orb';
  orb.setAttribute('aria-controls', panel.id);
  orb.style.width = orbSize + 'px';
  orb.style.height = orbSize + 'px';
  if (icon) {
    const image = document.createElement('img');
    image.src = icon;
    image.alt = '';
    image.draggable = false;
    image.style.width = imageSize + 'px';
    image.style.height = imageSize + 'px';
    image.setAttribute('aria-hidden', 'true');
    orb.append(image);
  } else {
    orb.innerHTML = '<svg aria-hidden="true" style="width:36px;height:36px"><use href="#i-book"/></svg>';
  }
  document.body.insertBefore(orb, panel);

  const style = document.createElement('style');
  style.id = 'glass-floating-position';
  style.textContent = `
    #floating-settings { position:fixed; margin:0; transform-origin:0 0; }
    #floating-settings.is-resizing { min-width:0; min-height:0; max-width:none; }
    #floating-settings.is-resizing > * { position:absolute; left:var(--motion-left); top:var(--motion-top);
      width:var(--motion-width); height:var(--motion-height); margin:0; flex:none; }
    #floating-settings .settings-header { cursor:grab; touch-action:none; }
    #floating-settings .settings-header button,
    #floating-settings .settings-header input,
    #floating-settings .settings-header label { cursor:pointer; }
    #widget-avatar-anchor { width:44px; height:44px; min-width:44px; flex-shrink:0;
      visibility:hidden; pointer-events:none; padding:0; background:none; border:0; box-shadow:none; }
    #settings-orb { position:fixed; margin:0; width:44px; height:44px; padding:0;
      display:grid; place-items:center; touch-action:none; cursor:move; opacity:1; visibility:visible;
      transform-origin:50% 50%; transition:transform .18s ease, box-shadow .2s, background .2s, opacity .2s; }
    #settings-orb img { object-fit:contain; pointer-events:none; }
    #settings-orb[data-widget-state="collapsed"][data-dock]:not([data-dock=""]):not(:hover, :focus-visible, .is-peeking, .is-dragging, .is-animating) { opacity:.5; }
    #settings-orb[data-widget-state="collapsed"][data-dock="left"] { transform:translateX(-26px) rotate(-120deg); }
    #settings-orb[data-widget-state="collapsed"][data-dock="right"] { transform:translateX(26px) rotate(120deg); }
    #settings-orb[data-widget-state="collapsed"][data-dock="top"] { transform:translateY(-26px) rotate(-120deg); }
    #settings-orb[data-widget-state="collapsed"][data-dock="bottom"] { transform:translateY(26px) rotate(120deg); }
    #settings-orb[data-widget-state="open"],
    #settings-orb[data-widget-state].is-peeking, #settings-orb[data-widget-state].is-dragging,
    #settings-orb[data-widget-state="open"]:active,
    #settings-orb[data-dock=""]:active { transform:none; }
    #floating-settings.is-dragging, #settings-orb.is-dragging,
    #settings-orb.is-animating { transition:none; }
    #floating-settings.is-dragging .settings-header, body.is-dragging #settings-orb { cursor:grabbing; }
    #floating-settings.is-animating, #settings-orb.is-animating { pointer-events:none; }
    body.is-dragging, body.is-dragging * { user-select:none !important; -webkit-user-select:none !important; }
    #floating-settings[hidden], #settings-orb[hidden] { display:none !important; }
    @media (prefers-reduced-motion:reduce) { #settings-orb { transition:none; } }
  `;
  document.head.append(style);

  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (_) {}
  }

  function panelSize() {
    return { width: panel.offsetWidth || 440, height: panel.offsetHeight || 600 };
  }

  function placeIcon(x, y) {
    orb.style.left = x + 'px';
    orb.style.top = y + 'px';
  }

  function alignIconToHeader() {
    if (panel.hidden) return;
    const rect = avatarAnchor.getBoundingClientRect();
    placeIcon(rect.left + rect.width / 2 - orbSize / 2, rect.top + rect.height / 2 - orbSize / 2);
  }

  function clampPanel() {
    const view = viewport();
    const size = panelSize();
    state.panel.x = clamp(state.panel.x, margin, view.width - size.width - margin);
    state.panel.y = clamp(state.panel.y, margin, view.height - size.height - margin);
    panel.style.left = Math.round(state.panel.x) + 'px';
    panel.style.top = Math.round(state.panel.y) + 'px';
    if (state.mode === 'open' && !phase) alignIconToHeader();
  }

  function clampOrb() {
    const view = viewport();
    state.orb.x = clamp(state.orb.x, margin, view.width - orbSize - margin);
    state.orb.y = clamp(state.orb.y, margin, view.height - orbSize - margin);
    if (state.orb.dock === 'left') state.orb.x = 0;
    if (state.orb.dock === 'right') state.orb.x = Math.max(0, view.width - orbSize);
    if (state.orb.dock === 'top') state.orb.y = 0;
    if (state.orb.dock === 'bottom') state.orb.y = Math.max(0, view.height - orbSize);
    if (state.mode === 'collapsed') placeIcon(state.orb.x, state.orb.y);
    else if (!phase) alignIconToHeader();
  }

  function dockOffset() {
    return {
      left: { x: -tuck, y: 0, angle: -120 },
      right: { x: tuck, y: 0, angle: 120 },
      top: { x: 0, y: -tuck, angle: -120 },
      bottom: { x: 0, y: tuck, angle: 120 }
    }[state.orb.dock] || { x: 0, y: 0, angle: 0 };
  }

  function dockTransform() {
    const offset = dockOffset();
    return 'translate(' + offset.x + 'px,' + offset.y + 'px) rotate(' + offset.angle + 'deg)';
  }

  function captureIcon() {
    const rect = orb.getBoundingClientRect();
    const transform = getComputedStyle(orb).transform;
    const values = transform === 'none' ? [1, 0] : transform.slice(transform.indexOf('(') + 1, -1).split(',').map(Number);
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
      angle: Math.atan2(values[1] || 0, values[0] === undefined ? 1 : values[0]) * 180 / Math.PI };
  }

  function status() {
    const dock = state.orb.dock;
    [document.body, panel, orb].forEach(element => {
      element.dataset.widgetState = state.mode;
      element.dataset.dock = dock;
      element.dataset.animation = phase;
      element.classList.toggle('is-animating', Boolean(phase));
    });
    orb.setAttribute('aria-expanded', String(state.mode === 'open'));
    orb.setAttribute('aria-label', state.mode === 'open' ? '收起设置面板' : '展开设置面板');
    const dockName = { left: '左', right: '右', top: '上', bottom: '下' }[dock];
    orb.title = state.mode === 'open'
      ? '拖动头像移动设置 · 单击收起'
      : dockName ? '已停靠' + dockName + '侧 · 点击展开设置；可拖动移出边缘'
        : '点击打开设置 · 拖到屏幕边缘自动收起 · 方向键微调位置';
    document.dispatchEvent(new CustomEvent('glasswidgetchange', {
      detail: { state: state.mode, dock, animation: phase, panel: { ...state.panel }, orb: { ...state.orb } }
    }));
  }

  function restoreScroll() {
    if (panelScroll && savedScrollTop !== null) panelScroll.scrollTo({ top: savedScrollTop, behavior: 'instant' });
  }

  function restoreScrollAfterFocus() {
    restoreScroll();
    cancelAnimationFrame(scrollRestoreFrame);
    scrollRestoreFrame = requestAnimationFrame(() => { if (state.mode === 'open') restoreScroll(); });
  }

  function snapshotScroll() {
    cancelAnimationFrame(scrollRestoreFrame);
    if (panelScroll) { savedScrollTop = panelScroll.scrollTop; restoreScroll(); }
  }

  function snapOrb() {
    const view = viewport();
    const distances = [
      ['left', state.orb.x], ['right', view.width - state.orb.x - orbSize],
      ['top', state.orb.y], ['bottom', view.height - state.orb.y - orbSize]
    ].sort((a, b) => a[1] - b[1]);
    state.orb.dock = distances[0][1] <= dockDistance ? distances[0][0] : '';
    clampOrb();
  }

  function positionPanelByOrb() {
    const view = viewport();
    const size = panelSize();
    const rightSpace = view.width - state.orb.x - orbSize - margin;
    state.panel.x = rightSpace >= size.width ? state.orb.x + orbSize + margin : state.orb.x - size.width - margin;
    state.panel.y = state.orb.y - 20;
    if (state.orb.dock === 'top') state.panel.y = orbSize + margin;
    if (state.orb.dock === 'bottom') state.panel.y = view.height - orbSize - size.height - margin;
    clampPanel();
  }

  function restorePanelPosition() {
    if (state.followOrb) positionPanelByOrb();
    else clampPanel();
    state.followOrb = false;
  }

  function newTransition(kind, options) {
    const token = { kind, options, animations: [], cancelled: false };
    transition = token;
    phase = kind;
    status();
    return token;
  }

  function animate(token, element, frames, options) {
    if (motionPreference.matches || !element.animate) return Promise.resolve();
    const animation = element.animate(frames, { fill: 'both', ...options });
    token.animations.push(animation);
    return animation.finished.catch(() => {});
  }

  function animateContents(token, opening, offset, duration, easing) {
    const folded = 'translate(' + offset.x + 'px,' + offset.y + 'px)';
    return Promise.all(Array.from(panel.children).map(child => {
      animate(token, child, [{ opacity: opening ? 0 : 1 }, { opacity: opening ? 1 : 0 }], {
        duration: opening ? 180 : 120, delay: opening ? 95 : 170, easing: 'ease'
      });
      return animate(token, child, [
        { transform: opening ? folded : 'translate(0px,0px)' },
        { transform: opening ? 'translate(0px,0px)' : folded }
      ], { duration, easing });
    }));
  }

  function lockContents() {
    const bounds = panel.getBoundingClientRect();
    const anchor = avatarAnchor.getBoundingClientRect();
    Array.from(panel.children).forEach(child => {
      const rect = child.getBoundingClientRect();
      child.style.setProperty('--motion-left', rect.left - bounds.left - panel.clientLeft + 'px');
      child.style.setProperty('--motion-top', rect.top - bounds.top - panel.clientTop + 'px');
      child.style.setProperty('--motion-width', rect.width + 'px');
      child.style.setProperty('--motion-height', rect.height + 'px');
    });
    panel.classList.add('is-resizing');
    // Keep the header's avatar slot centered on the single icon as the frame closes.
    return { x: orbSize / 2 - (anchor.left + anchor.width / 2 - bounds.left),
      y: orbSize / 2 - (anchor.top + anchor.height / 2 - bounds.top) };
  }

  function unlockContents() {
    panel.classList.remove('is-resizing');
    Array.from(panel.children).forEach(child => {
      ['left', 'top', 'width', 'height'].forEach(name => child.style.removeProperty('--motion-' + name));
    });
  }

  function moveIcon(token, source, targetTransform, duration, easing) {
    const baseX = parseFloat(orb.style.left) + orbSize / 2;
    const baseY = parseFloat(orb.style.top) + orbSize / 2;
    const start = 'translate(' + (source.x - baseX) + 'px,' + (source.y - baseY) + 'px) rotate(' + source.angle + 'deg)';
    // The avatar's own animation deliberately has no scale, opacity or visibility keys.
    return animate(token, orb, [{ transform: start }, { transform: targetTransform }], { duration, easing });
  }

  function finishTransition(token, allowFocus = true) {
    if (transition !== token) return;
    transition = null;
    token.cancelled = true;
    panel.hidden = state.mode === 'collapsed';
    orb.hidden = state.mode === 'collapsed' && Boolean(token.options.dismiss);
    orb.classList.remove('is-peeking');
    token.animations.forEach(animation => animation.cancel());
    unlockContents();
    phase = '';
    if (state.mode === 'open') {
      restorePanelPosition();
      alignIconToHeader();
    } else clampOrb();
    status();
    if (state.mode === 'open') {
      if (allowFocus && token.options.focus !== false) orb.focus({ preventScroll: true });
      restoreScrollAfterFocus();
    } else {
      if (allowFocus && token.options.focus) {
        orb.focus({ preventScroll: true });
        orb.classList.add('is-peeking');
      }
    }
    save();
  }

  async function open(options = {}) {
    if (phase || state.mode === 'open' || drag) return;
    const reveal = orb.hidden || options.reveal;
    orb.hidden = false;
    // Capture before status/layout changes: dock translation and live rotation are physical state.
    const source = captureIcon();
    state.mode = 'open';
    panel.hidden = false;
    restorePanelPosition();
    alignIconToHeader();
    restoreScroll();
    const size = panelSize();
    const left = panel.offsetLeft, top = panel.offsetTop;
    const contentOffset = lockContents();
    const token = newTransition('opening', options);
    const duration = state.orb.dock ? 420 : 360;
    const easing = 'cubic-bezier(.4,0,.2,1)';
    const contents = animateContents(token, true, contentOffset, duration, easing);
    const unfolding = animate(token, panel, [
      { left: source.x - orbSize / 2 + 'px', top: source.y - orbSize / 2 + 'px', width: orbSize + 'px', height: orbSize + 'px', opacity: 0, offset: 0 },
      { opacity: 1, offset: .15 },
      { left: left + 'px', top: top + 'px', width: size.width + 'px', height: size.height + 'px', opacity: 1, offset: 1 }
    ], { duration, easing });
    const moving = moveIcon(token, source, 'translate(0px,0px) rotate(0deg)', duration, easing);
    const appearing = reveal ? animate(token, orb, [{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-out' }) : Promise.resolve();
    orb.style.removeProperty('opacity');
    await Promise.all([unfolding, moving, appearing, contents]);
    if (!token.cancelled && transition === token) finishTransition(token);
  }

  async function collapse(options = {}) {
    if (phase || state.mode === 'collapsed' || drag) return;
    const source = captureIcon();
    snapshotScroll();
    if (options.orbAt) {
      state.followOrb = true;
      state.orb.x = options.orbAt.x;
      state.orb.y = options.orbAt.y;
      state.orb.dock = options.orbAt.dock;
    } else if (!state.orb.dock) {
      state.orb.x = source.x - orbSize / 2;
      state.orb.y = source.y - orbSize / 2;
      snapOrb();
    }
    const size = panelSize();
    const left = panel.offsetLeft, top = panel.offsetTop;
    const contentOffset = lockContents();
    state.mode = 'collapsed';
    const token = newTransition('closing', options);
    orb.classList.remove('is-peeking');
    clampOrb();
    const offset = dockOffset();
    const targetX = state.orb.x + offset.x;
    const targetY = state.orb.y + offset.y;
    const duration = state.orb.dock ? 420 : 360;
    const easing = 'cubic-bezier(.4,0,.2,1)';
    const contents = animateContents(token, false, contentOffset, duration, easing);
    const folding = animate(token, panel, [
      { left: left + 'px', top: top + 'px', width: size.width + 'px', height: size.height + 'px' },
      { left: targetX + 'px', top: targetY + 'px', width: orbSize + 'px', height: orbSize + 'px' }
    ], { duration, easing });
    const moving = moveIcon(token, source, dockTransform(), duration, easing);
    const disappearing = options.dismiss ? animate(token, orb, [{ opacity: 1 }, { opacity: 0 }], { duration, easing: 'ease-in' }) : Promise.resolve();
    await Promise.all([folding, moving, disappearing, contents]);
    if (!token.cancelled && transition === token) finishTransition(token);
  }

  function startDrag(event, kind) {
    if (phase || drag || !event.isPrimary || event.button !== 0) return;
    const fromIcon = event.currentTarget === orb;
    if (kind === 'panel' && !fromIcon && event.target.closest('button, input, select, textarea, a, label, summary, [role="button"], [contenteditable="true"]')) return;
    const element = kind === 'panel' ? panel : orb;
    const rect = element.getBoundingClientRect();
    suppressClickUntil = 0;
    const captureHandle = fromIcon ? orb : event.currentTarget;
    drag = { kind, element, handle: captureHandle, pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY,
      left: kind === 'orb' ? rect.left + rect.width / 2 - orbSize / 2 : rect.left,
      top: kind === 'orb' ? rect.top + rect.height / 2 - orbSize / 2 : rect.top,
      moved: false };
    try { captureHandle.setPointerCapture(event.pointerId); } catch (_) {}
    if (kind === 'panel' && !fromIcon) event.preventDefault();
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    drag.dx = dx;
    drag.dy = dy;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      document.body.classList.add('is-dragging');
      drag.element.classList.add('is-dragging');
      orb.classList.add('is-dragging');
      if (drag.kind === 'orb') {
        state.followOrb = true;
        state.orb.dock = '';
        orb.classList.remove('is-peeking');
        if (document.activeElement === orb) orb.blur();
        status();
      }
    }
    event.preventDefault();
    const view = viewport();
    if (drag.kind === 'panel') {
      state.panel.x = drag.left + dx;
      state.panel.y = drag.top + dy;
      clampPanel();
    } else {
      state.orb.x = clamp(drag.left + dx, 0, view.width - orbSize);
      state.orb.y = clamp(drag.top + dy, 0, view.height - orbSize);
      placeIcon(state.orb.x, state.orb.y);
    }
  }

  function panelEdge(completed) {
    const view = viewport();
    const size = panelSize();
    const dx = completed.dx || 0;
    const dy = completed.dy || 0;
    const rawX = completed.left + dx;
    const rawY = completed.top + dy;
    const horizontalSpace = view.width - size.width - 2 * margin;
    const verticalSpace = view.height - size.height - 2 * margin;
    const horizontalIntent = Math.abs(dx) >= 18 && (horizontalSpace >= 48 || Math.abs(dx) >= Math.abs(dy));
    const verticalIntent = Math.abs(dy) >= 18 && (verticalSpace >= 48 || Math.abs(dy) >= Math.abs(dx));
    const edges = [];
    if (horizontalIntent && dx < 0) edges.push(['left', rawX]);
    if (horizontalIntent && dx > 0) edges.push(['right', view.width - rawX - size.width]);
    if (verticalIntent && dy < 0) edges.push(['top', rawY]);
    if (verticalIntent && dy > 0) edges.push(['bottom', view.height - rawY - size.height]);
    edges.sort((a, b) => a[1] - b[1]);
    return edges.length && edges[0][1] <= panelDockDistance ? edges[0][0] : '';
  }

  function edgeOrbPosition(side, event) {
    const view = viewport();
    let x = clamp(event.clientX - orbSize / 2, margin, view.width - orbSize - margin);
    let y = clamp(event.clientY - orbSize / 2, margin, view.height - orbSize - margin);
    if (side === 'left') x = 0;
    if (side === 'right') x = Math.max(0, view.width - orbSize);
    if (side === 'top') y = 0;
    if (side === 'bottom') y = Math.max(0, view.height - orbSize);
    return { x, y, dock: side };
  }

  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const completed = drag;
    drag = null;
    const cancelled = event.type === 'pointercancel' || event.type === 'lostpointercapture';
    document.body.classList.remove('is-dragging');
    completed.element.classList.remove('is-dragging');
    orb.classList.remove('is-dragging');
    if (completed.moved) {
      suppressClickUntil = performance.now() + 400;
      if (completed.kind === 'orb') { snapOrb(); orb.classList.remove('is-peeking'); }
      else clampPanel();
    }
    try {
      if (completed.handle.hasPointerCapture(event.pointerId)) completed.handle.releasePointerCapture(event.pointerId);
    } catch (_) {}
    status();
    save();
    if (completed.moved && completed.kind === 'panel' && !cancelled) {
      const side = panelEdge(completed);
      if (side) collapse({ focus: false, orbAt: edgeOrbPosition(side, event) });
      else { state.followOrb = false; state.orb.dock = ''; status(); save(); }
    }
  }

  handle.addEventListener('pointerdown', event => startDrag(event, 'panel'));
  orb.addEventListener('pointerdown', event => startDrag(event, state.mode === 'open' ? 'panel' : 'orb'));
  [handle, orb].forEach(element => element.addEventListener('lostpointercapture', finishDrag));
  window.addEventListener('pointerdown', () => { if (!drag) suppressClickUntil = 0; }, true);
  window.addEventListener('pointermove', moveDrag, { passive: false });
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);
  [panel, orb].forEach(element => element.addEventListener('click', event => {
    if (phase || (event.detail > 0 && performance.now() < suppressClickUntil)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true));
  orb.addEventListener('click', event => {
    if (state.mode === 'open') collapse({ focus: event.detail === 0 });
    else open();
  });
  orb.addEventListener('pointerleave', () => {
    if (!phase && !drag && document.activeElement !== orb) orb.classList.remove('is-peeking');
  });
  orb.addEventListener('focus', () => {
    if (state.mode === 'collapsed' && !phase && !drag) orb.classList.add('is-peeking');
  });
  orb.addEventListener('blur', () => { if (!phase && !drag) orb.classList.remove('is-peeking'); });

  function onEscape(event) {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || phase || state.mode !== 'open' || document.querySelector('dialog[open]')) return;
    event.preventDefault(); event.stopPropagation(); collapse({ focus: true });
  }
  panel.addEventListener('keydown', onEscape);
  orb.addEventListener('keydown', event => {
    if (event.key === 'Escape') { onEscape(event); return; }
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!directions[event.key] || phase) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 32 : 8;
    if (state.mode === 'open') {
      state.panel.x += directions[event.key][0] * step;
      state.panel.y += directions[event.key][1] * step;
      state.followOrb = false; state.orb.dock = ''; clampPanel();
    } else {
      const previous = { ...state.orb };
      state.orb.dock = '';
      state.orb.x += directions[event.key][0] * step;
      state.orb.y += directions[event.key][1] * step;
      clampOrb();
      if (previous.x !== state.orb.x || previous.y !== state.orb.y || previous.dock !== state.orb.dock) state.followOrb = true;
    }
    status(); save();
  });

  function resize() {
    if (drag) finishDrag({ type: 'pointercancel', pointerId: drag.pointerId });
    if (transition) finishTransition(transition, false);
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (!panel.hidden) clampPanel();
      clampOrb(); save();
    });
  }
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(() => {
    if (phase || panel.hidden) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { clampPanel(); clampOrb(); save(); });
  }).observe(panel);
  window.addEventListener('blur', () => {
    if (drag) finishDrag({ type: 'pointercancel', pointerId: drag.pointerId });
    if (transition) finishTransition(transition, false);
  });
  if (motionPreference.addEventListener) motionPreference.addEventListener('change', () => {
    if (motionPreference.matches && transition) finishTransition(transition, false);
  });

  panel.hidden = false;
  clampPanel();
  if (!hasSavedOrb) {
    const rect = avatarAnchor.getBoundingClientRect();
    state.orb.x = rect.left + rect.width / 2 - orbSize / 2;
    state.orb.y = rect.top + rect.height / 2 - orbSize / 2;
  }
  clampOrb();
  state.mode = 'collapsed';
  clampOrb();
  panel.hidden = true;
  orb.style.opacity = '0';
  status();
  const controller = {
    open, collapse,
    close() {
      env.selects?.close?.();
      return collapse({ dismiss: true, focus: false });
    },
    getState: () => ({ ...JSON.parse(JSON.stringify(state)), animation: phase })
  };
  orb.style.removeProperty('opacity');
  return controller;
}
