/**
 * "Ende erklärt" headline format enforcement.
 *
 * Mandatory pattern (requested by the editor):
 *   "Das Ende von <Serie> <Staffel/Episode/Film> erklärt: <short suffix>"
 *
 * Any generated ending-explained headline that does not match the prefix
 * is mechanically rewritten to comply. Used both by the one-shot demo
 * script and the main news pipeline.
 */

/**
 * Matches anything that already starts with "Das Ende von … erklärt:".
 * Umlauts and the optional space before the colon must be tolerated.
 */
export const ENDE_ERKLAERT_PREFIX_REGEX = /^das\s+ende\s+von\s+.+?\s+erklärt\s*:/i;

export interface EnforceEndeInput {
  headline: string;
  seriesTitle: string;
  episodeType?: 'finale' | 'episode' | 'standalone' | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}

/**
 * Returns a headline guaranteed to match the mandatory ending-explained
 * format. Idempotent — re-running on an already-compliant headline is a no-op.
 */
export function enforceEndeErklaertFormat(input: EnforceEndeInput): string {
  const { headline, seriesTitle, episodeType, seasonNumber, episodeNumber } = input;
  if (ENDE_ERKLAERT_PREFIX_REGEX.test(headline)) return headline;

  const unit =
    episodeType === 'finale' && seasonNumber
      ? `Staffel ${seasonNumber}`
      : episodeType === 'episode' && episodeNumber
        ? `Episode ${episodeNumber}`
        : episodeType === 'standalone'
          ? 'Film'
          : seasonNumber
            ? `Staffel ${seasonNumber}`
            : '';
  const prefix = unit
    ? `Das Ende von ${seriesTitle} ${unit} erklärt:`
    : `Das Ende von ${seriesTitle} erklärt:`;

  // Try to salvage a short, concrete suffix from the LLM output. Strip any
  // existing "<something>:" prefix and take up to 10 words from the tail.
  const tail = headline.replace(/^[^:]+:\s*/, '').trim();
  const suffix = tail.split(/\s+/).filter(Boolean).slice(0, 10).join(' ');
  return suffix ? `${prefix} ${suffix}` : prefix;
}

/**
 * Detect ending-explained intent from a URL or source title.
 * Used by the pipeline to decide whether to route through the dedicated
 * generator + headline-format enforcement.
 */
export function isEndingExplainedSource(url: string, title?: string): boolean {
  if (/ending-explained/i.test(url || '')) return true;
  if (/ending\s+explained/i.test(title || '')) return true;
  return false;
}

/**
 * Guess episode type + season/episode numbers from a URL slug.
 * Example: "stranger-things-s4-ending-explained" → season 4, type=finale.
 */
export function parseEndingExplainedMetaFromUrl(url: string): {
  episodeType: 'finale' | 'episode' | 'standalone';
  seasonNumber: number | null;
  episodeNumber: number | null;
} {
  const u = (url || '').toLowerCase();
  // season-N-ending-explained | s0?N-ending-explained | -sN-ending-explained
  const season = u.match(/(?:^|[-_/])season-(\d+)/) || u.match(/(?:^|[-_/])s0?(\d+)(?=[-_/])/);
  const epi = u.match(/(?:^|[-_/])episode-(\d+)/) || u.match(/(?:^|[-_/])e0?(\d+)(?=[-_/])/);
  const seasonNumber = season ? Number(season[1]) : null;
  const episodeNumber = epi ? Number(epi[1]) : null;
  if (episodeNumber) return { episodeType: 'episode', seasonNumber, episodeNumber };
  if (seasonNumber) return { episodeType: 'finale', seasonNumber, episodeNumber: null };
  return { episodeType: 'standalone', seasonNumber: null, episodeNumber: null };
}
