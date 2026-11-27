/** Combining marks, tatweel and the letter variants Arabic search should fold together. */
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/;

const FOLD: Record<string, string> = {
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ٱ": "ا",
  "ة": "ه",
  "ى": "ي",
  "ؤ": "و",
  "ئ": "ي",
};

function foldChar(ch: string): string {
  if (MARKS.test(ch)) return "";
  return FOLD[ch] ?? ch;
}

/** أ/إ/آ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي, with diacritics and tatweel removed. */
export function normalizeArabic(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) out += foldChar(value[i]);
  return out;
}

/** Same folding, plus a map from each folded character back to its index in the original. */
export function foldWithMap(value: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const folded = foldChar(value[i]);
    if (!folded) continue;
    text += folded;
    map.push(i);
  }
  return { text, map };
}

/**
 * SQL expression that folds a column the same way `normalizeArabic` folds the query,
 * so "احمد" finds "أحمد" and "نوره" finds "نورة".
 */
export function arabicNormSql(column: string): string {
  return `translate(regexp_replace(replace(${column}, '\u0640', ''), '[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]', '', 'g'), 'أإآٱةىؤئ', 'ااااهيوي')`;
}
