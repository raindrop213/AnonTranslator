const chromeServices = {
  google: { name: 'Google', section: '翻译', origins: ['https://translate-pa.googleapis.com/*'] },
  youdao: { name: '有道', section: '翻译', origins: ['https://m.youdao.com/*'] },
  vits: { name: 'VITS', section: '语音', origins: ['http://127.0.0.1/*'] },
  huosh: { name: '火山语音', section: '语音', origins: ['https://translate.volcengine.com/*'] }
};
function servicePermissionError(service, origin) {
  const error = new Error(`Chrome 未授权访问 ${service.name} 接口（${new URL(origin).hostname}）。请打开扩展设置，在“${service.section}”栏点击“授权 ${service.name} 接口”，然后重试。`);
  error.code = 'HOST_PERMISSION_MISSING';
  return error;
}
function serviceOrigins(id, settings = App.defaults) {
  if (id !== 'vits') return chromeServices[id].origins;
  const address = new URL(App.normalizeSetting('vitsAPI', settings.vitsAPI));
  return [`${address.protocol}//${address.hostname}/*`];
}
async function chromeServiceRequest(url, options) {
  const address = new URL(url);
  let entry = Object.values(chromeServices).flatMap(service => service.origins.map(origin => ({ service, origin })))
    .find(({ origin }) => { const allowed = new URL(origin); return allowed.protocol === address.protocol && allowed.hostname === address.hostname; });
  if (options?.vitsBase) {
    const base = App.normalizeSetting('vitsAPI', options.vitsBase);
    if (!url.startsWith(`${base}/voice/`)) throw new Error('不支持的 VITS 接口地址');
    entry = { service: chromeServices.vits, origin: serviceOrigins('vits', { vitsAPI: base })[0] };
  }
  if (!entry) throw new Error('不支持的接口地址');
  const { service, origin } = entry;
  if (!await chrome.permissions.contains({ origins: [origin] })) throw servicePermissionError(service, origin);
  try { return await App.fetchRequest(url, options); }
  catch (error) {
    if (error instanceof TypeError || error.name === 'TypeError') {
      // Permissions can be revoked while a request is in progress.
      if (!await chrome.permissions.contains({ origins: [origin] })) throw servicePermissionError(service, origin);
      const failure = new Error(`${service.name} 接口连接失败（${address.hostname}）。请检查网络、代理或 Chrome 的网站访问限制。`, { cause: error });
      failure.code = 'NETWORK_ERROR';
      throw failure;
    }
    throw error;
  }
}
Object.assign(App, { chromeServices, chromeServiceRequest, serviceOrigins });
