/** Source-level newsroom policy, independent of SEO scores or provider names. */
export const NEWS_SOURCE_MAX_AGE_MS = 72 * 60 * 60 * 1000;

export function isNewsClassification(classification: string): boolean {
  return classification === 'SINGLE_SERIES_NEWS' || classification === 'PERSONALITY_NEWS';
}

/** Match observed TMDB display/original names, never a single common word. */
export function matchesResolvedSeries(primaryName: string, names: string[]): boolean {
  const normalize = (text: string) => text.normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const primary = normalize(primaryName);
  return Boolean(primary) && names.some(name => normalize(name) === primary);
}

export function newsSourceIsFresh(sourceDate: Date | null, now = new Date()): boolean {
  if (!sourceDate) return false;
  const sourceTime = sourceDate.getTime();
  const currentTime = now.getTime();
  return Number.isFinite(sourceTime) && Number.isFinite(currentTime)
    && sourceTime <= currentTime + 3_600_000
    && currentTime - sourceTime <= NEWS_SOURCE_MAX_AGE_MS;
}

/** Classifier must return the actual source title, not an associated show's name.
 * Scan the complete source. One shared word ("Space") is not a series match.
 */
export function sourceMentionsSeries(series: string, title: string, fullText: string): boolean {
  const normalize = (text: string) => text.normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const name = normalize(series);
  if (!name) return false;
  return ` ${normalize(`${title} ${fullText}`)} `.includes(` ${name} `);
}
