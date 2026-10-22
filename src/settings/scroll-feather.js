// Fade scrolling content into the panel's continuous glass background.
export function mountScrollFeather(env) {
  const { window, document, requestAnimationFrame, ResizeObserver, MutationObserver } = env;
  const scroller = document.querySelector('#panel-scroll');
  if (!scroller) return null;
  const shell = scroller.closest('.settings-shell');
  const depth = 28;
  let frame = 0;
  let previousStart = '', previousEnd = '';
  const observedViews = new Set();

  function update() {
    frame = 0;
    // While the floating panel is hidden it has no measurable scroll viewport.
    // Keep its last mask until the opening mutation/resize gives real geometry.
    if (shell?.hidden || scroller.clientHeight < 1) return;
    const maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const position = Math.max(0, Math.min(maximum, scroller.scrollTop));
    const start = Math.min(depth, position).toFixed(2) + 'px';
    const end = Math.min(depth, Math.max(0, maximum - position)).toFixed(2) + 'px';
    if (start !== previousStart) {
      scroller.style.setProperty('--scroll-feather-start', start);
      previousStart = start;
    }
    if (end !== previousEnd) {
      scroller.style.setProperty('--scroll-feather-end', end);
      previousEnd = end;
    }
    const atStart = String(position <= .5);
    const atEnd = String(maximum - position <= .5);
    if (scroller.dataset.scrollStart !== atStart) scroller.dataset.scrollStart = atStart;
    if (scroller.dataset.scrollEnd !== atEnd) scroller.dataset.scrollEnd = atEnd;
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  const resizeObserver = window.ResizeObserver ? new ResizeObserver(schedule) : null;
  function observeViews() {
    if (!resizeObserver) return;
    scroller.querySelectorAll('.panel-view').forEach(view => {
      if (!observedViews.has(view)) {
        observedViews.add(view);
        resizeObserver.observe(view);
      }
    });
    observedViews.forEach(view => {
      if (!view.isConnected) {
        resizeObserver.unobserve(view);
        observedViews.delete(view);
      }
    });
  }

  scroller.dataset.scrollFeather = 'true';
  scroller.addEventListener('scroll', schedule, { passive: true });
  scroller.addEventListener('input', schedule, { passive: true });
  scroller.addEventListener('change', schedule, { passive: true });
  // Details open/close changes can alter the scroll limit without adding nodes.
  scroller.addEventListener('toggle', schedule, true);
  window.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  document.addEventListener('glass:reset', schedule);
  if (resizeObserver) resizeObserver.observe(scroller);
  observeViews();
  const mutationObserver = new MutationObserver(records => {
    if (records.some(record => record.type === 'childList')) observeViews();
    schedule();
  });
  mutationObserver.observe(shell || scroller, {
    childList: true, subtree: true, attributes: true,
    // Deliberately omit style and our own data attributes to avoid observer loops.
    attributeFilter: ['hidden', 'open', 'data-widget-state', 'data-animation']
  });
  document.fonts?.ready.then(schedule);
  update();
  const api = { refresh: schedule };
  return api;
}
