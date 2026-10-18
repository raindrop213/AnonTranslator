import { defaults, settingOptions, numericRules, normalizeSetting, shortcutActions, shortcutFromEvent, validateShortcuts, huoshanVoices, posGroups } from './settings.js';
import metadata from '../../package.json' with { type: 'json' };
import { mountAnkiPanel } from './anki-panel.js';
import { mountServiceOrdering } from './service-order.js';
const settingsGroups = [
  ['复制', ['copy', 'targetTags', 'ignoreFurigana', 'showCopyContent', 'extraImage', 'ignoreSymbolPairs', 'symbolPairs', 'sentenceDelimiters']],
  ['语音', ['readingInterval', 'splitSpeech']],
  ['翻译', []],
  ['词典', ['dictionaryEnabled', 'dictionaryFurigana', 'dictionaryBaseForm', 'dictionaryPopupMode']],
  ['Anki', ['ankiEnabled']],
  ['外观', ['scrollSwitch', 'scrollIntoView']],
  ['快捷键', ['swapMouseButtons', ...Object.keys(shortcutActions)]],
  ['帮助', []]
];
const settingLabels = {
  pluginSwitch: '启用阅读工具', copy: '复制文本', ignoreFurigana: '忽略振假名', showCopyContent: '显示复制内容', extraImage: '点击打开图片',
  targetTags: '目标文本标签',
  ignoreSymbolPairs: '忽略首尾符号对', symbolPairs: '首尾符号对', splitSpeech: '朗读段落时先切成句子', sentenceDelimiters: '断句符号', readingInterval: '自动朗读间隔（毫秒）',
  shortcutPreviousParagraph: '上一段', shortcutNextParagraph: '下一段', shortcutPreviousSentence: '上一句', shortcutNextSentence: '下一句',
  shortcutReadCurrent: '重读当前选择', shortcutAutoRead: '自动阅读 / 暂停', shortcutStop: '清除所有效果',
  swapMouseButtons: '左右键对调',
  useWindowsTTS: '启用系统语音', winVoice: '系统声音', rate: '语速', pitch: '音调', useVITS: '启用 VITS',
  useHuoshTTS: '启用火山语音', huoshVoice: '火山声音', huoshRate: '播放速度',
  vitsAPI: '服务地址', vitsVoice: '声线（id）', vitsLang: '语言（lang）', length: '发音长度（length 越大越慢）',
  noise: '声音随机性（noise）', noisew: '发音时长随机性（noisew）', max: '合成分段阈值（segment_size）', vitsCustomAPI: '完整 API 地址（可选）',
  google: '启用 Google', youdao: '启用有道', googleColor: 'Google 译文', youdaoColor: '有道译文',
  dictionaryEnabled: '启用分词查词', dictionaryFurigana: '显示汉字振假名', dictionaryWeblio: '启用 Weblio', dictionaryMoji: '启用 MOJi',
  dictionaryBaseForm: '点击词语时查询基本形（原型）',
  dictionaryPopupMode: '查词窗模式',
  dictionarySearchURL: '外部搜索地址', posOpacity: '不透明度',
  ankiEnabled: '启用 Anki 制卡', ankiURL: 'AnkiConnect 地址', ankiAPIKey: 'API Key（可选）',
  ankiModel: '笔记模板名称（deck）', ankiDecks: '卡组（每行一个，首行为默认）', ankiTags: '标签（每行一个，可多选）',
  ankiTranslationServices: '例句翻译（Translation）', ankiWordAudioService: '单词音频（WordAudio）', ankiSentenceAudioService: '例句音频（SentenceAudio）', ankiBoldWord: '标注例句中的单词（加<b>标签）',
  ankiSuccessSound: '保存成功时提示音', ankiCloseAfterAdd: '添加成功后关闭查词窗', ankiImageFormat: '图片格式', ankiLayout: '制卡区位置',
  sentenceColor: '例句底色', scrollSwitch: '自动滚动到段落/句子', scrollIntoView: '滚动方式',
  ...Object.fromEntries(posGroups.map(group => [group.key, group.label]))
};
const selectOptions = settingOptions;

export function mountSettings(root, store, platform) {
  const doc = root.ownerDocument;
  const controls = new Map();
  const permissionRows = [];
  const serviceOrdering = new Map();
  const form = doc.createElement('form');
  form.className = 'at-settings';
  form.setAttribute('data-at-ui', '');
  form.addEventListener('submit', event => event.preventDefault());
  let queue = Promise.resolve(), revision = 0, ankiPanel = null;
  const header = doc.createElement('header');
  header.className = 'at-header';
  const heading = doc.createElement('div'); heading.className = 'at-heading';
  const title = doc.createElement('h1'), version = doc.createElement('div');
  title.textContent = 'AnonTranslator';
  version.className = 'at-version'; version.textContent = `Ver ${metadata.version}`;
  const update = doc.createElement('a');
  update.className = 'at-update'; update.id = 'newVersion'; update.textContent = 'Update:…';
  update.href = platform.updateURL; update.target = '_blank'; update.rel = 'noopener noreferrer'; update.setAttribute('aria-live', 'polite');
  version.append(' · ', update);
  heading.append(title, version);
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
      ankiPanel?.reload();
      loadVoices();
      void refreshVits(); status.textContent = '';
    }).catch(error => { status.textContent = `重置失败：${error.message}`; });
  });
  const power = doc.createElement('label'), powerInput = doc.createElement('input');
  power.className = 'at-power'; powerInput.type = 'checkbox'; powerInput.name = powerInput.id = 'pluginSwitch';
  powerInput.checked = store.values.pluginSwitch; powerInput.setAttribute('aria-label', '启用阅读工具');
  power.append(powerInput, '启用'); controls.set('pluginSwitch', powerInput);
  actions.append(themeButton, resetButton);
  header.append(heading, actions, power); form.append(header);
  const updateTheme = values => {
    root.dataset.atTheme = form.dataset.atTheme = values.nightMode ? 'night' : 'day';
    themeButton.textContent = values.nightMode ? '☾' : '☀';
    themeButton.title = values.nightMode ? '切换日间模式' : '切换夜间模式';
    themeButton.setAttribute('aria-label', themeButton.title);
    themeButton.setAttribute('aria-pressed', String(values.nightMode));
    power.title = values.pluginSwitch ? '关闭阅读工具' : '启用阅读工具';
    controls.get('symbolPairs')?.toggleAttribute('disabled', !values.ignoreSymbolPairs);
    for (const key of ['dictionaryFurigana', 'dictionaryBaseForm', 'dictionaryWeblio', 'dictionaryMoji', 'dictionarySearchURL']) {
      const input = controls.get(key);
      input?.toggleAttribute('disabled', !values.dictionaryEnabled);
      input?.closest('.at-setting')?.classList.toggle('at-setting-disabled', !values.dictionaryEnabled);
    }
    dictionaryNotice.hidden = !values.dictionaryEnabled || values.dictionaryWeblio || values.dictionaryMoji;
  };
  const dictionaryNotice = doc.createElement('p');
  dictionaryNotice.className = 'at-guide at-dictionary-notice';
  dictionaryNotice.textContent = '当前未开启词典服务，仍可分词。选择至少一个服务后即可在线查词。';
  const status = doc.createElement('p');
  status.className = 'at-save-status';
  status.setAttribute('role', 'status');
  form.append(status);
  const labelFor = key => {
    const base = key.startsWith('night') ? key[5].toLowerCase() + key.slice(6) : key;
    return settingLabels[base] || `${base.replace(/(From|To|Color)$/, '')} ${{ From: '源语言', To: '目标语言', Color: '颜色' }[base.match(/(From|To|Color)$/)?.[0]] || base}`;
  };
  const displayValue = (key, value) => key === 'posOpacity' ? `${value}%` : value;
  const controlValue = input => input.name === 'ankiTranslationServices'
    ? [...input.closest('.at-setting').querySelectorAll('input[type=checkbox]')].filter(choice => choice.checked).map(choice => choice.value)
    : input.type === 'checkbox' ? input.checked : input.value;
  const addControl = (parent, key, colorRow = null) => {
    const row = doc.createElement(key.endsWith('Color') || key === 'ankiTranslationServices' ? 'div' : 'label');
    row.className = 'at-setting';
    const label = doc.createElement('span');
    label.textContent = labelFor(key);
    if (['symbolPairs', 'scrollIntoView'].includes(key)) label.className = 'at-sr-only';
    row.append(label);
    const value = store.values[key];
    if (key === 'ankiTranslationServices') {
      const choices = doc.createElement('div'); choices.className = 'at-service-choices';
      for (const service of store.values.translationOrder) {
        const title = { google: 'Google', youdao: '有道' }[service];
        const option = doc.createElement('label'), input = doc.createElement('input'); input.type = 'checkbox'; input.name = key; input.value = service; input.checked = value.includes(service); input.id = key + '-' + service;
        option.append(input, title); choices.append(option);
        if (!controls.has(key)) controls.set(key, input);
      }
      row.append(choices); parent.append(row); return row;
    }
    const input = doc.createElement(['ankiDecks', 'ankiTags'].includes(key) ? 'textarea' : selectOptions[key] || ['winVoice', 'vitsVoice'].includes(key) ? 'select' : 'input');
    input.id = key;
    input.name = key;
    if (input.tagName === 'SELECT') {
      for (const optionValue of selectOptions[key] || [value]) {
        const option = doc.createElement('option');
        option.value = optionValue;
        option.textContent = key === 'ankiLayout' ? { below: '词典下方', right: '词典右侧' }[optionValue]
          : key === 'dictionaryPopupMode' ? { page: '页面浮窗', independent: '独立窗口 / 底部面板' }[optionValue]
          : ['ankiWordAudioService', 'ankiSentenceAudioService'].includes(key) ? { none: '无', huosh: '火山语音', vits: 'VITS'}[optionValue] : optionValue;
        input.append(option);
      }
    } else if (input.tagName === 'TEXTAREA') { input.rows = 3; input.spellcheck = false; }
    else if (key === 'ankiAPIKey') { input.type = 'password'; input.autocomplete = 'off'; }
    else if (typeof value === 'boolean') input.type = 'checkbox';
    else if (key.endsWith('Color')) input.type = 'color';
    else if (['rate', 'huoshRate', 'pitch', 'length', 'posOpacity'].includes(key)) {
      input.type = 'range';
      input.min = numericRules[key][0]; input.max = numericRules[key][1]; input.step = key === 'posOpacity' ? '1' : '0.1';
    } else if (numericRules[key]) {
      input.type = 'number';
      input.min = numericRules[key][0]; input.max = numericRules[key][1];
      input.step = numericRules[key][2] ? '1' : '0.01';
    } else input.type = 'text';
    if (key === 'vitsAPI') { input.placeholder = 'http://127.0.0.1:23456'; input.spellcheck = false; }
    if (key === 'vitsCustomAPI') { input.placeholder = 'http://127.0.0.1:23456/voice/vits?id=0&lang=ja'; input.spellcheck = false; }
    if (key === 'targetTags') { input.placeholder = 'p,h1,h2,h3,h4,h5,h6'; input.spellcheck = false; }
    if (key === 'dictionarySearchURL') { input.placeholder = defaults.dictionarySearchURL; input.spellcheck = false; input.autocapitalize = 'off'; }
    if (key === 'ankiURL') { input.placeholder = defaults.ankiURL; input.spellcheck = false; }
    if (key === 'posOpacity') row.classList.add('at-opacity');
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
      output.textContent = displayValue(key, value);
      row.append(output);
    }
    if (colorRow) {
      input.title = input.getAttribute('aria-label') || `${labelFor(key)} · 夜间`;
      input.setAttribute('aria-label', input.title); colorRow.append(input);
    } else parent.append(row);
    if (key === 'swapMouseButtons') {
      const help = doc.createElement('p'); help.className = 'at-guide';
      help.textContent = '默认左键激活句子，右键激活段落。';
      parent.append(help);
    }
    controls.set(key, input);
    return row;
  };
  const tabs = doc.createElement('nav'); tabs.className = 'at-tabs';
  tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '设置栏目');
  const sections = doc.createElement('div'); sections.className = 'at-settings-sections';
  sections.append(tabs); form.append(sections);
  const panels = [], tabButtons = [];
  const sortable = (section, key, groups) => {
    serviceOrdering.set(key, mountServiceOrdering(section, key, groups, order => {
      queue = queue.then(() => store.set(key, order)).catch(error => {
        status.textContent = '保存服务顺序失败：' + error.message; serviceOrdering.get(key).refresh(store.values[key]);
      });
    }, store.values[key]));
  };
  const selectTab = (index, remember = true) => {
    tabButtons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    if (settingsGroups[index]?.[0] === 'Anki') void ankiPanel?.refreshDraft();
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
      sortable(section, 'translationOrder', serviceGroups);
    }
    if (name === '词典') {
      addGroup('Weblio', ['dictionaryWeblio'], 'weblio');
      addGroup('MOJi', ['dictionaryMoji'], 'moji');
      sortable(section, 'dictionaryOrder', serviceGroups);
      section.append(dictionaryNotice);
      const search = addGroup('外部搜索', ['dictionarySearchURL']);
      const searchHelp = doc.createElement('p'); searchHelp.className = 'at-guide';
      searchHelp.textContent = '使用完整网址，并用 {word} 代替查询词。如：谷歌：https://www.google.com/search?q={word}；维基百科(日)：https://ja.wikipedia.org/wiki/{word}。';
      search.append(searchHelp);
    }
    if (name === 'Anki') {
      const guide = doc.createElement('p'); guide.className = 'at-guide';
      const ankiLink = document.createElement('a'); ankiLink.textContent = 'Anki'; ankiLink.href = 'https://apps.ankiweb.net/'; ankiLink.target = '_blank'; ankiLink.rel = 'noopener noreferrer';
      const ankiConnectLink = document.createElement('a'); ankiConnectLink.textContent = 'AnkiConnect'; ankiConnectLink.href = 'https://ankiweb.net/shared/info/2055492159'; ankiConnectLink.target = '_blank'; ankiConnectLink.rel = 'noopener noreferrer';
      guide.append('需安装 ', ankiLink, ' 及其插件 ', ankiConnectLink, ' 并保持开启状态。');
      section.append(guide);
      const connection = addGroup('连接', ['ankiURL', 'ankiAPIKey'], 'anki');
      addGroup('卡组与标签', ['ankiDecks', 'ankiTags']);
      const services = addGroup('制卡服务', ['ankiTranslationServices', 'ankiWordAudioService', 'ankiSentenceAudioService']);
      const serviceGuide = doc.createElement('p'); serviceGuide.className = 'at-guide';
      serviceGuide.textContent = '不需要启用语音栏中对应的服务，但需要读取对应的设置'; services.append(serviceGuide);
      addGroup('制卡选项', ['ankiBoldWord', 'ankiSuccessSound', 'ankiCloseAfterAdd', 'ankiImageFormat', 'ankiLayout']);
      ankiPanel = mountAnkiPanel(section, store, platform, { connectionGroup: connection, addControl, async beforeAction() {
        await queue;
        for (const [key, input] of controls) if (key.startsWith('anki') && !input.checkValidity()) {
          input.reportValidity(); throw new Error(`${labelFor(key)}：${input.validationMessage}`);
        }
      } });
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
    if (name === '外观') {
      const guide = doc.createElement('p'); guide.className = 'at-guide at-color-guide';
      guide.textContent = '☀ 日间 | ☾ 夜间'; section.append(guide);
      for (const [title, colors] of [['阅读与译文', ['sentenceColor', 'googleColor', 'youdaoColor']], ['分词底色', posGroups.map(group => group.key)]]) {
        const group = addGroup(title, []);
        if (title === '分词底色') addControl(group, 'posOpacity');
        for (const key of colors) {
          const row = addControl(group, key); row.classList.add('at-color-pair');
          const input = controls.get(key);
          input.title = `${labelFor(key)} · 日间`; input.setAttribute('aria-label', input.title);
          addControl(group, 'night' + key[0].toUpperCase() + key.slice(1), row);
        }
      }
    }
    if (name === '快捷键') {
      const help = doc.createElement('p'); help.className = 'at-guide';
      help.textContent = '点击“录制”后按下新键位，支持 Ctrl / Alt / Shift。可手工填写多个备用键，用 / 分隔；清空即可禁用。'; section.append(help);
    }
    if (name === '帮助') {
      for (const text of [
        '网页小说阅读工具，支持按句子或段落复制、朗读和翻译。',
        '支持分词着色、振假名、在线查词，以及带例句、图片和音频的 Anki 制卡。',
        '均采用在线服务，目标是构建最灵活通用的学习环境。',
      ]) {
        const guide = doc.createElement('p'); guide.className = 'at-guide'; guide.textContent = text; section.append(guide);
      }
      if (Object.keys(platform?.servicePermissions || {}).length) {
        const help = doc.createElement('p'); help.className = 'at-guide';
        help.textContent = 'Chrome扩展修改成“在特定网站上”运行的时候，每个服务都需要授权添加地址，只需点击授权按钮即可。'; section.append(help);
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
    const value = controlValue(input);
    const output = input.parentElement.querySelector('output');
    if (output) output.textContent = displayValue(input.name, value);
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
    const value = controlValue(input);
    if (String(store.values[input.name]) !== String(value)) save(event);
  });
  const unsubscribe = store.subscribe((values, patch) => {
    if ('settingsTab' in patch) selectTab(settingsGroups.findIndex(([name]) => name === values.settingsTab), false);
    updateTheme(values);
    for (const [key, ordering] of serviceOrdering) if (key in patch) ordering.refresh(values[key]);
    for (const [key, input] of controls) {
      // Preserve active text editing, but synchronize switches and reset values.
      if ((['text', 'password'].includes(input.type) || input.tagName === 'TEXTAREA') && (root.activeElement === input || doc.activeElement === input)) continue;
      if (key === 'ankiTranslationServices') {
        const choices = input.closest('.at-setting').querySelector('.at-service-choices');
        values.translationOrder.forEach((service, index) => {
          const choice = choices.querySelector(`input[value="${service}"]`); choice.checked = values[key].includes(service);
          if (choices.children[index] !== choice.parentElement) choices.insertBefore(choice.parentElement, choices.children[index] || null);
        });
      }
      else if (input.type === 'checkbox') input.checked = values[key];
      else input.value = values[key];
      const output = input.parentElement.querySelector('output');
      if (output) output.textContent = displayValue(key, values[key]);
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
        if (id === 'update') text.parentElement.hidden = granted;
        if (id === 'update' && granted !== updateAccess) { updateAccess = granted; void refreshUpdate(granted); }
      } catch (error) {
        if (mounted && revision === permissionRevision) {
          text.textContent = `权限检查失败：${error.message}`; button.disabled = false;
          if (id === 'update') {
            text.parentElement.hidden = false;
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
    if ('vitsAPI' in patch || 'vitsCustomAPI' in patch || 'ankiURL' in patch) void refreshPermissions();
    if ('vitsAPI' in patch) void refreshVits();
  });
  return () => {
    mounted = false; unwatchVits(); unwatchPermissions(); ankiPanel?.destroy();
    unsubscribe();
    window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
    form.remove();
  };
}


