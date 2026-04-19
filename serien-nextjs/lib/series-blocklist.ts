/**
 * Series / Topic Blocklist (DB-backed, cached)
 *
 * Entries live in the `blocklist_entries` table and are managed via /admin/blocklist.
 * Loaded once per process + cached for 60 s; mutations call `invalidateBlocklistCache()`.
 *
 * Match levels:
 *   • URL substring  (source url)         — checked during scraping
 *   • Title keyword  (headline substring) — checked during scraping + pipeline start
 *   • TMDB ID        (resolved series)    — checked post-TMDB as safety net
 *
 * On any hit we call `recordBlocklistHit(entryId)` (fire-and-forget) to increment
 * the entry's `hits` + `lastHitAt` for the admin dashboard.
 */
import prisma from './prisma';

export interface BlockedSeries {
  id: string;
  label: string;
  tmdbIds: number[];
  urlPatterns: string[];     // lowercase substring match
  titleKeywords: string[];   // lowercase substring match
  enabled: boolean;
}

// ─── In-process cache ──────────────────────────────────────────────────────
let cache: BlockedSeries[] | null = null;
let cacheExpires = 0;
const TTL_MS = 60_000;

async function getEntries(): Promise<BlockedSeries[]> {
  if (cache && Date.now() < cacheExpires) return cache;
  const rows = await prisma.blocklist_entries.findMany({
    where: { enabled: true },
    select: { id: true, label: true, tmdbIds: true, urlPatterns: true, titleKeywords: true, enabled: true },
  });
  cache = rows.map((r) => ({
    id: r.id,
    label: r.label,
    tmdbIds: r.tmdbIds || [],
    urlPatterns: (r.urlPatterns || []).map((s) => s.toLowerCase()),
    titleKeywords: (r.titleKeywords || []).map((s) => s.toLowerCase()),
    enabled: r.enabled,
  }));
  cacheExpires = Date.now() + TTL_MS;
  return cache;
}

export function invalidateBlocklistCache() {
  cache = null;
  cacheExpires = 0;
}

// ─── Fire-and-forget hit recorder ──────────────────────────────────────────
export function recordBlocklistHit(entryId: string) {
  prisma.blocklist_entries
    .update({
      where: { id: entryId },
      data: { hits: { increment: 1 }, lastHitAt: new Date() },
    })
    .catch(() => { /* best-effort */ });
}

// ─── Match helpers ─────────────────────────────────────────────────────────
export async function blockReasonForSource(
  title: string,
  url: string,
): Promise<BlockedSeries | null> {
  const t = (title || '').toLowerCase();
  const u = (url || '').toLowerCase();
  const entries = await getEntries();
  for (const b of entries) {
    if (b.urlPatterns.some((p) => u.includes(p))) { recordBlocklistHit(b.id); return b; }
    if (b.titleKeywords.some((k) => t.includes(k))) { recordBlocklistHit(b.id); return b; }
  }
  return null;
}

export async function blockReasonForTmdbId(
  tmdbId: number | null | undefined,
): Promise<BlockedSeries | null> {
  if (tmdbId == null) return null;
  const entries = await getEntries();
  for (const b of entries) {
    if (b.tmdbIds.includes(tmdbId)) { recordBlocklistHit(b.id); return b; }
  }
  return null;
}

export async function blockReasonForSeriesTitle(
  seriesTitle: string | null | undefined,
): Promise<BlockedSeries | null> {
  if (!seriesTitle) return null;
  const s = seriesTitle.toLowerCase();
  const entries = await getEntries();
  for (const b of entries) {
    if (b.titleKeywords.some((k) => s.includes(k))) { recordBlocklistHit(b.id); return b; }
  }
  return null;
}
