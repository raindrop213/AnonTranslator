// Website authorization owns the UI lifecycle. Showing or animating a panel
// never grants authorization, and disabled websites allocate no floating UI.
export function createSiteUI(store, mountWidget, { onError = console.error } = {}) {
  let current, mounting, disposed = false, openRevision = 0, generation = 0;
  const closing = new Set();
  const report = error => { if (!disposed) onError(error); };

  const destroyClosing = () => {
    for (const widget of closing) widget.destroy();
    closing.clear();
  };
  const retire = widget => {
    closing.add(widget);
    void Promise.resolve().then(() => closing.has(widget) ? widget.dismiss?.() : undefined).catch(report).finally(() => {
      if (closing.delete(widget)) widget.destroy();
    });
  };
  const ensure = () => {
    if (disposed || !store.values.pluginSwitch) return Promise.resolve(null);
    if (current) return Promise.resolve(current);
    if (mounting) return mounting;
    destroyClosing();
    const revision = generation;
    const task = Promise.resolve().then(mountWidget).then(widget => {
      if (disposed || revision !== generation || !store.values.pluginSwitch) { widget.destroy(); return null; }
      current = widget;
      return widget;
    });
    mounting = task;
    task.then(() => { if (mounting === task) mounting = null; }, () => { if (mounting === task) mounting = null; });
    return task;
  };
  const unsubscribe = store.subscribe((values, patch) => {
    if (!Object.hasOwn(patch, 'pluginSwitch')) return;
    if (values.pluginSwitch) void ensure().catch(report);
    else {
      openRevision++; generation++; mounting = null;
      if (current) { const widget = current; current = null; retire(widget); }
    }
  });
  const ready = ensure().catch(error => { report(error); return null; });
  return {
    ready,
    async open() {
      if (disposed) return;
      const revision = ++openRevision;
      await store.set('pluginSwitch', true);
      if (disposed || revision !== openRevision || !store.values.pluginSwitch) return;
      const widget = await ensure();
      if (!disposed && revision === openRevision && store.values.pluginSwitch) await widget?.open();
    },
    destroy() {
      if (disposed) return;
      disposed = true; openRevision++; generation++; unsubscribe();
      current?.destroy(); current = null; destroyClosing();
    }
  };
}
