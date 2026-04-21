/**
 * STORY FINGERPRINT
 *
 * Stable SHA1 hash over the normalized "hard facts" of an article.
 * Two articles covering the same story from different publishers (Deadline,
 * Variety, Hollywood Reporter, …) produce the same fingerprint — even when
 * headline and prose differ.
 *
 * Inputs we hash:
 *   - series name (lowercased, diacritics stripped)
 *   - season numbers (sorted, deduped)
 *   - episode numbers (sorted, deduped)
 *   - people names (lowercased, sorted, deduped)
 *   - networks/platforms (lowercased, sorted, deduped)
 *   - top 3 key statements (lowercased, sorted, alpha-stripped, deduped)
 *   - release dates (ISO, sorted)
 *
 * We deliberately do NOT hash the headline or full text — those vary too much
 * between publishers.
 */
import { createHash } from 'crypto';
import type { ExtractedFacts } from './fact-extractor';

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacritics
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normList(arr: string[] | undefined | null, max = 20): string[] {
  if (!arr?.length) return [];
  return Array.from(new Set(arr.map(norm).filter(Boolean))).sort().slice(0, max);
}

const STATEMENT_STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'und', 'oder', 'aber', 'wie', 'als', 'dass', 'weil', 'denn', 'wenn', 'ist', 'sind', 'war',
  'waren', 'hat', 'habe', 'haben', 'hatte', 'hatten', 'wird', 'werden', 'wurde', 'wurden',
  'sein', 'seine', 'ihrer', 'seinen', 'seiner', 'für', 'von', 'vom', 'zu', 'zum', 'zur',
  'mit', 'bei', 'nach', 'aus', 'auf', 'in', 'im', 'an', 'am', 'um', 'über',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'has', 'have', 'had', 'will', 'be',
  'been', 'being', 'of', 'to', 'for', 'with', 'on', 'at', 'by', 'from',
]);

function normStatementTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STATEMENT_STOPWORDS.has(t));
}

export interface FingerprintBundle {
  fingerprint: string;
  components: {
    series: string[];
    seasons: number[];
    episodes: number[];
    people: string[];
    platforms: string[];
    statements: string[];
    dates: string[];
  };
}

export function computeStoryFingerprint(facts: ExtractedFacts | null | undefined): FingerprintBundle | null {
  if (!facts) return null;

  const series = normList(facts.series_names);
  const people = normList(facts.people_names);
  const platforms = normList(facts.networks_platforms);
  const dates = normList(facts.release_dates);

  const seasons = Array.from(new Set(facts.season_numbers ?? []))
    .filter((n): n is number => typeof n === 'number' && !Number.isNaN(n))
    .sort((a, b) => a - b);

  const episodes = Array.from(new Set(facts.episode_numbers ?? []))
    .filter((n): n is number => typeof n === 'number' && !Number.isNaN(n))
    .sort((a, b) => a - b);

  // Extract signal tokens from each key statement, dedupe globally, sort.
  // This is robust against "Die Produktion" vs "Produktion", punctuation, word order.
  const statementTokens = new Set<string>();
  for (const s of facts.key_statements ?? []) {
    for (const t of normStatementTokens(s)) statementTokens.add(t);
  }
  const statements = Array.from(statementTokens).sort().slice(0, 12);

  // Signal strength check: if we have almost nothing, no meaningful fingerprint.
  const signalCount =
    series.length + people.length + platforms.length + seasons.length + episodes.length + statements.length;
  if (signalCount < 2) return null;

  const payload = JSON.stringify({ series, seasons, episodes, people, platforms, statements, dates });
  const fingerprint = createHash('sha1').update(payload).digest('hex');

  return {
    fingerprint,
    components: { series, seasons, episodes, people, platforms, statements, dates },
  };
}
