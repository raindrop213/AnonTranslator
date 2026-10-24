import { fetchRequest } from './request.js';
import { vitsAudio, huoshanAudio } from './speech.js';
import { defaults } from '../settings/settings.js';
import { ankiFields, defaultAnkiFront, defaultAnkiBack, defaultAnkiCSS } from './anki-model.js';
import { ankiDraftFields, escapeHTML, plainText } from './anki-fields.js';

// AnkiConnect v6: https://git.sr.ht/~foosoft/anki-connect
// API source: https://github.com/FooSoft/anki-connect/blob/master/plugin/__init__.py
export function normalizeAnkiURL(value = defaults.ankiURL) {
  let url;
  try { url = new URL(String(value).trim()); } catch { throw new Error('AnkiConnect 地址无效，例如 http://127.0.0.1:8765'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('AnkiConnect 地址仅支持 HTTP/HTTPS，API 密钥请单独填写');
  return url.href;
}

export function ankiLines(value) {
  return [...new Set((Array.isArray(value) ? value : String(value || '').split(/\r?\n/)).map(item => String(item).trim()).filter(Boolean))];
}

const quoteSearch = value => `"${value.replace(/[\\"*_]/g, character => '\\' + character)}"`;

function base64(value, name) {
  const data = typeof value === 'string' ? value.replace(/\s/g, '') : '';
  if (!data || data.length > 28 * 1024 * 1024 || !/^[A-Za-z\d+/]+={0,2}$/.test(data) || data.length % 4 === 1) throw new Error(`${name}不是有效的 base64 媒体（最大 20 MB）`);
  try { if (!atob(data).length) throw new Error(); } catch { throw new Error(`${name}不是有效的 base64 媒体`); }
  return data;
}

function prepareDraft(draft = {}, settings) {
  const word = String(draft.word || '').trim(), deck = String(draft.deck || ankiLines(settings.ankiDecks)[0] || '日语::单词').trim();
  if (!word || word.length > 100 || /[\r\n]/.test(word)) throw new Error('单词不能为空，且最多 100 个字符');
  if (!deck || deck.length > 200 || /[\r\n]/.test(deck)) throw new Error('请选择有效的 Anki 卡组');
  const tags = ankiLines(draft.tags ?? settings.ankiTags);
  if (tags.some(tag => /\s/.test(tag) || tag.length > 100)) throw new Error('Anki 标签不能含空格或换行，每个标签最多 100 个字符');
  const fields = ankiDraftFields({ ...draft, word });
  const media = [];
  if (draft.image) {
    const extension = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }[draft.image.mime];
    if (!extension) throw new Error('截图仅支持 WebP、PNG 或 JPEG');
    media.push({ field: 'Image', data: base64(draft.image.data, '截图'), extension });
  }
  return { ...draft, word, deck, tags, fields, media };
}

export function createAnkiService(request = fetchRequest, { audio, undoStorage } = {}) {
  let operationQueue = Promise.resolve(), lastUndo = null;
  const modelCache = new Map(), modelTTL = 10000;
  const config = settings => ({ url: normalizeAnkiURL(settings.ankiURL || defaults.ankiURL),
    key: String(settings.ankiAPIKey || ''), model: String(settings.ankiModel || 'AnonTranslator Japanese').trim() });
  const modelKey = settings => JSON.stringify(config(settings));
  const modelState = settings => {
    const key = modelKey(settings);
    if (!modelCache.has(key)) {
      modelCache.set(key, {});
      if (modelCache.size > 16) modelCache.delete(modelCache.keys().next().value);
    }
    return modelCache.get(key);
  };
  async function call(settings, action, params = {}) {
    const { url, key } = config(settings);
    let response, data;
    try {
      response = await request(url, { method: 'POST', timeout: 20000, ankiBase: url, credentials: 'omit',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, version: 6, params, ...(key ? { key } : {}) }) });
      try { data = await response.json(); } catch { throw new Error('AnkiConnect 返回了非 JSON 内容，请确认地址和端口未被其他本地服务占用'); }
    } catch (cause) {
      modelCache.delete(modelKey(settings));
      const permission = cause.code === 'HOST_PERMISSION_MISSING' || /未授权/.test(cause.message);
      const error = new Error(permission ? cause.message : `无法完成 AnkiConnect ${action}：${cause.message}。请确认 Anki 已启动、已安装 AnkiConnect，并检查“Anki”设置中的地址和密钥。`, { cause });
      error.uncertain = ['addNote', 'updateNoteFields', 'deleteNotes'].includes(action);
      throw error;
    }
    if (!data || typeof data !== 'object' || !Object.hasOwn(data, 'result') || !Object.hasOwn(data, 'error')) {
      modelCache.delete(modelKey(settings));
      const error = new Error('AnkiConnect 响应格式无效，请更新 AnkiConnect 到支持 API v6 的版本');
      error.uncertain = ['addNote', 'updateNoteFields', 'deleteNotes'].includes(action); throw error;
    }
    if (data.error !== null) {
      modelCache.delete(modelKey(settings));
      throw new Error(`AnkiConnect ${action}：${data.error}${/api key/i.test(String(data.error)) ? '；请检查 API 密钥' : ''}`);
    }
    return data.result;
  }
  async function info(settings) {
    const version = await call(settings, 'version');
    if (!Number.isFinite(version) || version < 6) throw new Error('请更新 AnkiConnect：需要 API v6 或更高版本');
    const [decks, models] = await Promise.all([call(settings, 'deckNames'), call(settings, 'modelNames')]);
    if (!Array.isArray(decks) || !Array.isArray(models)) throw new Error('AnkiConnect 未返回卡组和模型列表');
    return { version, decks, models };
  }
  async function validateModel(settings, snapshot) {
    const { model } = config(settings);
    if (!model || model.length > 200) throw new Error('Anki 模型名称不能为空，且最多 200 个字符');
    if (!snapshot.models.includes(model)) return;
    const fields = await call(settings, 'modelFieldNames', { modelName: model });
    if (!Array.isArray(fields) || fields[0] !== 'Word' || ankiFields.some(field => !fields.includes(field))) throw new Error(`模型“${model}”需要以 Word 为首字段并包含全部标准字段；请在设置中换一个模型名称，再创建标准模型`);
  }
  async function validatedSnapshot(settings, fresh = false) {
    const state = modelState(settings);
    if (!fresh && state.snapshot && state.validUntil > Date.now()) return state.snapshot;
    const snapshot = await info(settings);
    await validateModel(settings, snapshot);
    state.snapshot = snapshot; state.validUntil = Date.now() + modelTTL;
    return snapshot;
  }
  async function setup(settings, updateTemplates = false, extraDecks = [], snapshot, forceTemplates = false) {
    snapshot ||= await validatedSnapshot(settings, true);
    const { model } = config(settings), createdModel = !snapshot.models.includes(model);
    const front = settings.ankiFront || defaultAnkiFront, back = settings.ankiBack || defaultAnkiBack, css = settings.ankiCSS ?? defaultAnkiCSS;
    const state = modelState(settings), signature = JSON.stringify([front, back, css]);
    let templatesUpdated = false;
    if (createdModel) {
      await call(settings, 'createModel', { modelName: model, inOrderFields: [...ankiFields], css, isCloze: false,
        cardTemplates: [{ Name: 'Japanese', Front: front, Back: back }] });
      snapshot.models.push(model);
    } else if (updateTemplates && (forceTemplates || state.templateSignature !== signature || state.templateUntil <= Date.now())) {
      const [templates, styling] = await Promise.all([
        call(settings, 'modelTemplates', { modelName: model }), call(settings, 'modelStyling', { modelName: model })
      ]);
      if (!templates || typeof templates !== 'object' || typeof styling?.css !== 'string') throw new Error('AnkiConnect 未返回有效的模型模板和样式');
      const templateName = Object.hasOwn(templates, 'Japanese') ? 'Japanese' : Object.keys(templates)[0];
      if (!templateName) throw new Error('现有模型没有卡片模板，请使用新的标准模型名称');
      const writes = [];
      if (forceTemplates || templates[templateName].Front !== front || templates[templateName].Back !== back) {
        writes.push(call(settings, 'updateModelTemplates', { model: { name: model, templates: { [templateName]: { Front: front, Back: back } } } }));
      }
      if (forceTemplates || styling.css !== css) writes.push(call(settings, 'updateModelStyling', { model: { name: model, css } }));
      const results = await Promise.allSettled(writes);
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      templatesUpdated = writes.length > 0;
    }
    if (createdModel || updateTemplates) {
      state.templateSignature = signature; state.templateUntil = Date.now() + modelTTL;
    }
    const createdDecks = [];
    for (const deck of [...new Set([...ankiLines(settings.ankiDecks || '日语::单词'), ...extraDecks])]) {
      if (snapshot.decks.includes(deck)) continue;
      await call(settings, 'createDeck', { deck }); createdDecks.push(deck); snapshot.decks.push(deck);
    }
    return { model, createdModel, createdDecks, templatesUpdated, fields: [...ankiFields] };
  }
  async function duplicates(settings, draft, snapshot) {
    const { model } = config(settings);
    if (!snapshot.models.includes(model)) return [];
    const ids = await call(settings, 'findNotes', { query: `note:${quoteSearch(model)} Word:${quoteSearch(draft.word)}` });
    if (!Array.isArray(ids)) throw new Error('AnkiConnect 未返回有效的查重结果');
    const notes = [];
    for (let index = 0; index < ids.length; index += 200) notes.push(...await call(settings, 'notesInfo', { notes: ids.slice(index, index + 200) }));
    return notes.filter(note => note?.modelName === model && Number.isSafeInteger(note.noteId) && note.fields?.Word?.order === 0 && plainText(note.fields.Word.value) === draft.word)
      .sort((left, right) => left.noteId - right.noteId);
  }
  async function generateAudio(settings, draft) {
    const selected = key => {
      const value = settings[key] ?? 'none';
      if (!['none', 'vits', 'huosh'].includes(value)) throw new Error('无效的 Anki 音频服务');
      return value;
    };
    const jobs = [[selected('ankiWordAudioService'), 'WordAudio', draft.word], [selected('ankiSentenceAudioService'), 'SentenceAudio', plainText(draft.sentence)]];
    for (const [provider, , text] of jobs) {
      if (provider === 'none') continue;
      if (!String(text || '').trim()) throw new Error('例句为空，无法生成例句音频；请填写例句或关闭例句音频');
    }
    return Promise.all(jobs.filter(([provider]) => provider !== 'none').map(async ([provider, field, text]) => {
      // Reuse provider parameters while keeping export independent of reader playback.
      const voiceSettings = { ...settings, useWindowsTTS: false, useVITS: provider === 'vits', useHuoshTTS: provider === 'huosh' };
      const result = await (audio ? audio(text, voiceSettings, request, provider) : (provider === 'huosh' ? huoshanAudio : vitsAudio)(text, voiceSettings, request));
      const mime = String(result.mime || 'audio/mpeg').split(';')[0].trim().toLowerCase();
      const extension = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'application/octet-stream': 'mp3' }[mime];
      if (!extension) throw new Error(`无法导出此音频格式：${mime}`);
      return { field, data: base64(result.audio, '语音'), extension };
    }));
  }
  async function readUndo() { return undoStorage ? await undoStorage.get() : lastUndo; }
  async function saveUndo(value) { lastUndo = value; if (undoStorage) await undoStorage.set(value); }
  function undoAvailability(settings, record) {
    if (!record) return { undoAvailable: false, reason: '没有可以撤回的新卡片' };
    const { url, model } = config(settings);
    if (record.url !== url || record.model !== model) return { undoAvailable: false, reason: 'Anki 接口或模型已改变，不能撤回其他目标中的卡片' };
    return { undoAvailable: true, noteId: record.noteId, word: record.word };
  }
  async function noteSignature(note) {
    if (!note?.fields || !Array.isArray(note.tags) || !Array.isArray(note.cards) || ankiFields.some(name => typeof note.fields[name]?.value !== 'string')) throw new Error('卡片核验数据不完整');
    const data = JSON.stringify({ noteId: note.noteId, model: note.modelName,
      fields: Object.keys(note.fields).sort().map(name => [name, note.fields[name].order, note.fields[name].value]),
      tags: [...note.tags].sort(), cards: [...note.cards].sort((left, right) => left - right) });
    if (!globalThis.crypto?.subtle) return 'raw:' + data;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return 'sha256:' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function recordAddedNote(settings, noteId, word, overwritten, warnings) {
    const undoReason = overwritten ? '覆盖已有卡片不支持撤回，不会删除既有卡片' : '无法核验新卡片，暂不能安全撤回';
    try {
      // Replacing one slot also invalidates an older add after an overwrite.
      await saveUndo(null);
      if (overwritten) return { undoAvailable: false, undoReason };
      const notes = await call(settings, 'notesInfo', { notes: [noteId] }), note = notes?.[0];
      const { url, model } = config(settings);
      if (notes?.length !== 1 || note?.noteId !== noteId || note.modelName !== model || note.fields?.Word?.order !== 0 || plainText(note.fields.Word.value) !== word) throw new Error('新卡片信息与添加结果不一致');
      await saveUndo({ url, model, noteId, word, signature: await noteSignature(note) });
      return { undoAvailable: true };
    } catch (error) {
      warnings.push(`卡片已保存，但撤回记录未能准备：${error.message}`);
      return { undoAvailable: false, undoReason };
    }
  }
  async function undo(settings, confirmed, expectedId) {
    if (confirmed !== true) throw new Error('请先确认撤回最后新建的卡片');
    const record = await readUndo(), state = undoAvailability(settings, record);
    if (!state.undoAvailable) throw new Error(state.reason);
    if (expectedId !== undefined && expectedId !== record.noteId) throw new Error('最后添加的卡片已改变，请重新确认撤回目标');
    const notes = await call(settings, 'notesInfo', { notes: [record.noteId] }), note = notes?.[0];
    let matches = notes?.length === 1 && note?.noteId === record.noteId && note.modelName === record.model && note.fields?.Word?.order === 0 && plainText(note.fields.Word.value) === record.word;
    try { matches = matches && await noteSignature(note) === record.signature; } catch { matches = false; }
    if (!matches) { await saveUndo(null); throw new Error('卡片已被修改或删除，已停止撤回，未删除任何卡片'); }
    try { await call(settings, 'deleteNotes', { notes: [record.noteId] }); }
    catch (error) {
      if (error.uncertain) { await saveUndo(null); error.message += '；撤回结果未确认，请在 Anki 核对，不要再次删除'; }
      throw error;
    }
    await saveUndo(null);
    return { status: 'undone', noteId: record.noteId, undoAvailable: false };
  }
  async function add(settings, source, duplicateMode = 'ask') {
    if (!settings.ankiEnabled) throw new Error('请先在“Anki”设置开启 Anki 制卡');
    if (!['ask', 'duplicate', 'overwrite'].includes(duplicateMode)) throw new Error('无效的重复词处理方式');
    const draft = prepareDraft(source, settings), snapshot = await validatedSnapshot(settings);
    const matches = await duplicates(settings, draft, snapshot);
    if (matches.length && duplicateMode === 'ask') return { status: 'duplicate', noteIds: matches.map(note => note.noteId) };
    const warnings = [];
    draft.media.push(...await generateAudio(settings, draft));
    // A confirmed add/overwrite applies the current templates; field definitions
    // and unrelated templates are preserved. Duplicate prompts remain read-only.
    await setup(settings, true, [draft.deck], snapshot);
    const existing = duplicateMode === 'overwrite' ? matches[0] : null, uploaded = [];
    if (existing) for (const field of ['Image', 'WordAudio', 'SentenceAudio']) if (!draft.media.some(media => media.field === field)) draft.fields[field] = existing.fields[field]?.value || '';
    let written = false;
    try {
      for (const media of draft.media) {
        const identifier = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const filename = `at_${identifier}_${media.field}.${media.extension}`;
        uploaded.push(filename);
        const stored = await call(settings, 'storeMediaFile', { filename, data: media.data, deleteExisting: false });
        if (typeof stored !== 'string' || !stored.startsWith(`at_${identifier}_`) || /[\\/\[\]<>"']/.test(stored)) throw new Error('AnkiConnect 未返回有效的新媒体文件名');
        uploaded[uploaded.length - 1] = stored;
        draft.fields[media.field] = media.field === 'Image' ? `<img src="${escapeHTML(stored)}">` : `<audio src="${escapeHTML(stored)}" preload="none"></audio>`;
      }
      let noteId;
      if (existing) {
        noteId = existing.noteId;
        await call(settings, 'updateNoteFields', { note: { id: noteId, fields: draft.fields } }); written = true;
        if (matches.length > 1) warnings.push(`有 ${matches.length} 条同词记录，仅更新最早的一条（${noteId}）`);
        try { await call(settings, 'updateNoteTags', { note: noteId, tags: [...new Set([...(existing.tags || []), ...draft.tags])] }); }
        catch (error) { warnings.push(`字段已更新，标签未完全更新：${error.message}`); }
        if (existing.cards?.length) {
          try { await call(settings, 'changeDeck', { cards: existing.cards, deck: draft.deck }); }
          catch (error) { warnings.push(`字段已更新，卡组未移动：${error.message}`); }
        }
      } else {
        noteId = await call(settings, 'addNote', { note: { deckName: draft.deck, modelName: config(settings).model,
          fields: draft.fields, tags: draft.tags, options: { allowDuplicate: duplicateMode === 'duplicate', duplicateScope: 'collection' } } });
        if (!Number.isSafeInteger(noteId) || noteId <= 0) throw new Error('AnkiConnect 没有创建卡片，请检查模型模板及重复词设置');
        written = true;
      }
      const undoState = await recordAddedNote(settings, noteId, draft.word, !!existing, warnings);
      return { status: existing ? 'updated' : 'added', noteId, ...undoState, ...(warnings.length ? { warnings } : {}) };
    } catch (error) {
      if (!written && !error.uncertain) {
        const cleanup = await Promise.allSettled(uploaded.map(filename => call(settings, 'deleteMediaFile', { filename })));
        if (cleanup.some(result => result.status === 'rejected')) error.message += '；部分新上传媒体未能清理，可在 Anki 检查媒体';
      } else if (!written && error.uncertain) error.message += '；写入结果未能确认，请先在 Anki 检查该词，避免重复添加；新媒体已保留';
      throw error;
    }
  }
  function serialize(settings, operation) {
    config(settings);
    // Adds and undo share one slot across tabs, endpoints and models.
    const task = operationQueue.catch(() => {}).then(operation).catch(error => { modelCache.delete(modelKey(settings)); throw error; });
    operationQueue = task;
    return task;
  }
  return {
    info, setup: (settings, updateTemplates = false) => serialize(settings, () => setup(settings, updateTemplates, [], undefined, updateTemplates)),
    add: (settings, draft, duplicateMode) => serialize(settings, () => add(settings, draft, duplicateMode)),
    undoInfo: settings => serialize(settings, async () => undoAvailability(settings, await readUndo())),
    undo: (settings, confirmed, noteId) => serialize(settings, () => undo(settings, confirmed, noteId)),
    send(message) {
      const settings = message.settings || {};
      if (message.action === 'anki_info') return info(settings);
      if (message.action === 'anki_setup') return this.setup(settings, message.updateTemplates === true);
      if (message.action === 'anki_add') return this.add(settings, message.draft, message.duplicateMode);
      if (message.action === 'anki_undo_info') return this.undoInfo(settings);
      if (message.action === 'anki_undo') return this.undo(settings, message.confirmed, message.noteId);
      throw new Error('未知 Anki 操作');
    }
  };
}
