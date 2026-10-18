// Session-only transport for live previews. No draft or image enters settings.
const prefix = 'at-anki-draft:';
const maxDraftBytes = 6 * 1024 * 1024, maxSessionBytes = 8 * 1024 * 1024;
const bytes = value => new TextEncoder().encode(value).byteLength;

export function serializeAnkiDraft(draft) {
  if (draft === null) return null;
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new Error('Anki 草稿格式无效');
  let json;
  try { json = JSON.stringify(draft); } catch { throw new Error('Anki 草稿无法序列化'); }
  if (json.length > maxDraftBytes || bytes(JSON.stringify({ json })) > maxDraftBytes) throw new Error('草稿超过 6 MB，无法同步实时预览；请缩小截图或减少词典内容');
  return json;
}

export function createSessionDraftStore(storage) {
  let queue = Promise.resolve();
  const keyFor = tabId => {
    if (!Number.isInteger(tabId) || tabId < 0) throw new Error('找不到用于预览的阅读标签页');
    return prefix + tabId;
  };
  const enqueue = operation => {
    const task = queue.catch(() => {}).then(operation); queue = task; return task;
  };
  return {
    set(tabId, draft) {
      const key = keyFor(tabId);
      let json;
      try { json = serializeAnkiDraft(draft); }
      catch (error) { return enqueue(async () => { await storage.remove(key); throw error; }); }
      return enqueue(async () => {
        if (json === null) { await storage.remove(key); return { saved: true }; }
        const all = await storage.get(null), entry = { json, updated: Date.now() }, size = bytes(JSON.stringify(entry)) + key.length;
        const candidates = Object.entries(all).filter(([name]) => name.startsWith(prefix) && name !== key)
          .map(([name, value]) => ({ name, updated: Number(value?.updated) || 0, size: bytes(JSON.stringify(value)) + name.length }))
          .sort((left, right) => left.updated - right.updated);
        let total = size + candidates.reduce((sum, candidate) => sum + candidate.size, 0);
        const remove = [];
        while (total > maxSessionBytes && candidates.length) { const oldest = candidates.shift(); total -= oldest.size; remove.push(oldest.name); }
        if (remove.length) await storage.remove(remove);
        await storage.set({ [key]: entry });
        return { saved: true };
      });
    },
    async get(tabId) {
      await queue.catch(() => {});
      const key = keyFor(tabId), result = await storage.get(key);
      try { return { draft: result[key]?.json ? JSON.parse(result[key].json) : null }; }
      catch { await storage.remove(key); return { draft: null }; }
    },
    remove(tabId) { return enqueue(() => storage.remove(keyFor(tabId))); }
  };
}
