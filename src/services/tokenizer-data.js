import dictionary from './tokenizer-dictionary.json' with { type: 'json' };
import { sha256 } from './sha256.js';
import { createTokenizer } from './tokenize.js';

const installHelp = '请打开设置，在“词典”页安装分词数据（约 17 MB）';
const leaseTime = 45000;

// Only this service downloads data, and only in response to install(). Reading
// text never initiates a network request. Both platforms share this lifecycle.
export function createTokenizerData({ storage, request, manifest = dictionary, hash = sha256, makeTokenizer = createTokenizer, now = Date.now }) {
  const { version, baseURL, files } = manifest;
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  let task = null, starting = null, removing = null, controller = null, error = '', loadedToken;
  const tokenizer = makeTokenizer(read);
  const reset = () => { loadedToken = undefined; tokenizer.reset?.(); };
  const fresh = (meta, epoch) => meta?.version === version && meta.epoch === epoch && meta.state === 'installing' && now() - meta.updatedAt < leaseTime;
  const cancelled = () => new Error('安装已中断，可重新点击安装继续');
  async function snapshot() {
    const [names, meta, epoch] = await Promise.all([storage.list(), storage.getMeta(), storage.getEpoch()]);
    const present = new Set(names), found = files.filter(file => present.has(file.name));
    const ready = meta?.version === version && meta.epoch === epoch && meta.state === 'installed' && found.length === files.length;
    const problem = ready ? '' : (meta?.epoch === epoch ? meta?.error : '') || error;
    return { meta, epoch, status: {
      state: ready ? 'installed' : task || fresh(meta, epoch) ? 'installing' : problem ? 'error' : found.length ? 'partial' : 'missing',
      completed: found.length, total: files.length,
      bytes: found.reduce((sum, file) => sum + file.bytes, 0), totalBytes,
      ...(problem ? { error: problem } : {})
    } };
  }
  async function valid(data, file) {
    return data instanceof Uint8Array && data.byteLength === file.bytes && await hash(data) === file.sha256;
  }
  async function read(name) {
    const readToken = loadedToken;
    const file = files.find(file => file.name === name);
    if (!file) throw new Error('不支持的分词数据文件');
    const data = await storage.get(name);
    if (!await valid(data, file)) {
      reset(); error = '分词数据缺失或损坏，请在“词典”设置中重新安装修复';
      const meta = await storage.getMeta();
      if (meta?.state === 'installed' && meta.token === readToken) await storage.setMeta({ ...meta, state: 'error', error });
      throw new Error(error);
    }
    return data;
  }
  async function own(token, epoch) {
    if (await storage.getEpoch() !== epoch || (await storage.getMeta())?.token !== token) throw cancelled();
  }
  async function perform(token, epoch, signal) {
    try {
      for (const file of files) {
        signal.throwIfAborted(); await own(token, epoch);
        const cached = await storage.get(file.name);
        if (!await valid(cached, file)) {
          const response = await request(baseURL + file.name, { binary: true, timeout: 20000, signal, credentials: 'omit' });
          const data = new Uint8Array(await response.arrayBuffer());
          if (!await valid(data, file)) throw new Error(`分词数据校验失败：${file.name}，请重试`);
          signal.throwIfAborted(); await own(token, epoch);
          await storage.set(file.name, data, epoch);
        }
        signal.throwIfAborted(); await own(token, epoch);
        await storage.setMeta({ version, state: 'installing', token, epoch, updatedAt: now() });
      }
      await own(token, epoch); reset();
      await storage.setMeta({ version, state: 'installed', token, epoch, updatedAt: now() });
    } catch (cause) {
      // Another userscript tab may have removed or taken over this install.
      // A stale task must never publish its completion over the new owner.
      if (await storage.getEpoch() === epoch && (await storage.getMeta())?.token === token && !signal.aborted) {
        error = cause.message || '分词数据安装失败，请重试';
        await storage.setMeta({ version, state: 'error', token, epoch, updatedAt: now(), error });
      }
    }
  }
  const service = {
    async status() {
      const result = await snapshot();
      if (result.status.state !== 'installed') reset();
      return result.status;
    },
    install() {
      if (removing) return Promise.reject(new Error('正在删除分词数据，请稍后重试'));
      if (starting) return starting;
      // Establish the gate before any storage await. Several extension popups
      // may send install simultaneously to the same service worker.
      starting = (async () => {
        const current = await snapshot();
        if (current.status.state === 'installed' || task || fresh(current.meta, current.epoch)) return current.status;
        error = '';
        const activeController = new AbortController(); controller = activeController;
        const token = globalThis.crypto?.randomUUID?.() || `${now()}-${Math.random()}`;
        await storage.setMeta({ version, state: 'installing', token, epoch: current.epoch, updatedAt: now() });
        const activeTask = perform(token, current.epoch, activeController.signal).catch(cause => { error = cause.message || '分词数据保存失败，请重试'; })
          .finally(() => {
            if (task === activeTask) task = null;
            if (controller === activeController) controller = null;
          });
        task = activeTask;
        return (await snapshot()).status;
      })().finally(() => { starting = null; });
      return starting;
    },
    remove() {
      if (removing) return removing;
      removing = (async () => {
        if (starting) await starting.catch(() => {});
        controller?.abort(); reset(); error = '';
        // Invalidate other pages before clearing, so they cannot publish ready.
        // This separate tombstone cannot be overwritten by an old metadata write.
        const epoch = `removed-${now()}-${Math.random()}`;
        await storage.setEpoch(epoch);
        await storage.setMeta({ version, state: 'removed', token: epoch, epoch });
        if (task) await task;
        await storage.clear();
        return (await snapshot()).status;
      })().finally(() => { removing = null; });
      return removing;
    },
    async tokenize(text) {
      const current = await snapshot();
      if (current.status.state !== 'installed') {
        reset(); throw new Error(current.status.state === 'installing' ? '分词数据正在安装，请稍候' : installHelp);
      }
      if (loadedToken !== current.meta.token) { reset(); loadedToken = current.meta.token; }
      const result = await tokenizer(text);
      const meta = await storage.getMeta();
      if (meta?.state !== 'installed' || meta.token !== current.meta.token || await storage.getEpoch() !== current.epoch) { reset(); throw new Error(installHelp); }
      return result;
    }
  };
  return service;
}
