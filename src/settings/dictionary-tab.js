// Dictionary settings, downloads and service permissions.
export function mountDictionaryTab(env, store, platform, ctx) {
  const doc = env.document, view = env.window;
  const $ = selector => doc.querySelector(selector);
  const $$ = selector => [...doc.querySelectorAll(selector)];
  const aliases = {
    plugin: 'pluginSwitch', dictionary: 'dictionaryEnabled', furigana: 'dictionaryFurigana',
    baseForm: 'dictionaryBaseForm', popup: 'dictionaryPopupMode', weblio: 'dictionaryWeblio', moji: 'dictionaryMoji'
  };
  const providers = ['weblio', 'moji'];
  const button = $('#data-button'), description = $('#data-description'), progress = $('#data-progress');
  const search = $('#search-url'), searchHelp = $('#search-help');
  const removers = [], permissions = new Map(), permissionErrors = new Map(), requesting = new Set();
  let mounted = true, busy = '', failure = '', poll, revision = 0, permissionRevision = 0, dragging = '';
  let data = { state: 'checking', completed: 0, total: 12 };
  const listen = (target, name, listener, options) => {
    target?.addEventListener(name, listener, options);
    removers.push(() => target?.removeEventListener(name, listener, options));
  };
  const notifyError = error => ctx.notify(error?.message || '操作失败，请重试。');
  const order = () => {
    const saved = ctx.get('dictionaryOrder');
    return [...new Set([...(Array.isArray(saved) ? saved.filter(id => providers.includes(id)) : []), ...providers])];
  };
  const set = (key, value, message) => {
    try { ctx.set(key, value, message); return true; }
    catch (error) { notifyError(error); render(); return false; }
  };

  function renderPermissions() {
    providers.forEach(id => {
      const control = $(`[data-permission="${id}"]`);
      if (!control) return;
      const label = control.querySelector('span');
      const manager = !platform.hasServiceAccess;
      const allowed = permissions.get(id);
      control.dataset.allowed = manager ? 'manager' : String(allowed === true);
      control.disabled = requesting.has(id);
      const text = manager ? '脚本管理器授权' : requesting.has(id) ? '正在授权…'
        : permissionErrors.has(id) ? '权限检查失败' : allowed === true ? '接口已授权'
        : allowed === false ? '点击授权接口' : '检查权限…';
      if (label) label.textContent = text;
      control.title = permissionErrors.get(id) || (manager ? '跨域访问由脚本管理器在首次请求时授权' : allowed ? '接口已授权' : '点击授权此词典接口');
    });
  }

  function renderData() {
    const installed = data.state === 'installed', installing = data.state === 'installing';
    const total = Math.max(1, Number(data.total) || 12);
    const completed = Math.max(0, Math.min(total, Number(data.completed) || 0));
    const percent = Math.round(completed / total * 100);
    $('#data-card').dataset.state = data.state;
    button.disabled = Boolean(busy) || installing || data.state === 'checking';
    button.classList.toggle('install', !installed);
    button.setAttribute('aria-label', installed ? '删除分词数据' : '安装分词数据');
    button.title = installed ? '删除分词数据' : '安装分词数据';
    if (busy === 'remove') button.textContent = '删除中';
    else if (busy === 'install' || installing) button.textContent = '安装中';
    else if (installed) button.innerHTML = '<svg><use href="#i-trash"/></svg>';
    else button.textContent = data.state === 'partial' ? '继续安装' : data.state === 'error' ? '重试' : '安装';
    if (failure) description.textContent = failure;
    else if (installed) description.innerHTML = '<svg><use href="#i-check"/></svg><span>已安装，可离线使用</span>';
    else if (busy === 'remove') description.textContent = '正在删除分词数据…';
    else if (busy === 'install' || installing) description.textContent = `正在安装离线数据… ${percent}%（${completed}/${total}）`;
    else if (data.state === 'checking') description.textContent = '正在检查分词数据…';
    else if (data.state === 'partial') description.textContent = `已完成 ${completed}/${total} 个文件，可继续安装`;
    else if (data.state === 'error') description.textContent = data.error || '安装未完成，请重试';
    else description.textContent = '安装后，即可启用离线分词';
    progress.style.width = installing ? `calc((100% - 28px) * ${completed / total})` : '0';
    $('#dictionary-enabled').disabled = !ctx.get('pluginSwitch') || !installed || Boolean(busy);
  }

  function render() {
    if (!mounted) return;
    const plugin = Boolean(ctx.get('pluginSwitch')), dictionary = Boolean(ctx.get('dictionaryEnabled'));
    $$('[data-setting]').forEach(control => {
      const alias = control.dataset.setting, key = aliases[alias];
      if (!key) return;
      let value = ctx.get(key);
      if (alias === 'popup') value = value === 'independent' ? 'window' : 'page';
      if (control.type === 'checkbox') control.checked = Boolean(value);
      else control.value = value;
      control.disabled = alias !== 'plugin' && (!plugin || (!dictionary && alias !== 'dictionary'));
    });
    $$('.dependent').forEach(row => row.classList.toggle('is-disabled', !plugin || !dictionary));
    search.disabled = !plugin || !dictionary;
    const value = String(ctx.get('dictionarySearchURL') || '');
    if (doc.activeElement !== search) {
      search.value = value; search.removeAttribute('aria-invalid');
      searchHelp.innerHTML = '填写完整网址，用 <code>{word}</code> 代替查询词。';
    }
    try {
      const hostname = new URL(value).hostname.replace(/^www\./, '');
      $('#search-host').textContent = hostname === 'google.com' ? 'Google' : hostname;
    } catch { $('#search-host').textContent = ''; }
    const container = $('#services');
    order().forEach((id, index, ordered) => {
      const card = $(`[data-provider="${id}"]`);
      if (container.children[index] !== card) container.insertBefore(card, container.children[index] || null);
      card.querySelector('.order-index').textContent = String(index + 1).padStart(2, '0');
      card.querySelector('[data-move="up"]').disabled = index === 0;
      card.querySelector('[data-move="down"]').disabled = index === ordered.length - 1;
    });
    $('#service-notice').hidden = !plugin || !dictionary || ctx.get('dictionaryWeblio') || ctx.get('dictionaryMoji');
    renderData(); renderPermissions(); env.selects?.refresh?.();
  }

  function accept(response) {
    if (!response || !['missing', 'partial', 'installing', 'installed', 'error'].includes(response.state)) throw new Error('无法读取分词数据状态');
    data = response; failure = '';
  }
  function schedulePoll() {
    view.clearTimeout(poll);
    if (mounted && !busy && data.state === 'installing') poll = view.setTimeout(() => { void refreshStatus(); }, 1000);
  }
  async function refreshStatus() {
    if (!mounted || busy) return;
    view.clearTimeout(poll);
    const current = ++revision;
    try {
      const response = await platform.send({ action: 'tokenizer_data_status' });
      if (!mounted || current !== revision) return;
      accept(response);
    } catch (error) {
      if (!mounted || current !== revision) return;
      data = { ...data, state: 'error' }; failure = error.message || '无法检查分词数据，请重试';
    }
    render(); schedulePoll();
  }
  async function refreshPermissions() {
    if (!mounted || !platform.hasServiceAccess) { renderPermissions(); return; }
    const current = ++permissionRevision;
    await Promise.all(providers.map(async id => {
      try {
        const allowed = await platform.hasServiceAccess(id, store.values);
        if (!mounted || current !== permissionRevision) return;
        permissions.set(id, Boolean(allowed)); permissionErrors.delete(id);
      } catch (error) {
        if (!mounted || current !== permissionRevision) return;
        permissions.delete(id); permissionErrors.set(id, error.message);
      }
    }));
    if (mounted && current === permissionRevision) renderPermissions();
  }

  async function runDataAction(remove) {
    if (!mounted || busy || data.state === 'installing') return;
    // Invoke the permission request in the original click handler's task.
    let access;
    try {
      if (!remove && platform.requestServiceAccess) access = platform.requestServiceAccess('tokenizer', store.values);
    } catch (error) { notifyError(error); return; }
    const current = ++revision;
    busy = remove ? 'remove' : 'install'; failure = ''; view.clearTimeout(poll); render();
    try {
      if (access !== undefined && !await access) throw new Error('分词数据下载接口未授权');
      await ctx.flush?.();
      if (!mounted || current !== revision) return;
      const response = await platform.send({ action: remove ? 'tokenizer_data_remove' : 'tokenizer_data_install' });
      if (!mounted || current !== revision) return;
      accept(response);
      if (remove) { ctx.set('dictionaryEnabled', false); await ctx.flush?.(); ctx.notify('分词数据已删除'); }
      else if (data.state === 'installed') ctx.notify('分词数据已安装');
    } catch (error) {
      if (!mounted || current !== revision) return;
      failure = error.message || (remove ? '删除失败，请重试' : '安装失败，请重试');
      if (!remove) data = { ...data, state: 'error' };
      ctx.notify(failure);
    } finally {
      if (mounted && current === revision) { busy = ''; render(); schedulePoll(); }
    }
  }

  $$('[data-setting]').forEach(control => listen(control, 'change', () => {
    const alias = control.dataset.setting, key = aliases[alias];
    if (!key) return;
    if (alias === 'dictionary' && control.checked && (data.state !== 'installed' || busy)) {
      control.checked = Boolean(ctx.get(key)); ctx.notify('请先安装完整的分词数据。'); return;
    }
    const value = control.type === 'checkbox' ? control.checked : alias === 'popup' ? control.value === 'window' ? 'independent' : 'page' : control.value;
    set(key, value); render();
  }));
  listen(search, 'input', () => {
    try {
      ctx.set('dictionarySearchURL', search.value.trim());
      search.setCustomValidity(''); search.removeAttribute('aria-invalid');
      searchHelp.innerHTML = '填写完整网址，用 <code>{word}</code> 代替查询词。';
      render();
    } catch (error) {
      search.setCustomValidity(error.message); search.setAttribute('aria-invalid', 'true');
      searchHelp.textContent = error.message;
    }
  });
  listen(button, 'click', () => {
    if (button.disabled) return;
    if (data.state === 'installed') ctx.dialog('删除分词数据？', '删除后会关闭分词查词。需要时可以重新安装。', '删除数据', () => { void runDataAction(true); });
    else void runDataAction(false);
  });

  function moveProvider(id, target) {
    const ordered = order(), previous = ordered.indexOf(id);
    if (target < 0 || target >= ordered.length || target === previous) return;
    ordered.splice(previous, 1); ordered.splice(target, 0, id);
    if (set('dictionaryOrder', ordered, '已调整词典查询顺序')) {
      render(); $(`[data-provider="${id}"] .drag-handle`).focus();
    }
  }
  $$('[data-move]').forEach(control => listen(control, 'click', () => {
    const id = control.closest('[data-provider]').dataset.provider;
    moveProvider(id, order().indexOf(id) + (control.dataset.move === 'up' ? -1 : 1));
  }));
  const clearDrag = () => {
    dragging = ''; $$('#services .service-card').forEach(card => card.classList.remove('dragging', 'drop-target'));
  };
  $$('#services .drag-handle').forEach(handle => {
    const card = handle.closest('[data-provider]'), id = card.dataset.provider;
    listen(handle, 'keydown', event => {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const ordered = order(), target = event.key === 'Home' ? 0 : event.key === 'End' ? ordered.length - 1 : ordered.indexOf(id) + (event.key === 'ArrowUp' ? -1 : 1);
      moveProvider(id, target);
    });
    listen(handle, 'dragstart', event => {
      dragging = id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); card.classList.add('dragging');
    });
    listen(handle, 'dragend', clearDrag);
  });
  $$('#services .service-card').forEach(card => {
    listen(card, 'dragover', event => {
      if (!dragging || dragging === card.dataset.provider) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'move'; card.classList.add('drop-target');
    });
    listen(card, 'dragleave', event => { if (!card.contains(event.relatedTarget)) card.classList.remove('drop-target'); });
    listen(card, 'drop', event => {
      if (!dragging) return;
      event.preventDefault(); moveProvider(dragging, order().indexOf(card.dataset.provider)); clearDrag();
    });
  });
  $$('[data-permission]').forEach(control => listen(control, 'click', () => {
    const id = control.dataset.permission;
    if (!platform.requestServiceAccess) { ctx.notify('首次查词时，请在脚本管理器的跨域提示中授权此接口。'); return; }
    if (permissions.get(id)) { ctx.notify('此词典接口已授权。'); return; }
    let request;
    try { request = platform.requestServiceAccess(id, store.values); }
    catch (error) { notifyError(error); return; }
    requesting.add(id); renderPermissions();
    void Promise.resolve(request).then(granted => {
      if (!mounted) return;
      permissions.set(id, Boolean(granted)); permissionErrors.delete(id);
      ctx.notify(granted ? '词典接口已授权' : '未授予词典接口权限');
    }).catch(error => { if (mounted) { permissionErrors.set(id, error.message); notifyError(error); } })
      .finally(() => { requesting.delete(id); if (mounted) renderPermissions(); });
  }));
  const unsubscribe = store.subscribe(() => render());
  const unwatchPermissions = platform.watchServiceAccess?.(() => { void refreshPermissions(); });
  const onVisible = () => { if (doc.visibilityState !== 'hidden') void refreshStatus(); };
  listen(view, 'focus', onVisible); listen(doc, 'visibilitychange', onVisible);
  render();
  return {
    render,
    async refresh() { if (mounted) { render(); await Promise.all([refreshStatus(), refreshPermissions()]); } },
    destroy() {
      mounted = false; revision++; permissionRevision++; view.clearTimeout(poll);
      unsubscribe(); unwatchPermissions?.(); removers.forEach(remove => remove());
    }
  };
}
