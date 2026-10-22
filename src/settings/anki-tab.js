import { ankiPreviewDocument, ankiPreviewFields, ankiPreviewSpeech } from './anki-preview.js';
import { createSpeaker } from '../services/speech.js';

export function createAnkiTabs(ctx, env, platform) {
  const valueOf = key => ctx.get(key) ?? ctx.defaults[key];
  const switchRow = (key, title) => `<div class="setting-row"><div class="setting-copy"><label for="glass-${key}">${title}</label></div><label class="switch"><input id="glass-${key}" type="checkbox" role="switch" data-pref="${key}" aria-label="${title}"><span class="switch-track"></span></label></div>`;
  const selectRow = (key, title, choices, description = '') => `<div class="setting-row"><div class="setting-copy"><label for="glass-${key}">${title}</label>${description ? `<p>${description}</p>` : ''}</div><div class="select-wrap"><select id="glass-${key}" data-pref="${key}">${choices.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></div></div>`;
  const templatePages = [['ankiFront', '正面'], ['ankiBack', '背面'], ['ankiCSS', '样式']];
  const fields = [['Word', '单词'], ['Reading', '读音'], ['Sentence', '原句'], ['Translation', '例句翻译'], ['WordAudio', '单词音频'], ['SentenceAudio', '例句音频'], ['Image', '图片'], ['DictionaryData', '词典数据'], ['SourceURL', '来源网址'], ['SourceTitle', '来源标题']];
  let activeTemplate = 'ankiFront';
  let previewSide = 'ankiFront', previewRoot, previewHTML = '', previewLoaded = false, previewTimer;
  const speaker = createSpeaker(platform), playbackToken = crypto.randomUUID();
  let previewFields;
  function playPreview(event) {
    const message = event.data, frame = previewRoot?.querySelector('[data-anki-preview]');
    if (!frame || previewRoot.hidden || env.document.querySelector('#floating-settings')?.hidden || event.source !== frame.contentWindow || message?.type !== 'at-anki-play' || message.token !== playbackToken || !previewFields) return;
    const settings = Object.fromEntries(Object.keys(ctx.defaults).map(key => [key, valueOf(key)]));
    const job = ankiPreviewSpeech(message.kind, previewFields, settings);
    if (!job) { if (['word', 'sentence'].includes(message.kind)) ctx.notify('请先为 Anki 的对应音频选择语音服务'); return; }
    void speaker.speak(job.text, job.settings).catch(error => ctx.notify('预览语音：' + error.message));
  }

  function updatePreview() {
    if (!previewRoot || previewRoot.hidden || env.document.querySelector('#floating-settings')?.hidden) { speaker.stop(); return; }
    const frame = previewRoot.querySelector('[data-anki-preview]');
    try {
      const draft = platform.getAnkiPreviewDraft?.() || null;
      const html = ankiPreviewDocument(valueOf('ankiFront'), valueOf('ankiBack'), valueOf('ankiCSS'), previewSide, draft, {
        playbackToken, wordAudio: valueOf('ankiWordAudioService') !== 'none', sentenceAudio: valueOf('ankiSentenceAudioService') !== 'none', translationEnabled: valueOf('ankiTranslationServices').length > 0
      });
      frame.title = 'Anki 卡片' + (previewSide === 'ankiFront' ? '正面' : '背面') + '预览 · ' + (draft ? '当前制卡内容' : '示例内容');
      if (html === previewHTML) return;
      speaker.stop(); previewFields = ankiPreviewFields(draft);
      previewHTML = html;
      if (platform.ankiPreviewURL) {
        if (!frame.hasAttribute('src')) frame.src = platform.ankiPreviewURL;
        if (previewLoaded) frame.contentWindow?.postMessage({ type: 'at-anki-preview', html }, '*');
      } else frame.srcdoc = html;
    } catch (error) { ctx.notify('预览失败：' + error.message); }
  }

  function queuePreview() {
    env.clearTimeout(previewTimer);
    previewTimer = env.setTimeout(updatePreview, 120);
  }

  function refresh(root) {
    const editor = root.querySelector('[data-template-editor]');
    if (!editor) return;
    const template = String(valueOf(activeTemplate) || '');
    if (editor.value !== template) editor.value = template;
    const currentName = templatePages.find(([key]) => key === activeTemplate)[1];
    editor.setAttribute('aria-label', currentName + '模板代码');
    root.querySelector('[data-anki-restore]').title = '重置' + currentName + '模板';
    root.querySelector('[data-anki-restore]').setAttribute('aria-label', '重置' + currentName + '模板');
    root.querySelectorAll('[data-template-tab]').forEach(button => {
      const selected = button.dataset.templateTab === activeTemplate;
      button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    });
    const audioSelected = ['ankiWordAudioService', 'ankiSentenceAudioService'].some(key => valueOf(key) !== 'none');
    root.querySelector('[data-anki-audio-hint]').hidden = !audioSelected;
    queuePreview();
  }

  return [{
    id: 'anki', name: 'Anki', subtitle: '', icon: 'cards',
    html: `<div class="glass-anki">
      <div class="settings-group glass">${switchRow('ankiEnabled', '启用 Anki 制卡')}</div>

      <div class="group-heading"><h3>连接 Anki</h3></div>
      <div class="settings-group glass anki-form-group">
        <label class="anki-field" for="glass-ankiURL"><span>AnkiConnect 地址</span><input id="glass-ankiURL" type="url" data-pref="ankiURL" placeholder="http://127.0.0.1:8765" spellcheck="false"></label>
        <label class="anki-field" for="glass-ankiAPIKey"><span>API Key <i>可选</i></span><span class="anki-password-wrap"><input id="glass-ankiAPIKey" type="password" data-pref="ankiAPIKey" placeholder="未设置时留空" autocomplete="off" spellcheck="false"><button type="button" class="anki-reveal" data-anki-reveal aria-label="显示 API Key" aria-pressed="false">显示</button></span></label>
        <div class="anki-connection-actions"><small class="anki-connection-hint">在电脑上打开 Anki，并安装 AnkiConnect 插件。</small><button type="button" class="pill-button" data-anki-connect>检查地址</button></div>
        <p class="anki-feedback" data-anki-connection-status role="status" aria-live="polite"></p>
      </div>

      <div class="group-heading"><h3>卡组与标签</h3></div>
      <div class="settings-group glass anki-form-group">
        <label class="anki-field" for="glass-ankiDecks"><span>卡组 <i>每行一个，首行为默认</i></span><textarea id="glass-ankiDecks" data-pref="ankiDecks" rows="2" placeholder="anon::novel" spellcheck="false"></textarea></label>
        <label class="anki-field" for="glass-ankiTags"><span>标签 <i>每行一个，制卡时可多选</i></span><textarea id="glass-ankiTags" data-pref="ankiTags" rows="2" placeholder="外来语&#10;俗语&#10;方言" spellcheck="false"></textarea></label>
      </div>

      <div class="group-heading"><h3>制卡服务</h3></div>
      <div class="settings-group glass">
        <div class="setting-row anki-translation-row"><div class="setting-copy"><span>例句翻译</span></div><div class="anki-choice-list">${[['google', 'Google'], ['youdao', '有道']].map(([value, name]) => `<label class="pill-button"><input type="checkbox" data-pref="ankiTranslationServices" data-pref-array value="${value}" aria-label="${name} 例句翻译"><span>${name}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg></label>`).join('')}</div></div>
        ${selectRow('ankiWordAudioService', '单词音频', [['none', '不添加'], ['huosh', '火山语音'], ['vits', 'VITS']])}
        ${selectRow('ankiSentenceAudioService', '例句音频', [['none', '不添加'], ['huosh', '火山语音'], ['vits', 'VITS']])}
      </div>
      <p class="anki-guide" data-anki-audio-hint hidden>音频沿用「语音」中的服务配置，无需开启对应朗读开关。</p>

      <div class="group-heading"><h3>制卡偏好</h3></div>
      <div class="settings-group glass">
        ${switchRow('ankiBoldWord', '加粗例句中的单词')}
        ${switchRow('ankiSuccessSound', '保存成功时播放提示音')}
        ${switchRow('ankiCloseAfterAdd', '添加后关闭查词窗')}
        ${selectRow('ankiImageFormat', '截图格式', [['webp', 'WebP'], ['png', 'PNG'], ['jpeg', 'JPEG']])}
        ${selectRow('ankiLayout', '制卡区位置', [['below', '词典下方'], ['right', '词典右侧']])}
      </div>

      <div class="group-heading"><h3>卡片模板</h3></div>
      <div class="settings-group glass anki-form-group anki-template-group">
        <label class="anki-field" for="glass-ankiModel"><span>笔记模板名称</span><input id="glass-ankiModel" type="text" data-pref="ankiModel" placeholder="anon-model" spellcheck="false"></label>
        <div class="anki-code-frame"><textarea data-template-editor spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" aria-label="正面模板代码"></textarea></div>
        <div class="anki-editor-tabs" role="tablist" aria-label="卡片模板">${templatePages.map(([key, name]) => `<button type="button" role="tab" data-template-tab="${key}" aria-selected="${key === 'ankiFront'}" tabindex="${key === 'ankiFront' ? 0 : -1}">${name}</button>`).join('')}<button type="button" class="anki-restore" data-anki-restore title="重置正面模板" aria-label="重置正面模板">↺</button></div>
        <div class="anki-preview-frame"><div class="anki-preview-toolbar"><button type="button" class="anki-preview-refresh" data-preview-refresh title="刷新卡片" aria-label="刷新卡片"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9"/></svg></button></div>
        <iframe class="anki-preview" data-at-ui data-anki-preview title="Anki 卡片正面预览" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe></div>
        <details class="anki-fields"><summary>可用字段与模板语法 <span aria-hidden="true">＋</span></summary><p>在 HTML 中插入 <code>{{Word}}</code>；用 <code>{{#Sentence}}…{{/Sentence}}</code> 仅在字段有内容时显示。</p><dl>${fields.map(([name, label]) => `<div><dt>{{${name}}}</dt><dd>${label}</dd></div>`).join('')}</dl></details>
        <p class="anki-guide">预览优先使用当前制卡内容，没有时显示示例。修改制卡内容后，点击“刷新”更新预览。发送卡片时自动创建模型并同步模板，同一模型的全部卡片都会使用更新后的模板。</p>
      </div>
    </div>`,
    init(root) {
      previewRoot = root;
      env.window.addEventListener('message', playPreview);
      const frame = root.querySelector('[data-anki-preview]');
      frame.addEventListener('load', () => {
        previewLoaded = true;
        if (platform.ankiPreviewURL && previewHTML) frame.contentWindow?.postMessage({ type: 'at-anki-preview', html: previewHTML }, '*');
      });
      root.querySelector('[data-preview-refresh]').addEventListener('click', () => { previewHTML = ''; updatePreview(); });
      env.document.addEventListener('glasswidgetchange', queuePreview);
      const editor = root.querySelector('[data-template-editor]');
      function selectTemplate(key) {
        activeTemplate = key;
        if (key !== 'ankiCSS') previewSide = key;
        refresh(root);
      }
      root.querySelectorAll('[data-template-tab]').forEach(button => {
        button.addEventListener('click', () => selectTemplate(button.dataset.templateTab));
        button.addEventListener('keydown', event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const index = templatePages.findIndex(([key]) => key === activeTemplate);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
          selectTemplate(templatePages[next][0]); root.querySelector(`[data-template-tab="${activeTemplate}"]`).focus();
        });
      });
      editor.addEventListener('input', () => { ctx.set(activeTemplate, editor.value); refresh(root); });
      root.querySelector('[data-anki-restore]').addEventListener('click', () => {
        const key = activeTemplate, name = templatePages.find(([name]) => name === key)[1];
        ctx.dialog('还原' + name + '模板', '将当前模板恢复为 AnonTranslator 默认内容。其他模板和设置保持原值。', '还原默认', () => { ctx.set(key, ctx.defaults[key]); refresh(root); ctx.notify(name + '模板已还原'); });
      });
      root.querySelector('[data-anki-reveal]').addEventListener('click', event => {
        const input = root.querySelector('[data-pref="ankiAPIKey"]'), show = input.type === 'password';
        input.type = show ? 'text' : 'password'; event.currentTarget.textContent = show ? '隐藏' : '显示';
        event.currentTarget.setAttribute('aria-pressed', String(show)); event.currentTarget.setAttribute('aria-label', (show ? '隐藏' : '显示') + ' API Key');
      });
      for (const key of ['ankiURL', 'ankiAPIKey']) root.querySelector(`[data-pref="${key}"]`).addEventListener('input', () => {
        root.querySelector('[data-anki-connection-status]').textContent = '';
      });
      refresh(root);
    },
    refresh,
    destroy() { env.clearTimeout(previewTimer); env.document.removeEventListener('glasswidgetchange', queuePreview); env.window.removeEventListener('message', playPreview); speaker.destroy(); previewRoot = null; },
    css: `
      .glass-anki{min-width:0}
      .glass-anki .anki-form-group{padding-top:2px;padding-bottom:13px}.glass-anki .anki-field{display:flex;flex-direction:column;gap:8px;padding-top:14px;font-size:11px;min-width:0}.glass-anki .anki-field>span:first-child{display:flex;gap:7px;align-items:baseline}.glass-anki .anki-field i{font-style:normal;color:var(--muted);font-size:9px}.glass-anki .anki-field small{font-size:9px;color:var(--muted);line-height:1.7}
      .glass-anki .anki-field input,.glass-anki .anki-field textarea{width:100%;min-width:0;font:11px/1.6 inherit;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:rgba(255,255,255,.19);box-shadow:inset 0 1px 2px rgba(var(--shadow),.025);resize:vertical}.glass-anki .anki-field textarea{min-height:56px;max-height:150px;font-family:inherit;font-size:11px;line-height:1.7}.glass-anki .anki-field input{font-size:11px;line-height:1.6}
      .glass-anki .anki-password-wrap{position:relative;display:block}.glass-anki .anki-password-wrap>input{padding-right:51px}.glass-anki .anki-reveal{position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:9px;color:var(--muted);background:transparent;border:0;padding:5px}.glass-anki .anki-reveal:active{transform:translateY(-50%)}
      .glass-anki .anki-connection-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:14px}.glass-anki .anki-connection-hint{min-width:0;font-size:9px;color:var(--muted);line-height:1.7}.glass-anki .pill-button{flex-shrink:0;padding:8px 12px;font-size:10px;white-space:nowrap}.glass-anki .anki-feedback{font-size:10px;line-height:1.7;color:var(--muted);margin:9px 0 0;overflow-wrap:anywhere}.glass-anki .anki-feedback:empty{display:none}
      .glass-anki .anki-translation-row .setting-copy>span{font-size:12px;font-weight:500}.glass-anki .anki-choice-list{display:flex;gap:7px;flex-shrink:0}.glass-anki .anki-choice-list label{position:relative;cursor:pointer}.glass-anki .anki-choice-list input{position:absolute;width:1px;height:1px;opacity:0}.glass-anki .anki-choice-list label:has(input:focus-visible){outline:2px solid var(--ink);outline-offset:3px}.glass-anki .select-wrap select{max-width:135px;padding-right:17px}
      .glass-anki .anki-guide{font-size:9px;color:var(--muted);line-height:1.8;margin:9px 3px 0}.glass-anki .anki-template-group{--anki-template-gap:12px}.glass-anki .anki-template-group>.anki-code-frame{margin-top:var(--anki-template-gap)}.glass-anki .anki-editor-tabs{display:flex;gap:3px;align-items:center;margin:var(--anki-template-gap) 0;padding:3px;border-radius:13px;border:1px solid var(--line);background:rgba(var(--shadow),.025)}.glass-anki .anki-editor-tabs button{border:0;background:transparent;color:var(--muted);font-size:10px;border-radius:10px;min-height:29px;padding:6px 16px}.glass-anki .anki-editor-tabs button[aria-selected="true"]{color:var(--ink);background:var(--highlight);box-shadow:0 2px 4px rgba(var(--shadow),.09)}.glass-anki .anki-editor-tabs button.anki-restore{margin-left:auto;font-size:16px;padding:3px 9px}
      .glass-anki .anki-code-frame{overflow:hidden;border-radius:11px;border:1px solid var(--line);background:rgba(255,255,255,.18)}.glass-anki [data-template-editor]{width:100%;height:174px;min-height:110px;max-height:400px;display:block;padding:12px 11px;border:0;background:transparent;resize:vertical;outline-offset:-3px;white-space:pre;font:10px/1.7 Consolas,"SFMono-Regular",monospace;color:var(--ink);tab-size:2}
      .glass-anki .anki-preview-frame{position:relative;border:1px solid var(--line);border-radius:11px;overflow:hidden;background:#fff}.glass-anki .anki-preview-toolbar{position:absolute;top:6px;left:7px;z-index:1;display:flex;align-items:center}.glass-anki .anki-preview-refresh{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--line);border-radius:9px;padding:5px;background:var(--highlight);box-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 2px 5px rgba(var(--shadow),.08);backdrop-filter:blur(10px);color:var(--muted)}.glass-anki .anki-preview-refresh:hover{color:var(--ink);box-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 2px 7px rgba(var(--shadow),.14)}.glass-anki .anki-preview-refresh svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
      .glass-anki .anki-preview{display:block;width:100%;height:310px;margin-top:0;border:0;background:#fff}
      .glass-anki .anki-fields{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}.glass-anki .anki-fields summary{display:flex;justify-content:space-between;align-items:center;list-style:none;cursor:pointer;font-size:10px}.glass-anki .anki-fields summary::-webkit-details-marker{display:none}.glass-anki .anki-fields summary>span{font-size:14px;color:var(--muted)}.glass-anki .anki-fields[open] summary>span{transform:rotate(45deg)}.glass-anki .anki-fields>p{font-size:9px;line-height:1.8;color:var(--muted);overflow-wrap:anywhere}.glass-anki .anki-fields code{font-size:9px;color:var(--ink)}.glass-anki .anki-fields dl{display:grid;gap:6px;margin:12px 0 0}.glass-anki .anki-fields dl>div{display:flex;gap:10px;justify-content:space-between;font-size:9px;line-height:1.5}.glass-anki .anki-fields dt{font-family:Consolas,monospace;overflow-wrap:anywhere}.glass-anki .anki-fields dd{margin:0;color:var(--muted);flex-shrink:0}
      [data-theme="dark"] .glass-anki .anki-field input,[data-theme="dark"] .glass-anki .anki-field textarea,[data-theme="dark"] .glass-anki .anki-code-frame{background:rgba(0,0,0,.12)}
      @media(max-width:360px){.glass-anki .anki-translation-row{align-items:flex-start;flex-direction:column;gap:8px}.glass-anki .anki-choice-list{padding-bottom:4px}}
    `
  }];
}
