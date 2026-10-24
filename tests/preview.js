// The built Chrome content bundle and built userscript run unmodified here.
// Only browser/GM APIs are emulated; no external services are called.
const mode = new URL(location.href).searchParams.get('platform') || 'chrome';
const run = new URL(location.href).searchParams.get('run') || 'default';
const prefix = `at-preview:${mode}:${run}:`;
const callbacks = new Set(), messageCallbacks = new Set();
const $ = selector => document.querySelector(selector);
const all = () => Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith(prefix)).map(key => [key.slice(prefix.length), JSON.parse(localStorage.getItem(key))]));
const updateState = () => {
  const active = all()['at-site:127.0.0.1'] === true;
  $('#state').textContent = `${new URL(location.href).searchParams.get('platform') === 'userscript' ? '油猴' : 'Chrome'} · 本站${active ? '已开启' : '已关闭'}`;
};
function changed(patch) { callbacks.forEach(fn => fn(patch)); updateState(); }
function set(patch) {
  for (const [key, value] of Object.entries(patch)) localStorage.setItem(prefix + key, JSON.stringify(value));
  changed(patch);
}
function remove(keys) { keys.forEach(key => localStorage.removeItem(prefix + key)); changed(Object.fromEntries(keys.map(key => [key, undefined]))); }
addEventListener('storage', event => {
  if (!event.key?.startsWith(prefix)) return;
  changed({ [event.key.slice(prefix.length)]: event.newValue === null ? undefined : JSON.parse(event.newValue) });
});
const service = async message => {
  $('#events').textContent = '最近的服务调用：' + message.action;
  if (['service_access', 'service_access_request'].includes(message.action)) return { granted: true };
  if (message.action === 'translate' && message.translator === 'ai' && new URL(message.settings.aiURL).hostname === 'ai.example') {
    $('#events').textContent = 'AI 翻译：本地模拟响应';
    if ((JSON.parse(message.settings.aiBody || '{}').stream ?? message.settings.aiStream) && message.progressId) {
      let translatedText = '';
      for (const text of ['今', '天', '的', '天气', '很', '好。']) {
        await new Promise(resolve => setTimeout(resolve, 180)); translatedText += text;
        messageCallbacks.forEach(fn => fn({ action: 'translation_progress', progressId: message.progressId, translatedText }, {}, () => {}));
      }
    }
    return { translatedText: '今天的天气很好。' };
  }
  if (message.action === 'tokenizer_data_status') return { state: 'missing', completed: 0, total: 12 };
  if (message.action === 'check_update') return { available: false };
  if (message.action === 'vits_speakers') {
    if (!run.startsWith('reset-audit')) return { voices: [] };
    // Local fixtures exercise missing default voices and replies after reset.
    if (message.settings.vitsAPI === 'https://slow.example') await new Promise(resolve => setTimeout(resolve, 1800));
    return { voices: [{ id: 4, name: '演示声线 A', lang: ['ja'] }, { id: 8, name: '演示声线 B', lang: ['ja'] }] };
  }
  if (['stop_audio', 'cancel_translation'].includes(message.action)) return {};
  throw new Error('此页用于本地界面验证，请在安装后配置在线服务');
};
let openSettings;
if (mode === 'userscript') {
  const gmListeners = new Map(); let nextId = 0;
  Object.assign(window, {
    GM_getValue: (key, fallback) => Object.hasOwn(all(), key) ? all()[key] : fallback,
    GM_setValue: (key, value) => set({ [key]: value }), GM_deleteValue: key => remove([key]), GM_listValues: () => Object.keys(all()),
    GM_addValueChangeListener(key, fn) { const id = ++nextId, listener = patch => { if (Object.hasOwn(patch, key)) fn(key, undefined, patch[key], true); }; gmListeners.set(id, listener); callbacks.add(listener); return id; },
    GM_removeValueChangeListener(id) { callbacks.delete(gmListeners.get(id)); gmListeners.delete(id); },
    GM_registerMenuCommand(_name, fn) { openSettings = fn; $('#open-panel').disabled = false; },
    GM_setClipboard(text) { $('#events').textContent = '已复制：' + text; },
    GM_xmlhttpRequest(options) {
      if (new URL(options.url).hostname !== 'ai.example') { options.onerror?.({ statusText: '界面验证未连接在线服务' }); return; }
      $('#events').textContent = 'AI 翻译：本地模拟响应';
      const streaming = JSON.parse(options.data || '{}').stream || options.url.includes(':streamGenerateContent');
      if (streaming) {
        const gemini = options.url.includes(':streamGenerateContent'), claude = options.url.includes('messages');
        const events = ['今', '天', '的', '天气', '很', '好。'].map(text => gemini
          ? { candidates: [{ content: { parts: [{ text }] } }] }
          : claude ? { type: 'content_block_delta', delta: { type: 'text_delta', text } } : { choices: [{ delta: { content: text } }] });
        events.push(gemini ? { candidates: [{ finishReason: 'STOP' }] } : claude ? { type: 'message_stop' } : '[DONE]');
        let cancelled = false, responseText = '', index = 0;
        const next = () => {
          if (cancelled) return;
          const event = events[index++]; responseText += 'data: ' + (typeof event === 'string' ? event : JSON.stringify(event)) + '\n\n';
          options.onprogress?.({ status: 200, responseText });
          if (index < events.length) setTimeout(next, 180);
          else options.onload?.({ status: 200, responseText, responseHeaders: 'Content-Type: text/event-stream' });
        };
        setTimeout(next, 180);
        return { abort() { cancelled = true; } };
      }
      const text = '今天的天气很好。';
      const response = options.url.includes('generateContent') ? { candidates: [{ content: { parts: [{ text }] } }] }
        : options.url.includes('messages') ? { content: [{ type: 'text', text }] } : { choices: [{ message: { content: text } }] };
      queueMicrotask(() => options.onload?.({ status: 200, responseText: JSON.stringify(response), responseHeaders: 'Content-Type: application/json' }));
      return { abort() {} };
    }
  });
} else {
  window.chrome = {
    runtime: { getURL: path => '/' + path, sendMessage: service,
      onMessage: { addListener: fn => messageCallbacks.add(fn), removeListener: fn => messageCallbacks.delete(fn) } },
    storage: {
      local: { async get(keys) { const values = all(); return keys === null ? values : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, values[key]])); }, async set(patch) { set(patch); }, async remove(keys) { remove(keys); } },
      onChanged: { addListener(fn) { const listener = patch => fn(Object.fromEntries(Object.entries(patch).map(([key, newValue]) => [key, { newValue }])), 'local'); fn._listener = listener; callbacks.add(listener); }, removeListener(fn) { callbacks.delete(fn._listener); } }
    }
  };
  openSettings = () => messageCallbacks.forEach(fn => fn({ action: 'open_settings' }, {}, () => {}));
}
// The initial data-at-ui marker lets already-installed reading extensions skip
// this test harness. Load exactly one test bundle after the page is ready.
let loaded = false;
$('#open-panel').addEventListener('click', () => {
  if (loaded) { openSettings?.(); return; }
  loaded = true; $('#open-panel').disabled = true;
  document.documentElement.removeAttribute('data-at-ui');
  const script = document.createElement('script'); script.src = mode === 'userscript' ? '/userscript.js' : '/content.js';
  script.addEventListener('load', () => { updateState(); $('#open-panel').textContent = '打开设置'; if (mode !== 'userscript') $('#open-panel').disabled = false; });
  script.addEventListener('error', () => { $('#state').textContent = '请先执行 npm run build'; }); document.body.append(script);
});
updateState();
if (run.startsWith('reset-audit')) {
  const backgroundFixture = document.createElement('button');
  backgroundFixture.textContent = '载入测试背景';
  document.querySelector('header').append(backgroundFixture);
  backgroundFixture.addEventListener('click', () => {
    const input = document.querySelector('[data-at-widget]')?.shadowRoot?.querySelector('[data-background-file]');
    if (!input) return;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
    const context = canvas.getContext('2d'); context.fillStyle = '#ddd'; context.fillRect(0, 0, 16, 16);
    canvas.toBlob(blob => {
      const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'reset-background.png', { type: 'image/png' }));
      input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 'image/png');
  });
}
