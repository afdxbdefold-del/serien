/**
 * Shared filter dictionaries + helpers for /serien and sub-routes.
 *
 * Sub-routes (/serien/genre/[genre] etc.) reuse this so URL semantics stay consistent.
 */

export interface SerienFilters {
  genre?: string;
  streamer?: string;
  jahrzehnt?: string;
  status?: string;
  sort?: string;
  page?: string;
}

export const SITE_BASE = 'https://serien.de';
export const PAGE_SIZE = 50;

export const STREAMERS: { slug: string; label: string; matches: string[] }[] = [
  { slug: 'netflix', label: 'Netflix', matches: ['netflix'] },
  { slug: 'prime-video', label: 'Prime Video', matches: ['prime', 'amazon'] },
  { slug: 'disney-plus', label: 'Disney+', matches: ['disney'] },
  { slug: 'apple-tv', label: 'Apple TV+', matches: ['apple'] },
  { slug: 'wow', label: 'WOW', matches: ['wow'] },
  { slug: 'sky', label: 'Sky', matches: ['sky'] },
  { slug: 'paramount-plus', label: 'Paramount+', matches: ['paramount'] },
  { slug: 'rtl-plus', label: 'RTL+', matches: ['rtl'] },
  { slug: 'joyn', label: 'Joyn', matches: ['joyn'] },
  { slug: 'ard', label: 'ARD', matches: ['ard', 'das erste'] },
];

export const GENRES: { slug: string; label: string }[] = [
  { slug: 'action-adventure', label: 'Action & Adventure' },
  { slug: 'animation', label: 'Animation' },
  { slug: 'comedy', label: 'Komödie' },
  { slug: 'crime', label: 'Krimi' },
  { slug: 'documentary', label: 'Dokumentation' },
  { slug: 'drama', label: 'Drama' },
  { slug: 'family', label: 'Familie' },
  { slug: 'kids', label: 'Kinder' },
  { slug: 'mystery', label: 'Mystery' },
  { slug: 'news', label: 'News' },
  { slug: 'reality', label: 'Reality' },
  { slug: 'sci-fi-fantasy', label: 'Sci-Fi & Fantasy' },
  { slug: 'soap', label: 'Soap' },
  { slug: 'talk', label: 'Talk' },
  { slug: 'war-politics', label: 'War & Politics' },
  { slug: 'western', label: 'Western' },
];

export const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950];

export const SORT_OPTIONS: { slug: string; label: string }[] = [
  { slug: 'popularity', label: 'Beliebteste' },
  { slug: 'newest', label: 'Neueste' },
  { slug: 'rating', label: 'Bewertung' },
  { slug: 'alphabetical', label: 'A–Z' },
];

export const STATUS_FILTERS: { slug: string; label: string; values: string[] }[] = [
  { slug: 'returning', label: 'Laufend', values: ['Returning Series', 'In Production'] },
  { slug: 'ended', label: 'Abgeschlossen', values: ['Ended'] },
  { slug: 'canceled', label: 'Abgesetzt', values: ['Canceled'] },
];

/**
 * Build a clean URL given current filters + an override.
 * Picks the BEST canonical path:
 *  - If exactly one of (genre, streamer, jahrzehnt) is set → /serien/[primary]/[slug]
 *  - Otherwise → /serien?... query string
 *
 * `forcePrimary` lets the caller pin the path style (e.g. inside a sub-route, links should
 * stay in the sub-route's path family when toggling secondary filters).
 */
export function buildHref(
  current: SerienFilters,
  override: Partial<SerienFilters>,
  options?: { forcePrimary?: 'genre' | 'streamer' | 'jahrzehnt' | 'none' }
): string {
  const merged: SerienFilters = { ...current, ...override };
  if (override.page === undefined) delete merged.page; // reset page when filters change

  // Decide primary path segment
  const primaryKey = options?.forcePrimary ?? choosePrimary(merged);

  let base = '/serien';
  const restParams = new URLSearchParams();

  if (primaryKey === 'genre' && merged.genre) {
    base = `/serien/genre/${merged.genre}`;
  } else if (primaryKey === 'streamer' && merged.streamer) {
    base = `/serien/streamer/${merged.streamer}`;
  } else if (primaryKey === 'jahrzehnt' && merged.jahrzehnt) {
    base = `/serien/jahrzehnt/${merged.jahrzehnt}er`;
  }

  // Add remaining filters as query string (skipping the one absorbed into the path)
  const skipKeys = new Set<keyof SerienFilters>();
  if (base.startsWith('/serien/genre/')) skipKeys.add('genre');
  if (base.startsWith('/serien/streamer/')) skipKeys.add('streamer');
  if (base.startsWith('/serien/jahrzehnt/')) skipKeys.add('jahrzehnt');

  (Object.entries(merged) as [keyof SerienFilters, string | undefined][]).forEach(([k, v]) => {
    if (!v) return;
    if (skipKeys.has(k)) return;
    restParams.set(k, v);
  });

  const qs = restParams.toString();
  return qs ? `${base}?${qs}` : base;
}

function choosePrimary(f: SerienFilters): 'genre' | 'streamer' | 'jahrzehnt' | 'none' {
  // priority order: genre > streamer > jahrzehnt
  if (f.genre) return 'genre';
  if (f.streamer) return 'streamer';
  if (f.jahrzehnt) return 'jahrzehnt';
  return 'none';
}

export function buildTitle(f: SerienFilters): string {
  const parts: string[] = ['Alle Serien'];
  if (f.genre) {
    const label = GENRES.find((g) => g.slug === f.genre)?.label;
    if (label) parts[0] = `${label}-Serien`;
  }
  if (f.streamer) {
    const label = STREAMERS.find((s) => s.slug === f.streamer)?.label;
    if (label) parts.push(`auf ${label}`);
  }
  if (f.jahrzehnt) parts.push(`aus den ${f.jahrzehnt}er Jahren`);
  if (f.status) {
    const label = STATUS_FILTERS.find((s) => s.slug === f.status)?.label;
    if (label) parts.push(`(${label})`);
  }
  return parts.join(' ');
}

export function buildDescription(f: SerienFilters): string {
  const title = buildTitle(f);
  return (
    `${title} im Überblick — finde deine nächste Lieblingsserie nach Genre, Streamer und Jahrzehnt. ` +
    `Mit Bewertungen, Staffel-Infos und aktuellen News auf serien.de.`
  );
}
