App.huoshanVoices = [
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

// App is scoped to each generated bundle; no variables leak into the host page.
const speechSwitches = ['useWindowsTTS', 'useVITS', 'useHuoshTTS'];
const numericRules = {
  readingInterval: [0, 60000, true],
  winVoice: [0, 10000, true], vitsVoice: [0, 100000, true],
  rate: [0.1, 2], huoshRate: [0.5, 2], pitch: [0, 2], length: [0.1, 2],
  noise: [0, 2], noisew: [0, 2], max: [1, 10000, true]
};
const settingOptions = {
  settingsTab: ['复制', '语音', '翻译', '外观', '快捷键', '帮助'],
  huoshVoice: App.huoshanVoices.map(voice => voice.id),
  vitsLang: ['auto', 'ja', 'zh'],
  googleFrom: ['auto', 'zh-CN', 'zh-TW', 'ja', 'en'], googleTo: ['zh-CN', 'zh-TW', 'ja', 'en'],
  youdaoFrom: ['auto', 'ja', 'en', 'zh-CHS', 'zh-CHT'], youdaoTo: ['zh-CHS', 'zh-CHT', 'ja', 'en'],
  borderStyle: ['none', 'solid', 'dotted', 'dashed', 'double', 'groove', 'ridge', 'inset', 'outset'],
  scrollIntoView: ['smooth', 'instant']
};

function normalizeSetting(key, value) {
  const fallback = App.defaults[key];
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
  if (key === 'vitsAPI') {
    try {
      const address = new URL(text.trim());
      if (!/^https?:\/\//i.test(text.trim()) || !['http:', 'https:'].includes(address.protocol) || address.username || address.password || /[?#]/.test(text)) throw new Error();
      return address.href.replace(/\/+$/, '');
    } catch { throw new Error('请输入完整的 HTTP / HTTPS 服务地址，例如 http://127.0.0.1:23456'); }
  }
  if (key.startsWith('shortcut')) return App.normalizeShortcut(text);
  if (settingOptions[key] && !settingOptions[key].includes(text)) throw new Error('请选择有效选项');
  if (key.endsWith('Color') && !/^#[\da-f]{6}$/i.test(text)) throw new Error('请输入六位十六进制颜色');
  if (['borderWidth', 'borderRadius'].includes(key) && !/^\d+(\.\d+)?(px|em|rem)$/.test(text)) throw new Error('请输入带单位的非负长度，例如 2px');
  if (key === 'symbolPairs' && text.split('/').some(pair => Array.from(pair).length !== 2)) throw new Error('符号对须为两个字符，用 / 分隔');
  if (key === 'sentenceDelimiters' && (!text || text.split('/').some(part => Array.from(part).length !== 1))) throw new Error('断句符号须为单个字符，用 / 分隔');
  return text;
}

function normalizeSettings(saved = {}) {
  const result = { ...App.defaults };
  for (const key of Object.keys(result)) {
    if (saved[key] === undefined) continue;
    try {
      result[key] = normalizeSetting(key, saved[key]);
    } catch { /* Invalid values use defaults. */ }
  }
  if (speechSwitches.filter(key => result[key]).length > 1) speechSwitches.forEach(key => { result[key] = false; });
  return result;
}

function createSettingsStore(platform) {
  let values = { ...App.defaults };
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
      App.validateShortcuts({ ...values, ...patch });
      if (Object.entries(patch).every(([name, next]) => values[name] === next)) return;
      await platform.setSettings(patch);
      publish(patch);
    },
    async reset() {
      // Write all defaults together, bypassing transient shortcut conflicts.
      const patch = { ...App.defaults };
      await platform.setSettings(patch);
      publish(patch);
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
}

Object.assign(App, { speechSwitches, numericRules, settingOptions, normalizeSetting, normalizeSettings, createSettingsStore });
// Existing keys remain the day palette, preserving earlier custom colors.
App.colorsFor = settings => Object.fromEntries(['googleColor', 'youdaoColor', 'freeBorderColor', 'selectedBorderColor', 'sentenceColor'].map(key => [key, settings[settings.nightMode ? 'night' + key[0].toUpperCase() + key.slice(1) : key]]));
