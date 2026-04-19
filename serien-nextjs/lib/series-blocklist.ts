/**
 * Series/Topic Blocklist
 *
 * Prevents future articles about listed series/topics from entering the pipeline.
 * Checked at three levels:
 *   1. news-scraper — URL-pattern + title-keyword match (pre-fetch, saves LLM cost)
 *   2. pipeline-v2 — post-classification safety net on TMDB-ID + Series-Title
 *   3. admin /api/admin/pipeline — same safety net for single-article trigger
 *
 * To block a new series, add entries to BLOCKED_SERIES.
 * Matching is case-insensitive; URL patterns are substring-matched.
 */
export interface BlockedSeries {
  /** Human-readable label for logs */
  label: string;
  /** TMDB IDs that identify this series (most reliable signal) */
  tmdbIds?: number[];
  /** Lowercase substrings to search in URL (source URL) */
  urlPatterns?: string[];
  /** Lowercase substrings to search in title (headline) */
  titleKeywords?: string[];
}

export const BLOCKED_SERIES: BlockedSeries[] = [
  {
    label: 'Jeopardy! (US Game Show)',
    tmdbIds: [2912, 103081], // Jeopardy! + Celebrity Jeopardy!
    urlPatterns: ['/jeopardy', '-jeopardy-', 'jeopardy!'],
    titleKeywords: ['jeopardy', 'ken jennings', 'mayim bialik'],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Match helpers — return the first matching blocklist entry or null
// ──────────────────────────────────────────────────────────────────────────
export function blockReasonForSource(
  title: string,
  url: string,
): BlockedSeries | null {
  const t = (title || '').toLowerCase();
  const u = (url || '').toLowerCase();
  for (const b of BLOCKED_SERIES) {
    if (b.urlPatterns?.some((p) => u.includes(p.toLowerCase()))) return b;
    if (b.titleKeywords?.some((k) => t.includes(k.toLowerCase()))) return b;
  }
  return null;
}

export function blockReasonForTmdbId(tmdbId: number | null | undefined): BlockedSeries | null {
  if (tmdbId == null) return null;
  for (const b of BLOCKED_SERIES) {
    if (b.tmdbIds?.includes(tmdbId)) return b;
  }
  return null;
}

export function blockReasonForSeriesTitle(seriesTitle: string | null | undefined): BlockedSeries | null {
  if (!seriesTitle) return null;
  const s = seriesTitle.toLowerCase();
  for (const b of BLOCKED_SERIES) {
    if (b.titleKeywords?.some((k) => s.includes(k.toLowerCase()))) return b;
  }
  return null;
}
