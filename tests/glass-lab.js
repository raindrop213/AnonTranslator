// Development-only controls. These overrides never enter the extension bundle.
const targets = { settings: '设置面板', popup: '查词窗', words: '分词底色' };
const themes = { light: '浅色', dark: '深色' };
// Apply the supplied preset once, then keep subsequent adjustments in this browser.
const presetRevision = '2026-10-24-light-glass';
const presetSurface = {
  enabled: true, transparency: 82, minAlpha: 0, alphaWeight: 100,
  angle: 140, middleColor: '#ffffff', middleAlpha: 0, stop1: 30, stop2: 70,
  borderWidth: 1, borderColor: '#ffffff', borderAlpha: 5, radius: 27,
  blur: 6, saturation: 100,
  highlightX: 1, highlightY: 1, highlightBlur: 1, highlightSpread: 0,
  highlightColor: '#ffffff', edgeX: -1, edgeY: -1, edgeBlur: 1, edgeSpread: 0,
  edgeOpacity: 25, outerX: 2, outerY: 5, outerBlur: 22, outerSpread: 0,
  outerColor: '#000000', outerOpacity: 18
};
const presetDark = {
  ...presetSurface, baseColor: '#231b28', startColor: '#928c97', startAlpha: 60,
  endColor: '#928c97', endAlpha: 40, highlightOpacity: 25, edgeColor: '#000000'
};
const suppliedPreset = {
  settings: {
    light: {
      ...presetSurface, baseColor: '#f0f0f0', startColor: '#ffffff', startAlpha: 60,
      endColor: '#ffffff', endAlpha: 40, highlightOpacity: 85, edgeColor: '#3c3c3c',
      cardColor: '#ffffff', cardAlpha: 18, inputColor: '#ffffff', inputAlpha: 18,
      cardBorderColor: '#ffffff', cardBorderAlpha: 8
    },
    dark: {
      ...presetDark, cardColor: '#000000', cardAlpha: 18, inputColor: '#000000',
      inputAlpha: 18, cardBorderColor: '#000000', cardBorderAlpha: 8
    }
  },
  popup: { light: {
    ...presetSurface, baseColor: '#f0f0f0', startColor: '#ffffff', startAlpha: 60,
    endColor: '#ffffff', endAlpha: 30, borderWidth: 0, borderColor: '#363338',
    borderAlpha: 100, radius: 0, blur: 8, saturation: 110,
    highlightOpacity: 85, edgeColor: '#3c3c3c', outerX: 0, outerOpacity: 13
  }, dark: {
    ...presetDark, endAlpha: 30, borderWidth: 0, borderColor: '#edeaf0',
    borderAlpha: 100, radius: 0, blur: 8, saturation: 110, outerOpacity: 30
  } },
  words: { light: {
    ...presetSurface, transparency: 0, uniformWords: false,
    startColor: '#ffffff', startAlpha: 75, middleColor: '#b5b5b5', middleAlpha: 25,
    stop1: 50, stop2: 50, endColor: '#ffffff', endAlpha: 25,
    borderWidth: 0, borderColor: '#30343b', borderAlpha: 100, radius: 0, blur: 0,
    highlightOpacity: 25, edgeColor: '#373737', edgeOpacity: 22,
    outerColor: '#232323', outerX: 0, outerY: 1, outerBlur: 2, outerOpacity: 10
  }, dark: {
    ...presetSurface, transparency: 25, uniformWords: false,
    startColor: '#ffffff', startAlpha: 25, stop1: 50, stop2: 50,
    endColor: '#ffffff', endAlpha: 7, borderWidth: 0, borderColor: '#e2e7ed',
    borderAlpha: 100, radius: 0, blur: 0, highlightOpacity: 26,
    edgeColor: '#000000', edgeOpacity: 22,
    outerX: 1, outerY: 1, outerBlur: 2, outerOpacity: 10
  } }
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rgb = hex => hex.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16)).join(',');
const rgba = (hex, opacity) => `rgba(${rgb(hex)},${Number((opacity / 100).toFixed(4))})`;
const split = text => {
  const parts = []; let depth = 0, start = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '(') depth++;
    if (text[index] === ')') depth--;
    if (text[index] === ',' && depth === 0) { parts.push(text.slice(start, index).trim()); start = index + 1; }
  }
  parts.push(text.slice(start).trim()); return parts;
};
function color(text, fallback = '#ffffff') {
  text = String(text || '').trim();
  if (/^#[\da-f]{6}$/i.test(text)) return { hex: text.toLowerCase(), opacity: 100 };
  const values = text.match(/-?(?:\d*\.)?\d+/g)?.map(Number);
  if (!values || values.length < 3) return { hex: fallback, opacity: 100 };
  const scale = text.startsWith('color(srgb') ? 255 : 1;
  return { hex: '#' + values.slice(0, 3).map(value => Math.round(clamp(value * scale, 0, 255)).toString(16).padStart(2, '0')).join(''), opacity: (values[3] ?? 1) * 100 };
}
function gradient(text) {
  const start = text.indexOf('linear-gradient(');
  if (start < 0) return null;
  let depth = 1, end = start + 16;
  for (; end < text.length && depth; end++) { if (text[end] === '(') depth++; if (text[end] === ')') depth--; }
  const parts = split(text.slice(start + 16, end - 1));
  const middle = color(parts[2]), first = color(parts[1]);
  if (middle.opacity === 0) middle.hex = first.hex;
  const stop1 = Number(parts[2]?.match(/([\d.]+)%$/)?.[1] ?? 30);
  return { angle: parseFloat(parts[0]) || 0, start: first, middle, end: color(parts.at(-1)), stop1, stop2: parts.length === 4 ? stop1 : Number(parts[3]?.match(/([\d.]+)%$/)?.[1] ?? 70) };
}
function shadow(text) {
  const match = text.match(/(?:rgba?|color)\([^)]*\)|#[\da-f]{3,8}/i);
  const tint = color(match?.[0], '#000000');
  const values = text.replace(match?.[0] || '', '').match(/-?(?:\d*\.)?\d+(?=px)/g)?.map(Number) || [];
  return { color: tint.hex, opacity: text === 'none' || !text ? 0 : tint.opacity, x: values[0] || 0, y: values[1] || 0, blur: values[2] || 0, spread: values[3] || 0 };
}
const numeric = (key, label, min, max, step = 1, unit = '') => ({ key, label, type: 'number', min, max, step, unit });
const tint = (key, label) => ({ key, label, type: 'color' });
const toggle = (key, label) => ({ key, label, type: 'checkbox' });
const shadowFields = prefix => [tint(prefix + 'Color', '颜色'), numeric(prefix + 'Opacity', '不透明度', 0, 100, 1, '%'), numeric(prefix + 'X', '横向偏移', -40, 40, 1, 'px'), numeric(prefix + 'Y', '纵向偏移', -40, 60, 1, 'px'), numeric(prefix + 'Blur', '模糊半径', 0, 80, 1, 'px'), numeric(prefix + 'Spread', '扩展距离', -30, 30, 1, 'px')];
const groups = [
  { title: '底色与透明度', open: true, fields: [toggle('enabled', '玻璃效果'), tint('baseColor', '背景颜色'), numeric('transparency', '背景透明度', 0, 100, 1, '%'), numeric('minAlpha', '底色不透明度下限', 0, 100, 1, '%'), numeric('alphaWeight', '透明度响应系数', 0, 100, 1, '%'), { ...toggle('uniformWords', '统一分词底色'), only: 'words' }] },
  { title: '渐变高光', open: true, fields: [numeric('angle', '渐变角度', 0, 360, 1, '°'), tint('startColor', '起点颜色'), numeric('startAlpha', '起点不透明度', 0, 100, 1, '%'), tint('middleColor', '中段颜色'), numeric('middleAlpha', '中段不透明度', 0, 100, 1, '%'), numeric('stop1', '中段起点', 0, 100, 1, '%'), numeric('stop2', '中段终点', 0, 100, 1, '%'), tint('endColor', '终点颜色'), numeric('endAlpha', '终点不透明度', 0, 100, 1, '%')] },
  { title: '模糊、形状与边框', fields: [numeric('blur', '背景模糊', 0, 40, .5, 'px'), numeric('saturation', '背景饱和度', 0, 250, 1, '%'), numeric('radius', '圆角', 0, 48, 1, 'px'), numeric('borderWidth', '边框宽度', 0, 4, .5, 'px'), tint('borderColor', '边框颜色'), numeric('borderAlpha', '边框不透明度', 0, 100, 1, '%')] },
  { title: '内高光阴影', fields: shadowFields('highlight') },
  { title: '内暗边阴影', fields: shadowFields('edge') },
  { title: '外部阴影', fields: shadowFields('outer') },
  { title: '卡片与输入框', only: 'settings', fields: [tint('cardColor', '卡片底色'), numeric('cardAlpha', '卡片不透明度', 0, 100, 1, '%'), tint('inputColor', '输入框底色'), numeric('inputAlpha', '输入框不透明度', 0, 100, 1, '%'), tint('cardBorderColor', '卡片边框颜色'), numeric('cardBorderAlpha', '卡片边框不透明度', 0, 100, 1, '%')] }
];
const fields = groups.flatMap(group => group.fields);
function normalize(saved, base) {
  const result = { ...base };
  for (const field of fields) {
    const value = saved?.[field.key];
    if (field.type === 'checkbox' && typeof value === 'boolean') result[field.key] = value;
    else if (field.type === 'color' && /^#[\da-f]{6}$/i.test(value)) result[field.key] = value.toLowerCase();
    else if (field.type === 'number' && Number.isFinite(Number(value)) && value !== undefined) result[field.key] = clamp(Number(value), field.min, field.max);
  }
  return result;
}
function baseline(target, entry, theme) {
  const element = entry.surface, css = getComputedStyle(element), root = entry.root;
  const popupImage = target === 'popup' && entry.host.hasAttribute('data-background');
  const tint = color(target === 'words' ? element.style.getPropertyValue('--at-word-color') : popupImage ? `rgb(${css.getPropertyValue('--at-popup-base-rgb')})` : css.backgroundColor);
  const rawAlpha = parseFloat(css.getPropertyValue(target === 'settings' ? '--surface-alpha' : popupImage ? '--at-popup-image-alpha' : '--at-popup-alpha'));
  const wordAlpha = parseFloat(css.getPropertyValue('--at-word-opacity'));
  const alpha = target === 'words' ? (Number.isFinite(wordAlpha) ? wordAlpha / 100 : tint.opacity / 100) : Number.isFinite(rawAlpha) ? rawAlpha : tint.opacity / 100;
  const grad = gradient(target === 'settings' ? getComputedStyle(element, '::after').backgroundImage : popupImage ? css.getPropertyValue('--at-popup-highlight') : css.backgroundImage);
  let formula = css.getPropertyValue('--surface-background-alpha');
  if (target === 'popup' && theme === 'dark') {
    formula = [...root.adoptedStyleSheets].flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText)).join('\n');
  }
  const blend = theme === 'dark' && formula.match(/calc\(\s*([\d.]+)\s*\+\s*(?:var\(--at-popup-alpha[^)]*\)|[\d.]+)\s*\*\s*([\d.]+)\s*\)/);
  const shadows = split(css.boxShadow), inners = shadows.filter(value => value.includes('inset')), outer = shadows.find(value => !value.includes('inset')) || 'none';
  const result = {
    enabled: target === 'settings' || (target === 'popup' ? entry.host.hasAttribute('data-glass') : element.classList.contains('at-word-glass')),
    baseColor: tint.hex, transparency: Math.round((1 - alpha) * 100), minAlpha: blend ? Number(blend[1]) * 100 : 0, alphaWeight: blend ? Number(blend[2]) * 100 : 100,
    uniformWords: false, angle: grad?.angle ?? 140, startColor: grad?.start.hex ?? '#ffffff', startAlpha: grad?.start.opacity ?? 0, middleColor: grad?.middle.hex ?? '#ffffff', middleAlpha: grad?.middle.opacity ?? 0, endColor: grad?.end.hex ?? '#ffffff', endAlpha: grad?.end.opacity ?? 0, stop1: grad?.stop1 ?? 30, stop2: grad?.stop2 ?? 70,
    blur: parseFloat(css.backdropFilter.match(/blur\(([^)]+)/)?.[1]) || 0, saturation: Number(css.backdropFilter.match(/saturate\(([^)]+)/)?.[1] ?? 1) * 100,
    radius: parseFloat(css.borderTopLeftRadius) || 0, borderWidth: parseFloat(css.borderTopWidth) || 0, borderColor: color(css.borderTopColor).hex, borderAlpha: color(css.borderTopColor).opacity,
    cardColor: '#ffffff', cardAlpha: 0, inputColor: '#ffffff', inputAlpha: 0, cardBorderColor: '#ffffff', cardBorderAlpha: 0
  };
  for (const [prefix, text] of [['highlight', inners[0] || 'none'], ['edge', inners[1] || 'none'], ['outer', outer]]) {
    for (const [key, value] of Object.entries(shadow(text))) result[prefix + key[0].toUpperCase() + key.slice(1)] = value;
  }
  if (target === 'settings') {
    const card = element.querySelector('.settings-group.glass'), input = element.querySelector('input[type="text"],textarea,select');
    if (card) { const style = getComputedStyle(card), fill = color(style.backgroundColor), border = color(style.borderTopColor); Object.assign(result, { cardColor: fill.hex, cardAlpha: fill.opacity, cardBorderColor: border.hex, cardBorderAlpha: border.opacity }); }
    if (input) { const fill = color(getComputedStyle(input).backgroundColor); Object.assign(result, { inputColor: fill.hex, inputAlpha: fill.opacity }); }
  }
  return result;
}
function shadowCSS(profile, prefix, inset = false) {
  return `${inset ? 'inset ' : ''}${profile[prefix + 'X']}px ${profile[prefix + 'Y']}px ${profile[prefix + 'Blur']}px ${profile[prefix + 'Spread']}px ${rgba(profile[prefix + 'Color'], profile[prefix + 'Opacity'])}`;
}
function profileCSS(target, theme, profile) {
  const selector = target === 'settings' ? `[data-reader-mode="true"][data-theme="${theme}"] .settings-shell` : target === 'popup' ? `:host(${theme === 'dark' ? '[data-night]' : ':not([data-night])'}) .popup` : `html .at-word${theme === 'dark' ? '.at-word-night' : ':not(.at-word-night)'}[data-at-word]:not([data-at-pos="記号"])`;
  const p = profile, alpha = clamp((p.minAlpha + (100 - p.transparency) * p.alphaWeight / 100) / 100, 0, 1);
  const fill = target === 'words' && !p.uniformWords ? `color-mix(in srgb,var(--at-word-color,transparent) ${Number((alpha * 100).toFixed(3))}%,transparent)` : rgba(p.baseColor, p.enabled ? alpha * 100 : 100);
  const grad = p.enabled ? `linear-gradient(${p.angle}deg,${rgba(p.startColor, p.startAlpha)},${rgba(p.middleColor, p.middleAlpha)} ${Math.min(p.stop1, p.stop2)}%,${rgba(p.middleColor, p.middleAlpha)} ${Math.max(p.stop1, p.stop2)}%,${rgba(p.endColor, p.endAlpha)})` : 'none';
  const filter = p.enabled && target !== 'words' ? `blur(${p.blur}px) saturate(${p.saturation / 100})` : 'none';
  const shadows = p.enabled ? [shadowCSS(p, 'highlight', true), shadowCSS(p, 'edge', true), shadowCSS(p, 'outer')] : [];
  if (target === 'words' && p.borderWidth > 0) shadows.unshift(`inset 0 0 0 ${p.borderWidth}px ${rgba(p.borderColor, p.borderAlpha)}`);
  const shadow = shadows.join(',\n    ') || 'none';
  let text = `/* ${targets[target]} · ${themes[theme]}：测试页当前数值 */\n${selector} {\n  background: ${target === 'settings' ? fill : grad + ', ' + fill} !important;\n  border: ${target === 'words' ? 0 : p.borderWidth}px solid ${rgba(p.borderColor, p.borderAlpha)} !important;\n  border-radius: ${p.radius}px !important;\n  -webkit-backdrop-filter: ${filter} !important;\n  backdrop-filter: ${filter} !important;\n  box-shadow: ${shadow} !important;\n}`;
  if (target === 'settings') text += `\n${selector} {\n  --surface-alpha: ${p.enabled ? alpha : 1} !important;\n  background: rgba(${rgb(p.baseColor)},var(--surface-background-alpha)) !important;\n  --surface-card-rgb: ${rgb(p.cardColor)} !important;\n  --surface-card-alpha: ${p.cardAlpha / 100} !important;\n  --surface-card-edge: ${rgba(p.cardBorderColor, p.cardBorderAlpha)} !important;\n  --surface-input-rgb: ${rgb(p.inputColor)} !important;\n  --surface-input-alpha: ${p.inputAlpha / 100} !important;\n}\n${selector}::after { background: ${grad} !important; opacity: 1 !important; }`;
  if (target === 'popup') text += `\n${selector} { --at-popup-highlight: ${grad} !important; --at-popup-image-alpha: ${alpha} !important; --at-anki-editor-bg: ${p.enabled ? 'transparent' : rgba(p.baseColor, 100)}; --at-anki-image-surface: transparent; }\n:host([data-background]${theme === 'dark' ? '[data-night]' : ':not([data-night])'}) .popup { background: transparent !important; --at-anki-editor-bg: transparent; }\n${selector} iframe { background: transparent !important; }`;
  if (target === 'words') text += `\n${selector} { --at-word-opacity: ${p.uniformWords && !p.enabled ? 100 : Number((alpha * 100).toFixed(3))}% !important;${p.uniformWords ? ` --at-word-color: ${p.baseColor} !important;` : ''} }`;
  return text;
}

const labCSS = `
:host{all:initial;position:fixed;z-index:2147483647;left:16px;top:82px;bottom:16px;width:min(342px,calc(100vw - 24px));color:#29313a;font:12px/1.5 system-ui,"Microsoft YaHei",sans-serif;writing-mode:horizontal-tb;direction:ltr;pointer-events:auto}
:host([hidden]){display:none!important}*{box-sizing:border-box}[hidden]{display:none!important}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer}button:disabled{opacity:.4;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid #688172;outline-offset:2px}
.lab{height:100%;display:flex;flex-direction:column;border:1px solid #ffffffb8;border-radius:20px;overflow:hidden;background:linear-gradient(140deg,#ffffffc9,transparent 30%,transparent 70%,#ffffff99),#f2f3f1db;backdrop-filter:blur(18px);box-shadow:inset 1px 1px 1px #fff,0 8px 30px #0002}
.head{display:flex;align-items:center;gap:8px;padding:14px 15px 9px}.head strong{font-size:15px;flex:1}.close{border:0;background:transparent;font-size:20px;padding:0 3px}.intro{margin:0;padding:0 15px 11px;color:#6d747b;font-size:10px}.tools{display:flex;gap:7px;padding:0 15px 11px;align-items:center}.tools select{min-width:0;flex:1;border:1px solid #ffffffb0;border-radius:9px;padding:7px;background:#ffffff70}.themes{display:flex;background:#00000008;padding:2px;border-radius:10px}.themes button{border:0;border-radius:8px;padding:6px 8px;background:transparent;font-size:11px}.themes button[aria-pressed=true]{background:#fff;box-shadow:0 1px 5px #0001}.scroll{flex:1;min-height:0;overflow:auto;padding:0 15px 12px;scrollbar-width:thin}.notice{margin:0 0 9px;color:#68717d;font-size:10px}.group{border:1px solid #ffffffbd;border-radius:12px;background:#ffffff24;margin-bottom:9px;overflow:hidden}.group>summary{padding:10px 11px;cursor:pointer;font-weight:600}.group>summary::marker{color:#8d969d}.fields{padding:0 11px 10px}.field{display:block;margin:9px 0 0}.field>.label{display:flex;justify-content:space-between;margin-bottom:5px;color:#535d67;font-size:11px}.field .controls{display:flex;align-items:center;gap:8px}.field input[type=range]{appearance:auto;flex:1;min-width:0;margin:0;accent-color:#60766a;height:18px}.field input[type=number]{width:62px;min-width:0;text-align:right;padding:4px 5px;border:1px solid #ffffffd9;border-radius:7px;background:#ffffff82;font-variant-numeric:tabular-nums}.field input[type=color]{height:29px;width:58px;padding:2px;border:1px solid #ffffffd9;border-radius:8px;background:#ffffff82}.field .hex{font-size:10px;color:#7a858d;font-family:monospace}.field.check{display:flex;justify-content:space-between;align-items:center;padding:4px 0}.field.check>.label{margin:0}.field.check input{width:16px;height:16px;accent-color:#60766a}.actions{display:flex;gap:6px;padding:10px 12px;border-top:1px solid #0000000a}.actions button{flex:1;border:1px solid #ffffffcf;border-radius:9px;background:#ffffff82;padding:8px 4px;font-size:10px}.status{padding:0 14px 10px;font-size:10px;color:#68717d;min-height:24px}.code{margin-top:9px}.code>summary{font-size:11px;cursor:pointer}.code textarea{width:100%;height:180px;display:block;margin-top:8px;resize:vertical;border:1px solid #cdd4d7;border-radius:8px;background:#fff9;padding:8px;font:10px/1.55 ui-monospace,monospace;white-space:pre;overflow:auto}
:host([data-night]){color:#e2e7ed}.lab:where(:host([data-night]) *){color:inherit}:host([data-night]) .lab{background:linear-gradient(140deg,#ffffff16,transparent 30%,transparent 70%,#ffffff08),#252a31ef;border-color:#ffffff35;box-shadow:inset 1px 1px 1px #ffffff38,0 8px 30px #0004}:host([data-night]) .intro,:host([data-night]) .notice,:host([data-night]) .status,:host([data-night]) .field>.label{color:#b2bdca}:host([data-night]) .group{border-color:#ffffff22;background:#ffffff04}:host([data-night]) .themes button[aria-pressed=true]{background:#ffffff20}:host([data-night]) select,:host([data-night]) .field input[type=number],:host([data-night]) .field input[type=color],:host([data-night]) .actions button,:host([data-night]) .code textarea{background:#11151a66;border-color:#ffffff25}:host([data-night]) select{color-scheme:dark}:host([data-night]) .actions{border-color:#ffffff15}
@media(max-width:700px){:host{left:12px;top:72px;bottom:12px;width:min(342px,calc(100vw - 24px))}}
`;

export function mountGlassLab({ mode = 'chrome', run = 'default', openSettings, readSettings, updateSettings }) {
  const storageKey = `at-glass-lab:v1:${mode}:${run}`;
  const cache = {}, profiles = {}, injected = new Map(), originalSwitches = {};
  let target = 'settings', theme = readSettings().nightMode ? 'dark' : 'light', loading = false, changingTheme = false, mounted = true, serial = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    for (const key of Object.keys(targets)) for (const name of Object.keys(themes)) if (saved[key]?.[name] && typeof saved[key][name] === 'object') (profiles[key] ||= {})[name] = saved[key][name];
  } catch { /* A test page remains usable when storage is unavailable. */ }
  try {
    const previousPreset = localStorage.getItem(storageKey + ':preset');
    if (previousPreset !== presetRevision) {
      const update = previousPreset === '2026-10-24-user-glass'
        ? { popup: { light: suppliedPreset.popup.light }, words: { light: suppliedPreset.words.light } }
        : suppliedPreset;
      for (const [kind, variants] of Object.entries(update)) {
        for (const [name, values] of Object.entries(variants)) {
          (profiles[kind] ||= {})[name] = { ...profiles[kind]?.[name], ...values };
        }
      }
      localStorage.setItem(storageKey, JSON.stringify(profiles));
      localStorage.setItem(storageKey + ':preset', presetRevision);
    }
  } catch { /* Storage restrictions do not prevent live tuning. */ }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey + ':switches') || '{}');
    for (const key of ['dictionaryPopupGlass', 'posGlass']) if (typeof saved[key] === 'boolean') originalSwitches[key] = saved[key];
  } catch {}
  const button = document.createElement('button'); button.textContent = '玻璃调节'; button.type = 'button'; button.dataset.atUi = ''; button.setAttribute('aria-expanded', 'false');
  document.querySelector('header').append(button);
  const host = document.createElement('aside'); host.dataset.atUi = ''; host.setAttribute('data-at-glass-lab', ''); host.hidden = true;
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${labCSS}</style><section class="lab" aria-label="玻璃参数调节"><div class="head"><strong>玻璃调节</strong><button type="button" class="close" aria-label="关闭玻璃调节">×</button></div><p class="intro">仅改变本地测试页，参数会自动保存在此浏览器。恢复源码可撤销全部调节。</p><div class="tools"><select aria-label="调节对象">${Object.entries(targets).map(([key, name]) => `<option value="${key}">${name}</option>`).join('')}</select><div class="themes">${Object.entries(themes).map(([key, name]) => `<button type="button" data-theme="${key}" aria-pressed="${key === theme}">${name}</button>`).join('')}</div></div><div class="scroll"><p class="notice" role="status"></p><div class="groups"></div><details class="code"><summary>当前 CSS / 导出内容</summary><textarea readonly aria-label="玻璃参数代码" spellcheck="false"></textarea></details></div><div class="actions"><button type="button" data-action="reset">恢复源码</button><button type="button" data-action="copy">复制当前 CSS</button><button type="button" data-action="export">导出参数</button></div><div class="status" role="status"></div></section>`;
  document.body.append(host);
  const $ = selector => root.querySelector(selector);
  const entries = kind => {
    if (kind === 'settings') return [...document.querySelectorAll('[data-at-widget]')].map(host => ({ host, root: host.shadowRoot, surface: host.shadowRoot?.querySelector('.settings-shell') })).filter(entry => entry.surface);
    if (kind === 'popup') return [...document.querySelectorAll('[data-at-dictionary-popup]')].map(host => ({ host, root: host.shadowRoot, surface: host.shadowRoot?.querySelector('.popup') })).filter(entry => entry.surface).sort((a, b) => Number(a.host.hidden) - Number(b.host.hidden) || Number(b.host.hasAttribute('data-glass')) - Number(a.host.hasAttribute('data-glass')));
    const surface = [...document.querySelectorAll('.at-word[data-at-word]')].find(word => word.dataset.atPos !== '記号');
    return surface ? [{ host: document.documentElement, root: document, surface }] : [];
  };
  const current = () => cache[target]?.[theme] ? normalize(profiles[target]?.[theme], cache[target][theme]) : null;
  const status = text => { $('.status').textContent = text; };
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify(profiles)); } catch { status('当前浏览器无法保存，调节在本页仍会生效。'); } };
  function setSwitch(kind, value) {
    const key = kind === 'popup' ? 'dictionaryPopupGlass' : 'posGlass';
    if (!Object.hasOwn(originalSwitches, key)) originalSwitches[key] = typeof readSettings()[key] === 'boolean' ? readSettings()[key] : cache[kind]?.[theme]?.enabled ?? true;
    try { localStorage.setItem(storageKey + ':switches', JSON.stringify(originalSwitches)); } catch {}
    updateSettings({ [key]: value });
  }
  function syncSwitches() {
    for (const kind of ['popup', 'words']) {
      const key = kind === 'popup' ? 'dictionaryPopupGlass' : 'posGlass', desired = profiles[kind]?.[theme]?.enabled ?? originalSwitches[key];
      if (typeof desired === 'boolean' && readSettings()[key] !== desired) setSwitch(kind, desired);
    }
  }
  function apply() {
    if (!mounted || loading) return;
    const wanted = new Map();
    for (const kind of Object.keys(targets)) {
      const css = Object.keys(themes).flatMap(name => cache[kind]?.[name] && profiles[kind]?.[name] ? [profileCSS(kind, name, normalize(profiles[kind][name], cache[kind][name]))] : []).join('\n');
      for (const entry of entries(kind)) if (css) wanted.set(entry.root, (wanted.get(entry.root) || '') + '\n' + css);
    }
    for (const [scope, style] of injected) if (!wanted.has(scope)) { style.remove(); injected.delete(scope); }
    for (const [scope, css] of wanted) {
      let style = injected.get(scope);
      if (!style || !style.isConnected) { style = document.createElement('style'); style.dataset.glassLabOverride = ''; (scope === document ? document.head : scope).append(style); injected.set(scope, style); }
      if (style.textContent !== css) style.textContent = css;
    }
  }
  function render() {
    const profile = current(); host.toggleAttribute('data-night', theme === 'dark');
    $('.tools select').disabled = loading || changingTheme;
    root.querySelectorAll('[data-theme]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.theme === theme)));
    root.querySelectorAll('[data-theme]').forEach(item => { item.disabled = loading || changingTheme; });
    $('.notice').textContent = !profile ? `${targets[target]}尚未出现。载入预览后，在示例文字中打开对应效果即可。` : target === 'words' ? '分词保留原有排版，背景模糊始终关闭。未勾选统一底色时保留词性配色。' : '滑条和数值框均可修改；深浅色分别保存。';
    const disabled = !profile || loading || changingTheme;
    $('[data-action="copy"]').disabled = disabled;
    if (!profile) { $('.groups').replaceChildren(); $('.code textarea').value = ''; return; }
    $('.groups').innerHTML = groups.filter(group => !group.only || group.only === target).map(group => `<details class="group"${group.open ? ' open' : ''}><summary>${group.title}</summary><div class="fields">${group.fields.filter(field => !field.only || field.only === target).map(field => {
      const value = profile[field.key], off = disabled || (target === 'words' && ['blur', 'saturation'].includes(field.key));
      if (field.type === 'checkbox') return `<label class="field check"><span class="label">${field.label}</span><input type="checkbox" data-param="${field.key}" aria-label="${field.label}"${value ? ' checked' : ''}${off ? ' disabled' : ''}></label>`;
      if (field.type === 'color') return `<label class="field"><span class="label">${field.label}</span><span class="controls"><input type="color" data-param="${field.key}" aria-label="${field.label}" value="${escape(value)}"${off ? ' disabled' : ''}><span class="hex">${escape(value)}</span></span></label>`;
      return `<div class="field"><label class="label" for="lab-${field.key}">${field.label}<span>${field.unit}</span></label><div class="controls"><input type="range" data-param="${field.key}" aria-label="${field.label}" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}"${off ? ' disabled' : ''}><input id="lab-${field.key}" type="number" data-param="${field.key}" aria-label="${field.label}数值" min="${field.min}" max="${field.max}" step="${field.step}" value="${Number(Number(value).toFixed(3))}"${off ? ' disabled' : ''}></div></div>`;
    }).join('')}</div></details>`).join('');
    $('.code textarea').value = profileCSS(target, theme, profile);
  }
  async function capture() {
    const missing = Object.keys(targets).some(key => !cache[key]?.[theme] && entries(key).length);
    if (loading || !mounted || !missing) { render(); return; }
    loading = true; const name = theme, token = ++serial; render();
    for (const style of injected.values()) if (style.sheet) style.sheet.disabled = true;
    await new Promise(resolve => setTimeout(resolve, 360));
    const actual = readSettings().nightMode ? 'dark' : 'light';
    if (token === serial && actual === name) for (const key of Object.keys(targets)) {
      const entry = entries(key)[0];
      if (entry && !cache[key]?.[name]) (cache[key] ||= {})[name] = baseline(key, entry, name);
    }
    else if (token === serial) theme = actual;
    for (const style of injected.values()) if (style.sheet) style.sheet.disabled = false;
    loading = false; apply(); render();
  }
  async function open() {
    host.hidden = false; button.setAttribute('aria-expanded', 'true'); status('正在载入实际组件…');
    try { await openSettings(); await capture(); status('直接调节即可预览。'); }
    catch (error) { status(error.message || '预览加载失败，请先运行 npm run build。'); }
  }
  function close() { host.hidden = true; button.setAttribute('aria-expanded', 'false'); }
  button.addEventListener('click', () => host.hidden ? void open() : close()); $('.close').addEventListener('click', close);
  $('.tools select').addEventListener('change', async event => { target = event.target.value; render(); await capture(); apply(); });
  root.querySelectorAll('[data-theme]').forEach(item => item.addEventListener('click', async () => {
    if (changingTheme || theme === item.dataset.theme) return;
    changingTheme = true; theme = item.dataset.theme; render(); updateSettings({ nightMode: theme === 'dark' }); syncSwitches();
    await new Promise(resolve => setTimeout(resolve, 360)); await capture(); changingTheme = false; render(); apply();
  }));
  $('.groups').addEventListener('input', event => {
    const control = event.target.closest('[data-param]'); if (!control || !current()) return;
    const field = fields.find(field => field.key === control.dataset.param); if (!field) return;
    if (field.type === 'number' && (control.value === '' || !Number.isFinite(Number(control.value)))) return;
    const value = field.type === 'checkbox' ? control.checked : field.type === 'color' ? control.value : clamp(Number(control.value), field.min, field.max);
    const profile = { ...current(), [field.key]: value }; (profiles[target] ||= {})[theme] = profile;
    root.querySelectorAll(`[data-param="${field.key}"]`).forEach(other => { if (other !== control) { if (field.type === 'checkbox') other.checked = value; else other.value = value; } });
    if (field.type === 'color') control.nextElementSibling.textContent = value;
    if (field.key === 'enabled' && target !== 'settings') setSwitch(target, value);
    apply(); save(); $('.code textarea').value = profileCSS(target, theme, profile); status('已应用到实际预览组件。');
  });
  $('[data-action="reset"]').addEventListener('click', async () => {
    for (const key of Object.keys(profiles)) delete profiles[key];
    if (Object.keys(originalSwitches).length) updateSettings({ ...originalSwitches });
    for (const key of Object.keys(originalSwitches)) delete originalSwitches[key];
    try { localStorage.removeItem(storageKey + ':switches'); } catch {}
    for (const style of injected.values()) style.remove(); injected.clear();
    for (const key of Object.keys(cache)) delete cache[key];
    save(); await capture(); status('已撤销全部 CSS 覆盖，恢复当前源码样式。');
  });
  $('[data-action="copy"]').addEventListener('click', async () => {
    const profile = current(); if (!profile) return;
    const text = profileCSS(target, theme, profile); $('.code textarea').value = text; $('.code').open = true;
    try { await navigator.clipboard.writeText(text); status('当前 CSS 已复制，可用于对应源码样式。'); }
    catch { $('.code textarea').focus(); $('.code textarea').select(); status('请从展开的代码框复制。'); }
  });
  $('[data-action="export"]').addEventListener('click', () => {
    const output = {};
    for (const key of Object.keys(targets)) for (const name of Object.keys(themes)) if (cache[key]?.[name] || profiles[key]?.[name]) (output[key] ||= {})[name] = normalize(profiles[key]?.[name], cache[key]?.[name] || {});
    const text = JSON.stringify({ version: 1, glass: output }, null, 2); $('.code textarea').value = text; $('.code').open = true;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = document.createElement('a');
    link.href = url; link.download = 'anon-glass-parameters.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('已导出读取和调节过的玻璃参数，不含插件其他设置。');
  });
  const timer = setInterval(() => {
    if (!mounted || document.hidden || loading || changingTheme) return;
    const actual = readSettings().nightMode ? 'dark' : 'light';
    if (actual !== theme) { theme = actual; syncSwitches(); if (!host.hidden) void capture(); }
    if (!host.hidden && Object.keys(targets).some(key => !cache[key]?.[theme] && entries(key).length)) void capture();
    else apply();
  }, 500);
  render();
  if (run === 'glass-lab') void open();
  return { open, close, refresh: () => { apply(); if (!host.hidden) void capture(); }, destroy() { mounted = false; serial++; clearInterval(timer); for (const style of injected.values()) style.remove(); injected.clear(); host.remove(); button.remove(); } };
}
