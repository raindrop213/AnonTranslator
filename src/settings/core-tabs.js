import { aiProtocols } from '../services/ai.js';

export function createCoreTabs(ctx, { window, document }) {
  const e = ctx.escape;
  const paths = {
    chevron: '<path d="m8 10 4 4 4-4"/>', up: '<path d="m7 14 5-5 5 5"/>', down: '<path d="m7 10 5 5 5-5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    grip: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', link: '<path d="M14 3h7v7m-1-6L10 14"/><path d="M10 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z"/><path d="M13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.chevron}</svg>`;
  const hint = value => value ? `<p>${value}</p>` : '';
  const label = (key, name, description) => `<div class="setting-copy"><label for="core-${key}">${name}</label>${hint(description)}</div>`;
  const toggle = (key, name, description = '') => `<div class="setting-row">${label(key, name, description)}<label class="switch"><input id="core-${key}" data-pref="${key}" type="checkbox" role="switch" aria-label="${name}"><span class="switch-track"></span></label></div>`;
  const input = (key, name, description = '', attrs = '') => `<div class="setting-row core-field">${label(key, name, description)}<input class="core-input" id="core-${key}" data-pref="${key}" ${attrs || 'type="text"'} spellcheck="false"></div>`;
  const textarea = (key, name, description, placeholder, rows = 4) => `<div class="setting-row core-field">${label(key, name, description)}<textarea class="core-textarea" id="core-${key}" data-pref="${key}" rows="${rows}" placeholder="${e(placeholder)}" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></div>`;
  const select = (key, name, options, description = '') => `<div class="setting-row core-select-row">${label(key, name, description)}<div class="select-wrap"><select id="core-${key}" data-pref="${key}">${options.map(item => { const [value, text] = Array.isArray(item) ? item : [item, item]; return `<option value="${e(value)}">${e(text)}</option>`; }).join('')}</select>${svg('chevron')}</div></div>`;
  const range = (key, name, min, max, step, description = '', unit = '') => `<div class="setting-row core-range-row">${label(key, name, description)}<output data-output="${key}" class="core-value"></output>${unit ? `<span class="core-unit">${unit}</span>` : ''}<input id="core-${key}" data-pref="${key}" aria-label="${name}" type="range" min="${min}" max="${max}" step="${step}"></div>`;
  const group = (title, description, content, attrs = '') => `<div class="group-heading"><h3>${title}</h3>${hint(description)}</div><div class="settings-group glass" ${attrs}>${content}</div>`;
  const note = text => `<p class="core-note">${text}</p>`;
  const button = (text, attrs = '', primary = false) => `<button type="button" class="pill-button${primary ? ' primary' : ''}" ${attrs}>${text}</button>`;
  const permission = id => `<div class="core-permission"><span data-permission-status="${id}"><span class="core-status-dot"></span>接口未授权</span><button type="button" class="core-text-button" data-service-auth="${id}">授权接口 ${svg('arrow')}</button></div>`;
  const languageNames = { auto: '自动检测', 'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'zh-CHS': '简体中文', 'zh-CHT': '繁體中文', ja: '日语', en: '英语', zh: '中文' };
  const languages = key => (ctx.options[key] || []).map(value => [value, languageNames[value] || value]);
  const css = `
    .core-field { display: block; padding: 14px 0; }
    .core-field .setting-copy { margin-bottom: 10px; }
    .setting-row.core-symbol-pairs { border-top: 0; padding-top: 0; }
    .core-input, .core-textarea { width: 100%; min-width: 0; border: 1px solid var(--line); background: rgba(255,255,255,.19); box-shadow: inset 0 1px 3px rgba(var(--shadow),.035), 0 1px 0 var(--highlight); border-radius: 11px; padding: 10px 11px; font: inherit; font-size: 11px; color: var(--ink); }
    .core-input::placeholder, .core-textarea::placeholder { color: var(--faint); }
    .core-input:focus, .core-textarea:focus { border-color: var(--muted); }
    .core-input[type=number] { font-variant-numeric: tabular-nums; }
    .core-textarea { display: block; resize: vertical; min-height: 76px; line-height: 1.7; }
    .core-ai-json { font-family: Consolas, 'SFMono-Regular', monospace; }
    .core-note { font-size: 10px; color: var(--muted); line-height: 1.8; margin: 12px 4px 0; }
    .core-note a { color: var(--ink); text-decoration-color: var(--line); text-underline-offset: 3px; }
    .core-select-row { flex-wrap: wrap; gap: 9px; padding: 12px 0; }
    .core-select-row .select-wrap { max-width: 100%; }
    .core-select-row select { max-width: 100%; }
    .core-select-row.core-wide-select { display: block; }
    .core-wide-select .select-wrap { display: block; margin-top: 11px; }
    .core-wide-select select { width: 100%; }
    .core-range-row { display: flex; flex-wrap: wrap; padding: 14px 0; gap: 4px 8px; }
    .core-range-row .setting-copy { flex-basis: 65%; }
    .core-value { margin-left: auto; font-size: 11px; font-variant-numeric: tabular-nums; }
    .core-unit { font-size: 9px; color: var(--muted); }
    .core-range-row input[type=range] { width: 100%; height: 15px; margin: 7px 0 0; accent-color: var(--black); cursor: pointer; }
    .core-inline-action { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
    .core-inline-action > span { font-size: 10px; color: var(--muted); }
    .core-inline-action button { display: flex; align-items: center; gap: 6px; font-size: 10px; padding: 8px 13px; }
    .core-inline-action svg { width: 11px; height: 11px; }
    .core-permission { border-top: 1px solid var(--line); padding: 11px 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 9px; color: var(--muted); }
    .core-permission > span { display: flex; align-items: center; gap: 5px; }
    .core-permission svg { width: 11px; height: 11px; }
    .core-status-dot { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #b58a60; }
    .core-permission .is-authorized { color: var(--green); }
    .core-text-button { background: none; border: 0; padding: 2px; color: var(--ink); font-size: 9px; display: inline-flex; align-items: center; gap: 5px; }
    .core-text-button svg { width: 11px; height: 11px; }
    .core-details { border-top: 1px solid var(--line); }
    .core-details > summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 15px 0; font-size: 11px; }
    .core-details > summary::-webkit-details-marker { display: none; }
    .core-details > summary svg { width: 12px; height: 12px; color: var(--muted); transition: transform .2s; }
    .core-details[open] > summary svg { transform: rotate(180deg); }
    .core-details .core-note { margin: 0 0 14px; }
    .core-translation-order { display: grid; gap: 12px; margin-top: 15px; }
    .core-translation-card { padding: 0 15px; border-radius: 19px; background: var(--card); }
    .core-translation-top { display: flex; align-items: center; gap: 10px; padding: 14px 0; }
    .core-translation-top .drag-handle { width: 11px; margin-left: -4px; }
    .core-translation-top .drag-handle svg { stroke-width: 3; }
    .core-translation-top .service-name p { font-size: 9px; }
    .core-translation-top .service-logo { width: 30px; height: 30px; font-family: inherit; font-size: 16px; }
    .core-translation-top .order-actions { margin-left: -2px; }
    .core-translation-card > .core-select-row:first-of-type { border-top: 1px solid var(--line); }
    .core-translation-card.is-dragging { opacity: .4; }
    .core-translation-card.is-drop-target { outline: 1px solid var(--muted); outline-offset: 3px; }
    .core-order-note { display: flex; justify-content: space-between; align-items: center; color: var(--muted); font-size: 10px; margin: 0 3px; }
    .core-order-note span { display: flex; align-items: center; gap: 5px; }
    .core-order-note svg { width: 12px; height: 12px; }
    .core-shortcut-row { padding: 14px 0; border-top: 1px solid var(--line); }
    .core-shortcut-row:first-child { border-top: 0; }
    .core-shortcut-title { display: flex; justify-content: space-between; margin-bottom: 9px; gap: 8px; align-items: center; }
    .core-shortcut-title label { font-size: 11px; font-weight: 500; }
    .core-shortcut-title span { font-size: 9px; color: var(--faint); }
    .core-shortcut-inputs { display: flex; align-items: center; gap: 6px; }
    .core-shortcut-inputs input { flex: 1; font-family: Consolas, 'SFMono-Regular', monospace; font-size: 10px; padding: 9px 8px; }
    .core-shortcut-inputs button { padding: 8px 10px; font-size: 9px; white-space: nowrap; }
    .core-shortcut-row.is-recording input { border-color: var(--ink); background: var(--highlight); }
    .core-shortcut-row.is-recording [data-shortcut-record] { background: var(--black); color: var(--knob); }
    .core-shortcut-toolbar { display: flex; align-items: center; justify-content: space-between; margin: 15px 3px 0; gap: 12px; }
    .core-shortcut-toolbar span { color: var(--muted); font-size: 9px; line-height: 1.7; }
    .core-shortcut-toolbar button { flex-shrink: 0; padding: 8px 12px; font-size: 10px; }
    .core-help-brand { display: flex; align-items: center; gap: 11px; padding: 16px 15px; border-radius: 18px; background: var(--card); }
    .core-help-brand-icon { width: 36px; height: 36px; display: grid; place-items: center; flex-shrink: 0; border-radius: 11px; }
    .core-help-brand-icon img { width: 26px; height: 26px; object-fit: contain; }
    .core-help-brand-icon svg { width: 21px; height: 21px; }
    .core-help-brand-copy { flex: 1; min-width: 0; }
    .core-help-brand-copy strong { font-size: 13px; font-weight: 580; letter-spacing: -.25px; }
    .core-help-brand-copy p { font-size: 9px; line-height: 1.6; color: var(--muted); margin: 5px 0 0; }
    .core-help-version { font-size: 9px; color: var(--muted); padding: 4px 7px; border: 1px solid var(--line); border-radius: 20px; white-space: nowrap; }
    .core-help-list .core-details:first-child { border-top: 0; }
    .core-help-list .core-details > summary { min-height: 47px; padding: 12px 0; gap: 10px; }
    .core-help-list .core-details > summary > span { flex: 1; }
    .core-help-step { color: var(--faint); font-size: 9px; font-style: normal; font-variant-numeric: tabular-nums; }
    .core-help-list .core-details > p { font-size: 10px; line-height: 1.85; color: var(--muted); margin: 0 0 14px; }
    .core-help-list .core-details > p strong { color: var(--ink); font-weight: 500; }
    .core-help-list a { color: var(--ink); text-underline-offset: 3px; }
    .core-help-list kbd { display: inline; padding: 1px 4px; border: 1px solid var(--line); border-radius: 4px; color: var(--ink); font: inherit; font-size: 9px; background: var(--glass); }
    .core-help-link { display: flex; align-items: center; gap: 11px; padding: 14px 0; color: inherit; text-decoration: none; border-top: 1px solid var(--line); }
    .core-help-link:first-child { border-top: 0; }
    .core-help-link > svg { width: 16px; height: 16px; color: var(--muted); }
    .core-help-link > span { flex: 1; min-width: 0; font-size: 11px; }
    .core-help-link small { display: block; color: var(--muted); font-size: 9px; margin-top: 4px; overflow-wrap: anywhere; }
    .core-help-link > svg:last-child { width: 12px; height: 12px; }
    [data-theme=dark] .core-input, [data-theme=dark] .core-textarea { background: rgba(0,0,0,.08); }
  `;

  const copy = {
    id: 'copy', name: '复制', icon: 'copy', css,
    html: `
      <div class="settings-group glass">
        ${toggle('copy', '复制文本', '点击句子或段落时，自动复制到剪贴板')}
        ${toggle('showCopyContent', '显示复制内容', '在页面中显示本次复制的文本')}
        ${toggle('ignoreFurigana', '忽略振假名', '复制正文时移除汉字上方的读音')}
        ${toggle('extraImage', '查看图片', '点击打开正文中的图片')}
      </div>
      ${group('文本处理', '让内容更干净', `
        ${toggle('ignoreSymbolPairs', '忽略首尾符号对', '去除句首与句尾成对出现的符号')}
        <div class="setting-row core-field core-symbol-pairs"><input class="core-input" id="core-symbolPairs" data-pref="symbolPairs" type="text" aria-label="首尾符号对，各组符号之间使用 / 分隔" placeholder="「」/『』/《》/“”/【】/（）" spellcheck="false"></div>
        ${input('sentenceDelimiters', '断句符号', '决定按句阅读时的句子边界，使用 / 分隔', 'type="text" placeholder="。/！/？"')}
      `)}
      ${group('网页识别', '阅读范围', input('targetTags', '目标文本标签', '使用逗号分隔 HTML 标签名', 'type="text" placeholder="p,h1,h2,h3,h4,h5,h6"'))}
      ${group('阅读与滚动', '', `
        ${toggle('scrollSwitch', '自动滚动到段落 / 句子', '阅读焦点始终留在视野里')}
        ${select('scrollIntoView', '滚动方式', [['smooth', '平滑滚动'], ['instant', '立即滚动']])}
      `)}`,
    refresh(root) {
      root.querySelector('[data-pref="symbolPairs"]').disabled = !ctx.get('ignoreSymbolPairs');
      root.querySelector('[data-pref="symbolPairs"]').closest('.setting-row').style.opacity = ctx.get('ignoreSymbolPairs') ? '' : '.45';
      root.querySelector('[data-pref="scrollIntoView"]').disabled = !ctx.get('scrollSwitch');
    }
  };

  const systemVoices = [[0, '默认系统声音'], [5, '日语 · 系统默认声音']];
  const huoshVoices = ctx.voices.map(voice => [voice.id, `${voice.lang.toUpperCase()} · ${voice.name}`]);
  const speech = {
    id: 'speech', name: '语音', icon: 'speech',
    html: `
      <div class="settings-group glass">
        ${toggle('splitSpeech', '朗读段落时先切成句子', '按句播放，跟随阅读的节奏')}
        ${input('readingInterval', '自动朗读间隔', '每句话之间的停顿时间，单位：毫秒', 'type="number" min="0" max="60000" step="10"')}
      </div>
      ${group('系统语音', '使用设备上的声音', `
        ${toggle('useWindowsTTS', '启用系统语音', '语音服务一次启用一个')}
        ${select('winVoice', '系统声音', systemVoices)}
        ${range('rate', '语速', .1, 2, .1, '', '倍')}
        ${range('pitch', '音调', 0, 2, .1)}
      `)}
      ${group('火山语音', '多语言在线语音', `
        ${toggle('useHuoshTTS', '启用火山语音', '日语、英语、中文等多种音色')}
        ${select('huoshVoice', '声音', huoshVoices)}
        ${range('huoshRate', '播放速度', .5, 2, .1, '', '倍')}
        ${permission('huosh', '火山语音')}
      `)}
      ${group('VITS', '本地语音合成', `
        ${toggle('useVITS', '启用 VITS', '连接本地运行的语音服务')}
        ${input('vitsAPI', '服务地址', '', 'type="url" placeholder="http://127.0.0.1:23456"')}
        ${select('vitsVoice', '声线（id）', [[0, '0 · 点击刷新声音列表']])}
        <div class="core-inline-action"><span>声音列表</span>${button(`${svg('refresh')} 刷新声音列表`, 'data-refresh-vits')}</div>
        ${select('vitsLang', '语言（lang）', languages('vitsLang'))}
        ${range('length', '发音长度', .1, 2, .1, '数值越大，发音越慢')}
        <details class="core-details"><summary>高级合成参数 ${svg('chevron')}</summary>
          ${input('noise', '声音随机性（noise）', '', 'type="number" min="0" max="2" step="0.01"')}
          ${input('noisew', '发音时长随机性（noisew）', '', 'type="number" min="0" max="2" step="0.01"')}
          ${input('max', '合成分段阈值（segment_size）', '', 'type="number" min="1" max="10000" step="1"')}
          ${input('vitsCustomAPI', '完整 API 地址（可选）', '填写后优先使用此地址，声音、语言等参数以链接为准', 'type="url" placeholder="http://127.0.0.1:23456/voice/vits?id=0&amp;lang=ja"')}
          ${note('text 参数可留空，播放时会自动替换或补上当前选中的文本。')}
        </details>
        ${permission('vits', 'VITS')}
      `)}
      ${note('<a href="https://github.com/raindrop213/LunaTranslator-re/releases/tag/v0.0.3" target="_blank" rel="noopener noreferrer">下载 VITS 整合包 ↗</a>，解压后运行 start.bat，待服务地址出现即可使用。')}
    `,
    init(root) {
      const systemSelect = root.querySelector('[data-pref="winVoice"]');
      let deviceVoices = [];
      const loadVoices = () => {
        deviceVoices = window.speechSynthesis?.getVoices() || [];
        if (!deviceVoices.length) return;
        const selected = ctx.get('winVoice');
        systemSelect.innerHTML = deviceVoices.map((voice, index) => `<option value="${index}">${e(voice.name)} · ${e(voice.lang)}</option>`).join('');
        if (deviceVoices[selected]) systemSelect.value = selected;
        else { const option = document.createElement('option'); option.value = selected; option.textContent = `${selected} · 当前配置（此设备暂无对应声音）`; systemSelect.prepend(option); systemSelect.value = selected; }
      };
      loadVoices();
      window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
      root.querySelector('[data-pref="huoshVoice"]').closest('.setting-row').classList.add('core-wide-select');
      systemSelect.closest('.setting-row').classList.add('core-wide-select');

    }
  };

  function translationCard(id, name, logo, description, fields = '') {
    return `<section class="core-translation-card glass" data-translation-service="${id}">
      <div class="core-translation-top">
        <button type="button" class="drag-handle" draggable="true" aria-label="拖动排序 ${name}">${svg('grip')}</button>
        <span class="service-logo">${logo}</span><div class="service-name"><h4>${name}</h4><p>${description}</p></div>
        <div class="order-actions"><button type="button" class="icon-button" data-order-up aria-label="上移 ${name}">${svg('up')}</button><button type="button" class="icon-button" data-order-down aria-label="下移 ${name}">${svg('down')}</button></div>
        <label class="switch"><input id="core-${id}" data-pref="${id}" type="checkbox" role="switch" aria-label="启用 ${name}"><span class="switch-track"></span></label>
      </div>
      ${select(`${id}From`, '源语言', languages(`${id}From`))}
      ${select(`${id}To`, '目标语言', languages(`${id}To`))}
      ${fields}
      ${permission(id, name)}
    </section>`;
  }
  const aiFields = `
    ${input('aiURL', '接口地址', '默认按地址识别接口，支持根地址或完整路径。', `type="url" placeholder="${e(aiProtocols.openai.url)}" autocomplete="off"`)}
    ${input('aiModel', '模型名称', '', 'type="text" placeholder="填写服务商提供的模型名称" autocomplete="off"')}
    ${input('aiAPIKey', 'API Key', '密钥保存在此设备。本地免密接口可留空。', 'type="password" placeholder="填写接口密钥" autocomplete="off"')}
    ${toggle('aiStream', '流式输出', '边生成边显示译文；不支持流式的接口可关闭。')}
    <details class="core-details" data-ai-advanced><summary>高级设置 ${svg('chevron')}</summary>
      ${select('aiProtocol', '接口格式', [['auto', '自动识别'], ...Object.entries(aiProtocols).map(([id, protocol]) => [id, protocol.label])], '默认自动识别，特殊中转服务可手动指定。')}
      ${textarea('aiPrompt', '翻译提示词', '{{text}} 原文，{{from}} 源语言，{{to}} 目标语言。', ctx.defaults.aiPrompt, 4)}
      ${textarea('aiBody', '请求字段（JSON）', '与默认请求体合并；stream 字段可覆盖流式开关。', '{"temperature":0.3}', 3)}
      ${textarea('aiHeaders', '请求头（JSON）', '可自定义鉴权等请求头；留空使用当前格式的默认请求头。', '{"Authorization":"Bearer …"}', 3)}
    </details>
  `;
  const translation = {
    id: 'translation', name: '翻译', icon: 'translation',
    html: `
      <div class="core-translation-order">${translationCard('youdao', '有道', '有', '中日英互译')}${translationCard('google', 'Google', 'G', '多语言翻译')}${translationCard('ai', 'AI 翻译', 'AI', '自定义模型接口', aiFields)}</div>
    `,
    init(root) {
      const aiCard = root.querySelector('[data-translation-service="ai"]');
      aiCard.querySelector('[data-pref="aiProtocol"]').closest('.setting-row').classList.add('core-wide-select');
      aiCard.querySelectorAll('[data-pref="aiHeaders"],[data-pref="aiBody"]').forEach(control => control.classList.add('core-ai-json'));
      const ordering = root.querySelector('.core-translation-order');
      const move = (id, offset) => {
        const order = [...ctx.get('translationOrder')];
        const index = order.indexOf(id), next = index + offset;
        if (next < 0 || next >= order.length) return;
        [order[index], order[next]] = [order[next], order[index]];
        ctx.set('translationOrder', order, '翻译服务顺序已更新');
      };
      root.querySelectorAll('[data-translation-service]').forEach(card => {
        card.querySelector('[data-order-up]').addEventListener('click', () => move(card.dataset.translationService, -1));
        card.querySelector('[data-order-down]').addEventListener('click', () => move(card.dataset.translationService, 1));
      });
      let dragged = '';
      ordering.addEventListener('dragstart', event => {
        if (!event.target.closest('.drag-handle')) return;
        dragged = event.target.closest('[data-translation-service]').dataset.translationService;
        event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', dragged);
        event.target.closest('[data-translation-service]').classList.add('is-dragging');
      });
      ordering.addEventListener('dragover', event => {
        const card = event.target.closest('[data-translation-service]');
        if (!dragged || !card) return;
        event.preventDefault();
        ordering.querySelectorAll('.is-drop-target').forEach(node => node.classList.remove('is-drop-target'));
        if (card.dataset.translationService !== dragged) card.classList.add('is-drop-target');
      });
      ordering.addEventListener('drop', event => {
        const card = event.target.closest('[data-translation-service]');
        if (!dragged || !card) return;
        event.preventDefault();
        const order = [...ctx.get('translationOrder')];
        const from = order.indexOf(dragged), to = order.indexOf(card.dataset.translationService);
        if (from !== to) { order.splice(from, 1); order.splice(to, 0, dragged); ctx.set('translationOrder', order, '翻译服务顺序已更新'); }
      });
      ordering.addEventListener('dragend', () => { dragged = ''; ordering.querySelectorAll('.is-dragging,.is-drop-target').forEach(node => node.classList.remove('is-dragging', 'is-drop-target')); });
    },
    refresh(root) {
      const container = root.querySelector('.core-translation-order');
      ctx.get('translationOrder').forEach((id, index, order) => {
        const card = container.querySelector(`[data-translation-service="${id}"]`);
        if (container.children[index] !== card) container.insertBefore(card, container.children[index] || null);
        card.querySelector('[data-order-up]').disabled = index === 0;
        card.querySelector('[data-order-down]').disabled = index === order.length - 1;
      });
    }
  };

  const shortcutNames = {
    shortcutPreviousParagraph: ['上一段', 'PARAGRAPH ↑'], shortcutNextParagraph: ['下一段', 'PARAGRAPH ↓'],
    shortcutPreviousSentence: ['上一句', 'SENTENCE ↑'], shortcutNextSentence: ['下一句', 'SENTENCE ↓'],
    shortcutReadCurrent: ['重读当前选择', 'REPLAY'], shortcutAutoRead: ['自动阅读 / 暂停', 'AUTO READ'], shortcutStop: ['清除所有效果', 'CLEAR']
  };
  const shortcutKeys = Object.keys(ctx.shortcuts);
  const shortcuts = {
    id: 'shortcuts', name: '键位', icon: 'shortcuts',
    html: `
      <div class="settings-group glass">${toggle('swapMouseButtons', '左右键对调', '默认左键激活句子，右键激活段落')}</div>
      <div class="group-heading"><h3>阅读快捷键</h3><p>点击录制，自定义按键</p></div>
      <div class="settings-group glass">${shortcutKeys.map(key => {
        const [name, caption] = shortcutNames[key];
        return `<div class="core-shortcut-row"><div class="core-shortcut-title"><label for="core-${key}">${name}</label><span>${caption}</span></div><div class="core-shortcut-inputs"><input class="core-input" type="text" id="core-${key}" data-pref="${key}" spellcheck="false" aria-label="${name}快捷键"><button type="button" class="pill-button" data-shortcut-record="${key}">录制</button><button type="button" class="core-text-button" data-shortcut-reset="${key}">默认</button></div></div>`;
      }).join('')}</div>
      <div class="core-shortcut-toolbar"><span>支持 Ctrl / Alt / Shift / Meta<br>多个备用键使用 / 分隔，清空即可禁用</span>${button('全部恢复默认', 'data-shortcuts-reset-all')}</div>
    `,
    init(root) {
      let activeKey = null;
      const finishRecording = () => {
        if (!activeKey) return;
        const input = root.querySelector(`[data-pref="${activeKey}"]`);
        input.closest('.core-shortcut-row').classList.remove('is-recording');
        root.querySelector(`[data-shortcut-record="${activeKey}"]`).textContent = '录制';
        input.placeholder = ''; activeKey = null;
      };
      root.querySelectorAll('[data-shortcut-record]').forEach(control => control.addEventListener('click', () => {
        if (activeKey === control.dataset.shortcutRecord) { finishRecording(); return; }
        finishRecording(); activeKey = control.dataset.shortcutRecord;
        const input = root.querySelector(`[data-pref="${activeKey}"]`);
        control.textContent = '请按键…'; input.closest('.core-shortcut-row').classList.add('is-recording'); input.focus();
      }));
      root.querySelectorAll('[data-pref^="shortcut"]').forEach(input => {
        input.addEventListener('keydown', event => {
          if (activeKey !== input.dataset.pref) return;
          event.preventDefault(); event.stopPropagation();
          if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
          const binding = [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta', event.code].filter(Boolean).join('+');
          const conflict = shortcutKeys.find(key => key !== activeKey && String(ctx.get(key)).split('/').includes(binding));
          if (conflict) { ctx.notify(`${binding} 已用于「${shortcutNames[conflict][0]}」，请换一个组合`); return; }
          try { ctx.set(activeKey, binding, '快捷键已更新'); input.value = binding; finishRecording(); }
          catch (error) { ctx.notify(error.message); }
        });
        input.addEventListener('blur', finishRecording);
      });
      root.querySelectorAll('[data-shortcut-reset]').forEach(control => control.addEventListener('click', () => {
        finishRecording();
        try { ctx.set(control.dataset.shortcutReset, ctx.defaults[control.dataset.shortcutReset], '已恢复该项默认键位'); }
        catch (error) { ctx.notify(error.message); }
      }));
      root.querySelector('[data-shortcuts-reset-all]').addEventListener('click', () => ctx.dialog('恢复默认键位', '将阅读快捷键恢复为默认配置。鼠标左右键设置会保留。', '恢复默认', () => {
        finishRecording();
        shortcutKeys.forEach(key => ctx.set(key, ''));
        shortcutKeys.forEach(key => ctx.set(key, ctx.defaults[key]));
        ctx.notify('所有阅读快捷键已恢复默认');
      }));
    }
  };

  const help = {
    id: 'help', name: '帮助', icon: 'help',
    html: `
      <div class="core-help-brand glass">
        <span class="core-help-brand-icon glass">${ctx.icon ? `<img src="${e(ctx.icon)}" alt="" draggable="false">` : svg('book')}</span>
        <div class="core-help-brand-copy"><strong>AnonTranslator</strong><p>构建最灵活通用的学习环境</p></div>
        <span class="core-help-version">v2.0.0</span>
      </div>
      ${group('快速开始', '四步熟悉阅读工具', `
        <div class="core-help-list">
          <details class="core-details" open><summary><i class="core-help-step">01</i><span>选择句子与段落</span>${svg('chevron')}</summary><p>打开阅读工具后，<strong>左键点击句子，右键点击段落</strong>。启用复制时，选中的文本会自动复制；鼠标操作可在「键位」中对调。</p></details>
          <details class="core-details"><summary><i class="core-help-step">02</i><span>朗读与翻译</span>${svg('chevron')}</summary><p>在「语音」中启用一个声音，在「翻译」中选择服务与语言。默认使用 <kbd>Space</kbd> 开始或暂停自动阅读。</p></details>
          <details class="core-details"><summary><i class="core-help-step">03</i><span>查词与振假名</span>${svg('chevron')}</summary><p>在「词典」中安装分词数据并启用查词，即可分词着色、显示振假名。点击词语查看词典释义。</p></details>
          <details class="core-details"><summary><i class="core-help-step">04</i><span>保存到 Anki</span>${svg('chevron')}</summary><p>安装 <a href="https://apps.ankiweb.net/" target="_blank" rel="noopener noreferrer">Anki</a> 与 <a href="https://ankiweb.net/shared/info/2055492159" target="_blank" rel="noopener noreferrer">AnkiConnect</a>，保持 Anki 运行。在「Anki」中设置连接与卡组后，即可从查词窗保存单词和例句。</p></details>
        </div>
      `)}
      ${group('常见问题', '', `
        <div class="core-help-list">
          <details class="core-details"><summary><span>为什么提示接口未授权？</span>${svg('chevron')}</summary><p>扩展限制为「在特定网站上」运行时，在线服务需要单独授权。点击对应服务的「授权接口」，添加服务地址即可。</p></details>
          <details class="core-details"><summary><span>插件如何记住网站开关？</span>${svg('chevron')}</summary><p>安装后默认关闭。通过 Chrome 工具栏图标或油猴菜单手动开启，会记住当前网站，以后进入自动启用。点击面板右上角 ×，会关闭插件并删除本站记录，刷新后仍保持关闭，直到你再次手动开启。点击头像仅收起面板，不会关闭插件。</p></details>
        </div>
      `)}
      ${group('项目与反馈', '', `
        <a class="core-help-link" href="https://github.com/raindrop213/AnonTranslator" target="_blank" rel="noopener noreferrer">${svg('book')}<span>项目主页<small>raindrop213 / AnonTranslator</small></span>${svg('link')}</a>
        <a class="core-help-link" href="https://github.com/raindrop213/AnonTranslator/issues" target="_blank" rel="noopener noreferrer">${svg('link')}<span>问题反馈<small>查看讨论或提交使用问题</small></span>${svg('link')}</a>
      `)}
    `
  };

  return [copy, speech, translation, shortcuts, help];
}
