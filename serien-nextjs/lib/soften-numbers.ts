/**
 * Soften concrete viewership / audience numbers in headlines.
 *
 * Rationale: Highly specific stats ("26,5 Millionen schauen Marshals") feel
 * over-data-driven and age out fast. Abstracting them to category words
 * ("Millionen", "Hunderttausende") keeps the hook intact while making the
 * headline evergreen and less robotic.
 *
 * Rules:
 *  – `<approx>? <num> Million(en)/Mio./Milliarden/Mrd.` → `Millionen`
 *    (Approximator wie "fast", "knapp", "rund", "über" wird MIT konsumiert,
 *    sonst entstehen kaputte Phrasen wie "Nach fast Millionen Zuschauern".)
 *  – Bare number ≥ 1_000_000 written as `1.234.567` or `1,5 Millionen` → `Millionen`
 *  – `<num>.000` between 100 000 and 999 999 → `Hunderttausende`
 *  – Numbers that are part of seasons / episodes / years are NEVER touched
 *    (`Staffel 3`, `S2E11`, `2026`, `Top 10` etc.).
 *
 * Idempotent.
 */

const SEASON_EPISODE_RX = /\b(?:Staffel\s+\d+|S\d+E\d+|S\s?\d+|E\s?\d+|Folge\s+\d+|Episode\s+\d+|Top\s*\d+|Platz\s+\d+)\b/giu;
const YEAR_RX = /\b(19|20)\d{2}\b/g;

// Deutsche Approximatoren, die VOR der Zahl stehen können und ohne sie
// grammatikalisch hängen ("fast Millionen" ist kein Deutsch).
// Werden zusammen mit der Zahl entfernt, damit die Phrase grammatisch bleibt.
const APPROX_PREFIX = '(?:fast\\s+schon\\s+|fast\\s+|knapp\\s+|rund\\s+|etwa\\s+|circa\\s+|ca\\.?\\s+|nahezu\\s+|beinahe\\s+|gerade\\s+mal\\s+|gut\\s+|über\\s+|ueber\\s+|mehr\\s+als\\s+|weniger\\s+als\\s+|an\\s+die\\s+|bloß\\s+|bloss\\s+|nur\\s+)?';

/**
 * Replace specific large numbers with abstract category words.
 */
export function softenLargeNumbers(input: string): string {
  if (!input) return input;
  let s = input;

  // 1. Mask season/episode/year/year-range tokens so they survive untouched.
  const masks: string[] = [];
  const mask = (re: RegExp) => {
    s = s.replace(re, (m) => {
      masks.push(m);
      return `\u0001${masks.length - 1}\u0001`;
    });
  };
  mask(SEASON_EPISODE_RX);
  mask(YEAR_RX);

  // 2. "<approx>? <digits>[,.]<digits>? Million/Milliarden/Mio/Mrd[.] [Wort]?"
  //    → "Millionen [Wort]?"
  s = s.replace(
    new RegExp(`${APPROX_PREFIX}\\b\\d+(?:[.,]\\d+)?\\s*(?:Millionen?|Mio\\.?|Milliarden|Mrd\\.?)\\b`, 'giu'),
    'Millionen',
  );

  // 3. Numbers like "150.000" / "500.000" (Hunderttausende). Threshold 100k–999k.
  //    Approximator wird ebenfalls konsumiert.
  s = s.replace(
    new RegExp(`${APPROX_PREFIX}\\b([1-9]\\d{2})[.\\u202F\\u00A0]?000\\b`, 'giu'),
    'Hunderttausende',
  );

  // 4. Bare integers ≥ 1_000_000 written with thousands separators (e.g. 12.345.678).
  s = s.replace(
    new RegExp(`${APPROX_PREFIX}\\b\\d{1,3}(?:[.\\u202F\\u00A0]\\d{3}){2,}\\b`, 'giu'),
    'Millionen',
  );

  // 5. "<approx>? <num> Tausend" → "Tausende"
  s = s.replace(
    new RegExp(`${APPROX_PREFIX}\\b\\d+(?:[.,]\\d+)?\\s*Tausend\\b`, 'giu'),
    'Tausende',
  );

  // 6. Restore masks.
  s = s.replace(/\u0001(\d+)\u0001/g, (_, idx) => masks[Number(idx)] ?? '');

  // 7. Cleanup: consecutive duplicates ("Millionen Millionen") + leading "Millionen Millionen".
  s = s.replace(/\b(Millionen|Hunderttausende|Tausende)(\s+\1)+\b/giu, '$1');

  // 8. Cleanup: trim double spaces.
  s = s.replace(/\s{2,}/g, ' ').trim();

  return s;
}
