import { createAnkiService } from '../src/services/anki.js';

// Browser QA never writes to a user's running Anki instance.
export function createMockAnki() {
  const models = new Map(), decks = new Set(['日语::单词', '日语::句子']), notes = new Map(), media = new Map();
  let sequence = 1000;
  const request = async (_url, options) => {
    const { action, params = {} } = JSON.parse(options.body);
    let result = null, error = null;
    switch (action) {
      case 'version': result = 6; break;
      case 'deckNames': result = [...decks]; break;
      case 'modelNames': result = [...models.keys()]; break;
      case 'modelFieldNames': result = models.get(params.modelName)?.fields || []; break;
      case 'createModel': models.set(params.modelName, { fields: params.inOrderFields, templates: { Japanese: params.cardTemplates[0] }, css: params.css }); result = {}; break;
      case 'createDeck': decks.add(params.deck); result = ++sequence; break;
      case 'modelTemplates': result = models.get(params.modelName)?.templates; break;
      case 'updateModelTemplates': Object.assign(models.get(params.model.name).templates, params.model.templates); break;
      case 'updateModelStyling': models.get(params.model.name).css = params.model.css; break;
      case 'findNotes': result = [...notes.keys()]; break;
      case 'notesInfo': result = params.notes.map(id => notes.get(id)).filter(Boolean); break;
      case 'storeMediaFile': media.set(params.filename, params.data); result = params.filename; break;
      case 'deleteMediaFile': media.delete(params.filename); break;
      case 'addNote': {
        const id = ++sequence, note = params.note, fields = {};
        models.get(note.modelName).fields.forEach((name, order) => { fields[name] = { value: note.fields[name] || '', order }; });
        notes.set(id, { noteId: id, modelName: note.modelName, tags: note.tags, cards: [id], deck: note.deckName, fields }); result = id; break;
      }
      case 'updateNoteFields': for (const [name, value] of Object.entries(params.note.fields)) notes.get(params.note.id).fields[name].value = value; break;
      case 'updateNoteTags': notes.get(params.note).tags = params.tags; break;
      case 'changeDeck': for (const id of params.cards) if (notes.has(id)) notes.get(id).deck = params.deck; break;
      default: error = `Unknown mock action: ${action}`;
    }
    return { json: async () => ({ result, error }) };
  };
  const service = createAnkiService(request);
  return { service, snapshot: () => ({ notes: [...notes.values()], media: [...media.keys()], models: [...models.keys()] }) };
}
