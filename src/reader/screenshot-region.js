function dataImage(value) {
  if (value && typeof value.arrayBuffer === 'function') return value;
  if (typeof value !== 'string' || value.length > 48 * 1024 * 1024) throw new Error('截图数据无效或过大');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z\d+/=\r\n]+)$/i.exec(value);
  if (!match) throw new Error('截图没有返回有效图片');
  const raw = atob(match[2]), bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}

async function displayImage(doc, requestWindow) {
  const win = doc.defaultView;
  if (!requestWindow.navigator.mediaDevices?.getDisplayMedia) throw new Error('浏览器不支持屏幕共享截图，请上传或粘贴图片');
  const stream = await requestWindow.navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: requestWindow === win, selfBrowserSurface: requestWindow === win ? 'include' : 'exclude' });
  const video = doc.createElement('video'); video.muted = true; video.srcObject = stream;
  try {
    await video.play();
    if (video.requestVideoFrameCallback) await Promise.race([new Promise(resolve => video.requestVideoFrameCallback(resolve)), new Promise(resolve => setTimeout(resolve, 120))]);
    const canvas = doc.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    if (!canvas.width || !canvas.height || canvas.width * canvas.height > 32 * 1024 * 1024) throw new Error('截图分辨率过大，请降低共享画面分辨率');
    canvas.getContext('2d').drawImage(video, 0, 0);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('截图编码失败')), 'image/png'));
  } finally { for (const track of stream.getTracks()) track.stop(); video.srcObject = null; }
}

export function cropCoordinates(start, end, viewport, image) {
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  const left = clamp(Math.min(start.x, end.x), 0, viewport.width), top = clamp(Math.min(start.y, end.y), 0, viewport.height);
  const right = clamp(Math.max(start.x, end.x), 0, viewport.width), bottom = clamp(Math.max(start.y, end.y), 0, viewport.height);
  const x = Math.round(left * image.width / viewport.width), y = Math.round(top * image.height / viewport.height);
  return { x, y, width: Math.max(0, Math.round(right * image.width / viewport.width) - x), height: Math.max(0, Math.round(bottom * image.height / viewport.height) - y) };
}

export async function captureRegion(doc = document, platform = {}, requestWindow = doc.defaultView) {
  const win = doc.defaultView; let bitmap, host;
  const hadCaptureMarker = doc.documentElement.hasAttribute('data-at-capturing');
  doc.documentElement.setAttribute('data-at-capturing', '');
  try {
    let image;
    if (platform.captureVisibleTab) {
      try { image = dataImage(await platform.captureVisibleTab()); } catch (error) { if (!requestWindow.navigator.mediaDevices?.getDisplayMedia) throw error; }
    }
    if (!image) image = await displayImage(doc, requestWindow);
    bitmap = await win.createImageBitmap(image);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 32 * 1024 * 1024) throw new Error('截图分辨率过大，请降低页面缩放或屏幕分辨率');
    if (requestWindow !== win) win.focus();
    const viewport = win.visualViewport, width = viewport?.width || win.innerWidth, height = viewport?.height || win.innerHeight;
    host = doc.createElement('div'); host.setAttribute('data-at-ui', ''); host.setAttribute('data-at-region-capture', '');
    const root = host.attachShadow({ mode: 'open' }), css = `:host{all:initial;display:block!important;position:fixed!important;right:auto!important;bottom:auto!important;z-index:2147483647!important;cursor:crosshair!important;touch-action:none!important}canvas{position:absolute;inset:0;width:100%;height:100%;display:block}.hint{position:absolute;left:50%;top:12px;transform:translateX(-50%);padding:5px 10px;background:#222d;color:white;font:13px/1.4 sans-serif;border-radius:4px;pointer-events:none}.selection{position:absolute;display:none;border:1px solid #fff;outline:1px solid #9d3d39;background:#fff1;pointer-events:none;box-sizing:border-box}`;
    try { const sheet = new win.CSSStyleSheet(); sheet.replaceSync(css); root.adoptedStyleSheets = [sheet]; } catch { const style = doc.createElement('style'); style.textContent = css; root.append(style); }
    const canvas = doc.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; canvas.getContext('2d').drawImage(bitmap, 0, 0); root.append(canvas);
    const hint = doc.createElement('div'); hint.className = 'hint'; hint.textContent = '拖动选择截图区域 · Esc 取消'; root.append(hint);
    const selection = doc.createElement('div'); selection.className = 'selection'; root.append(selection);
    host.style.setProperty('left', `${viewport?.offsetLeft || 0}px`, 'important'); host.style.setProperty('top', `${viewport?.offsetTop || 0}px`, 'important'); host.style.setProperty('width', `${width}px`, 'important'); host.style.setProperty('height', `${height}px`, 'important');
    doc.documentElement.append(host); host.tabIndex = -1; host.focus({ preventScroll: true });
    const region = await new Promise(resolve => {
      let start = null;
      const point = event => { const rect = host.getBoundingClientRect(); return { x: Math.max(0, Math.min(width, event.clientX - rect.left)), y: Math.max(0, Math.min(height, event.clientY - rect.top)) }; };
      const cleanup = () => doc.removeEventListener('keydown', keydown, true);
      const keydown = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cleanup(); resolve(null); } };
      doc.addEventListener('keydown', keydown, true);
      host.addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); start = point(event); host.setPointerCapture(event.pointerId); });
      host.addEventListener('pointermove', event => {
        if (!start) return; const end = point(event); selection.style.display = 'block'; selection.style.left = `${Math.min(start.x, end.x)}px`; selection.style.top = `${Math.min(start.y, end.y)}px`; selection.style.width = `${Math.abs(end.x - start.x)}px`; selection.style.height = `${Math.abs(end.y - start.y)}px`;
      });
      host.addEventListener('pointerup', event => { if (!start) return; const result = cropCoordinates(start, point(event), { width, height }, bitmap); if (result.width < 3 || result.height < 3) { start = null; selection.style.display = 'none'; return; } cleanup(); resolve(result); });
      host.addEventListener('pointercancel', () => { cleanup(); resolve(null); });
    });
    if (!region) return null;
    const cropped = doc.createElement('canvas'); cropped.width = region.width; cropped.height = region.height;
    cropped.getContext('2d').drawImage(bitmap, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
    return await new Promise((resolve, reject) => cropped.toBlob(blob => blob ? resolve(blob) : reject(new Error('截图裁切失败')), 'image/png'));
  } catch (error) { if (['NotAllowedError', 'AbortError'].includes(error.name)) return null; throw error; }
  finally { bitmap?.close(); host?.remove(); if (!hadCaptureMarker) doc.documentElement.removeAttribute('data-at-capturing'); }
}
