const kanji = /[\p{Script=Han}々〆ヵヶ]/u;

export function hiragana(value) {
  return String(value || '').replace(/[\u30a1-\u30f6]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60));
}

// Match visible kana against the reading so 濡らし gets ruby only over 濡.
export function readingParts(surface, value) {
  const reading = hiragana(value);
  if (!kanji.test(surface) || !reading || reading === '*') return [{ text: surface, start: 0, end: surface.length, reading: '' }];
  const runs = [...surface.matchAll(/[\p{Script=Han}々〆ヵヶ]+|[^\p{Script=Han}々〆ヵヶ]+/gu)];
  const parts = []; let cursor = 0;
  for (let index = 0; index < runs.length; index++) {
    const run = runs[index], text = run[0], isKanji = kanji.test(text);
    if (!isKanji) {
      const kana = hiragana(text);
      if (!reading.startsWith(kana, cursor)) return [{ text: surface, start: 0, end: surface.length, reading }];
      parts.push({ text, start: run.index, end: run.index + text.length, reading: '' }); cursor += kana.length;
    } else {
      const nextKana = runs[index + 1]?.[0], end = nextKana ? reading.indexOf(hiragana(nextKana), cursor + 1) : reading.length;
      if (end < cursor + 1) return [{ text: surface, start: 0, end: surface.length, reading }];
      parts.push({ text, start: run.index, end: run.index + text.length, reading: reading.slice(cursor, end) }); cursor = end;
    }
  }
  return cursor === reading.length ? parts : [{ text: surface, start: 0, end: surface.length, reading }];
}

