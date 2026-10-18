import { defaults, normalizeSetting } from './settings.js';
import { ankiFields } from '../services/anki-model.js';
import { ankiDraftFields } from '../services/anki-fields.js';

const templatePages = [['ankiFront', '正面'], ['ankiBack', '背面'], ['ankiCSS', '样式']];
const fieldDescriptions = {
  Word: '单词', Reading: '平假名读音', Sentence: '原句',
  Translation: '例句翻译', WordAudio: '单词音频', SentenceAudio: '例句音频', Image: '图片',
  DictionaryData: '词典结果数据', SourceURL: '来源网址', SourceTitle: '来源标题'
};
const sampleFields = {
  ...ankiDraftFields({
    word: '重い', reading: 'おもい',
    sentence: 'ちょ…ちょちょちょ、一生だよ！？いちいち<b>重い</b>んだよな', translation: '等……等等等，是一辈子喔！？每次说话都好沉重啊。',
    dictionaries: [
      { id: 'moegirl', name: '萌娘百科', html: '<h1>重い（おもい）</h1><p>沉重</p><p>释义：形容一个人对他人的感情过于强烈，伴随较深的依赖、不安或占有欲，有时让对方感到心理负担。</p><p>特征：害怕失去对方；希望频繁联系或确认感情；容易嫉妒；对关系过度在意。并非每个角色都具备全部特征。</p><p>相关词：重い女（おもいおんな）／重女；重い男（おもいおとこ）／重男；湿度が高い（しつどがたかい）／高湿度。<br>与「ヤンデレ」（病娇）有交集，但不等同。</p><p><a href="https://zh.moegirl.org.cn/%E6%B2%89%E9%87%8D">萌娘百科</a></p>', styles: 'body{font-family:serif;font-size:12px;line-height:1.2}' },
      { id: 'pixiv', name: 'ピクシブ百科事典', html: '<h1><b>愛が重い</b> | あいがおもい</h1><p>行き過ぎた愛情表現を目の当たりにした人間が抱く率直な感想。</p><h3>解説</h3><p>愛が重くなるのは自信のなさの裏返しでもある。</p><p>自信のなさ故に、愛する相手を失ったら二度と新しい相手を得られないのではないかという不安に駆られている上に、人間不信と承認欲求も強いため、相手を束縛しかねないほどの重さに変わってしまうである。</p><p>故に理解を拒み憎しみに変わっていく場合もあるので人間関係には注意されたし。</p><h3>タグとして</h3><p>あふれんばかりの愛がまさに質量となってあふれた瞬間。</p><p>また、愛がありすぎるが故に何か人として大切なものを犠牲にした場合など、その愛を受け取る側や閲覧者があまりの愛に精神的、または物理的に重さを感じてしまうような場合につけられる。</p><p>まれに受け取った質量を勘違いして愛と認識する場合につけられる事もある。</p><p>質量ではなく容量や速度の場合もあるとかないとか・・・。</p><p>逆に言えば、自信のなさという人間味が出るからこそ、創作の定番ネタになったと言えるのだが。</p><p><a href="https://dic.pixiv.net/a/%E6%84%9B%E3%81%8C%E9%87%8D%E3%81%84">ピクシブ百科事典</a></p>', styles: 'body{font-family:sans-serif;font-size:12px}' }
    ],
    sourceURL: 'https://bgm.tv/ep/1225915', sourceTitle: 'ep.4 一生だよ！？'
  }),
  Image: '<img alt="示例图片" src="data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="100"><rect width="320" height="100" rx="8" fill="#e8edf3"/><text x="160" y="57" text-anchor="middle" fill="#64748b" font-size="18">Image</text></svg>') + '">'
};

export function ankiPreviewFields(draft) {
  if (!draft || !String(draft.word || '').trim()) return sampleFields;
  let image = '';
  if (/^image\/(?:png|jpeg|webp|gif)$/.test(draft.image?.mime || '') && typeof draft.image?.data === 'string' && draft.image.data.length <= 28 * 1024 * 1024 && /^[A-Za-z\d+/]+={0,2}$/.test(draft.image.data)) image = `<img alt="当前卡片截图" src="data:${draft.image.mime};base64,${draft.image.data}">`;
  return { ...ankiDraftFields(draft), Image: image };
}

function renderTemplate(template, fields) {
  let result = template;
  for (let pass = 0; pass < 8; pass++) {
    const next = result.replace(/{{([#^])([A-Za-z][A-Za-z0-9]*)}}([\s\S]*?){{\/\2}}/g,
      (_match, condition, field, content) => (condition === '#' ? !!fields[field] : !fields[field]) ? content : '');
    if (next === result) break;
    result = next;
  }
  return result.replace(/{{(?:(?:text|type):)?([A-Za-z][A-Za-z0-9]*)}}/g, (match, field) => fields[field] ?? match);
}

// Use the native card fields and CSS inside an opaque sandbox.
export function ankiPreviewDocument(front, back, css, side = 'ankiBack', draft = null) {
  const fields = ankiPreviewFields(draft), frontSide = renderTemplate(front, fields);
  const body = side === 'ankiFront' ? frontSide : renderTemplate(back, { ...fields, FrontSide: frontSide });
  const safeCSS = css.replace(/<\/style/gi, '<\\/style');
  return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; script-src &apos;unsafe-inline&apos;; style-src &apos;unsafe-inline&apos;; img-src data:; frame-src about:; connect-src &apos;none&apos;; form-action &apos;none&apos;; base-uri &apos;none&apos;"><style>' + safeCSS + '</style></head><body class="card">' + body + '</body></html>';
}

export function mountAnkiPanel(section, store, platform, { connectionGroup, addControl, beforeAction = async () => {} } = {}) {
  const doc = section.ownerDocument;
  let mounted = true, activeKey = 'ankiFront', previewTimer, saveTimer, busy = false, draftGeneration = 0, liveDraft = null;
  let templateQueue = Promise.resolve();
  let drafts = Object.fromEntries(templatePages.map(([key]) => [key, store.values[key]]));
  const dirty = new Set();
  const make = (tag, text, className) => { const element = doc.createElement(tag); if (text) element.textContent = text; if (className) element.className = className; return element; };
  const button = text => { const element = make('button', text); element.type = 'button'; return element; };
  const actions = make('div', '', 'at-anki-actions');
  const connect = button('测试连接'), apply = button('立即同步模型');
  actions.append(connect); (connectionGroup || section).append(actions);
  const warning = make('p', '发送卡片时自动创建模型并同步模板；同一模型的全部卡片都会使用更新后的模板。', 'at-guide');
  const manual = make('details', '', 'at-anki-manual'); manual.append(make('summary', '手动同步模型（可选）'), apply);
  const connectionStatus = make('p', '', 'at-guide at-anki-status'); connectionStatus.setAttribute('role', 'status');
  const available = make('details', '', 'at-anki-available');
  available.append(make('summary', '可用卡组与模型'));
  const lists = make('div'); available.append(lists); available.hidden = true;
  (connectionGroup || section).append(connectionStatus, available);

  const templates = make('fieldset', '', 'at-anki-templates'); templates.append(make('legend', '卡片模板'));
  addControl?.(templates, 'ankiModel'); templates.append(warning, manual);
  const templateTabBar = make('div', '', 'at-anki-template-bar');
  const tabs = make('div', '', 'at-anki-template-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '卡片模板');
  const restore = button('↺'); restore.title = '还原默认模板'; restore.setAttribute('aria-label', '还原默认模板');
  templateTabBar.append(tabs, restore);
  const editor = make('textarea', '', 'at-anki-editor'); editor.spellcheck = false; editor.autocapitalize = 'off'; editor.wrap = 'off'; editor.setAttribute('aria-label', '正面模板');
  const templateStatus = make('p', '', 'at-guide at-anki-status'); templateStatus.setAttribute('role', 'status');
  const previewActions = make('div', '', 'at-anki-actions at-anki-preview-actions'); const refreshPreview = button('刷新卡片预览');
  refreshPreview.title = '刷新卡片预览'; refreshPreview.setAttribute('aria-label', '刷新卡片预览'); previewActions.append(refreshPreview);
  const preview = make('iframe', '', 'at-anki-preview'); preview.title = 'Anki 卡片示例预览'; preview.setAttribute('sandbox', 'allow-scripts'); preview.referrerPolicy = 'no-referrer';
  let previewLoaded = false, previewHTML = '';
  const sendPreview = () => { if (mounted && previewLoaded) preview.contentWindow?.postMessage({ type: 'at-anki-preview', html: previewHTML }, '*'); };
  if (platform.ankiPreviewURL) {
    preview.addEventListener('load', () => { previewLoaded = true; sendPreview(); });
    preview.src = platform.ankiPreviewURL;
  }
  const tabButtons = new Map();
  function updatePreview() {
    clearTimeout(previewTimer);
    previewHTML = ankiPreviewDocument(drafts.ankiFront, drafts.ankiBack, drafts.ankiCSS, activeKey, liveDraft);
    if (platform.ankiPreviewURL) sendPreview();
    else preview.srcdoc = previewHTML;
  }
  async function refreshDraft() {
    const run = ++draftGeneration; refreshPreview.disabled = true;
    try {
      const response = await platform.send({ action: 'anki_draft_get' });
      if (!mounted || run !== draftGeneration) return;
      liveDraft = response?.draft && typeof response.draft === 'object' ? response.draft : null;
      updatePreview();
    } catch { if (mounted && run === draftGeneration) { liveDraft = null; updatePreview(); } }
    finally { if (mounted && run === draftGeneration) refreshPreview.disabled = false; }
  }
  refreshPreview.addEventListener('click', () => { void refreshDraft(); });
  function select(key) {
    activeKey = key; editor.value = drafts[key]; editor.setAttribute('aria-label', templatePages.find(([name]) => name === key)[1] + '模板');
    for (const [name, tab] of tabButtons) { tab.setAttribute('aria-selected', String(name === key)); tab.tabIndex = name === key ? 0 : -1; }
    updatePreview();
  }
  for (const [key, label] of templatePages) {
    const tab = button(label); tab.setAttribute('role', 'tab'); tab.addEventListener('click', () => select(key)); tabButtons.set(key, tab); tabs.append(tab);
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const index = templatePages.findIndex(([name]) => name === activeKey);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
      select(templatePages[next][0]); tabButtons.get(activeKey).focus();
    });
  }
  editor.addEventListener('input', () => {
    drafts[activeKey] = editor.value; dirty.add(activeKey); templateStatus.textContent = '正在自动保存模板…';
    clearTimeout(previewTimer); previewTimer = setTimeout(updatePreview, 180);
    scheduleSave();
  });
  editor.addEventListener('blur', () => { if (dirty.size) void saveTemplates().catch(reportSaveError); });
  restore.addEventListener('click', () => {
    const pageLabel = templatePages.find(([key]) => key === activeKey)[1];
    if (!doc.defaultView.confirm(`确定将当前“${pageLabel}”还原为默认模板吗？此操作会自动保存。`)) return;
    drafts[activeKey] = defaults[activeKey]; dirty.add(activeKey); editor.value = drafts[activeKey];
    templateStatus.textContent = '当前页已恢复默认，正在自动保存…'; updatePreview(); scheduleSave();
  });
  function reportSaveError(error) { if (mounted) templateStatus.textContent = '尚未保存：' + error.message; }
  function scheduleSave() {
    clearTimeout(saveTimer); saveTimer = setTimeout(() => { void saveTemplates().catch(reportSaveError); }, 350);
  }
  function saveTemplates() {
    clearTimeout(saveTimer);
    const snapshot = { ...drafts };
    try { for (const [key, value] of Object.entries(snapshot)) normalizeSetting(key, value); }
    catch (error) { return Promise.reject(error); }
    const pending = templateQueue.then(async () => {
      for (const [key, value] of Object.entries(snapshot)) await store.set(key, value);
      for (const [key, value] of Object.entries(snapshot)) if (drafts[key] === value) dirty.delete(key);
      if (mounted) templateStatus.textContent = dirty.size ? '正在保存新的模板修改…' : '模板已自动保存，发送卡片时同步到 Anki。';
    });
    templateQueue = pending.catch(() => {});
    return pending;
  }
  function setBusy(value) { busy = value; connect.disabled = apply.disabled = value; }
  async function run(action) {
    if (busy) return; setBusy(true);
    const resultStatus = action === 'anki_info' ? connectionStatus : templateStatus;
    resultStatus.textContent = action === 'anki_info' ? '正在连接 Anki…' : '正在同步模型…';
    try {
      await beforeAction(); if (action === 'anki_setup') await saveTemplates();
      if (!mounted) return;
      const settings = { ...store.values };
      const response = await platform.send({ action, settings, ...(action === 'anki_setup' ? { updateTemplates: true } : {}) });
      if (!mounted) return;
      if (response?.error) throw new Error(response.error);
      if (action === 'anki_info') {
        const decks = Array.isArray(response.decks) ? response.decks : [], models = Array.isArray(response.models) ? response.models : [];
        resultStatus.textContent = `已连接 AnkiConnect ${response.version || ''}：${settings.ankiURL}`;
        lists.replaceChildren(make('p', '卡组：' + (decks.join('、') || '无')), make('p', '模型：' + (models.join('、') || '无')));
        available.hidden = false; available.open = true;
      } else resultStatus.textContent = `模型“${response.model || settings.ankiModel}”已准备好，模板已应用。`;
    } catch (error) { if (mounted) resultStatus.textContent = '操作失败：' + error.message; }
    finally { if (mounted) setBusy(false); }
  }
  connect.addEventListener('click', () => { void run('anki_info'); });
  apply.addEventListener('click', event => { if (event.isTrusted) void run('anki_setup'); });
  const fields = make('details', '', 'at-anki-fields'); fields.append(make('summary', '字段说明与填写方法'));
  fields.append(make('p', 'HTML 中用 {{Word}}、{{Reading}} 等插入字段；{{#Sentence}}…{{/Sentence}} 只在例句非空时显示。', 'at-guide'));
  const descriptions = make('dl');
  for (const name of ankiFields) descriptions.append(make('dt', name), make('dd', fieldDescriptions[name] || name));
  fields.append(descriptions);
  const autoGuide = make('p', '模板修改后自动保存。预览优先使用当前制卡内容，没有草稿时显示示例。（示例中图片链接不显示，请以 Anki 中的最终效果为准）', 'at-guide');
  templates.append(autoGuide, templateTabBar, editor, templateStatus, preview, previewActions, fields); section.append(templates);
  select(activeKey);
  void refreshDraft();
  const unsubscribe = store.subscribe((values, patch) => {
    let updated = false;
    for (const [key] of templatePages) if (key in patch && !dirty.has(key)) { drafts[key] = values[key]; updated = true; }
    if (updated) editor.value = drafts[activeKey];
    if (updated) updatePreview();
    if ('ankiURL' in patch || 'ankiAPIKey' in patch) { available.hidden = true; connectionStatus.textContent = ''; }
  });
  return {
    refreshDraft,
    reload() { clearTimeout(saveTimer); drafts = Object.fromEntries(templatePages.map(([key]) => [key, store.values[key]])); dirty.clear(); templateStatus.textContent = ''; editor.value = drafts[activeKey]; updatePreview(); },
    destroy() { if (dirty.size) void saveTemplates().catch(() => {}); mounted = false; draftGeneration++; clearTimeout(previewTimer); clearTimeout(saveTimer); unsubscribe(); }
  };
}
