App.createUserscriptPlatform = () => ({
  async getSettings() {
    return Object.fromEntries(Object.keys(App.defaults).map(key => [key, GM_getValue(key, App.defaults[key])]));
  },
  async setSettings(patch) {
    for (const [key, value] of Object.entries(patch)) GM_setValue(key, value);
  },
  watchSettings(listener) {
    for (const key of Object.keys(App.defaults)) {
      GM_addValueChangeListener(key, (_key, _old, value) => listener({ [key]: value }));
    }
  },
  send(message) { return App.handleServiceMessage(message, App.gmRequest); },
  async copy(text) { GM_setClipboard(text, 'text'); }
});

App.gmRequest = (url, options = {}) => new Promise((resolve, reject) => {
  const signal = options.signal;
  if (signal?.aborted) { reject(signal.reason); return; }
  const finish = (callback, value) => { signal?.removeEventListener('abort', cancel); callback(value); };
  let handle;
  const cancel = () => { handle?.abort(); finish(reject, signal.reason); };
  signal?.addEventListener('abort', cancel, { once: true });
  try { handle = GM_xmlhttpRequest({
    url, method: options.method || 'GET', headers: options.headers,
    data: options.body?.toString(), timeout: options.timeout || 30000,
    responseType: options.binary ? 'arraybuffer' : 'text',
    onload(response) {
      if (response.status < 200 || response.status >= 300) {
        finish(reject, App.httpError(response.status));
        return;
      }
      finish(resolve, {
        text: async () => response.responseText,
        json: async () => JSON.parse(response.responseText),
        arrayBuffer: async () => response.response,
        headers: { get: name => response.responseHeaders?.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'))?.[1].trim() }
      });
    },
    onerror: () => finish(reject, new Error('网络请求失败')),
    ontimeout: () => finish(reject, new Error('接口请求超时'))
  }); } catch (error) { finish(reject, error); }
});
