const EARLIEST_PLAUSIBLE_DATE = Date.UTC(2000, 0, 1);
const MAX_FUTURE_SKEW_MS = 60 * 60 * 1000;

/** Parse a structured publisher timestamp without guessing from article prose. */
export function parseSourcePublishedAt(
  value: string | Date | null | undefined,
  now = new Date(),
): Date | null {
  if (!value) return null;

  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  const timestamp = parsed.getTime();

  if (!Number.isFinite(timestamp)) return null;
  if (timestamp < EARLIEST_PLAUSIBLE_DATE) return null;
  if (timestamp > now.getTime() + MAX_FUTURE_SKEW_MS) return null;

  return parsed;
}

const ARTICLE_JSON_LD_TYPES = new Set(['Article', 'BlogPosting', 'NewsArticle']);

function hasArticleJsonLdType(value: unknown): boolean {
  const types = Array.isArray(value) ? value : [value];

  return types.some((type) => {
    if (typeof type !== 'string') return false;
    const normalized = type.split(/[\/#]/).pop();
    return Boolean(normalized && ARTICLE_JSON_LD_TYPES.has(normalized));
  });
}

/** Walk JSON-LD shapes and return a date directly declared by an article node. */
export function findJsonLdPublishedAt(value: unknown, now = new Date()): Date | null {
  if (!value || typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findJsonLdPublishedAt(entry, now);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  if (hasArticleJsonLdType(record['@type'])) {
    const direct = parseSourcePublishedAt(
      typeof record.datePublished === 'string' ? record.datePublished : null,
      now,
    );
    if (direct) return direct;
  }

  for (const nested of Object.values(record)) {
    const found = findJsonLdPublishedAt(nested, now);
    if (found) return found;
  }

  return null;
}
