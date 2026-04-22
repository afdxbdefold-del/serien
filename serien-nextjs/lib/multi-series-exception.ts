/**
 * MULTI-SERIES EXCEPTION DETECTOR
 *
 * By default we skip MULTI_SERIES_EDITORIAL articles — they have weak Discover
 * performance and high mis-tagging risk (as seen with the Wednesday/Hulu bug).
 *
 * BUT some multi-series articles are actually ONE event that happens to touch
 * several shows. We allow those through, tagged as SEARCH_ONLY so they rank
 * in Google Search without polluting News/Discover:
 *
 *   1. DEATH       — actor/creator died, was in multiple series
 *   2. PLATFORM    — strike, shutdown, merger, outage affecting many shows
 *   3. AWARD       — ceremony where multiple series won/were nominated
 *
 * Detection is pattern-based (no extra LLM cost). We require the trigger to
 * appear in the title OR the first 1000 characters of the source, so incidental
 * mentions deeper in the text don't leak past the filter.
 */

export type MultiSeriesException =
  | { allowed: false }
  | { allowed: true; trigger: 'DEATH' | 'PLATFORM' | 'AWARD'; matchedPhrase: string };

const DEATH_PATTERNS: RegExp[] = [
  /(?:^|[^a-zäöüß])(gestorben|verstorben|tot aufgefunden|stirbt mit \d{1,3})(?=[^a-zäöüß]|$)/i,
  /(?:^|[^a-zäöüß])(ist tot)(?=[^a-zäöüß]|$)/i,
  /(?:^|[^a-zäöüß])(todesnachricht|nachruf|trauer um)(?=[^a-zäöüß]|$)/i,
  /(?:^|[^a-zäöüß])(dies(?:ed|es|ing)?\s+at\s+\d{1,3})(?=[^a-z0-9]|$)/i,
  /(?:^|[^a-zäöüß])(passes away|has died|death of)(?=[^a-zäöüß]|$)/i,
  /(?:^|[^a-zäöüß])(obituary|remembered)(?=[^a-zäöüß]|$)/i,
];

const PLATFORM_PATTERNS: RegExp[] = [
  /(?:^|[^a-zäöüß])(streik|writers?\s+strike|sag-aftra|wga\s+strike)(?=[^a-zäöüß]|$)/i,
  /(?:^|[^a-zäöüß])(insolven[tz]|konkurs|shutdown|stellt den betrieb ein)(?=[^a-zäöüß]|$)/i,
  /(?:^|[^a-zäöüß])(übernahme|übernimmt|takeover|acquisition|fusion|merger|acquired|kauft|buys)(?=[^a-zäöüß]|$)/i,
  /(?:^|[^a-zäöüß])(layoffs?|massenentlassung|entlässt hunderte)(?=[^a-zäöüß]|$)/i,
  /(?:^|[^a-zäöüß])(komplettausfall|global outage|serverausfall)(?=[^a-zäöüß]|$)/i,
];

const AWARD_PATTERNS: RegExp[] = [
  /(?:^|[^a-zäöüß])(emmy|emmys|golden globe|golden globes|sag awards?|critics' choice|peabody)(?=[^a-zäöüß]|$)/i,
  /(?:^|[^a-zäöüß])(grimme-preis|deutscher fernsehpreis|goldene kamera|bayerischer fernsehpreis)(?=[^a-zäöüß]|$)/i,
  /(?:^|[^a-zäöüß])(preisträger|gewinner der|hat.*gewonnen|won best|took home)(?=[^a-zäöüß]|$)/i,
  /(?:^|[^a-zäöüß])(nominier(?:ung|t|te|ten))(?=[^a-zäöüß]|$)/i,
];

/**
 * Check a multi-series article for the 3 allowed exception triggers.
 */
export function detectMultiSeriesException(input: {
  title: string;
  content: string;
}): MultiSeriesException {
  const title = input.title || '';
  const head = (input.content || '').slice(0, 1000);
  const haystack = `${title}\n${head}`;

  for (const rx of DEATH_PATTERNS) {
    const m = haystack.match(rx);
    if (m) return { allowed: true, trigger: 'DEATH', matchedPhrase: m[0] };
  }
  for (const rx of PLATFORM_PATTERNS) {
    const m = haystack.match(rx);
    if (m) return { allowed: true, trigger: 'PLATFORM', matchedPhrase: m[0] };
  }
  for (const rx of AWARD_PATTERNS) {
    const m = haystack.match(rx);
    if (m) return { allowed: true, trigger: 'AWARD', matchedPhrase: m[0] };
  }

  return { allowed: false };
}
