import { defaults, settingOptions, numericRules, normalizeSetting, shortcutActions, shortcutFromEvent, validateShortcuts, huoshanVoices } from './settings.js';
import metadata from '../../package.json' with { type: 'json' };
import settingsOn from '../../assets/settings-on.jpg';
import settingsOff from '../../assets/settings-off.jpg';
const headerImages = { on: settingsOn, off: settingsOff };
const settingsGroups = [
  ['复制', ['copy', 'targetTags', 'ignoreFurigana', 'showCopyContent', 'extraImage', 'ignoreSymbolPairs', 'symbolPairs', 'sentenceDelimiters']],
  ['语音', ['readingInterval', 'splitSpeech']],
  ['翻译', []],
  ['外观', ['borderWidth', 'borderStyle', 'borderRadius', 'scrollSwitch', 'scrollIntoView']],
  ['快捷键', Object.keys(shortcutActions)],
  ['帮助', []]
];
const settingLabels = {
  pluginSwitch: '启用阅读工具', copy: '复制文本', ignoreFurigana: '忽略振假名', showCopyContent: '显示复制内容', extraImage: '点击打开图片',
  targetTags: '目标文本标签',
  ignoreSymbolPairs: '忽略首尾符号对', symbolPairs: '首尾符号对', splitSpeech: '把段落切成句子', sentenceDelimiters: '断句符号', readingInterval: '自动朗读间隔（毫秒）',
  shortcutPreviousParagraph: '上一段', shortcutNextParagraph: '下一段', shortcutPreviousSentence: '上一句', shortcutNextSentence: '下一句',
  shortcutReadCurrent: '重读当前选择', shortcutAutoRead: '自动阅读 / 暂停', shortcutStop: '停止朗读',
  useWindowsTTS: '启用系统语音', winVoice: '系统声音', rate: '语速', pitch: '音调', useVITS: '启用 VITS',
  useHuoshTTS: '启用火山语音', huoshVoice: '火山声音', huoshRate: '播放速度',
  vitsAPI: '服务地址', vitsVoice: '声线（id）', vitsLang: '语言（lang）', length: '发音长度（length 越大越慢）',
  noise: '声音随机性（noise）', noisew: '发音时长随机性（noisew）', max: '合成分段阈值（segment_size）', vitsCustomAPI: '完整 API 地址（可选）',
  google: '启用 Google', youdao: '启用有道',
  borderWidth: '框宽度', borderStyle: '框样式', borderRadius: '框圆角',
  freeBorderColor: '预选框颜色', selectedBorderColor: '激活框颜色', sentenceColor: '句子高亮颜色', scrollSwitch: '自动滚动到段落/句子', scrollIntoView: '滚动方式'
};
const selectOptions = settingOptions;

export function mountSettings(root, store, platform) {
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
  const title = doc.createElement('h1'), version = doc.createElement('div');
  title.className = 'at-sr-only'; title.textContent = 'AnonTranslator';
  version.className = 'at-version'; version.textContent = `Ver ${metadata.version}`;
  const update = doc.createElement('a'), author = doc.createElement('small');
  update.className = 'at-update'; update.id = 'newVersion'; update.textContent = 'Update:…';
  update.href = platform.updateURL; update.target = '_blank'; update.rel = 'noopener noreferrer'; update.setAttribute('aria-live', 'polite');
  author.className = 'at-author'; author.textContent = `By: ${metadata.author}`;
  version.append(' ', update, author);
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
    if (!doc.defaultView.confirm('确定重置所有设置吗？')) return;
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
  header.append(artwork, title, version, actions, power); form.append(header);
  const updateTheme = values => {
    root.dataset.atTheme = form.dataset.atTheme = values.nightMode ? 'night' : 'day';
    themeButton.textContent = values.nightMode ? '☾' : '☀';
    themeButton.title = values.nightMode ? '切换日间模式' : '切换夜间模式';
    themeButton.setAttribute('aria-label', themeButton.title);
    themeButton.setAttribute('aria-pressed', String(values.nightMode));
    const state = values.pluginSwitch ? 'on' : 'off';
    if (artwork.dataset.state !== state) {
      artwork.dataset.state = state; artwork.src = headerImages[state];
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
      input.min = numericRules[key][0]; input.max = numericRules[key][1]; input.step = '0.1';
    } else if (numericRules[key]) {
      input.type = 'number';
      input.min = numericRules[key][0]; input.max = numericRules[key][1];
      input.step = numericRules[key][2] ? '1' : '0.01';
    } else input.type = 'text';
    if (key === 'vitsAPI') { input.placeholder = 'http://127.0.0.1:23456'; input.spellcheck = false; }
    if (key === 'vitsCustomAPI') { input.placeholder = 'http://127.0.0.1:23456/voice/vits?id=0&lang=ja'; input.spellcheck = false; }
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
        input.value = shortcutFromEvent(event);
        delete input.dataset.recording; record.textContent = '录制';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      input.addEventListener('blur', () => { delete input.dataset.recording; record.textContent = '录制'; });
      reset.addEventListener('click', () => { input.value = defaults[key]; input.dispatchEvent(new Event('input', { bubbles: true })); });
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
      return fieldset;
    };
    if (name === '语音') {
      addGroup('系统语音', ['useWindowsTTS', 'winVoice', 'rate', 'pitch']);
      addGroup('火山语音', ['useHuoshTTS', 'huoshVoice', 'huoshRate'], 'huosh');
      const vits = addGroup('VITS', ['useVITS', 'vitsAPI', 'vitsVoice', 'vitsLang', 'length', 'noise', 'noisew', 'max'], 'vits');
      const refresh = doc.createElement('button'); refresh.type = 'button'; refresh.className = 'at-refresh-voices'; refresh.textContent = '刷新声音列表';
      refresh.addEventListener('click', () => { void refreshVits(); });
      controls.get('vitsVoice').parentElement.append(refresh);
      const download = doc.createElement('p'); download.className = 'at-guide';
      const link = doc.createElement('a'); link.textContent = 'VITS 整合包下载';
      link.href = 'https://github.com/raindrop213/LunaTranslator-re/releases/tag/v0.0.3'; link.target = '_blank'; link.rel = 'noopener noreferrer';
      download.append(link, '：选择需要的版本，解压后运行 start.bat，待服务地址出现即可使用。');
      vits.append(download);
      addControl(vits, 'vitsCustomAPI');
      const customHelp = doc.createElement('p'); customHelp.className = 'at-guide';
      customHelp.textContent = '如果你熟悉此项目，可填入完整的 API 调用”链接。非空时优先使用此地址，声音、语言等参数以该链接为准。text 可填可不填，会自动替换或补上当前选中的文本。';
      vits.append(customHelp);
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
      help.textContent = name === '帮助'
        ? '授权后查询 GitHub 最新 Release，点击顶部更新状态打开对应平台的更新页。'
        : '只允许指定阅读网站时，还需允许访问以上接口。授权仅请求按钮列出的服务域名；授权后重新选择文本即可。'; section.append(help);
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
      for (const text of [
        '左键点击正文拾取整段，右键点击句子拾取单句。开启“复制文本”后自动复制，开启“显示复制内容”可查看拾取结果。',
        '默认拾取 p、h1–h6 标签。正文无法选中时，可在“复制 → 目标文本标签”补充 li、div 等标签，用逗号分隔。',
        '默认忽略振假名（ruby 读音），保留正文中的换行，不重复拾取插件译文。可在“复制”栏调整振假名、首尾符号对和断句符号；段落与句子导航的键位可在“快捷键”栏查看。'
      ]) {
        const guide = doc.createElement('p'); guide.className = 'at-guide'; guide.textContent = text; section.append(guide);
      }
      const project = doc.createElement('p'); project.className = 'at-guide';
      const link = doc.createElement('a'); link.textContent = 'raindrop213/AnonTranslator';
      link.href = 'https://github.com/raindrop213/AnonTranslator'; link.target = '_blank'; link.rel = 'noopener noreferrer';
      project.append('项目地址：', link); section.append(project);
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
      const normalized = normalizeSetting(input.name, value);
      validateShortcuts({ ...store.values, [input.name]: normalized });
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
  populate(controls.get('huoshVoice'), huoshanVoices.map(voice => ({ value: voice.id, name: `${voice.lang} · ${voice.name}` })), store.values.huoshVoice);
  let mounted = true, voiceRequest = 0;
  let updateRevision = 0, updateAccess;
  const refreshUpdate = async (granted = true) => {
    const current = ++updateRevision;
    update.textContent = 'Update:…';
    try {
      if (!granted) throw new Error('请在“帮助”栏授权版本更新接口');
      const latest = await platform.send({ action: 'check_update' });
      if (!mounted || current !== updateRevision) return;
      update.textContent = latest.available ? `Update:${latest.version}↻` : 'Latest:√';
      update.title = latest.available ? `发现新版本 ${latest.version}，点击前往更新页` : '当前已是最新版本，点击查看更新页';
    } catch (error) {
      if (!mounted || current !== updateRevision) return;
      update.textContent = 'Update:×'; update.title = `${error.message}；点击查看更新页`;
    }
  };
  let permissionRevision = 0;
  const refreshPermissions = async () => {
    const revision = ++permissionRevision;
    await Promise.all(permissionRows.map(async ({ id, service, text, button }) => {
      try {
        button.title = platform.serviceOrigins(id, store.values).map(origin => new URL(origin).hostname).join('、');
        const granted = await platform.hasServiceAccess(id, store.values);
        if (!mounted || revision !== permissionRevision) return;
        text.textContent = `${service.name} 接口：${granted ? '已授权' : '未授权'}`;
        button.disabled = granted;
        if (id === 'update' && granted !== updateAccess) { updateAccess = granted; void refreshUpdate(granted); }
      } catch (error) {
        if (mounted && revision === permissionRevision) {
          text.textContent = `权限检查失败：${error.message}`; button.disabled = false;
          if (id === 'update') {
            updateRevision++; updateAccess = undefined;
            update.textContent = 'Update:×'; update.title = `${error.message}；点击查看更新页`;
          }
        }
      }
    }));
  };
  void refreshPermissions();
  if (!platform.servicePermissions?.update) void refreshUpdate();
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
    if ('vitsAPI' in patch || 'vitsCustomAPI' in patch) void refreshPermissions();
    if ('vitsAPI' in patch) void refreshVits();
  });
  return () => {
    mounted = false; unwatchVits(); unwatchPermissions();
    unsubscribe();
    window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
    form.remove();
  };
}


