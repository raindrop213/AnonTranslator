function httpError(status) {
  const error = new Error(`HTTP ${status}`);
  error.status = status;
  return error;
}

// Both platform adapters use the same timeout and cancellation contract.
export async function fetchRequest(url, options = {}) {
  const { timeout = 30000, binary: _binary, vitsBase: _vitsBase, ankiBase: _ankiBase, aiBase: _aiBase, signal, onChunk, ...init } = options;
  const deadline = AbortSignal.timeout(timeout);
  const response = await fetch(url, { ...init, signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
  if (!response.ok) throw httpError(response.status);
  if (typeof onChunk === 'function' && response.body) {
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let body = '';
    const emit = chunk => { if (chunk) { body += chunk; onChunk(chunk); } };
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        emit(decoder.decode(value, { stream: true }));
      }
      emit(decoder.decode());
    } catch (error) {
      try { await reader.cancel(error); } catch { /* Preserve the original failure. */ }
      throw error;
    } finally { reader.releaseLock(); }
    return {
      ok: response.ok, status: response.status, statusText: response.statusText,
      url: response.url, headers: response.headers,
      text: async () => body, json: async () => JSON.parse(body),
      arrayBuffer: async () => new TextEncoder().encode(body).buffer
    };
  }
  return response;
}

export const gmRequest = (url, options = {}) => new Promise((resolve, reject) => {
  const signal = options.signal;
  if (signal?.aborted) { reject(signal.reason); return; }
  let settled = false, handle, abortPending = false, received = 0;
  const finish = (callback, value) => {
    if (settled) return;
    settled = true;
    signal?.removeEventListener('abort', cancel);
    callback(value);
  };
  const fail = error => {
    finish(reject, error);
    if (handle) handle.abort(); else abortPending = true;
  };
  const cancel = () => fail(signal.reason);
  const progress = response => {
    if (settled || typeof options.onChunk !== 'function' || response.status >= 400) return;
    const text = response.responseText || '';
    if (text.length > received) {
      const delta = text.slice(received);
      received = text.length;
      options.onChunk(delta);
    }
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try { handle = GM_xmlhttpRequest({
    url, method: options.method || 'GET', headers: options.headers,
    data: options.body?.toString(), timeout: options.timeout || 30000,
    responseType: options.binary ? 'arraybuffer' : 'text',
    onprogress(response) { try { progress(response); } catch (error) { fail(error); } },
    onload(response) {
      if (settled) return;
      if (response.status < 200 || response.status >= 300) {
        finish(reject, httpError(response.status));
        return;
      }
      try { progress(response); } catch (error) { fail(error); return; }
      finish(resolve, {
        ok: true, status: response.status,
        text: async () => response.responseText,
        json: async () => JSON.parse(response.responseText),
        arrayBuffer: async () => response.response,
        headers: { get: name => response.responseHeaders?.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'))?.[1].trim() }
      });
    },
    onerror: () => finish(reject, new Error(`网络请求失败（${new URL(url).host}），请检查油猴跨域授权或网络连接`)),
    ontimeout: () => finish(reject, new Error('接口请求超时')),
    onabort: () => finish(reject, signal?.reason || new DOMException('请求已取消', 'AbortError'))
  });
    if (abortPending) handle?.abort();
  } catch (error) { finish(reject, error); }
});
