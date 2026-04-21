/**
 * Shared dash-normalizer.
 * Removes em/en-dashes (AI-writing tells) and replaces with natural punctuation.
 * EXCEPT when the dash is part of a series name (e.g. "Verbotene Liebe – Next Generation"
 * or "9-1-1: Lone Star") — those belong to the official title and must stay.
 *
 *   "Text — weiter"  → "Text: weiter"
 *   "2026–2027"      → "2026-2027"
 *   "word— word"     → "word, word"
 */
export function stripDashes(s: string, protectedNames: string[] = []): string {
  if (!s || typeof s !== 'string') return s;

  const placeholders: string[] = [];
  let masked = s;
  for (const name of protectedNames) {
    if (!name || name.length < 3) continue;
    if (!/[—–\-]/.test(name)) continue;
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc, 'gi');
    masked = masked.replace(re, (match) => {
      const idx = placeholders.length;
      placeholders.push(match);
      return `\u0001SN${idx}\u0001`;
    });
  }

  let out = masked
    .replace(/(\d)[—–](\d)/g, '$1-$2')
    .replace(/\s+[—–]\s+/g, ': ')
    .replace(/[—–]\s+/g, ', ')
    .replace(/\s+[—–]/g, ', ')
    .replace(/[—–]/g, ', ')
    .replace(/  +/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+:/g, ':')
    .trim();

  out = out.replace(/\u0001SN(\d+)\u0001/g, (_, idx) => placeholders[Number(idx)] ?? '');
  return out;
}

export function stripDashesDeep(obj: any, protectedNames: string[] = []): void {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === 'string') {
      obj[key] = stripDashes(v, protectedNames);
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        if (typeof v[i] === 'string') v[i] = stripDashes(v[i], protectedNames);
        else if (typeof v[i] === 'object') stripDashesDeep(v[i], protectedNames);
      }
    } else if (typeof v === 'object') {
      stripDashesDeep(v, protectedNames);
    }
  }
}
