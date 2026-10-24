export function createAppearanceTabs(ctx) {
  const e = ctx.escape;
  const colorGroups = [
    ['sentenceColor', '例句底色'], ['googleColor', 'Google 译文'], ['youdaoColor', '有道译文'], ['aiColor', 'AI 译文']
  ];
  const posGroups = [['posNounColor', '名词'], ['posVerbColor', '动词'], ['posAdjectiveColor', '形容词'], ['posAdverbColor', '副词 / 连体词'], ['posParticleColor', '助词'], ['posAuxiliaryColor', '助动词'], ['posOtherColor', '其他']];
  const nightKey = key => 'night' + key[0].toUpperCase() + key.slice(1);
  const colorRow = ([key, label]) => `<div class="color-setting-row"><label for="pref-${key}">${e(label)}</label><div class="color-pair"><input type="color" id="pref-${key}" data-pref="${key}" aria-label="${e(label)} · 日间" title="${e(label)} · 日间"><input type="color" id="pref-${nightKey(key)}" data-pref="${nightKey(key)}" aria-label="${e(label)} · 夜间" title="${e(label)} · 夜间"></div></div>`;
  const heading = (title, note = '') => `<div class="group-heading"><h3>${title}</h3>${note ? `<p>${note}</p>` : ''}</div>`;
  return [{
    id: 'appearance', name: '外观', subtitle: '调整面板与配色，让阅读更舒适。', icon: 'sun',
    html: `
      ${heading('查词窗')}
      <div class="settings-group glass" data-popup-appearance><div class="setting-row"><div class="setting-copy"><label for="pref-dictionaryPopupGlass">玻璃效果</label><p>叠加高光与背景模糊</p></div><label class="switch"><input id="pref-dictionaryPopupGlass" data-pref="dictionaryPopupGlass" type="checkbox" role="switch" aria-label="查词窗玻璃效果"><span class="switch-track" aria-hidden="true"></span></label></div><div class="range-setting"><div class="range-setting-label"><label for="pref-dictionaryPopupTransparency">背景透明度</label><output data-output="dictionaryPopupTransparency" data-suffix="%"></output></div><input id="pref-dictionaryPopupTransparency" type="range" min="0" max="100" step="1" data-pref="dictionaryPopupTransparency" aria-label="查词窗背景透明度"></div><div class="range-setting"><div class="range-setting-label"><label for="pref-dictionaryPopupBlur">玻璃模糊</label><output data-output="dictionaryPopupBlur" data-suffix=" px"></output></div><input id="pref-dictionaryPopupBlur" type="range" min="0" max="20" step="1" data-pref="dictionaryPopupBlur" aria-label="查词窗玻璃模糊"></div></div>
      ${heading('阅读与译文', '☀ 日间　 /　☾ 夜间')}
      <div class="settings-group glass color-settings">${colorGroups.map(colorRow).join('')}</div>
      ${heading('分词底色', '☀ 日间　 /　☾ 夜间')}
      <div class="settings-group glass color-settings"><div class="setting-row"><div class="setting-copy"><label for="pref-posGlass">玻璃效果</label></div><label class="switch"><input id="pref-posGlass" data-pref="posGlass" type="checkbox" role="switch" aria-label="分词玻璃效果"><span class="switch-track" aria-hidden="true"></span></label></div><div class="range-setting"><div class="range-setting-label"><label for="pref-posOpacity">底色不透明度</label><output data-output="posOpacity" data-suffix="%"></output></div><input id="pref-posOpacity" type="range" min="0" max="100" step="1" data-pref="posOpacity" aria-label="分词底色不透明度"></div><div class="setting-row"><div class="setting-copy"><label for="pref-posUniformColor">统一底色</label><p>所有词性使用同一颜色</p></div><label class="switch"><input id="pref-posUniformColor" data-pref="posUniformColor" type="checkbox" role="switch" aria-label="分词统一底色"><span class="switch-track" aria-hidden="true"></span></label></div>${colorRow(['posUniformColorValue', '统一颜色'])}${posGroups.map(colorRow).join('')}</div>
      <div class="inline-actions" style="justify-content:flex-end"><button type="button" class="pill-button" data-restore-colors>恢复默认配色</button></div>`,
    init(root) {
      root.querySelector('[data-restore-colors]').addEventListener('click', () => ctx.dialog('恢复默认配色？', '将阅读、译文和分词的日夜颜色恢复为默认设置。', '恢复配色', () => {
        [...colorGroups, ...posGroups, ['posUniformColorValue']].forEach(([key]) => { ctx.set(key, ctx.defaults[key]); ctx.set(nightKey(key), ctx.defaults[nightKey(key)]); });
        ctx.set('posOpacity', ctx.defaults.posOpacity, '已恢复默认配色');
        ctx.set('nightPosOpacity', ctx.defaults.nightPosOpacity);
        ctx.set('posUniformColor', ctx.defaults.posUniformColor);
      }));
    },
    refresh(root) {
      const opacityKey = ctx.get('nightMode') ? 'nightPosOpacity' : 'posOpacity';
      const opacity = root.querySelector('#pref-posOpacity');
      opacity.dataset.pref = opacityKey;
      opacity.value = String(ctx.get(opacityKey));
      const output = opacity.previousElementSibling.querySelector('output');
      output.dataset.output = opacityKey;
      output.textContent = ctx.get(opacityKey) + '%';
      root.querySelector('label[for="pref-posOpacity"]').textContent = '底色不透明度 · ' + (ctx.get('nightMode') ? '夜间' : '日间');
      root.querySelector('[data-pref="dictionaryPopupBlur"]').disabled = !ctx.get('dictionaryPopupGlass');
      root.querySelector('[data-pref="dictionaryPopupTransparency"]').disabled = !ctx.get('dictionaryPopupGlass') && !ctx.get('dictionaryPopupBackground');
      for (const [key] of posGroups) for (const name of [key, nightKey(key)]) root.querySelector(`[data-pref="${name}"]`).disabled = ctx.get('posUniformColor');
      for (const name of ['posUniformColorValue', 'nightPosUniformColorValue']) root.querySelector(`[data-pref="${name}"]`).disabled = !ctx.get('posUniformColor');
    }
  }];
}
