// Custom select controls retain native values and change events.
export function mountSelects(env) {
  const { window, document, MutationObserver, Event, setTimeout, clearTimeout } = env;
  const shell = document.querySelector('.settings-shell');
  if (!shell) return null;
  const entries = new Map();
  let active = null, activeIndex = -1, sequence = 0, typeBuffer = '', typeTimer = 0;
  const popup = document.createElement('div');
  popup.className = 'glass-select-popover';
  popup.hidden = true;
  popup.setAttribute('role', 'presentation');
  const search = document.createElement('input');
  search.className = 'glass-select-search';
  search.type = 'search';
  search.autocomplete = 'off';
  search.spellcheck = false;
  search.placeholder = '搜索选项…';
  search.setAttribute('aria-label', '搜索选项');
  const list = document.createElement('div');
  list.className = 'glass-select-list';
  list.id = 'glass-select-listbox';
  list.setAttribute('role', 'listbox');
  popup.append(search, list);
  document.body.append(popup);

  const optionDisabled = option => option.disabled || (option.parentElement.tagName === 'OPTGROUP' && option.parentElement.disabled);
  const textFor = option => option.label || option.textContent || '';
  const nameFor = select => select.getAttribute('aria-label') ||
    (select.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim() ||
    Array.from(select.labels || []).map(label => label.textContent.trim()).join(' ') || '选择设置';
  function visibleOptions() {
    if (!active) return [];
    const query = search.hidden ? '' : search.value.trim().toLocaleLowerCase();
    return Array.from(active.select.options).filter(option => !option.hidden && (!query || textFor(option).toLocaleLowerCase().includes(query)));
  }
  const enabledOptions = () => visibleOptions().filter(option => !optionDisabled(option));

  function close(restoreFocus = false) {
    const entry = active;
    active = null; activeIndex = -1;
    clearTimeout(typeTimer); typeBuffer = '';
    popup.hidden = true;
    if (entry) {
      entry.button.setAttribute('aria-expanded', 'false');
      entry.button.removeAttribute('aria-activedescendant');
      if (restoreFocus && !entry.button.disabled && entry.button.isConnected) entry.button.focus({ preventScroll: true });
    }
  }

  function position() {
    if (!active || popup.hidden) return;
    const rect = active.button.getBoundingClientRect();
    if (!rect.width || !rect.height || active.select.disabled || shell.hidden || shell.dataset.animation) { close(); return; }
    const widthLimit = Math.max(100, Math.min(360, window.innerWidth - 24));
    popup.style.width = Math.min(widthLimit, Math.max(160, rect.width)) + 'px';
    const widest = Array.from(list.querySelectorAll('.glass-select-option-label')).reduce((width, node) => Math.max(width, node.scrollWidth + 54), 0);
    const width = Math.min(widthLimit, Math.max(160, rect.width, widest));
    popup.style.width = width + 'px';
    const below = Math.max(0, window.innerHeight - rect.bottom - 20);
    const above = Math.max(0, rect.top - 20);
    const desired = Math.min(320, list.scrollHeight + (search.hidden ? 0 : 44) + 12);
    const upwards = below < Math.min(desired, 180) && above > below;
    const available = Math.max(44, upwards ? above : below);
    list.style.maxHeight = Math.max(32, Math.min(304, available - (search.hidden ? 0 : 44) - 12)) + 'px';
    const height = popup.getBoundingClientRect().height;
    popup.style.left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width)) + 'px';
    popup.style.top = Math.max(12, Math.min(window.innerHeight - height - 12, upwards ? rect.top - height - 7 : rect.bottom + 7)) + 'px';
    popup.dataset.placement = upwards ? 'above' : 'below';
  }

  function highlight(index, reveal = true) {
    activeIndex = index;
    list.querySelectorAll('[role="option"]').forEach(option => option.classList.toggle('is-highlighted', Number(option.dataset.optionIndex) === index));
    if (!active) return;
    const option = list.querySelector('[data-option-index="' + index + '"]');
    if (option) {
      active.button.setAttribute('aria-activedescendant', option.id);
      search.setAttribute('aria-activedescendant', option.id);
      if (reveal) option.scrollIntoView({ block: 'nearest' });
    } else {
      active.button.removeAttribute('aria-activedescendant');
      search.removeAttribute('aria-activedescendant');
    }
  }

  function renderList() {
    if (!active) return;
    const fragment = document.createDocumentFragment();
    let previousGroup = null;
    const options = visibleOptions();
    options.forEach(option => {
      const group = option.parentElement.tagName === 'OPTGROUP' ? option.parentElement.label : '';
      if (group && group !== previousGroup) {
        const title = document.createElement('div');
        title.className = 'glass-select-group'; title.textContent = group;
        title.setAttribute('role', 'presentation'); fragment.append(title);
      }
      previousGroup = group;
      const row = document.createElement('div');
      row.className = 'glass-select-option';
      row.id = active.listId + '-option-' + option.index;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(option.selected));
      row.setAttribute('aria-disabled', String(optionDisabled(option)));
      row.dataset.optionIndex = String(option.index);
      const label = document.createElement('span');
      label.className = 'glass-select-option-label'; label.textContent = textFor(option);
      const check = document.createElement('span');
      check.className = 'glass-select-check'; check.setAttribute('aria-hidden', 'true'); check.textContent = '✓';
      row.append(label, check); fragment.append(row);
    });
    if (!options.length) {
      const empty = document.createElement('div');
      empty.className = 'glass-select-empty'; empty.setAttribute('role', 'status'); empty.textContent = '没有匹配的选项'; fragment.append(empty);
    }
    list.replaceChildren(fragment);
    const enabled = enabledOptions();
    if (!enabled.some(option => option.index === activeIndex)) {
      activeIndex = enabled.find(option => option.selected)?.index ?? enabled[0]?.index ?? -1;
    }
    position(); highlight(activeIndex);
  }

  function sync(entry) {
    const select = entry.select;
    const name = nameFor(select);
    const selected = select.options[select.selectedIndex];
    const text = selected ? textFor(selected) : '请选择';
    if (entry.value.textContent !== text) entry.value.textContent = text;
    entry.button.title = text;
    entry.button.setAttribute('aria-label', name);
    entry.button.disabled = select.disabled;
    entry.button.setAttribute('aria-disabled', String(select.disabled));
    if (select.getAttribute('aria-invalid') === 'true' || !select.validity.valid) entry.button.setAttribute('aria-invalid', 'true');
    else entry.button.removeAttribute('aria-invalid');
    if (active === entry) {
      if (select.disabled || !entry.button.getClientRects().length) close();
      else renderList();
    }
  }

  function open(entry) {
    if (entry.select.disabled || !entry.select.options.length || shell.hidden || shell.dataset.animation) return;
    close();
    active = entry;
    activeIndex = entry.select.selectedIndex;
    search.value = '';
    search.hidden = entry.select.options.length < 12;
    search.setAttribute('aria-label', '搜索' + nameFor(entry.select));
    list.setAttribute('aria-label', nameFor(entry.select));
    search.setAttribute('aria-controls', list.id);
    popup.hidden = false;
    entry.button.setAttribute('aria-expanded', 'true');
    entry.button.focus({ preventScroll: true });
    renderList();
  }

  function commit(index) {
    const entry = active;
    const option = entry?.select.options[index];
    if (!entry || !option || optionDisabled(option)) return;
    const changed = entry.select.selectedIndex !== index;
    entry.select.selectedIndex = index;
    close(true);
    if (changed) {
      entry.select.dispatchEvent(new Event('input', { bubbles: true }));
      entry.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sync(entry);
  }

  function move(direction) {
    const enabled = enabledOptions();
    if (!enabled.length) return;
    const current = enabled.findIndex(option => option.index === activeIndex);
    const next = direction === 'first' ? 0 : direction === 'last' ? enabled.length - 1 :
      Math.max(0, Math.min(enabled.length - 1, current + direction));
    highlight(enabled[next].index);
  }

  function onKey(event, entry) {
    if (entry.select.disabled) return;
    const isSearch = event.target === search;
    if (event.key === 'Tab') { close(isSearch); return; }
    if (event.key === 'Escape') {
      if (active) { event.preventDefault(); event.stopPropagation(); close(true); }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); event.stopPropagation();
      if (active !== entry) open(entry);
      else move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if ((event.key === 'Home' || event.key === 'End') && !isSearch) {
      event.preventDefault(); event.stopPropagation();
      if (active !== entry) open(entry);
      move(event.key === 'Home' ? 'first' : 'last'); return;
    }
    if (event.key === 'Enter' || (event.key === ' ' && !isSearch)) {
      event.preventDefault(); event.stopPropagation();
      if (active === entry) commit(activeIndex); else open(entry);
      return;
    }
    if (!isSearch && event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault(); event.stopPropagation();
      if (active !== entry) open(entry);
      clearTimeout(typeTimer);
      typeBuffer += event.key.toLocaleLowerCase();
      const repeated = typeBuffer.split('').every(char => char === typeBuffer[0]);
      const query = repeated ? typeBuffer[0] : typeBuffer;
      const enabled = enabledOptions();
      const start = repeated ? enabled.findIndex(option => option.index === activeIndex) + 1 : 0;
      const ordered = [...enabled.slice(start), ...enabled.slice(0, start)];
      const match = ordered.find(option => textFor(option).trim().toLocaleLowerCase().startsWith(query));
      if (match) highlight(match.index);
      typeTimer = setTimeout(() => { typeBuffer = ''; }, 600);
    }
  }

  function enhance(select) {
    if (entries.has(select) || select.multiple || select.size > 1) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'glass-select-trigger';
    button.id = (select.id || 'glass-native-' + (++sequence)) + '-trigger';
    const listId = button.id + '-list';
    button.setAttribute('role', 'combobox');
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', list.id);
    button.setAttribute('aria-autocomplete', 'none');
    const value = document.createElement('span');
    value.className = 'glass-select-value';
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('viewBox', '0 0 16 16'); arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '<path d="m5 6 3 3 3-3"/>';
    button.append(value, arrow);
    select.classList.add('glass-select-native');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    select.parentElement.classList.add('has-glass-select');
    select.after(button);
    const entry = { select, button, value, listId };
    entries.set(select, entry);
    select.addEventListener('change', () => sync(entry));
    select.addEventListener('input', () => sync(entry));
    button.addEventListener('click', () => { if (active === entry) close(); else open(entry); });
    button.addEventListener('keydown', event => onKey(event, entry));
    Array.from(select.labels || []).forEach(label => label.addEventListener('click', event => {
      if (event.target.closest('button, input, a')) return;
      event.preventDefault();
      if (!button.disabled) button.focus({ preventScroll: true });
    }));
    new MutationObserver(() => sync(entry)).observe(select, {
      attributes: true, childList: true, characterData: true, subtree: true,
      attributeFilter: ['disabled', 'selected', 'label', 'value', 'hidden', 'aria-label', 'aria-labelledby', 'aria-invalid']
    });
    sync(entry);
  }

  function refresh() {
    shell.querySelectorAll('select').forEach(enhance);
    entries.forEach(entry => {
      if (entry.select.isConnected) sync(entry);
      else { if (active === entry) close(); entry.button.remove(); entries.delete(entry.select); }
    });
  }

  popup.addEventListener('pointerdown', event => { if (event.target.closest('[role="option"]')) event.preventDefault(); });
  popup.addEventListener('pointermove', event => {
    const row = event.target.closest('[role="option"]');
    if (row && row.getAttribute('aria-disabled') !== 'true') highlight(Number(row.dataset.optionIndex), false);
  });
  popup.addEventListener('click', event => {
    const row = event.target.closest('[role="option"]');
    if (row) commit(Number(row.dataset.optionIndex));
  });
  search.addEventListener('input', () => { activeIndex = -1; renderList(); });
  search.addEventListener('keydown', event => { if (active) onKey(event, active); });
  document.addEventListener('pointerdown', event => {
    if (active && !popup.contains(event.target) && !active.button.contains(event.target)) close();
  }, true);
  document.addEventListener('focusin', event => {
    if (active && !popup.contains(event.target) && !active.button.contains(event.target)) close();
  });
  document.addEventListener('scroll', event => { if (active && !popup.contains(event.target)) close(); }, true);
  document.addEventListener('glass:reset', () => { close(); refresh(); });
  window.addEventListener('resize', () => close());
  window.addEventListener('blur', () => close());
  window.visualViewport?.addEventListener('resize', () => close());
  new MutationObserver(records => {
    if (active && (shell.hidden || shell.dataset.animation || shell.dataset.widgetState === 'collapsed')) close();
    if (records.some(record => record.type === 'childList')) refresh();
  }).observe(shell, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-widget-state', 'data-animation'] });
  const api = { refresh, close };
  refresh();
  return api;
}
