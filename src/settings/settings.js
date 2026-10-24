import { defaultAnkiFront, defaultAnkiBack, defaultAnkiCSS } from '../services/anki-model.js';
import { legacyAnkiTemplates } from './legacy-anki-templates.js';
import { siteIdentity } from './site-access.js';
import { aiDefaults, aiEndpoint, parseAIJSON, legacyAIPrompts } from '../services/ai.js';

export const defaults = {
  "pluginSwitch": false,
  "settingsTab": "词典",
  "panelTransparency": 86,
  "panelBlur": 6,
  "dockedIconOpacity": 20,
  "panelBackground": "",
  "panelBackgroundFit": "cover",
  "copy": true,
  "targetTags": "p,h1,h2,h3,h4,h5,h6",
  "ignoreFurigana": true,
  "showCopyContent": true,
  "extraImage": false,
  "ignoreSymbolPairs": true,
  "symbolPairs": "「」/『』/《》/“”/【】/（）",
  "sentenceDelimiters": "。/！/？",
  "swapMouseButtons": false,
  "shortcutPreviousParagraph": "ArrowUp/Numpad2/Digit2",
  "shortcutNextParagraph": "ArrowDown/Numpad1/Digit1",
  "shortcutPreviousSentence": "Digit5/Numpad5",
  "shortcutNextSentence": "Digit4/Numpad4",
  "shortcutReadCurrent": "Digit3/Numpad0",
  "shortcutAutoRead": "Space",
  "shortcutStop": "Escape",
  "useWindowsTTS": false,
  "splitSpeech": true,
  "winVoice": 5,
  "rate": 1,
  "pitch": 1,
  "useVITS": false,
  "vitsAPI": "http://127.0.0.1:23456",
  "vitsCustomAPI": "",
  "vitsVoice": 0,
  "useHuoshTTS": false,
  "huoshVoice": "jp_female_mai",
  "huoshRate": 1,
  "vitsLang": "ja",
  "length": 1,
  "noise": 0.33,
  "noisew": 0.4,
  "max": 50,
  "readingInterval": 120,
  "google": false,
  "translationOrder": ["youdao", "google", "ai"],
  "googleFrom": "auto",
  "googleTo": "zh-CN",
  "googleColor": "#a6d22d",
  "nightGoogleColor": "#AACFA2",
  "youdao": false,
  "youdaoFrom": "auto",
  "youdaoTo": "zh-CHS",
  "youdaoColor": "#D4B102",
  "nightYoudaoColor": "#F1CE78",
  "ai": false,
  ...aiDefaults,
  "aiFrom": "auto",
  "aiTo": "zh-CN",
  "aiColor": "#8570b2",
  "nightAiColor": "#c5aedb",
  "dictionaryEnabled": false,
  "dictionaryFurigana": true,
  "dictionaryBaseForm": true,
  "dictionaryWeblio": true,
  "dictionaryMoji": true,
  "dictionaryOrder": ["weblio", "moji"],
  "dictionarySearchURL": "https://www.google.com/search?q={word}",
  "dictionaryPopupMode": "page",
  "dictionaryPopupWidth": 424,
  "dictionaryPopupHeight": 470,
  "dictionaryWindowLeft": "",
  "dictionaryWindowTop": "",
  "ankiEnabled": false,
  "ankiURL": "http://127.0.0.1:8765",
  "ankiAPIKey": "",
  "ankiModel": "anon-model",
  "ankiDecks": "anon::novel",
  "ankiTags": "外来语\n俗语\n方言",
  "ankiWordAudio": false,
  "ankiSentenceAudio": false,
  "ankiTranslationService": "google",
  "ankiTranslationServices": [],
  "ankiWordAudioService": "none",
  "ankiSentenceAudioService": "none",
  "ankiBoldWord": true,
  "ankiSuccessSound": true,
  "ankiCloseAfterAdd": false,
  "ankiImageFormat": "webp",
  "ankiLayout": "below",
  "ankiSplit": 0.55,
  "ankiFront": defaultAnkiFront,
  "ankiBack": defaultAnkiBack,
  "ankiCSS": defaultAnkiCSS,
  "scrollSwitch": true,
  "scrollIntoView": "smooth",
  "nightMode": false,
  "sentenceColor": "#dde49a",
  "nightSentenceColor": "#49522e",
  "posOpacity": 70,
  "posNounColor": "#e0aa52",
  "posVerbColor": "#b9799c",
  "posAdjectiveColor": "#d5815d",
  "posAdverbColor": "#cd6a65",
  "posParticleColor": "#b4b67c",
  "posAuxiliaryColor": "#b88f7a",
  "posOtherColor": "#bba277",
  "nightPosNounColor": "#825917",
  "nightPosVerbColor": "#64354f",
  "nightPosAdjectiveColor": "#7a3a1f",
  "nightPosAdverbColor": "#742925",
  "nightPosParticleColor": "#606237",
  "nightPosAuxiliaryColor": "#634536",
  "nightPosOtherColor": "#665333"
};

export const huoshanVoices = [
  {"id":"tts.other.BV570_streaming","name":"阿语男声","lang":"ar"},
  {"id":"tts.other.BV531_streaming","name":"葡语男声","lang":"br"},
  {"id":"pt_female_alice","name":"葡语女声","lang":"br"},
  {"id":"de_female_sophie","name":"德语女声","lang":"de"},
  {"id":"tts.other.BV516_streaming","name":"澳洲男声","lang":"en"},
  {"id":"en_female_sarah","name":"澳洲女声","lang":"en"},
  {"id":"en_male_adam","name":"美式男声","lang":"en"},
  {"id":"tts.other.BV027_streaming","name":"美式女声","lang":"en"},
  {"id":"en_male_bob","name":"英式男声","lang":"en"},
  {"id":"tts.other.BV032_TOBI_streaming","name":"英式女声","lang":"en"},
  {"id":"es_male_george","name":"西语男声","lang":"es"},
  {"id":"tts.other.BV065_streaming","name":"西语女声","lang":"es"},
  {"id":"fr_male_enzo","name":"法语男声","lang":"fr"},
  {"id":"tts.other.BV078_streaming","name":"法语女声","lang":"fr"},
  {"id":"tts.other.BV160_streaming","name":"印尼男声","lang":"id"},
  {"id":"id_female_noor","name":"印尼女声","lang":"id"},
  {"id":"tts.other.BV087_streaming","name":"意语男声","lang":"it"},
  {"id":"jp_male_satoshi","name":"日语男声","lang":"jp"},
  {"id":"jp_female_mai","name":"日语女声","lang":"jp"},
  {"id":"kr_male_gye","name":"韩语男声","lang":"ko"},
  {"id":"tts.other.BV059_streaming","name":"韩语女声","lang":"ko"},
  {"id":"tts.other.BV092_streaming","name":"马来女声","lang":"ms"},
  {"id":"tts.other.BV068_streaming","name":"俄语女声","lang":"ru"},
  {"id":"tts.other.BV083_streaming","name":"土耳其男声","lang":"tr"},
  {"id":"tts.other.BV075_streaming","name":"越南男声","lang":"vi"},
  {"id":"tts.other.BV074_streaming","name":"越南女声","lang":"vi"},
  {"id":"tts.other.BV021_streaming","name":"东北男声","lang":"zh"},
  {"id":"zh_male_zhubo","name":"男主播","lang":"zh"},
  {"id":"zh_female_zhubo","name":"女主播","lang":"zh"},
  {"id":"zh_female_qingxin","name":"清新女声","lang":"zh"},
  {"id":"zh_female_story","name":"少儿故事","lang":"zh"},
  {"id":"zh_female_sichuan","name":"四川女声","lang":"zh"},
  {"id":"tts.other.BV025_streaming","name":"台湾女声","lang":"zh"},
  {"id":"zh_male_rap","name":"嘻哈歌手","lang":"zh"},
  {"id":"zh_male_xiaoming","name":"影视配音","lang":"zh"},
  {"id":"tts.other.BV026_streaming","name":"粤语男声","lang":"zh"},
];

export const shortcutActions = {
  shortcutPreviousParagraph: 'previousParagraph', shortcutNextParagraph: 'nextParagraph',
  shortcutPreviousSentence: 'previousSentence', shortcutNextSentence: 'nextSentence',
  shortcutReadCurrent: 'readCurrent', shortcutAutoRead: 'autoRead', shortcutStop: 'stop'
};
const shortcutModifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];
export function normalizeShortcut(value) {
  if (!value.trim()) return '';
  const alternatives = value.split('/').map(binding => {
    const pieces = binding.trim().split('+');
    const code = pieces.pop();
    if (!/^(Key[A-Z]|Digit\d|Numpad\d|F([1-9]|1\d|2[0-4])|Arrow(Up|Down|Left|Right)|Space|Escape|Enter|Tab|Home|End|PageUp|PageDown|Backspace|Delete|Insert|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote|Numpad(Add|Subtract|Multiply|Divide|Decimal|Enter))$/.test(code) || pieces.some(piece => !shortcutModifiers.includes(piece)) || new Set(pieces).size !== pieces.length) {
      throw new Error('使用按键代码，例如 Digit4、Numpad4、Ctrl+ArrowRight；备用键用 / 分隔');
    }
    return [...shortcutModifiers.filter(modifier => pieces.includes(modifier)), code].join('+');
  });
  return [...new Set(alternatives)].join('/');
}
export function shortcutFromEvent(event) {
  return [...shortcutModifiers.filter(modifier => event[{ Ctrl: 'ctrlKey', Alt: 'altKey', Shift: 'shiftKey', Meta: 'metaKey' }[modifier]]), event.code].join('+');
}
export function validateShortcuts(values) {
  const used = new Map();
  for (const key of Object.keys(shortcutActions)) {
    for (const binding of (values[key] || '').split('/').filter(Boolean)) {
      if (used.has(binding)) throw new Error(`${binding} 已用于另一个操作，请先修改或清空那个快捷键`);
      used.set(binding, key);
    }
  }
}
export function shortcutAction(event, values) {
  const binding = shortcutFromEvent(event);
  return Object.entries(shortcutActions).find(([key]) => (values[key] || '').split('/').includes(binding))?.[1];
}


const speechSwitches = ['useWindowsTTS', 'useVITS', 'useHuoshTTS'];
const ankiAudioKeys = ['ankiWordAudio', 'ankiSentenceAudio'];
const numericRules = {
  panelTransparency: [0, 100, true], panelBlur: [0, 20, true], dockedIconOpacity: [0, 100, true],
  readingInterval: [0, 60000, true],
  posOpacity: [0, 100, true],
  dictionaryPopupWidth: [220, 1600], dictionaryPopupHeight: [160, 1600],
  ankiSplit: [0.2, 0.8],
  winVoice: [0, 10000, true], vitsVoice: [0, 100000, true],
  rate: [0.1, 2], huoshRate: [0.5, 2], pitch: [0, 2], length: [0.1, 2],
  noise: [0, 2], noisew: [0, 2], max: [1, 10000, true]
};
const settingOptions = {
  panelBackgroundFit: ['cover', 'contain'],
  settingsTab: ['复制', '语音', '翻译', '词典', 'Anki', '外观', '键位', '帮助'],
  dictionaryPopupMode: ['page', 'independent'],
  ankiImageFormat: ['webp', 'png', 'jpeg'], ankiLayout: ['below', 'right'],
  ankiTranslationService: ['google', 'youdao', 'ai', 'none'],
  aiProtocol: ['auto', 'openai', 'claude', 'gemini'],
  aiFrom: ['auto', 'zh-CN', 'zh-TW', 'ja', 'en'], aiTo: ['zh-CN', 'zh-TW', 'ja', 'en'],
  ankiWordAudioService: ['none', 'huosh', 'vits'], ankiSentenceAudioService: ['none', 'huosh', 'vits'],
  huoshVoice: huoshanVoices.map(voice => voice.id),
  vitsLang: ['auto', 'ja', 'zh'],
  googleFrom: ['auto', 'zh-CN', 'zh-TW', 'ja', 'en'], googleTo: ['zh-CN', 'zh-TW', 'ja', 'en'],
  youdaoFrom: ['auto', 'ja', 'en', 'zh-CHS', 'zh-CHT'], youdaoTo: ['zh-CHS', 'zh-CHT', 'ja', 'en'],
  scrollIntoView: ['smooth', 'instant']
};

function normalizeSetting(key, value) {
  const fallback = defaults[key];
  if (fallback === undefined) throw new Error(`未知设置: ${key}`);
  if (key === 'dictionaryWindowLeft' || key === 'dictionaryWindowTop') {
    if (value === '') return '';
    const number = Number(value);
    if (value === null || !Number.isFinite(number) || Math.abs(number) > 100000) throw new Error('窗口坐标无效');
    return Math.round(number);
  }
  if (key === 'translationOrder' || key === 'dictionaryOrder') {
    if (!Array.isArray(value) || value.some(service => !fallback.includes(service)) || new Set(value).size !== value.length) throw new Error('服务顺序只能包含对应服务，每项不能重复');
    return serviceOrder({ [key]: value }, key);
  }
  if (key === 'ankiTranslationServices') {
    if (!Array.isArray(value) || value.some(service => !defaults.translationOrder.includes(service))) throw new Error('请选择有效的翻译服务，或全部不选');
    return [...new Set(value)];
  }
  if (typeof fallback === 'boolean') return value === true || value === 'true';
  if (numericRules[key]) {
    const [min, max, integer] = numericRules[key];
    const number = Number(value);
    if (value === '' || !Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
      throw new Error(`请输入 ${min}–${max} 之间的${integer ? '整数' : '数字'}`);
    }
    return number;
  }
  const text = String(value);
  if (key === 'aiURL') {
    const template = text.trim();
    aiEndpoint({ ...aiDefaults, aiURL: template, aiModel: 'model' });
    return template;
  }
  if (key === 'aiHeaders' || key === 'aiBody') {
    parseAIJSON(text, key === 'aiHeaders' ? '自定义请求头' : '自定义参数');
    return text.trim() || '{}';
  }
  if (key === 'aiPrompt') {
    if (!text.trim() || text.length > 30000 || !text.includes('{{text}}')) throw new Error('提示词须包含 {{text}}，最多 30000 个字符');
    return text;
  }
  if (key === 'aiModel' || key === 'aiAPIKey') {
    if (text.length > 2048 || /[\r\n\u0000]/.test(text)) throw new Error('模型名称和 API Key 最多 2048 个字符，不能换行');
    return text.trim();
  }
  if (key === 'panelBackground') {
    if (!text) return '';
    if (text.length > 3 * 1024 * 1024 || !/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(text)) throw new Error('请选择不超过 2 MB 的 PNG、JPEG、WebP 或 GIF 图片');
    return text;
  }
  if (key === 'targetTags') {
    const tags = text.trim().toLowerCase().split(/[\s,，]+/).filter(Boolean);
    if (!tags.length || tags.some(tag => !/^[a-z][a-z0-9-]*$/.test(tag))) throw new Error('请输入标签名，用逗号分隔，例如 p,h1,div；不支持 CSS 选择器');
    return [...new Set(tags)].join(',');
  }
  if (key === 'vitsAPI' || key === 'ankiURL') {
    try {
      const address = new URL(text.trim());
      if (!/^https?:\/\//i.test(text.trim()) || !['http:', 'https:'].includes(address.protocol) || address.username || address.password || /[?#]/.test(text)) throw new Error();
      return address.href.replace(/\/+$/, '');
    } catch { throw new Error(`请输入完整的 HTTP / HTTPS 服务地址，例如 ${key === 'ankiURL' ? 'http://127.0.0.1:8765' : 'http://127.0.0.1:23456'}`); }
  }
  if (key === 'vitsCustomAPI') {
    const api = text.trim();
    if (!api) return '';
    try {
      const address = new URL(api);
      if (!/^https?:\/\//i.test(api) || !['http:', 'https:'].includes(address.protocol) || address.username || address.password) throw new Error();
      return address.href;
    } catch { throw new Error('请输入完整的 HTTP / HTTPS 音频 API 地址，或留空使用上方设置'); }
  }
  if (key === 'dictionarySearchURL') {
    const template = text.trim();
    try {
      const address = new URL(template.replaceAll('{word}', 'word'));
      if (!/^https?:\/\//i.test(template) || !['http:', 'https:'].includes(address.protocol) || address.username || address.password || !template.includes('{word}')) throw new Error();
      return template;
    } catch { throw new Error('请输入包含 {word} 的 HTTP / HTTPS 搜索地址，例如 https://www.google.com/search?q={word}'); }
  }
  if (key === 'ankiModel') {
    const name = text.trim();
    if (!name || name.length > 100 || /[\r\n\u0000]/.test(name)) throw new Error('模型名称须为 1–100 个字符，不能换行');
    return name;
  }
  if (key === 'ankiDecks' || key === 'ankiTags') {
    const isDeck = key === 'ankiDecks';
    const items = [...new Set(text.trim().split(isDeck ? /\r?\n/ : /\s+/).map(item => item.trim()).filter(Boolean))];
    if (!items.length || items.length > 100 || text.length > 10000 || items.some(item => item.length > 200 || /[\u0000-\u001f\u007f]/.test(item))) throw new Error(`${isDeck ? '卡组' : '标签'}不能为空，最多 100 项，每项最多 200 个字符`);
    return items.join('\n');
  }
  if (key === 'ankiAPIKey') {
    if (text.length > 2048 || /[\r\n\u0000]/.test(text)) throw new Error('API Key 最多 2048 个字符，不能换行');
    return text.trim();
  }
  if (['ankiFront', 'ankiBack', 'ankiCSS'].includes(key)) {
    if (text.length > 100000 || (key !== 'ankiCSS' && !text.trim())) throw new Error('卡片模板不能为空，且最多 100000 个字符；样式可留空');
    return key === 'ankiCSS' ? text.replace(/^(?:[\t ]*\r?\n)+/, '') : text;
  }
  if (key.startsWith('shortcut')) return normalizeShortcut(text);
  if (settingOptions[key] && !settingOptions[key].includes(text)) throw new Error('请选择有效选项');
  if (key.endsWith('Color') && !/^#[\da-f]{6}$/i.test(text)) throw new Error('请输入六位十六进制颜色');
  if (key === 'symbolPairs' && text.split('/').some(pair => Array.from(pair).length !== 2)) throw new Error('符号对须为两个字符，用 / 分隔');
  if (key === 'sentenceDelimiters' && (!text || text.split('/').some(part => Array.from(part).length !== 1))) throw new Error('断句符号须为单个字符，用 / 分隔');
  return text;
}

function normalizeSettings(saved = {}) {
  const result = { ...defaults, ankiTranslationServices: [...defaults.ankiTranslationServices], translationOrder: [...defaults.translationOrder], dictionaryOrder: [...defaults.dictionaryOrder] };
  for (const key of Object.keys(result)) {
    if (saved[key] === undefined) continue;
    try {
      result[key] = normalizeSetting(key, saved[key]);
    } catch { /* Invalid values use defaults. */ }
  }
  if (speechSwitches.filter(key => result[key]).length > 1) speechSwitches.forEach(key => { result[key] = false; });
  for (const key of ankiAudioKeys) {
    if (saved[key + 'Service'] === undefined && result[key]) result[key + 'Service'] = result.useVITS ? 'vits' : result.useHuoshTTS ? 'huosh' : 'none';
  }
  if (saved.ankiTranslationServices === undefined && ['google', 'youdao', 'ai', 'none'].includes(saved.ankiTranslationService)) result.ankiTranslationServices = saved.ankiTranslationService === 'none' ? [] : [saved.ankiTranslationService];
  result.ankiTranslationServices = result.translationOrder.filter(service => result.ankiTranslationServices.includes(service));
  for (const [key, previous] of Object.entries(legacyAnkiTemplates)) {
    if (previous.includes(saved[key])) result[key] = defaults[key];
  }
  if (legacyAIPrompts.includes(saved.aiPrompt)) result.aiPrompt = defaults.aiPrompt;
  return result;
}

export { speechSwitches, numericRules, settingOptions, normalizeSetting, normalizeSettings };

export function serviceOrder(settings, key) {
  const fallback = key === 'translationOrder' || key === 'dictionaryOrder' ? defaults[key] : [];
  return [...new Set([...(Array.isArray(settings?.[key]) ? settings[key].filter(service => fallback.includes(service)) : []), ...fallback])];
}

// Keep existing setting keys as the day palette for storage compatibility.
export const colorsFor = settings => Object.fromEntries(['googleColor', 'youdaoColor', 'aiColor', 'sentenceColor'].map(key => [key, settings[settings.nightMode ? 'night' + key[0].toUpperCase() + key.slice(1) : key]]));

export const posGroups = [
  { key: 'posNounColor', label: '名词', pos: ['名詞', '代名詞'] },
  { key: 'posVerbColor', label: '动词', pos: ['動詞'] },
  { key: 'posAdjectiveColor', label: '形容词', pos: ['形容詞', '形容動詞'] },
  { key: 'posAdverbColor', label: '副词 / 连体词', pos: ['副詞', '連体詞'] },
  { key: 'posParticleColor', label: '助词', pos: ['助詞'] },
  { key: 'posAuxiliaryColor', label: '助动词', pos: ['助動詞'] },
  { key: 'posOtherColor', label: '其他', pos: [] }
];

export function wordColorFor(settings, pos) {
  const key = posGroups.find(group => group.pos.includes(pos))?.key || 'posOtherColor';
  const paletteKey = settings.nightMode ? 'night' + key[0].toUpperCase() + key.slice(1) : key;
  return settings[paletteKey] || defaults[paletteKey];
}


export function createSettingsStore(platform, { siteURL = platform.siteURL ?? globalThis.location?.href } = {}) {
  const site = siteIdentity(siteURL);
  let values = { ...defaults };
  let siteEnabled = false, siteRevision = 0, unsubscribeSettings;
  let writeQueue = Promise.resolve();
  const listeners = new Set();
  const sameValue = (left, right) => Array.isArray(left) && Array.isArray(right) ? left.length === right.length && left.every((value, index) => value === right[index]) : left === right;
  const publish = patch => {
    if (site.key && Object.hasOwn(patch, site.key)) siteEnabled = patch[site.key] === true;
    // The legacy global switch never authorizes a website.
    patch = { ...patch, pluginSwitch: siteEnabled };
    const enabled = speechSwitches.find(key => patch[key] === true);
    if (enabled) patch = { ...Object.fromEntries(speechSwitches.map(key => [key, false])), ...patch };
    const next = normalizeSettings({ ...values, ...patch });
    const changed = Object.fromEntries(Object.keys(next).filter(key => !sameValue(next[key], values[key])).map(key => [key, next[key]]));
    values = next;
    if (Object.keys(changed).length) for (const listener of listeners) listener(values, changed);
  };
  const enqueue = operation => {
    const result = writeQueue.then(operation);
    writeQueue = result.catch(() => {});
    return result;
  };
  return {
    get values() { return values; },
    get siteKey() { return site.key; },
    get siteLabel() { return site.label; },
    async init() {
      // Subscribe first so changes made while storage is loading are not lost.
      const pending = [];
      let loaded = false;
      unsubscribeSettings = platform.watchSettings(patch => {
        if (site.key && Object.hasOwn(patch, site.key)) siteRevision++;
        if (loaded) publish(patch);
        else pending.push(patch);
      });
      const saved = await platform.getSettings();
      siteEnabled = Boolean(site.key && saved[site.key] === true);
      values = normalizeSettings({ ...saved, pluginSwitch: siteEnabled });
      loaded = true;
      for (const patch of pending) publish(patch);
      // Persist migrated choices once so later reader voice changes cannot
      // change a user's independent Anki audio service on the next startup.
      const migrated = Object.fromEntries(ankiAudioKeys.filter(key => saved[key + 'Service'] === undefined && values[key]).map(key => [key + 'Service', values[key + 'Service']]));
      for (const [key, previous] of Object.entries(legacyAnkiTemplates)) {
        if (previous.includes(saved[key]) && saved[key] !== values[key]) migrated[key] = values[key];
      }
      if (legacyAIPrompts.includes(saved.aiPrompt)) migrated.aiPrompt = values.aiPrompt;
      if (saved.ankiTranslationServices === undefined && ['google', 'youdao', 'ai', 'none'].includes(saved.ankiTranslationService)) migrated.ankiTranslationServices = values.ankiTranslationServices;
      if (Object.keys(migrated).length) await platform.setSettings(migrated);
      return values;
    },
    set(key, value) { return enqueue(async () => {
      let normalized = normalizeSetting(key, value);
      if (key === 'pluginSwitch') {
        if (!site.key) throw new Error('请在 HTTP、HTTPS 网页或本地文件中开启阅读工具');
        if (normalized === values.pluginSwitch) return;
        const revision = siteRevision;
        if (normalized) await platform.setSettings({ [site.key]: true });
        else await platform.removeSettings([site.key]);
        // A newer cross-tab event can arrive before this write's promise
        // settles. Never overwrite that event with a late local echo.
        if (revision === siteRevision) publish({ [site.key]: normalized ? true : undefined });
        return;
      }
      if (key === 'ankiTranslationServices') normalized = values.translationOrder.filter(service => normalized.includes(service));
      const patch = speechSwitches.includes(key) && normalized
        ? { ...Object.fromEntries(speechSwitches.filter(other => other !== key).map(other => [other, false])), [key]: true }
        : { [key]: normalized };
      validateShortcuts({ ...values, ...patch });
      if (Object.entries(patch).every(([name, next]) => sameValue(values[name], next))) return;
      await platform.setSettings(patch);
      publish(patch);
    }); },
    reset() { return enqueue(async () => {
      // Write all defaults together, bypassing transient shortcut conflicts.
      const patch = { ...defaults };
      delete patch.pluginSwitch;
      await platform.setSettings(patch);
      publish(patch);
    }); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    destroy() { unsubscribeSettings?.(); listeners.clear(); }
  };
}


