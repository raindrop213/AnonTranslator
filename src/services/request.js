function httpError(status) {
  const error = new Error(`HTTP ${status}`);
  error.status = status;
  return error;
}

// Both platform adapters use the same timeout and cancellation contract.
export async function fetchRequest(url, options = {}) {
  const { timeout = 30000, binary: _binary, vitsBase: _vitsBase, ankiBase: _ankiBase, signal, ...init } = options;
  const deadline = AbortSignal.timeout(timeout);
  const response = await fetch(url, { ...init, signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
  if (!response.ok) throw httpError(response.status);
  return response;
}

export const gmRequest = (url, options = {}) => new Promise((resolve, reject) => {
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
        finish(reject, httpError(response.status));
        return;
      }
      finish(resolve, {
        text: async () => response.responseText,
        json: async () => JSON.parse(response.responseText),
        arrayBuffer: async () => response.response,
        headers: { get: name => response.responseHeaders?.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'))?.[1].trim() }
      });
    },
    onerror: () => finish(reject, new Error(`网络请求失败（${new URL(url).host}），请检查油猴跨域授权或网络连接`)),
    ontimeout: () => finish(reject, new Error('接口请求超时'))
  }); } catch (error) { finish(reject, error); }
});
