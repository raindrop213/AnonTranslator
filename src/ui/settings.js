const settingsGroups = [
  ['复制', ['copy', 'targetTags', 'ignoreFurigana', 'showCopyContent', 'extraImage', 'ignoreSymbolPairs', 'symbolPairs', 'sentenceDelimiters']],
  ['语音', ['readingInterval', 'splitSpeech']],
  ['翻译', []],
  ['外观', ['borderWidth', 'borderStyle', 'borderRadius', 'scrollSwitch', 'scrollIntoView']],
  ['快捷键', Object.keys(App.shortcutActions)],
  ['帮助', []]
];
const settingLabels = {
  pluginSwitch: '启用阅读工具', copy: '复制文本', ignoreFurigana: '忽略振假名', showCopyContent: '显示复制内容', extraImage: '点击打开图片',
  targetTags: '目标文本标签（用逗号分隔）',
  ignoreSymbolPairs: '忽略首尾符号对', symbolPairs: '首尾符号对（用 / 分隔）', splitSpeech: '把段落切成句子', sentenceDelimiters: '断句符号（用 / 分隔）', readingInterval: '自动朗读间隔（毫秒）',
  shortcutPreviousParagraph: '上一段', shortcutNextParagraph: '下一段', shortcutPreviousSentence: '上一句', shortcutNextSentence: '下一句',
  shortcutReadCurrent: '重读当前选择', shortcutAutoRead: '自动阅读 / 暂停', shortcutStop: '停止朗读',
  useWindowsTTS: '启用系统语音', winVoice: '系统声音', rate: '语速', pitch: '音调', useVITS: '启用 VITS',
  useHuoshTTS: '启用火山语音', huoshVoice: '火山声音', huoshRate: '播放速度（倍，1 为正常）',
  vitsAPI: 'VITS 服务地址', vitsVoice: 'VITS 声音', vitsLang: 'VITS 语言', length: '发音长度（越大越慢）',
  noise: '声音随机性', noisew: '发音时长随机性', max: '合成分段阈值（segment_size）', streaming: '服务端流式响应（获取完整音频后播放）',
  google: '启用 Google', youdao: '启用有道',
  borderWidth: '框宽度（例如 2px）', borderStyle: '框样式', borderRadius: '框圆角（例如 8px）',
  freeBorderColor: '预选框颜色', selectedBorderColor: '激活框颜色', sentenceColor: '句子高亮颜色', scrollSwitch: '自动滚动到段落/句子', scrollIntoView: '滚动方式'
};
const selectOptions = App.settingOptions;

function mountSettings(root, store, platform) {
  const doc = root.ownerDocument;
  const controls = new Map();
  const permissionRows = [];
  const form = doc.createElement('form');
  form.className = 'at-settings';
  form.setAttribute('data-at-ui', '');
  form.addEventListener('submit', event => event.preventDefault());
  let queue = Promise.resolve(), revision = 0;
  const header = doc.createElement('header');
  header.className = 'at-header';
  const artwork = doc.createElement('img');
  artwork.className = 'at-header-art'; artwork.alt = '';
  const title = doc.createElement('h1'), version = doc.createElement('span');
  title.className = 'at-sr-only'; title.textContent = 'AnonTranslator';
  version.className = 'at-version'; version.textContent = `Ver ${App.version}`;
  const updateLink = doc.createElement('a');
  updateLink.className = 'at-update'; updateLink.href = App.release.page;
  updateLink.target = '_blank'; updateLink.rel = 'noopener noreferrer';
  updateLink.setAttribute('aria-live', 'polite'); updateLink.textContent = '检查更新…';
  const actions = doc.createElement('div'); actions.className = 'at-header-actions';
  const themeButton = doc.createElement('button');
  themeButton.type = 'button'; themeButton.className = 'at-theme-toggle';
  themeButton.addEventListener('click', () => {
    queue = queue.then(() => store.set('nightMode', !store.values.nightMode)).catch(error => { status.textContent = `保存失败：${error.message}`; });
  });
  const resetButton = doc.createElement('button');
  resetButton.type = 'button'; resetButton.className = 'at-reset';
  resetButton.textContent = '↺'; resetButton.title = '重置设置'; resetButton.setAttribute('aria-label', '重置设置');
  resetButton.addEventListener('click', () => {
    if (!doc.defaultView.confirm('确定重置所有设置吗？自定义快捷键、颜色和语音参数会恢复默认，阅读工具将关闭。')) return;
    revision++;
    queue = queue.then(() => store.reset()).then(() => {
      for (const input of controls.values()) input.setCustomValidity('');
      loadVoices();
      void refreshVits(); status.textContent = '';
    }).catch(error => { status.textContent = `重置失败：${error.message}`; });
  });
  const power = doc.createElement('label'), powerInput = doc.createElement('input');
  power.className = 'at-power'; powerInput.type = 'checkbox'; powerInput.name = powerInput.id = 'pluginSwitch';
  powerInput.checked = store.values.pluginSwitch; powerInput.setAttribute('aria-label', '启用阅读工具');
  power.append(powerInput); controls.set('pluginSwitch', powerInput);
  actions.append(themeButton, resetButton);
  header.append(artwork, title, version, updateLink, actions, power); form.append(header);
  const updateTheme = values => {
    root.dataset.atTheme = form.dataset.atTheme = values.nightMode ? 'night' : 'day';
    themeButton.textContent = values.nightMode ? '☾' : '☀';
    themeButton.title = values.nightMode ? '切换日间模式' : '切换夜间模式';
    themeButton.setAttribute('aria-label', themeButton.title);
    themeButton.setAttribute('aria-pressed', String(values.nightMode));
    const state = values.pluginSwitch ? 'on' : 'off';
    if (artwork.dataset.state !== state) {
      artwork.dataset.state = state; artwork.src = App.headerImages[state];
    }
    power.title = values.pluginSwitch ? '关闭阅读工具' : '启用阅读工具';
    controls.get('symbolPairs')?.toggleAttribute('disabled', !values.ignoreSymbolPairs);
  };
  const status = doc.createElement('p');
  status.className = 'at-save-status';
  status.setAttribute('role', 'status');
  form.append(status);
  const labelFor = key => {
    const base = key.startsWith('night') ? key[5].toLowerCase() + key.slice(6) : key;
    return settingLabels[base] || `${base.replace(/(From|To|Color)$/, '')} ${{ From: '源语言', To: '目标语言', Color: '颜色' }[base.match(/(From|To|Color)$/)?.[0]] || base}`;
  };
  const addControl = (parent, key, colorRow = null) => {
    const row = doc.createElement(key.endsWith('Color') ? 'div' : 'label');
    row.className = 'at-setting';
    const label = doc.createElement('span');
    label.textContent = labelFor(key);
    if (['symbolPairs', 'scrollIntoView'].includes(key)) label.className = 'at-sr-only';
    row.append(label);
    const value = store.values[key];
    const input = doc.createElement(selectOptions[key] || ['winVoice', 'vitsVoice'].includes(key) ? 'select' : 'input');
    input.id = key;
    input.name = key;
    if (input.tagName === 'SELECT') {
      for (const optionValue of selectOptions[key] || [value]) {
        const option = doc.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        input.append(option);
      }
    } else if (typeof value === 'boolean') input.type = 'checkbox';
    else if (key.endsWith('Color')) input.type = 'color';
    else if (['rate', 'huoshRate', 'pitch', 'length'].includes(key)) {
      input.type = 'range';
      input.min = App.numericRules[key][0]; input.max = App.numericRules[key][1]; input.step = '0.1';
    } else if (App.numericRules[key]) {
      input.type = 'number';
      input.min = App.numericRules[key][0]; input.max = App.numericRules[key][1];
      input.step = App.numericRules[key][2] ? '1' : '0.01';
    } else input.type = 'text';
    if (key === 'vitsAPI') { input.placeholder = 'http://127.0.0.1:23456'; input.spellcheck = false; }
    if (key === 'targetTags') { input.placeholder = 'p,h1,h2,h3,h4,h5,h6'; input.spellcheck = false; }
    if (input.type === 'checkbox') input.checked = value;
    else input.value = value;
    row.append(input);
    if (key.startsWith('shortcut')) {
      const record = doc.createElement('button'), reset = doc.createElement('button');
      record.type = reset.type = 'button';
      record.textContent = '录制'; reset.textContent = '默认';
      record.addEventListener('click', () => { input.dataset.recording = 'true'; record.textContent = '请按键…'; input.focus(); });
      input.addEventListener('keydown', event => {
        if (input.dataset.recording !== 'true') return;
        event.preventDefault(); event.stopPropagation();
        if (/^(Control|Alt|Shift|Meta)/.test(event.code)) return;
        input.value = App.shortcutFromEvent(event);
        delete input.dataset.recording; record.textContent = '录制';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      input.addEventListener('blur', () => { delete input.dataset.recording; record.textContent = '录制'; });
      reset.addEventListener('click', () => { input.value = App.defaults[key]; input.dispatchEvent(new Event('input', { bubbles: true })); });
      row.append(record, reset);
    }
    if (input.type === 'range') {
      const output = doc.createElement('output');
      output.textContent = value;
      row.append(output);
    }
    if (colorRow) {
      input.title = input.getAttribute('aria-label') || `${labelFor(key)} · 夜间`;
      input.setAttribute('aria-label', input.title); colorRow.append(input);
    } else parent.append(row);
    controls.set(key, input);
    return row;
  };
  const tabs = doc.createElement('nav'); tabs.className = 'at-tabs';
  tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '设置栏目');
  const sections = doc.createElement('div'); sections.className = 'at-settings-sections';
  sections.append(tabs); form.append(sections);
  const panels = [], tabButtons = [];
  const selectTab = (index, remember = true) => {
    tabButtons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    if (remember) {
      queue = queue.then(() => store.set('settingsTab', settingsGroups[index][0]))
        .catch(error => { status.textContent = `保存栏目失败：${error.message}`; });
    }
  };
  for (const [name, keys] of settingsGroups) {
    const index = panels.length;
    const section = doc.createElement('section'); section.className = 'at-tab-panel';
    section.id = `at-panel-${index}`; section.setAttribute('role', 'tabpanel');
    const tab = doc.createElement('button'); tab.type = 'button'; tab.textContent = name;
    tab.id = `at-tab-${index}`; tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', section.id); section.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('click', () => selectTab(index));
    tab.addEventListener('keydown', event => {
      const offsets = { ArrowLeft: -1, ArrowRight: 1, Home: -index, End: settingsGroups.length - 1 - index };
      if (!(event.key in offsets)) return;
      event.preventDefault();
      const next = (index + offsets[event.key] + settingsGroups.length) % settingsGroups.length;
      selectTab(next); tabButtons[next].focus();
    });
    panels.push(section); tabButtons.push(tab); tabs.append(tab);
    for (const key of keys) addControl(section, key);
    const serviceGroups = new Map();
    const addGroup = (name, keys, serviceId) => {
      const fieldset = doc.createElement('fieldset'), legend = doc.createElement('legend');
      legend.textContent = name; fieldset.append(legend);
      for (const key of keys) addControl(fieldset, key);
      section.append(fieldset);
      if (serviceId) serviceGroups.set(serviceId, fieldset);
    };
    if (name === '语音') {
      addGroup('系统语音', ['useWindowsTTS', 'winVoice', 'rate', 'pitch']);
      addGroup('火山语音', ['useHuoshTTS', 'huoshVoice', 'huoshRate'], 'huosh');
      addGroup('VITS', ['useVITS', 'vitsAPI', 'vitsVoice', 'vitsLang', 'length', 'noise', 'noisew', 'max', 'streaming'], 'vits');
      const refresh = doc.createElement('button'); refresh.type = 'button'; refresh.className = 'at-refresh-voices'; refresh.textContent = '刷新声音列表';
      refresh.addEventListener('click', () => { void refreshVits(); });
      controls.get('vitsVoice').parentElement.append(refresh);
    }
    if (name === '翻译') {
      addGroup('Google', ['google', 'googleFrom', 'googleTo'], 'google');
      addGroup('有道', ['youdao', 'youdaoFrom', 'youdaoTo'], 'youdao');
    }
    for (const [id, service] of Object.entries(platform?.servicePermissions || {})) {
      if (service.section !== name) continue;
      const row = doc.createElement('div'), text = doc.createElement('span'), button = doc.createElement('button');
      row.className = 'at-service-permission'; row.dataset.atService = id;
      text.textContent = `${service.name} 接口：检查权限…`;
      button.type = 'button'; button.textContent = `授权 ${service.name} 接口`;
      button.title = service.origins.map(origin => new URL(origin).hostname).join('、');
      row.append(text, button); (serviceGroups.get(id) || section).append(row);
      permissionRows.push({ id, service, text, button });
      button.addEventListener('click', () => {
        // Request immediately inside the click; queued/awaited calls lose activation.
        const request = platform.requestServiceAccess(id, store.values);
        button.disabled = true;
        request.then(granted => {
          if (!granted) status.textContent = `${service.name} 接口未授权，仍可继续使用复制与系统语音。`;
          else { status.textContent = ''; if (id === 'vits') void refreshVits(); }
          return refreshPermissions();
        }).catch(error => { status.textContent = `接口授权失败：${error.message}`; button.disabled = false; });
      });
    }
    if (permissionRows.some(row => row.service.section === name)) {
      const help = doc.createElement('p'); help.className = 'at-guide';
      help.textContent = '只允许指定阅读网站时，还需允许访问以上接口。授权仅请求按钮列出的服务域名；授权后重新选择文本即可。'; section.append(help);
    }
    if (name === '外观') {
      const colors = ['googleColor', 'youdaoColor', 'freeBorderColor', 'selectedBorderColor', 'sentenceColor'];
      const guide = doc.createElement('p'); guide.className = 'at-guide at-color-guide';
      guide.textContent = '☀ 日间 | ☾ 夜间'; section.append(guide);
      for (const key of colors) {
        const row = addControl(section, key); row.classList.add('at-color-pair');
        const input = controls.get(key);
        input.title = `${labelFor(key)} · 日间`; input.setAttribute('aria-label', input.title);
        addControl(section, 'night' + key[0].toUpperCase() + key.slice(1), row);
      }
    }
    if (name === '快捷键') {
      const help = doc.createElement('p'); help.className = 'at-guide';
      help.textContent = '点击“录制”后按下新键位，支持 Ctrl / Alt / Shift。可手工填写多个备用键，用 / 分隔；清空即可禁用。1/2 控制段落，4/5 控制句子。'; section.append(help);
    }
    if (name === '帮助') {
      const guide = doc.createElement('p'); guide.className = 'at-guide';
      guide.textContent = '左键选择整段；右键选择句子。默认 1/2：下一段/上一段；4/5：下一句/上一句（主键盘与小键盘均可）。F1/Num 0 重读，空格自动阅读，Esc 停止。句子模式只翻译选中句子，译文跟在该句后；自动阅读沿当前模式前进。';
      section.append(guide);
    }
    sections.append(section);
  }
  selectTab(settingsGroups.findIndex(([name]) => name === store.values.settingsTab), false);
  root.append(form);
  updateTheme(store.values);

  const save = event => {
    const input = event.target;
    if (!controls.has(input.name)) return;
    const value = input.type === 'checkbox' ? input.checked : input.value;
    const output = input.parentElement.querySelector('output');
    if (output) output.textContent = value;
    const current = ++revision;
    try {
      const normalized = App.normalizeSetting(input.name, value);
      App.validateShortcuts({ ...store.values, [input.name]: normalized });
      input.setCustomValidity('');
    } catch (error) {
      input.setCustomValidity(error.message);
      status.textContent = `${labelFor(input.name)}：${error.message}（保留上次有效值）`;
      return;
    }
    status.textContent = '';
    // Serialize writes, including rapid slider changes, so older writes cannot win.
    queue = queue.then(() => store.set(input.name, value)).then(() => {
      if (current === revision) status.textContent = '';
    }).catch(error => {
      if (current === revision) status.textContent = `保存失败：${error.message}`;
    });
  };
  form.addEventListener('input', save);
  // Native select controls may only dispatch change on some browsers.
  form.addEventListener('change', event => {
    const input = event.target;
    const value = input.type === 'checkbox' ? input.checked : input.value;
    if (String(store.values[input.name]) !== String(value)) save(event);
  });
  const unsubscribe = store.subscribe((values, patch) => {
    if ('settingsTab' in patch) selectTab(settingsGroups.findIndex(([name]) => name === values.settingsTab), false);
    updateTheme(values);
    for (const [key, input] of controls) {
      // Preserve active text editing, but synchronize switches and reset values.
      if (input.type === 'text' && (root.activeElement === input || doc.activeElement === input)) continue;
      if (input.type === 'checkbox') input.checked = values[key];
      else input.value = values[key];
      const output = input.parentElement.querySelector('output');
      if (output) output.textContent = values[key];
    }
  });
  const populate = (input, options, current) => {
    if (!options.some(option => String(option.value) === String(current))) options.unshift({ value: current, name: `${current}（当前配置，声音暂不可用）` });
    input.replaceChildren(...options.map(item => {
      const option = doc.createElement('option');
      option.value = item.value; option.textContent = item.name;
      return option;
    }));
    input.value = current;
  };
  const loadVoices = () => {
    populate(controls.get('winVoice'), (window.speechSynthesis?.getVoices() || []).map((voice, index) => ({ value: index, name: `${voice.name} (${voice.lang})` })), store.values.winVoice);
  };
  loadVoices();
  window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
  populate(controls.get('huoshVoice'), App.huoshanVoices.map(voice => ({ value: voice.id, name: `${voice.lang} · ${voice.name}` })), store.values.huoshVoice);
  let mounted = true, voiceRequest = 0;
  let updateState = 'checking', updatePending = false;
  const updateStatus = (state, text, title, url = App.release.page) => {
    updateState = updateLink.dataset.state = state;
    updateLink.textContent = text; updateLink.title = title; updateLink.href = url;
    updateLink.setAttribute('aria-busy', String(state === 'checking'));
  };
  const checkUpdate = async (force = false) => {
    if (updatePending || !mounted) return;
    updatePending = true;
    updateStatus('checking', '检查更新…', '正在检查 GitHub 正式发布版本');
    try {
      if (platform.hasServiceAccess && !await platform.hasServiceAccess('updates', store.values)) {
        if (mounted) updateStatus('permission', '授权检查更新', '点击允许访问 GitHub 版本接口');
        return;
      }
      const result = await platform.send({ action: 'check_update', force });
      if (!mounted) return;
      const labels = { available: `建议更新v${result.version}`, current: '当前为最新版本', unpublished: '尚无公开版本' };
      if (!(result.state in labels)) throw new Error('版本检查响应无效');
      updateStatus(result.state, labels[result.state], result.state === 'available'
        ? '仅提示版本；点击查看 GitHub 发布页，安装更新请使用对应平台'
        : '以 GitHub 正式版为准；点击重新检查', result.url);
    } catch (error) {
      if (mounted) updateStatus('error', '检查失败 · 重试', `${error.message}；点击重试`);
    } finally { updatePending = false; }
  };
  updateLink.addEventListener('click', event => {
    if (updateState === 'available') return;
    event.preventDefault();
    if (updateState === 'permission') {
      // Preserve user activation for Chrome's origin permission prompt.
      platform.requestServiceAccess('updates', store.values).then(granted => {
        if (!mounted) return;
        if (granted) void checkUpdate(true);
        else updateStatus('permission', '授权检查更新', '未授权；点击重试');
      }).catch(error => { if (mounted) updateStatus('permission', '授权检查更新', error.message); });
    } else void checkUpdate(true);
  });
  void checkUpdate();
  let permissionRevision = 0;
  const refreshPermissions = async () => {
    const revision = ++permissionRevision;
    await Promise.all(permissionRows.map(async ({ id, service, text, button }) => {
      try {
        button.title = App.serviceOrigins(id, store.values).map(origin => new URL(origin).hostname).join('、');
        const granted = await platform.hasServiceAccess(id, store.values);
        if (!mounted || revision !== permissionRevision) return;
        text.textContent = `${service.name} 接口：${granted ? '已授权' : '未授权'}`;
        button.disabled = granted;
      } catch (error) {
        if (mounted && revision === permissionRevision) { text.textContent = `权限检查失败：${error.message}`; button.disabled = false; }
      }
    }));
  };
  void refreshPermissions();
  const unwatchPermissions = permissionRows.length ? platform.watchServiceAccess(() => { void refreshPermissions(); }) : () => {};
  const refreshVits = async () => {
    if (!platform) return;
    const requestId = ++voiceRequest;
    const input = controls.get('vitsVoice');
    const placeholder = text => {
      const option = doc.createElement('option'); option.value = store.values.vitsVoice; option.textContent = text;
      input.replaceChildren(option); input.disabled = true;
    };
    placeholder('正在获取声音列表…');
    try {
      const response = await platform.send({ action: 'vits_speakers', settings: store.values });
      if (!mounted || requestId !== voiceRequest) return;
      const voices = response.voices.filter(voice => Number.isInteger(Number(voice.id)) && Number(voice.id) >= 0);
      if (!voices.length) { placeholder('服务未返回 VITS 声音'); return; }
      const selected = voices.some(voice => Number(voice.id) === store.values.vitsVoice) ? store.values.vitsVoice : Number(voices[0].id);
      populate(input, voices.map(voice => ({ value: Number(voice.id), name: `${voice.id} · ${voice.name || '未命名'} · ${(voice.lang || []).join('/')}` })), selected);
      input.disabled = false;
      await store.set('vitsVoice', selected);
    } catch (error) {
      if (mounted && requestId === voiceRequest) placeholder(`获取失败：${error.message}`);
    }
  };
  void refreshVits();
  const unwatchVits = store.subscribe((_values, patch) => {
    if ('vitsAPI' in patch) { void refreshPermissions(); void refreshVits(); }
  });
  return () => {
    mounted = false; unwatchVits(); unwatchPermissions();
    unsubscribe();
    window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
    form.remove();
  };
}

App.mountSettings = mountSettings;
