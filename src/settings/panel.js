import { defaults, settingOptions, huoshanVoices, shortcutActions, normalizeSetting, validateShortcuts } from './settings.js';
import { mountDictionaryTab } from './dictionary-tab.js';
import { createCoreTabs } from './core-tabs.js';
import { createAnkiTabs } from './anki-tab.js';
import { createAppearanceTabs } from './appearance-tab.js';
import metadata from '../../package.json' with { type: 'json' };

// Settings tabs, persistence and service actions for the in-page panel.
export function mountSettingsPanel(env, store, platform) {
  const { window, document } = env;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let values = { ...store.values }, definitions = [], dictionary, toastTimer, dialogAction, disposed = false;
  let writes = Promise.resolve();
  let backgroundRevision = 0, serviceRevision = 0;
  const pending = new Map();
  const pendingValues = () => Object.fromEntries([...pending].map(([key, draft]) => [key, draft.value]));
  const controls = () => $$('[data-pref]');
  function notify(message) {
    clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('show');
    toastTimer = setTimeout(() => $('#toast')?.classList.remove('show'), 2600);
  }
  function dialog(title, description, confirmText, action) {
    $('#dialog-title').textContent = title; $('#dialog-description').textContent = description;
    $('#dialog-confirm').textContent = confirmText; dialogAction = action; $('#dialog').showModal();
  }
  function refresh(force = false) {
    if (disposed) return;
    document.documentElement.dataset.theme = values.nightMode ? 'dark' : 'light';
    document.documentElement.style.setProperty('--at-docked-icon-opacity', String(values.dockedIconOpacity / 100));
    $('#theme-button').setAttribute('aria-pressed', String(values.nightMode));
    $('#theme-icon').setAttribute('href', values.nightMode ? '#i-moon' : '#i-sun');
    controls().forEach(control => {
      const value = values[control.dataset.pref];
      if (['winVoice', 'vitsVoice'].includes(control.dataset.pref) && ![...control.options].some(option => option.value === String(value))) {
        const option = document.createElement('option'); option.value = value;
        option.textContent = `${value} · ${control.dataset.pref === 'vitsVoice' ? '点击刷新声音列表' : '当前配置（此设备暂无对应声音）'}`;
        control.prepend(option);
      }
      if (control.hasAttribute('data-pref-array')) control.checked = Array.isArray(value) && value.includes(control.value);
      else if (control.type === 'checkbox') control.checked = Boolean(value);
      else if ((force || document.activeElement !== control) && value !== undefined) control.value = String(value);
    });
    $$('[data-output]').forEach(output => { output.textContent = String(values[output.dataset.output] ?? '') + (output.dataset.suffix || ''); });
    definitions.forEach(definition => definition.refresh?.(definition.root));
    dictionary?.render?.(force); env.selects?.refresh?.();
  }
  function set(key, value, message) {
    const normalized = normalizeSetting(key, value);
    validateShortcuts({ ...values, [key]: normalized });
    const draft = { value: normalized };
    values = { ...values, [key]: normalized }; pending.set(key, draft);
    if (['useWindowsTTS', 'useVITS', 'useHuoshTTS'].includes(key) && normalized) {
      for (const other of ['useWindowsTTS', 'useVITS', 'useHuoshTTS']) if (other !== key) values[other] = false;
    }
    refresh();
    const operation = writes.catch(() => {}).then(() => store.set(key, normalized));
    writes = operation;
    operation.then(() => {
      if (pending.get(key) === draft) pending.delete(key);
      if (message && !disposed) notify(message);
    }, error => {
      if (pending.get(key) === draft) pending.delete(key);
      values = { ...store.values, ...pendingValues() }; refresh();
      if (!disposed) notify('保存失败：' + error.message);
    });
    return normalized;
  }
  const ctx = { defaults, options: settingOptions, voices: huoshanVoices, shortcuts: shortcutActions,
    icon: env.icon, get: key => values[key], set, notify, dialog, escape, flush: () => writes };

  const scroller = $('#panel-scroll');
  const dictionaryRoot = document.createElement('section');
  dictionaryRoot.className = 'panel-view'; dictionaryRoot.id = 'pane-dictionary';
  while (scroller.firstChild) dictionaryRoot.append(scroller.firstChild);
  scroller.append(dictionaryRoot);
  definitions = [
    ...createCoreTabs(ctx, env),
    { id: 'dictionary', name: '词典', root: dictionaryRoot },
    ...createAnkiTabs(ctx, env, platform),
    ...createAppearanceTabs(ctx)
  ];
  const tabOrder = ['复制', '语音', '翻译', '词典', 'Anki', '外观', '键位', '帮助'];
  const introductions = {
    copy: '选中的文本，轻松捕获。', speech: '选一种声音，跟着文字慢慢读。',
    translation: '按顺序显示译文，不止于一种语言。', dictionary: '查读音、看释义，读懂每一个词。',
    anki: '记录遇见的生词，学而时习之。', appearance: '调整面板与配色，让阅读更舒适。',
    shortcuts: '让每一个阅读动作，都顺手一些。', help: '遇到问题？这可能有答案。'
  };
  const introIcons = {
    copy: '<rect x="8" y="7" width="12" height="14" rx="2"/><path d="M16 7V3H4v14h4"/>',
    speech: '<path d="m11 5-5 4H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    translation: '<path d="M3 5h11M8 3v2m-3 0c1 6 5 9 8 10M12 5c-1 6-5 9-9 11m10 5 4-11 4 11m-6.5-4h5"/>',
    dictionary: '<path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm-2 14h16M9 3v8l3-2 3 2V3"/>',
    anki: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
    appearance: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z"/><circle cx="7.5" cy="10" r=".8"/><circle cx="10" cy="6.5" r=".8"/><circle cx="14.5" cy="6.5" r=".8"/><circle cx="17.5" cy="10" r=".8"/>',
    shortcuts: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h.1m4 0h.1m4 0h.1m4 0h.1M6 13h.1m4 0h.1m4 0h.1m4 0h.1M8 16h8"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4m0 3h.01"/>'
  };
  definitions.sort((a, b) => tabOrder.indexOf(a.name) - tabOrder.indexOf(b.name));
  definitions.forEach(definition => {
    if (!definition.root) {
      const root = document.createElement('section');
      root.id = 'pane-' + definition.id; root.className = 'panel-view'; root.hidden = true;
      root.innerHTML = definition.html;
      definition.root = root; scroller.append(root);
    }
    const intro = document.createElement('div');
    intro.className = 'section-intro';
    intro.innerHTML = `<div><h2>${escape(definition.name)}</h2><p>${escape(introductions[definition.id])}</p></div><div class="section-emblem glass" aria-hidden="true"><svg viewBox="0 0 24 24">${introIcons[definition.id]}</svg></div>`;
    definition.root.prepend(intro);
    if (definition.css) { const style = document.createElement('style'); style.textContent = definition.css; document.head.append(style); }
  });
  const iconSettings = document.createElement('section');
  iconSettings.className = 'panel-icon-settings';
  iconSettings.setAttribute('aria-label', '悬浮图标');
  iconSettings.innerHTML = `<div class="group-heading"><h3>悬浮图标</h3></div><div class="settings-group glass"><div class="range-setting"><div class="range-setting-label"><label for="pref-dockedIconOpacity">停靠图标不透明度</label><output for="pref-dockedIconOpacity" data-output="dockedIconOpacity" data-suffix="%"></output></div><input id="pref-dockedIconOpacity" type="range" min="0" max="100" step="1" data-pref="dockedIconOpacity" aria-label="停靠图标不透明度"></div></div>`;
  $('#pane-appearance .section-intro').after(iconSettings);
  const tabs = $$('.tab');
  $('.tabs').setAttribute('role', 'tablist');
  let activeName = '词典';
  function selectTab(name, remember = true) {
    env.selects?.close?.();
    if (!tabOrder.includes(name)) name = '词典';
    definitions.find(definition => definition.name === activeName).scrollTop = scroller.scrollTop;
    definitions.forEach(definition => { definition.root.hidden = definition.name !== name; });
    tabs.forEach((button, index) => {
      const selected = button.dataset.tab === name, definition = definitions[index];
      button.setAttribute('role', 'tab'); button.id = 'tab-' + definition.id;
      button.setAttribute('aria-controls', definition.root.id); button.setAttribute('aria-selected', String(selected));
      button.removeAttribute('aria-current'); button.tabIndex = selected ? 0 : -1;
      definition.root.setAttribute('role', 'tabpanel'); definition.root.setAttribute('aria-labelledby', button.id); definition.root.tabIndex = 0;
    });
    activeName = name;
    scroller.scrollTop = definitions.find(definition => definition.name === name).scrollTop || 0;
    if (remember) { set("settingsTab", name); if (name === "词典") void dictionary?.refresh(); }
  }
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => selectTab(button.dataset.tab));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[next].dataset.tab); tabs[next].focus();
    });
  });


  controls().forEach((control, index) => {
    if (!control.id) control.id = 'glass-pref-' + index;
    if (!control.closest('label') && !control.getAttribute('aria-label') && !document.querySelector(`label[for="${control.id}"]`)) {
      const label = control.closest('.setting-row, .field-row, .form-row')?.querySelector('label');
      if (label && !label.closest('.switch')) label.htmlFor = control.id;
    }
    const commit = () => {
      let value = control.value;
      if (control.hasAttribute('data-pref-array')) value = controls().filter(item => item.dataset.pref === control.dataset.pref && item.checked).map(item => item.value);
      else if (control.type === 'checkbox') value = control.checked;
      try { set(control.dataset.pref, value); control.setCustomValidity(''); control.removeAttribute('aria-invalid'); }
      catch (error) { control.setCustomValidity(error.message); control.setAttribute('aria-invalid', 'true'); notify(error.message); }
    };
    control.addEventListener(control.type === 'checkbox' || control.tagName === 'SELECT' ? 'change' : 'input', commit);
    control.addEventListener('blur', () => { if (!control.checkValidity()) control.reportValidity(); });
  });
  definitions.forEach(definition => definition.init?.(definition.root));
  $('#dialog-cancel').addEventListener('click', () => { dialogAction = null; $('#dialog').close(); });
  $('#dialog').addEventListener('cancel', () => { dialogAction = null; });
  $('#dialog-confirm').addEventListener('click', () => {
    const action = dialogAction; dialogAction = null; $('#dialog').close();
    Promise.resolve().then(() => action?.()).catch(error => notify(error.message));
  });
  $('#theme-button').addEventListener('click', () => set('nightMode', !values.nightMode));
  $('#reset-button').title = '重置设置'; $('#reset-button').setAttribute('aria-label', '重置设置');
  $('#reset-button').addEventListener('click', () => dialog('恢复默认设置？', '参数会恢复为默认值，设置面板将保持打开。', '恢复默认', async () => {
    serviceRevision++;
    await writes.catch(() => {}); await store.reset();
    $$('input, select, textarea').forEach(control => { control.setCustomValidity(''); control.removeAttribute('aria-invalid'); });
    $$('[data-refresh-vits], [data-anki-connect]').forEach(control => { control.disabled = false; });
    $('[data-anki-connection-status]').textContent = '';
    document.dispatchEvent(new CustomEvent('glass:reset')); refresh(true);
    definitions.forEach(definition => { definition.scrollTop = 0; });
    selectTab(values.settingsTab, false); notify('已恢复默认设置');
  }));
  $('#close-button').addEventListener('click', async () => {
    try {
      set('pluginSwitch', false); await writes;
    }
    catch { /* Saving errors remain visible in the original toast. */ }
  });
  const version = $('.version > span'); if (version) version.textContent = 'Ver ' + metadata.version;
  const latest = $('.version .latest'); if (latest) latest.textContent = 'Ready';
  const helpVersion = $('.core-help-version'); if (helpVersion) helpVersion.textContent = 'v' + metadata.version;
  dictionary = mountDictionaryTab(env, store, platform, ctx);

  // Service requests stay inside the panel lifecycle.
  env.body.addEventListener('click', event => {
    const control = event.target.closest('[data-service-auth],[data-refresh-vits],[data-anki-connect]');
    if (!control) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (control.hasAttribute('data-service-auth')) {
      const id = control.dataset.serviceAuth;
      if (!platform.requestServiceAccess) { notify('跨域接口由脚本管理器处理授权。'); return; }
      let request;
      try { request = platform.requestServiceAccess(id, values); } catch (error) { notify(error.message); return; }
      control.disabled = true;
      Promise.resolve(request).then(granted => {
        notify(granted ? '接口已授权' : '未授予接口权限');
      }, error => notify(error.message)).finally(() => { control.disabled = false; void refreshPermissions(); });
    } else if (control.hasAttribute('data-refresh-vits')) {
      const revision = serviceRevision;
      control.disabled = true;
      void ctx.flush().then(() => platform.send({ action: 'vits_speakers', settings: store.values })).then(response => {
        if (disposed || revision !== serviceRevision) return;
        const select = $('[data-pref="vitsVoice"]'), voices = response.voices || [];
        select.replaceChildren(...voices.map(voice => { const option = document.createElement('option'); option.value = voice.id; option.textContent = `${voice.id} · ${voice.name || '未命名'} · ${(voice.lang || []).join('/')}`; return option; }));
        if (voices.length) { const current = voices.some(voice => Number(voice.id) === values.vitsVoice) ? values.vitsVoice : Number(voices[0].id); set('vitsVoice', current); }
        refresh(); notify(voices.length ? '声音列表已刷新' : '服务没有返回声音');
      }).catch(error => { if (!disposed && revision === serviceRevision) notify(error.message); })
        .finally(() => { if (!disposed && revision === serviceRevision) control.disabled = false; });
    } else {
      const revision = serviceRevision;
      const status = $('[data-anki-connection-status]'); status.textContent = '正在连接 Anki…'; control.disabled = true;
      void ctx.flush().then(() => platform.send({ action: 'anki_info', settings: store.values })).then(response => {
        if (disposed || revision !== serviceRevision) return;
        if (response.error) throw new Error(response.error);
        status.textContent = `已连接 AnkiConnect ${response.version || ''}；${(response.decks || []).length} 个卡组。`;
      }).catch(error => { if (!disposed && revision === serviceRevision) status.textContent = '连接失败：' + error.message; })
        .finally(() => { if (!disposed && revision === serviceRevision) control.disabled = false; });
    }
  }, true);
  let permissionRevision = 0;
  async function refreshPermissions() {
    if (disposed) return;
    const revision = ++permissionRevision;
    await Promise.all($$('[data-service-auth]').map(async button => {
      const id = button.dataset.serviceAuth, status = $(`[data-permission-status="${id}"]`);
      if (!platform.hasServiceAccess) { status.textContent = '由脚本管理器授权'; button.hidden = true; return; }
      try {
        const allowed = await platform.hasServiceAccess(id, values);
        if (disposed || revision !== permissionRevision) return;
        status.textContent = allowed ? '接口已授权' : '接口未授权'; status.classList.toggle('is-authorized', allowed);
        button.textContent = allowed ? '已授权' : '授权接口'; button.disabled = allowed;
      } catch (error) {
        if (!disposed && revision === permissionRevision) {
          status.textContent = error.message; status.classList.remove('is-authorized');
          button.textContent = '授权接口'; button.disabled = false;
        }
      }
    }));
  }
  env.background = {
    async read() {
      const data = store.values.panelBackground;
      if (!data) return null;
      const comma = data.indexOf(','), mime = data.slice(5, data.indexOf(';'));
      const bytes = Uint8Array.from(atob(data.slice(comma + 1)), char => char.charCodeAt(0));
      let meta;
      try { meta = JSON.parse(env.localStorage.getItem('anon-glass-background-meta') || 'null'); } catch {}
      return { blob: new Blob([bytes], { type: mime }), name: meta?.name || '本地背景', width: 0, height: 0 };
    },
    async write(record) {
      const revision = ++backgroundRevision;
      if (!record) { await store.set('panelBackground', ''); env.localStorage.removeItem('anon-glass-background-meta'); return; }
      env.localStorage.setItem('anon-glass-background-meta', JSON.stringify({ name: record.name }));
      if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(record.blob.type) && record.blob.size < 2 * 1024 * 1024) {
        const data = await new Promise((resolve, reject) => {
          const reader = new window.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(record.blob);
        });
        if (revision === backgroundRevision && !disposed) await store.set('panelBackground', data);
        return;
      }
      const url = URL.createObjectURL(record.blob);
      try {
        const image = new Image(); image.src = url; await image.decode();
        if (revision !== backgroundRevision || disposed) return;
        const ratio = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        await store.set('panelBackground', canvas.toDataURL('image/webp', .85));
      } finally { URL.revokeObjectURL(url); }
    }
  };
  const unsubscribe = store.subscribe((next, patch) => {
    values = { ...next, ...pendingValues() }; refresh();
    if (['aiURL', 'aiProtocol', 'aiModel', 'ankiURL', 'vitsAPI', 'vitsCustomAPI'].some(key => Object.hasOwn(patch, key))) void refreshPermissions();
  });
  env.initialize();
  refresh(); selectTab(values.settingsTab, false);
  if (values.settingsTab === '词典') void dictionary.refresh();
  const permissionWatch = platform.watchServiceAccess?.(() => { void refreshPermissions(); });
  void refreshPermissions();
  // Empty VITS placeholders are honest until the user refreshes real voices.
  const vits = $('[data-pref="vitsVoice"]');
  vits.replaceChildren(); const vitsOption = document.createElement('option'); vitsOption.value = values.vitsVoice; vitsOption.textContent = `${values.vitsVoice} · 点击刷新声音列表`; vits.append(vitsOption);
  env.selects?.refresh?.();
  return { destroy() { disposed = true; clearTimeout(toastTimer); unsubscribe(); permissionWatch?.(); dictionary?.destroy(); definitions.forEach(definition => definition.destroy?.()); } };
}
