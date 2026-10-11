export const defaults = {
  "pluginSwitch": false,
  "settingsTab": "复制",
  "copy": true,
  "targetTags": "p,h1,h2,h3,h4,h5,h6",
  "ignoreFurigana": true,
  "showCopyContent": true,
  "extraImage": false,
  "ignoreSymbolPairs": false,
  "symbolPairs": "「」/『』/《》/“”/【】/（）",
  "sentenceDelimiters": "。/！/？",
  "shortcutPreviousParagraph": "ArrowUp/Numpad2/Digit2",
  "shortcutNextParagraph": "ArrowDown/Numpad1/Digit1",
  "shortcutPreviousSentence": "Numpad5/Digit5",
  "shortcutNextSentence": "Numpad4/Digit4",
  "shortcutReadCurrent": "F1/Numpad0",
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
  "googleFrom": "auto",
  "googleTo": "zh-CN",
  "googleColor": "#C8E37D",
  "nightGoogleColor": "#AACFA2",
  "youdao": false,
  "youdaoFrom": "auto",
  "youdaoTo": "zh-CHS",
  "youdaoColor": "#D4B102",
  "nightYoudaoColor": "#F1CE78",
  "borderWidth": "2px",
  "borderStyle": "solid",
  "borderRadius": "8px",
  "freeBorderColor": "#225D2E",
  "selectedBorderColor": "#94B505",
  "sentenceColor": "#d4e725",
  "nightMode": false,
  "nightFreeBorderColor": "#6C9387",
  "nightSelectedBorderColor": "#B4C982",
  "nightSentenceColor": "#405343",
  "scrollSwitch": true,
  "scrollIntoView": "smooth"
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
const numericRules = {
  readingInterval: [0, 60000, true],
  winVoice: [0, 10000, true], vitsVoice: [0, 100000, true],
  rate: [0.1, 2], huoshRate: [0.5, 2], pitch: [0, 2], length: [0.1, 2],
  noise: [0, 2], noisew: [0, 2], max: [1, 10000, true]
};
const settingOptions = {
  settingsTab: ['复制', '语音', '翻译', '外观', '快捷键', '帮助'],
  huoshVoice: huoshanVoices.map(voice => voice.id),
  vitsLang: ['auto', 'ja', 'zh'],
  googleFrom: ['auto', 'zh-CN', 'zh-TW', 'ja', 'en'], googleTo: ['zh-CN', 'zh-TW', 'ja', 'en'],
  youdaoFrom: ['auto', 'ja', 'en', 'zh-CHS', 'zh-CHT'], youdaoTo: ['zh-CHS', 'zh-CHT', 'ja', 'en'],
  borderStyle: ['none', 'solid', 'dotted', 'dashed', 'double', 'groove', 'ridge', 'inset', 'outset'],
  scrollIntoView: ['smooth', 'instant']
};

function normalizeSetting(key, value) {
  const fallback = defaults[key];
  if (fallback === undefined) throw new Error(`未知设置: ${key}`);
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
  if (key === 'targetTags') {
    const tags = text.trim().toLowerCase().split(/[\s,，]+/).filter(Boolean);
    if (!tags.length || tags.some(tag => !/^[a-z][a-z0-9-]*$/.test(tag))) throw new Error('请输入标签名，用逗号分隔，例如 p,h1,div；不支持 CSS 选择器');
    return [...new Set(tags)].join(',');
  }
  if (key === 'vitsAPI') {
    try {
      const address = new URL(text.trim());
      if (!/^https?:\/\//i.test(text.trim()) || !['http:', 'https:'].includes(address.protocol) || address.username || address.password || /[?#]/.test(text)) throw new Error();
      return address.href.replace(/\/+$/, '');
    } catch { throw new Error('请输入完整的 HTTP / HTTPS 服务地址，例如 http://127.0.0.1:23456'); }
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
  if (key.startsWith('shortcut')) return normalizeShortcut(text);
  if (settingOptions[key] && !settingOptions[key].includes(text)) throw new Error('请选择有效选项');
  if (key.endsWith('Color') && !/^#[\da-f]{6}$/i.test(text)) throw new Error('请输入六位十六进制颜色');
  if (['borderWidth', 'borderRadius'].includes(key) && !/^\d+(\.\d+)?(px|em|rem)$/.test(text)) throw new Error('请输入带单位的非负长度，例如 2px');
  if (key === 'symbolPairs' && text.split('/').some(pair => Array.from(pair).length !== 2)) throw new Error('符号对须为两个字符，用 / 分隔');
  if (key === 'sentenceDelimiters' && (!text || text.split('/').some(part => Array.from(part).length !== 1))) throw new Error('断句符号须为单个字符，用 / 分隔');
  return text;
}

function normalizeSettings(saved = {}) {
  const result = { ...defaults };
  for (const key of Object.keys(result)) {
    if (saved[key] === undefined) continue;
    try {
      result[key] = normalizeSetting(key, saved[key]);
    } catch { /* Invalid values use defaults. */ }
  }
  if (speechSwitches.filter(key => result[key]).length > 1) speechSwitches.forEach(key => { result[key] = false; });
  return result;
}

export { speechSwitches, numericRules, settingOptions, normalizeSetting, normalizeSettings };

// Keep existing setting keys as the day palette for storage compatibility.
export const colorsFor = settings => Object.fromEntries(['googleColor', 'youdaoColor', 'freeBorderColor', 'selectedBorderColor', 'sentenceColor'].map(key => [key, settings[settings.nightMode ? 'night' + key[0].toUpperCase() + key.slice(1) : key]]));


export function createSettingsStore(platform) {
  let values = { ...defaults };
  const listeners = new Set();
  const publish = patch => {
    const enabled = speechSwitches.find(key => patch[key] === true);
    if (enabled) patch = { ...Object.fromEntries(speechSwitches.map(key => [key, false])), ...patch };
    const next = normalizeSettings({ ...values, ...patch });
    const changed = Object.fromEntries(Object.keys(next).filter(key => next[key] !== values[key]).map(key => [key, next[key]]));
    values = next;
    if (Object.keys(changed).length) for (const listener of listeners) listener(values, changed);
  };
  return {
    get values() { return values; },
    async init() {
      // Subscribe first so changes made while storage is loading are not lost.
      const pending = [];
      let loaded = false;
      platform.watchSettings(patch => loaded ? publish(patch) : pending.push(patch));
      values = normalizeSettings(await platform.getSettings());
      loaded = true;
      for (const patch of pending) publish(patch);
      return values;
    },
    async set(key, value) {
      const normalized = normalizeSetting(key, value);
      const patch = speechSwitches.includes(key) && normalized
        ? { ...Object.fromEntries(speechSwitches.filter(other => other !== key).map(other => [other, false])), [key]: true }
        : { [key]: normalized };
      validateShortcuts({ ...values, ...patch });
      if (Object.entries(patch).every(([name, next]) => values[name] === next)) return;
      await platform.setSettings(patch);
      publish(patch);
    },
    async reset() {
      // Write all defaults together, bypassing transient shortcut conflicts.
      const patch = { ...defaults };
      await platform.setSettings(patch);
      publish(patch);
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
}


