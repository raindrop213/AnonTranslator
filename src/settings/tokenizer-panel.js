// Installing data is an explicit action. Reading status must never download it.
export function mountTokenizerPanel(section, store, platform, { toggle, beforeRemove = async () => {} } = {}) {
  const doc = section.ownerDocument;
  let mounted = true, revision = 0, timer, busy = '', failure = '';
  let data = { state: 'checking', completed: 0, total: 12 };
  const box = doc.createElement('div'); box.className = 'at-tokenizer-data';
  const row = doc.createElement('div'); row.className = 'at-tokenizer-actions';
  const title = doc.createElement('strong'); title.textContent = '分词数据（约 17 MB）';
  const action = doc.createElement('button'); action.type = 'button';
  row.append(title, action);
  const status = doc.createElement('p'); status.className = 'at-guide at-tokenizer-status';
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  box.append(row, status); section.prepend(box);
  const hint = doc.createElement('span'); hint.className = 'at-tokenizer-toggle-hint';
  hint.id = 'at-tokenizer-toggle-hint';
  if (toggle) { toggle.setAttribute('aria-describedby', hint.id); toggle.parentElement.append(hint); }

  function render() {
    if (!mounted) return;
    const installed = data.state === 'installed';
    const installing = data.state === 'installing';
    box.dataset.state = data.state;
    action.disabled = !!busy || installing || data.state === 'checking';
    action.textContent = busy === 'remove' ? '正在删除…' : busy === 'install' ? '正在准备…'
      : installed ? '删除' : installing ? '正在安装…' : data.state === 'partial' ? '继续安装'
      : data.state === 'error' ? '重试安装' : '安装';
    status.textContent = failure || (installed ? '分词数据已安装，可离线使用。'
      : installing ? `正在安装：已完成 ${data.completed}/${data.total} 个文件。可关闭设置，稍后查看进度。`
      : data.state === 'partial' ? `分词数据未安装完整（${data.completed}/${data.total} 个文件），可继续安装。`
      : data.state === 'error' ? (typeof data.error === 'string' && data.error.trim() ? data.error : '安装未完成，请检查网络或存储空间后重试。')
      : data.state === 'checking' ? '正在检查分词数据…' : '分词数据尚未安装。');
    hint.hidden = installed && busy !== 'remove';
    hint.textContent = store.values.dictionaryEnabled
      ? '分词查词已开启，请先安装分词数据后使用。'
      : installing || busy === 'install' ? '分词数据安装完成后即可启用。' : '请先在上方安装分词数据，再启用分词查词。';
  }
  function accept(response) {
    if (!response || !['missing', 'partial', 'installing', 'installed', 'error'].includes(response.state)) throw new Error('Invalid data status');
    const total = Math.max(1, Number(response.total) || 12);
    data = { ...response, total, completed: Math.max(0, Math.min(total, Number(response.completed) || 0)) };
    failure = '';
  }
  function schedulePoll() {
    clearTimeout(timer);
    if (mounted && !busy && data.state === 'installing') timer = setTimeout(() => { void refresh(); }, 1000);
  }
  async function refresh() {
    if (!mounted || busy) return;
    clearTimeout(timer);
    const current = ++revision;
    try {
      const response = await platform.send({ action: 'tokenizer_data_status' });
      if (!mounted || current !== revision) return;
      accept(response);
    } catch {
      if (!mounted || current !== revision) return;
      data = { ...data, state: 'error' };
      failure = '暂时无法检查分词数据，请点击重试。';
    }
    render(); schedulePoll();
  }
  action.addEventListener('click', () => {
    if (!mounted || action.disabled) return;
    const remove = data.state === 'installed', current = ++revision;
    clearTimeout(timer);
    busy = remove ? 'remove' : 'install'; failure = ''; render();
    void (async () => {
      if (remove) await beforeRemove();
      if (!mounted || current !== revision) return;
      const response = await platform.send({ action: remove ? 'tokenizer_data_remove' : 'tokenizer_data_install' });
      if (!mounted || current !== revision) return;
      accept(response);
      if (remove) {
        try { await store.set('dictionaryEnabled', false); }
        catch { failure = '分词数据已删除，关闭分词开关失败，请手动关闭。'; }
      }
    })().catch(() => {
      if (!mounted || current !== revision) return;
      failure = remove ? '删除失败，请稍后重试。' : '安装未完成，请检查网络或存储空间后重试。';
      if (!remove) data = { ...data, state: 'error' };
    }).finally(() => {
      if (!mounted || current !== revision) return;
      busy = ''; render(); schedulePoll();
    });
  });
  const unsubscribe = store.subscribe(() => render());
  const unwatchPermissions = platform.watchServiceAccess?.(() => { void refresh(); });
  const refreshWhenVisible = () => { if (doc.visibilityState !== 'hidden') void refresh(); };
  doc.defaultView?.addEventListener('focus', refreshWhenVisible);
  doc.addEventListener('visibilitychange', refreshWhenVisible);
  render(); void refresh();
  return {
    refresh,
    canEnable() { return data.state === 'installed' && !busy; },
    showInstallHint() { render(); },
    destroy() {
      mounted = false; revision++; clearTimeout(timer);
      unsubscribe(); unwatchPermissions?.(); box.remove(); hint.remove();
      doc.defaultView?.removeEventListener('focus', refreshWhenVisible);
      doc.removeEventListener('visibilitychange', refreshWhenVisible);
      toggle?.removeAttribute('aria-describedby');
    }
  };
}
