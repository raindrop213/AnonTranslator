const shortcutActions = {
  shortcutPreviousParagraph: 'previousParagraph', shortcutNextParagraph: 'nextParagraph',
  shortcutPreviousSentence: 'previousSentence', shortcutNextSentence: 'nextSentence',
  shortcutReadCurrent: 'readCurrent', shortcutAutoRead: 'autoRead', shortcutStop: 'stop'
};
const shortcutModifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];
function normalizeShortcut(value) {
  if (!value.trim()) return '';
  const alternatives = value.split('/').map(binding => {
    const pieces = binding.trim().split('+');
    const code = pieces.pop();
    if (!/^(Key[A-Z]|Digit\d|Numpad\d|F([1-9]|1\d|2[0-4])|Arrow(Up|Down|Left|Right)|Space|Escape|Enter|Tab|Home|End|PageUp|PageDown|Backspace|Delete|Insert|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote|Numpad(Add|Subtract|Multiply|Divide|Decimal|Enter))$/.test(code) || pieces.some(piece => !shortcutModifiers.includes(piece)) || new Set(pieces).size !== pieces.length) {
      throw new Error('使用按键代码，例如 Digit4、Numpad4、Ctrl+ArrowRight；备用键用 / 分隔');
    }
    return [...shortcutModifiers.filter(modifier => pieces.includes(modifier)), code].join('+');
  });
  return [...new Set(alternatives)].join('/');
}
function shortcutFromEvent(event) {
  return [...shortcutModifiers.filter(modifier => event[{ Ctrl: 'ctrlKey', Alt: 'altKey', Shift: 'shiftKey', Meta: 'metaKey' }[modifier]]), event.code].join('+');
}
function validateShortcuts(values) {
  const used = new Map();
  for (const key of Object.keys(shortcutActions)) {
    for (const binding of (values[key] || '').split('/').filter(Boolean)) {
      if (used.has(binding)) throw new Error(`${binding} 已用于另一个操作，请先修改或清空那个快捷键`);
      used.set(binding, key);
    }
  }
}
function shortcutAction(event, values) {
  const binding = shortcutFromEvent(event);
  return Object.entries(shortcutActions).find(([key]) => (values[key] || '').split('/').includes(binding))?.[1];
}
Object.assign(App, { shortcutActions, normalizeShortcut, shortcutFromEvent, validateShortcuts, shortcutAction });
