/**
 * USD → EUR CONVERTER (Feb 2026)
 *
 * Wandelt Dollar-Beträge in deutschen Texten deterministisch in Euro um.
 * Aufruf nach Content-Generation, vor DB-Speicherung (Sanitizer-Stufe).
 *
 * Wechselkurs: 0.92 EUR/USD (realistisch für Anfang 2026, jährlich anpassen).
 * Override via Env: `EUR_PER_USD=0.95` (z.B. wenn der Kurs sich stark
 * verschiebt — typischer Drift ±5%).
 *
 * Erkannte Patterns:
 *   - "300 Millionen Dollar" / "300 Mio. Dollar" / "300 Mio Dollar"
 *   - "1 Milliarde Dollar" / "1 Mrd. Dollar"
 *   - "300 Mio. US-Dollar"
 *   - "$300 million" / "$300M" / "$1.2B"
 *   - "300M USD" / "1.2B USD"
 *   - "300 Dollar" (kleine Beträge — selten in TV-News, aber wir handhaben)
 *
 * Rundung:
 *   - n < 10:    auf 1 (45 → 45)
 *   - n < 1000:  auf 5 (276 → 275, 46 → 45)
 *   - n ≥ 1000:  auf 50 (920 → 900)
 *
 * Output-Format: "rund 275 Millionen Euro" / "rund 920 Millionen Euro" /
 * "rund 1 Milliarde Euro" — `rund`-Prefix signalisiert die Approximation.
 */

const ENV_RATE = Number(process.env.EUR_PER_USD);
export const EUR_PER_USD: number = Number.isFinite(ENV_RATE) && ENV_RATE > 0 ? ENV_RATE : 0.92;

/** Round to a "nice" number for editorial readability. */
export function niceRound(n: number): number {
  if (n < 10) return Math.round(n * 2) / 2;   // 5.52 → 5.5, 7.36 → 7.5
  if (n < 1000) return Math.round(n / 5) * 5; // 276 → 275, 46 → 45
  return Math.round(n / 50) * 50;             // 920 → 920
}

/** Convert USD value to EUR with nice rounding. */
export function convertUsdToEur(usd: number): number {
  return niceRound(usd * EUR_PER_USD);
}

interface UnitMeta {
  label: 'Millionen' | 'Milliarden' | '';
  factor: number; // multiplier in absolute amount
}

function parseGermanNumber(s: string): number {
  // German uses "," as decimal — but in editorial text we also see "." as decimal
  // ("1.2 Milliarden"). Normalize: if string has both . and ,, "," is decimal.
  const trimmed = s.trim().toLowerCase();

  // German number-words 1-20, plus "hundert", "tausend", and common compound
  // tausend-forms (zweihundert-/sechshunderttausend etc.)
  const wordMap: Record<string, number> = {
    'ein': 1, 'eine': 1, 'einer': 1, 'eines': 1,
    'zwei': 2, 'drei': 3, 'vier': 4, 'fünf': 5, 'fuenf': 5,
    'sechs': 6, 'sieben': 7, 'acht': 8, 'neun': 9, 'zehn': 10,
    'elf': 11, 'zwölf': 12, 'zwoelf': 12, 'dreizehn': 13, 'vierzehn': 14,
    'fünfzehn': 15, 'fuenfzehn': 15, 'sechzehn': 16, 'siebzehn': 17,
    'achtzehn': 18, 'neunzehn': 19, 'zwanzig': 20,
    'dreißig': 30, 'dreissig': 30, 'vierzig': 40, 'fünfzig': 50, 'fuenfzig': 50,
    'sechzig': 60, 'siebzig': 70, 'achtzig': 80, 'neunzig': 90,
    'hundert': 100, 'tausend': 1000,
    // Tausend-Compounds (häufig in Beträgen)
    'einhunderttausend': 100_000, 'hunderttausend': 100_000,
    'zweihunderttausend': 200_000, 'dreihunderttausend': 300_000,
    'vierhunderttausend': 400_000, 'fünfhunderttausend': 500_000,
    'fuenfhunderttausend': 500_000, 'sechshunderttausend': 600_000,
    'siebenhunderttausend': 700_000, 'achthunderttausend': 800_000,
    'neunhunderttausend': 900_000,
  };
  if (wordMap[trimmed] !== undefined) return wordMap[trimmed];

  if (trimmed.includes(',') && trimmed.includes('.')) {
    return parseFloat(trimmed.replace(/\./g, '').replace(',', '.'));
  }
  if (trimmed.includes(',')) {
    return parseFloat(trimmed.replace(',', '.'));
  }
  return parseFloat(trimmed);
}

function detectUnit(unitWord: string): UnitMeta {
  const u = unitWord.toLowerCase().replace(/\./g, '');
  if (/^mio$|^millionen?$|^million$/.test(u)) return { label: 'Millionen', factor: 1_000_000 };
  if (/^mrd$|^milliarden?$|^milliarde$|^billion$|^billions$/.test(u)) return { label: 'Milliarden', factor: 1_000_000_000 };
  if (/^m$/.test(u)) return { label: 'Millionen', factor: 1_000_000 };
  if (/^b$/.test(u)) return { label: 'Milliarden', factor: 1_000_000_000 };
  return { label: '', factor: 1 };
}

/** Format an EUR value back to German with optional unit. */
function formatEur(usdValue: number, unit: UnitMeta): string {
  const rawEur = usdValue * unit.factor * EUR_PER_USD;

  // Choose display unit based on magnitude
  if (rawEur >= 1_000_000_000) {
    const billions = rawEur / 1_000_000_000;
    const rounded = niceRound(billions * 100) / 100; // round to 0.01B granularity, then nice-round
    // Use cleaner number for billions
    const billionsClean = billions >= 10 ? Math.round(billions) : Math.round(billions * 10) / 10;
    if (billionsClean === 1) return 'rund 1 Milliarde Euro';
    return `rund ${formatNumberDe(billionsClean)} Milliarden Euro`;
  }
  if (rawEur >= 1_000_000) {
    const millions = niceRound(rawEur / 1_000_000);
    return `rund ${formatNumberDe(millions)} Millionen Euro`;
  }
  if (rawEur >= 1_000) {
    const thousands = niceRound(rawEur / 1_000);
    return `rund ${formatNumberDe(thousands)} Tausend Euro`;
  }
  return `rund ${formatNumberDe(niceRound(rawEur))} Euro`;
}

function formatNumberDe(n: number): string {
  // German uses "," as decimal separator. Integers stay as-is.
  if (Number.isInteger(n)) return String(n);
  return String(n).replace('.', ',');
}

export interface ConversionReport {
  conversions: number;
}

/**
 * Replace all USD mentions in a German text with rounded EUR equivalents.
 * Idempotent: a second pass leaves already-converted text untouched
 * (because EUR has no Dollar/Mio Dollar/USD markers).
 */
export function convertUsdMentions(text: string): { clean: string; report: ConversionReport } {
  if (!text) return { clean: text, report: { conversions: 0 } };
  let conversions = 0;

  // Pattern 1: German prefix amount: "300 Millionen (US-)Dollar" / "1.2 Mrd. Dollar"
  // Approximators ("rund", "etwa", "ca", "über", "knapp") werden mit-konsumiert,
  // damit sie nicht doppelt erscheinen ("rund rund 275 Millionen Euro").
  // Word-Boundary für Umlaute manuell: `\b` würde an `ü/ö/ä` scheitern (kein
  // ASCII-Word-Char), daher `(?<![a-zäöüß])`.
  const APPROX = '(?:knapp|über|ueber|fast(?:\\s+schon)?|rund|etwa|ca\\.?|circa|gut|nahezu|beinahe|gerade\\s+mal|mehr\\s+als|weniger\\s+als|an\\s+die|schätzungsweise|schaetzungsweise|geschätzt|geschaetzt|geschätzte|geschaetzte)';
  const NUMBER = '(\\d+(?:[.,]\\d+)?)';
  // Erlaubt entweder Ziffern ODER deutsche Zahlwörter (eins, zwei, …, zwanzig,
  // dreißig, …, hundert, tausend) ODER zusammengesetzte Ziffer-Compounds
  // ("sechshunderttausend"). Das letzte Pattern fängt diese als Wort.
  const GERMAN_NUMBER_WORD = '(?:eine?r?|eines|zwei|drei|vier|f[üu]nf|sechs|sieben|acht|neun|zehn|elf|zw[öo]elf|zw[öo]lf|dreizehn|vierzehn|f[üu]nfzehn|sechzehn|siebzehn|achtzehn|neunzehn|zwanzig|drei(?:ß|ss)ig|vierzig|f[üu]nfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend)';
  const NUMBER_OR_WORD = `(\\d+(?:[.,]\\d+)?|${GERMAN_NUMBER_WORD})`;
  const UNIT = '(Mio\\.?|Million(?:en)?|Mrd\\.?|Milliard(?:en?)?)';
  const DOLLAR = '(?:US-?)?Dollar';

  // 1a: "{approx?} 300 Millionen Dollar" / "eine Milliarde Dollar" / "sechs Millionen Dollar"
  text = text.replace(
    new RegExp(`(?<![a-zäöüß])(?:${APPROX}\\s+)?${NUMBER_OR_WORD}\\s+${UNIT}\\s+${DOLLAR}\\b`, 'gi'),
    (_, num, unitWord) => {
      const n = parseGermanNumber(num);
      const unit = detectUnit(unitWord);
      conversions++;
      return formatEur(n, unit);
    },
  );

  // 1a-qual: Qualitative quantifiers ("Hunderte/Dutzende/mehrere/etliche/viele
  // Millionen Dollar"). Hier ist die Zahl unspezifisch — bei diesen
  // Approximationen ist der Kurs irrelevant, also tauschen wir nur das
  // Suffix Dollar→Euro ohne Umrechnung.
  text = text.replace(
    /\b(Hunderte|Dutzende|mehrere(?:n|r)?|etliche(?:n|r)?|viele(?:n|r)?|zahllose(?:n|r)?|hunderte|dutzende)\s+(?:von\s+)?(Millionen?|Milliarden?|Mio\.?|Mrd\.?)\s+(?:US-)?Dollar\b/gi,
    (_, qual, unit) => {
      conversions++;
      return `${qual} ${unit} Euro`;
    },
  );

  // 1a-compound: Hyphenated Dollar-noun compounds like
  // "200-Millionen-Dollar-Actionthriller", "100-Mio-Dollar-Deal"
  text = text.replace(
    /(\d+(?:[.,]\d+)?)[\s-]+(Mio\.?|Million(?:en)?|Mrd\.?|Milliard(?:en?)?)[\s-]+(?:US-)?Dollar(-)/gi,
    (_, num, unitWord, sep) => {
      const n = parseGermanNumber(num);
      const unit = detectUnit(unitWord);
      conversions++;
      const eur = formatEur(n, unit).replace(/^rund\s+/, '');
      return `${eur.replace(/\s+/g, '-')}${sep}`;
    },
  );

  // 1a-hyphen: German Compound "300-Millionen-Dollar-Budget", "300-Mio-Dollar-Deal"
  // Beispiele: "300-Millionen-Budget", "50-Mio.-Vertrag", "1-Milliarden-Investition"
  // Output behält deutsche Hyphenation: "275-Millionen-Euro-Budget".
  text = text.replace(
    /(\d+(?:[.,]\d+)?)[\s-]+(Mio\.?|Million(?:en)?|Mrd\.?|Milliard(?:en?)?)[\s-]+(Budget|Deal|Vertrag|Investition|Produktion|Projekt|Geschäft|Auftrag|Etat)\b/gi,
    (_, num, unitWord, tail) => {
      const n = parseGermanNumber(num);
      const unit = detectUnit(unitWord);
      conversions++;
      // formatEur returns "rund 275 Millionen Euro" — wir zerlegen es in
      // hyphenierte Compound-Form "275-Millionen-Euro-Budget".
      const eur = formatEur(n, unit).replace(/^rund\s+/, '');
      const hyphenated = eur.replace(/\s+/g, '-');
      return `${hyphenated}-${tail}`;
    },
  );

  // Cleanup-Stufe: doppelte Approximator-Prefixe entfernen, die durch
  // verschachtelte Konvertierungen oder Pre-Existing-Approximatoren ohne
  // Umlaut-Match-Support entstanden sind. Beispiel: "über rund 45 Millionen
  // Euro" → "rund 45 Millionen Euro".
  text = text.replace(
    /(?<![a-zäöüß])(über|ueber|knapp|fast|etwa|ca\.?|circa|nahezu|beinahe|gut|schätzungsweise|schaetzungsweise|geschätzt|geschaetzt|mehr\s+als|weniger\s+als)\s+rund\s+/gi,
    'rund ',
  );

  // 1b: "$300 million" / "$1.2 billion" / "$300M" / "$1.2B"
  text = text.replace(
    /\$\s*(\d+(?:[.,]\d+)?)\s*(million|millionen|billion|milliarden|mrd|mio|m|b)\b/gi,
    (_, num, unitWord) => {
      const n = parseGermanNumber(num);
      const unit = detectUnit(unitWord);
      conversions++;
      return formatEur(n, unit);
    },
  );

  // 1c: "$300" (bare dollar sign — small amount)
  text = text.replace(
    /\$\s*(\d+(?:[.,]\d+)?)\b(?!\s*(million|millionen|billion|milliarden|mrd|mio|m|b)\b)/gi,
    (_, num) => {
      const n = parseGermanNumber(num);
      conversions++;
      return formatEur(n, { label: '', factor: 1 });
    },
  );

  // 1d: "300M USD" / "1.2B USD" — inverse order
  text = text.replace(
    /\b(\d+(?:[.,]\d+)?)\s*(million|millionen|billion|milliarden|mrd|mio|m|b)\s+USD\b/gi,
    (_, num, unitWord) => {
      const n = parseGermanNumber(num);
      const unit = detectUnit(unitWord);
      conversions++;
      return formatEur(n, unit);
    },
  );

  // 1e: bare "300 Dollar" (no unit word) — usually small amounts in news
  // Akzeptiert auch deutsche Compound-Zahlwörter wie "sechshunderttausend".
  text = text.replace(
    new RegExp(`(?<![a-zäöüß])(?:${APPROX}\\s+)?(\\d+(?:[.,]\\d+)?|(?:ein|zwei|drei|vier|f[üu]nf|sechs|sieben|acht|neun)?(?:hundert)?(?:tausend))\\s+${DOLLAR}\\b(?!\\s+(?:Mio|Mrd|Million|Milliard))`, 'gi'),
    (_, num) => {
      const n = parseGermanNumber(num);
      if (!Number.isFinite(n)) return _; // safety
      conversions++;
      return formatEur(n, { label: '', factor: 1 });
    },
  );

  // 1f: bare-number + Dollar, plain digits only (fallback)
  text = text.replace(
    new RegExp(`(?<![a-zäöüß])(?:${APPROX}\\s+)?${NUMBER}\\s+${DOLLAR}\\b(?!\\s+(?:Mio|Mrd|Million|Milliard))`, 'gi'),
    (_, num) => {
      const n = parseGermanNumber(num);
      conversions++;
      return formatEur(n, { label: '', factor: 1 });
    },
  );

  return { clean: text, report: { conversions } };
}
