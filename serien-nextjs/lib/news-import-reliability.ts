/** Shared, side-effect-free policy for the HTTP cron and optional news worker. */
export const DEFAULT_NEWS_LIMIT = 5;
export const DEFAULT_NEWS_BUDGET_MS = 210_000;
export const SOURCE_TIMEOUT_MS = 20_000;

export function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export interface PreviousNewsAttempt {
  status: string;
  errorStep: string | null;
  errorMessage?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
}

const PERMANENT_STEPS = new Set([
  'multi-series-skip', 'blocklist-source', 'blocklist-tmdb',
  'genre-out-of-scope', 'topic-out-of-scope', 'topic-age-check', 'source-age-check',
  'primary-series-mismatch', 'duplicate-llm',
  'duplicate-jaccard-title', 'duplicate-core-event', 'duplicate-fingerprint',
  'duplicate-url', 'unreleased-project', 'sammel-recap',
  'plagiarism-similar-article', 'us-streaming-only', 'per-series-cap',
]);

export function isProviderFailure(message = ''): boolean {
  return /(?:Provider\/network unavailable|rate.?limit|quota|credits?|billing|timeout|timed out|ECONN|ENOTFOUND|EAI_AGAIN|overloaded|service unavailable|fetch failed|authentication|api.?key)/i.test(message)
    || /(?:^\s*(?:\[[^\]]+\]\s*)?|\b(?:http|status|statusCode|response|error|code)[\s"':=]*)(?:401|402|403|429|5\d\d)\b/i.test(message);
}

/** Infrastructure failures cool down; they never condemn a story for seven days. */
export function candidateRetryReason(attempts: PreviousNewsAttempt[], now = Date.now()): string | null {
  const hour = 60 * 60 * 1000;
  const recent = attempts.filter((attempt) => now - attempt.startedAt.getTime() < 7 * 24 * hour)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  if (recent.some((attempt) => attempt.status === 'success' && now - attempt.startedAt.getTime() < 24 * hour)) {
    return 'recent-success';
  }
  if (recent.some((attempt) => attempt.status === 'running' && now - attempt.startedAt.getTime() < hour)) {
    return 'already-running';
  }
  const failures = recent.filter((attempt) => attempt.status === 'failed');
  if (failures.some((attempt) => PERMANENT_STEPS.has(attempt.errorStep || '') && !isProviderFailure(attempt.errorMessage || ''))) {
    return 'editorial-rejection';
  }
  if (failures.filter((attempt) => attempt.errorStep === 'classification'
    && !isProviderFailure(attempt.errorMessage || '')
    && now - attempt.startedAt.getTime() < 72 * hour).length >= 2) {
    return 'repeated-classification-rejection';
  }
  const latest = failures[0];
  if (!latest) return null;
  const cooldown = failures.length === 1 ? 15 * 60_000 : failures.length === 2 ? hour : 6 * hour;
  const failedAt = (latest.completedAt || latest.startedAt).getTime();
  return now - failedAt < cooldown ? 'retry-cooldown' : null;
}

/** Limit only after history filtering and alternate sources to prevent starvation. */
export function selectNewsCandidates<T extends { source: string; url: string }>(articles: T[], limit: number, rotation = 0): T[] {
  const queues = new Map<string, T[]>();
  const seen = new Set<string>();
  for (const article of articles) {
    if (seen.has(article.url)) continue;
    seen.add(article.url);
    const queue = queues.get(article.source) || [];
    queue.push(article);
    queues.set(article.source, queue);
  }
  const selected: T[] = [];
  const sourceQueues = Array.from(queues.values());
  const offset = sourceQueues.length ? rotation % sourceQueues.length : 0;
  const orderedQueues = sourceQueues.slice(offset).concat(sourceQueues.slice(0, offset));
  while (selected.length < limit) {
    let found = false;
    for (const queue of orderedQueues) {
      const article = queue.shift();
      if (article) {
        selected.push(article);
        found = true;
      }
      if (selected.length === limit) break;
    }
    if (!found) break;
  }
  return selected;
}

export function safeNewsError(error: unknown): string {
  // External error messages can include request URLs, authorization headers or
  // connection strings. Persist only an allowlisted category in scheduler logs.
  const message = error instanceof Error ? error.message : String(error);
  if (isProviderFailure(message)) return 'Provider/network unavailable; inspect private provider diagnostics';
  if (/lease|lock/i.test(message)) return 'News import lease unavailable';
  if (/timeout|aborted/i.test(message)) return 'News source request timed out';
  return 'News import failed; inspect the associated pipeline run';
}
