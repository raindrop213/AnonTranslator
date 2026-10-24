import { defaults } from './settings.js';

export function mountBackground(env) {
  const { document, localStorage, URL, Blob, Image } = env;
  const root = document.documentElement;
  const appearance = document.querySelector('#pane-appearance');
  const preferenceKey = 'anon-glass-background-options-v1';
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp']);
  let preferences = { fit: defaults.panelBackgroundFit };
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey) || 'null');
    if (['cover', 'contain'].includes(saved?.fit)) preferences.fit = saved.fit;
  } catch (_) {}
  const section = document.createElement('section');
  section.className = 'panel-background-settings';
  section.setAttribute('aria-label', '面板背景');
  section.innerHTML = `
    <div class="group-heading"><h3>面板背景</h3></div>
    <div class="settings-group glass background-settings-card">
      <div class="background-image-row is-empty">
        <div class="background-thumbnail" aria-hidden="true"></div>
        <svg class="background-empty-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg>
        <div class="background-image-copy"><strong data-background-name>no image</strong><span data-background-dimensions></span></div>
      </div>
      <div class="background-image-actions"><button type="button" class="pill-button" data-background-choose><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/></svg>上传图片</button><button type="button" class="pill-button background-reset" data-background-reset disabled>清除图片</button></div>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp" data-background-file hidden aria-label="选择面板背景图片">
      <p class="background-file-status" data-background-status role="status" aria-live="polite">图片仅保存在当前浏览器。</p>
      <div class="setting-row select-row"><div class="setting-copy"><label for="panel-background-fit">图片显示</label></div><div class="select-wrap"><select id="panel-background-fit" aria-label="背景图片显示方式"><option value="cover">铺满面板</option><option value="contain">完整显示</option></select><svg><use href="#i-chevron"/></svg></div></div>
      <div class="range-setting"><div class="range-setting-label"><label for="panel-background-transparency">背景透明度</label><output for="panel-background-transparency" data-surface-transparency-output></output></div><input type="range" id="panel-background-transparency" data-surface-transparency min="0" max="100" step="1" aria-label="背景透明度"></div>
      <div class="range-setting"><div class="range-setting-label"><label for="appearance-panel-blur">玻璃模糊</label><output data-surface-blur-output for="appearance-panel-blur"></output></div><input type="range" id="appearance-panel-blur" data-surface-blur min="0" max="20" step="1" aria-label="设置面板玻璃模糊"></div>
    </div>`;
  appearance.querySelector('.section-intro').after(section);
  const find = selector => section.querySelector(selector);
  const fileInput = find('[data-background-file]');
  const chooseButton = find('[data-background-choose]');
  const resetButton = find('[data-background-reset]');
  const status = find('[data-background-status]');
  let currentURL = '', revision = 0;

  function applyPreferences(save = false) {
    root.style.setProperty('--panel-background-fit', preferences.fit);
    find('#panel-background-fit').value = preferences.fit;
    if (save) try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch (_) {}
    updateResetButton();
    env.selects?.refresh?.();
  }
  function updateResetButton() {
    resetButton.disabled = !currentURL && preferences.fit === defaults.panelBackgroundFit;
  }
  function showImage(record, url = '') {
    const previousURL = currentURL;
    currentURL = url;
    root.dataset.panelBackground = record ? 'custom' : 'default';
    if (record) root.style.setProperty('--panel-background', `url("${url}")`);
    else root.style.removeProperty('--panel-background');
    find('.background-thumbnail').style.backgroundImage = record ? `url("${url}")` : 'none';
    find('.background-image-row').classList.toggle('is-empty', !record);
    find('[data-background-name]').textContent = record ? record.name : 'no image';
    find('[data-background-dimensions]').textContent = record ? `${record.width} × ${record.height}` : '';
    find('#panel-background-fit').disabled = !record;
    updateResetButton();
    env.selects?.refresh?.();
    if (previousURL && previousURL !== url) URL.revokeObjectURL(previousURL);
  }
  async function loadImage(blob) {
    if (!(blob instanceof Blob) || !allowedTypes.has(blob.type)) throw new Error('请选择 JPG、PNG、WebP 等图片文件。');
    if (blob.size > 20 * 1024 * 1024) throw new Error('请选择小于 20 MB 的图片。');
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('这张图片无法读取，请换一张试试。'));
        image.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片尺寸无效。');
      return { url, width: image.naturalWidth, height: image.naturalHeight };
    } catch (error) { URL.revokeObjectURL(url); throw error; }
  }
  chooseButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const token = ++revision;
    let applied = false;
    chooseButton.disabled = true;
    status.textContent = '正在载入图片…';
    try {
      const decoded = await loadImage(file);
      if (token !== revision) { URL.revokeObjectURL(decoded.url); return; }
      const record = { blob: file, name: file.name, width: decoded.width, height: decoded.height };
      showImage(record, decoded.url);
      applied = true;
      await env.background.write(record);
      if (token === revision) status.textContent = '已保存，重新打开时也会保留。';
    } catch (error) {
      if (token === revision) status.textContent = applied ? '图片已应用，但当前浏览器无法保存它。' : error.message;
    } finally {
      if (token === revision) chooseButton.disabled = false;
    }
  });
  async function resetBackground() {
    const token = ++revision;
    chooseButton.disabled = false;
    preferences = { fit: defaults.panelBackgroundFit };
    applyPreferences(true);
    showImage(null);
    status.textContent = '正在清除背景图片…';
    try {
      await env.background.write(null);
      if (token === revision) status.textContent = '已清除图片，恢复无背景状态。';
    }
    catch (_) { if (token === revision) status.textContent = '已清除图片；当前浏览器未能保存这个更改。'; }
  }
  resetButton.addEventListener('click', resetBackground);
  document.addEventListener('glass:reset', resetBackground);
  find('#panel-background-fit').addEventListener('change', event => { preferences.fit = event.target.value; applyPreferences(true); });
  showImage(null);
  applyPreferences();
  env.material.refresh();
  const startupRevision = revision;
  env.background.read().then(async record => {
    if (!record || startupRevision !== revision) return;
    const decoded = await loadImage(record.blob);
    if (startupRevision !== revision) { URL.revokeObjectURL(decoded.url); return; }
    showImage({ ...record, width: decoded.width, height: decoded.height }, decoded.url);
    status.textContent = '已载入保存的本地图片。';
  }).catch(() => {});
}
