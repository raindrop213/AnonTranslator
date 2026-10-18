import Tokenizer from 'kuromoji/src/Tokenizer.js';
import DynamicDictionaries from 'kuromoji/src/dict/DynamicDictionaries.js';
import { gunzipSync } from 'fflate';

// Only the IPADIC data files are downloaded. The engine and decoder are bundled.
export const tokenizerDictionaryURL = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/';
export const tokenizerDictionaryFiles = [
  'base.dat.gz', 'check.dat.gz', 'tid.dat.gz', 'tid_pos.dat.gz', 'tid_map.dat.gz', 'cc.dat.gz',
  'unk.dat.gz', 'unk_pos.dat.gz', 'unk_map.dat.gz', 'unk_char.dat.gz', 'unk_compat.dat.gz', 'unk_invoke.dat.gz'
];

export function createTokenizer(loadBinary) {
  let initialization;
  async function initialize() {
    const buffers = await Promise.all(tokenizerDictionaryFiles.map(async file => {
      const data = new Uint8Array(await loadBinary(file));
      if (data.length > 16 * 1024 * 1024) throw new Error('分词数据文件过大');
      const bytes = gunzipSync(data);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }));
    const [base, check, tid, pos, map, cc, unk, unkPos, unkMap, char, compat, invoke] = buffers;
    const dictionary = new DynamicDictionaries();
    dictionary.loadTrie(new Int32Array(base), new Int32Array(check));
    dictionary.loadTokenInfoDictionaries(new Uint8Array(tid), new Uint8Array(pos), new Uint8Array(map));
    dictionary.loadConnectionCosts(new Int16Array(cc));
    dictionary.loadUnknownDictionaries(new Uint8Array(unk), new Uint8Array(unkPos), new Uint8Array(unkMap),
      new Uint8Array(char), new Uint32Array(compat), new Uint8Array(invoke));
    return new Tokenizer(dictionary);
  }
  return async text => {
    if (typeof text !== 'string' || text.length > 20000) throw new Error('分词文本最多 20000 个字符');
    if (!text.trim()) return { tokens: [] };
    if (!initialization) initialization = initialize().catch(error => {
      initialization = null;
      throw new Error(`分词器加载失败，请重试：${error.message}`, { cause: error });
    });
    const tokenizer = await initialization;
    let cursor = 0;
    const tokens = tokenizer.tokenize(text).map(token => {
      // Kuromoji's word_position counts Unicode characters and sentence offsets
      // differently. Match surfaces in order so DOM ranges always use UTF-16.
      const surface = token.surface_form, start = text.indexOf(surface, cursor);
      if (start < 0) throw new Error('分词结果与原文位置不一致');
      const end = start + surface.length;
      cursor = end;
      return { surface, start, end, pos: token.pos || 'その他', reading: token.reading || '',
        base: token.basic_form && token.basic_form !== '*' ? token.basic_form : surface };
    });
    return { tokens };
  };
}
