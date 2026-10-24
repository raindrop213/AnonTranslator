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
      ${heading('阅读与滚动')}
      <div class="settings-group glass"><div class="setting-row"><div class="setting-copy"><label for="pref-scrollSwitch">自动滚动到段落 / 句子</label><p>阅读焦点始终留在视野里</p></div><label class="switch"><input id="pref-scrollSwitch" data-pref="scrollSwitch" type="checkbox" role="switch" aria-label="自动滚动到段落 / 句子"><span class="switch-track" aria-hidden="true"></span></label></div><div class="setting-row select-row"><div class="setting-copy"><label for="pref-scrollIntoView">滚动方式</label></div><div class="select-wrap"><select id="pref-scrollIntoView" data-pref="scrollIntoView" aria-label="滚动方式"><option value="smooth">平滑滚动</option><option value="instant">立即滚动</option></select><svg><use href="#i-chevron"/></svg></div></div></div>
      ${heading('阅读与译文', '☀ 日间　 /　☾ 夜间')}
      <div class="settings-group glass color-settings">${colorGroups.map(colorRow).join('')}</div>
      ${heading('分词底色', '☀ 日间　 /　☾ 夜间')}
      <div class="settings-group glass color-settings"><div class="range-setting"><div class="range-setting-label"><label for="pref-posOpacity">不透明度</label><output data-output="posOpacity" data-suffix="%"></output></div><input id="pref-posOpacity" type="range" min="0" max="100" step="1" data-pref="posOpacity" aria-label="分词底色不透明度"></div>${posGroups.map(colorRow).join('')}</div>
      <div class="inline-actions" style="justify-content:flex-end"><button type="button" class="pill-button" data-restore-colors>恢复默认配色</button></div>`,
    init(root) {
      root.querySelector('[data-restore-colors]').addEventListener('click', () => ctx.dialog('恢复默认配色？', '将阅读、译文和分词的日夜颜色恢复为默认设置。', '恢复配色', () => {
        [...colorGroups, ...posGroups].forEach(([key]) => { ctx.set(key, ctx.defaults[key]); ctx.set(nightKey(key), ctx.defaults[nightKey(key)]); });
        ctx.set('posOpacity', ctx.defaults.posOpacity, '已恢复默认配色');
      }));
    },
    refresh(root) {
      root.querySelector('[data-pref="scrollIntoView"]').disabled = !ctx.get('scrollSwitch');
    }
  }];
}
