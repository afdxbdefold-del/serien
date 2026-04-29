/**
 * /news hub — shared filter dictionary, query helpers, metadata builders.
 *
 * Sub-routes /news/[filter] reuse this so URL semantics stay consistent:
 *   /news              → all latest published articles
 *   /news/netflix      → series.networks contains Netflix
 *   /news/prime-video  → series.networks contains Prime Video / Amazon
 *   /news/disney-plus  → series.networks contains Disney+
 *   /news/apple-tv     → series.networks contains Apple TV+
 *   /news/trailer      → title matches /trailer|teaser|first look/i
 *   /news/staffel-start → title matches /staffel\s*\d+|season\s*\d+|premiere|start am|kehrt zurück/i
 *   /news/erklaert     → title matches /erklärt|enthüllt|warum|theorie|hintergrund/i  (DE feature angle)
 *   /news/2026-04      → publishedAt within month YYYY-MM
 */

export const SITE_BASE = 'https://serien.de';
export const PAGE_SIZE = 30;
export const SECTION_LABEL = 'Serien-News';

export interface StreamerFilter {
  slug: string;
  label: string;
  networkMatches: string[];   // case-insensitive substring match against series.networks[]
  metaShort: string;          // short label for OG/Twitter
}

export const STREAMERS: StreamerFilter[] = [
  {
    slug: 'netflix',
    label: 'Netflix',
    networkMatches: ['netflix'],
    metaShort: 'Netflix',
  },
  {
    slug: 'prime-video',
    label: 'Prime Video',
    networkMatches: ['prime video', 'amazon prime', 'amazon studios', 'amazon'],
    metaShort: 'Prime Video',
  },
  {
    slug: 'disney-plus',
    label: 'Disney+',
    networkMatches: ['disney+', 'disney plus', 'disney'],
    metaShort: 'Disney+',
  },
  {
    slug: 'apple-tv',
    label: 'Apple TV+',
    networkMatches: ['apple tv+', 'apple tv plus', 'apple tv', 'appletv'],
    metaShort: 'Apple TV+',
  },
];

export interface KindFilter {
  slug: string;
  label: string;
  // Title regex used at query time (case-insensitive)
  titleRegex: RegExp;
  metaShort: string;
}

export const KINDS: KindFilter[] = [
  {
    slug: 'trailer',
    label: 'Trailer & Teaser',
    titleRegex: /\btrailer|teaser|first[\s-]look\b/i,
    metaShort: 'Trailer',
  },
  {
    slug: 'staffel-start',
    label: 'Staffel-Start',
    titleRegex: /\bstaffel\s*\d|season\s*\d|premiere|start am|kehrt zur(ü|ue)ck|comeback\b/i,
    metaShort: 'Staffel-Start',
  },
  {
    slug: 'erklaert',
    label: 'Hintergrund & erklärt',
    titleRegex: /\b(erkl(ä|ae)rt|hintergrund|theorie|warum|wieso|weshalb|wirklich|wahrheit)\b/i,
    metaShort: 'Hintergrund',
  },
];

/**
 * Determines whether a slug is a valid /news sub-route.
 * Returns the filter type so the page handler can branch.
 */
export function classifyFilter(slug: string):
  | { kind: 'streamer'; entry: StreamerFilter }
  | { kind: 'kind'; entry: KindFilter }
  | { kind: 'month'; year: number; month: number }
  | null {
  const lower = slug.toLowerCase();

  const streamer = STREAMERS.find((s) => s.slug === lower);
  if (streamer) return { kind: 'streamer', entry: streamer };

  const kind = KINDS.find((k) => k.slug === lower);
  if (kind) return { kind: 'kind', entry: kind };

  // Match YYYY-MM (2020-01 .. 2030-12)
  const m = /^(\d{4})-(\d{2})$/.exec(lower);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12) {
      return { kind: 'month', year, month };
    }
  }

  return null;
}

/* ────────────────────────────────────────────────────────────────────
 *  Title / description / canonical builders
 * ──────────────────────────────────────────────────────────────────── */

export function buildHubTitle(): string {
  return 'Serien-News: Alle aktuellen Meldungen im Überblick';
}

export function buildHubMetaTitle(): string {
  return 'Serien-News heute: Aktuelle Meldungen, Trailer & Streaming-Updates | serien.de';
}

export function buildHubDescription(): string {
  return (
    'Alle aktuellen Serien-News auf einen Blick: Neue Staffeln, Trailer, ' +
    'Streaming-Starts und Hintergründe von Netflix, Prime Video, Apple TV+ und Disney+. ' +
    'Täglich aktualisiert auf serien.de.'
  );
}

export function buildStreamerH1(s: StreamerFilter): string {
  return `${s.label} Serien-News: Alle aktuellen Updates`;
}
export function buildStreamerMetaTitle(s: StreamerFilter): string {
  return `${s.label} Serien-News heute: Neue Staffeln, Trailer & Updates | serien.de`;
}
export function buildStreamerDescription(s: StreamerFilter): string {
  return (
    `Alle aktuellen ${s.label} Serien-News: Neue Staffeln, Trailer, Starttermine ` +
    `und wichtige Updates im Überblick. Täglich gepflegt auf serien.de.`
  );
}

export function buildKindH1(k: KindFilter): string {
  return `${k.label}: Alle aktuellen Serien-News`;
}
export function buildKindMetaTitle(k: KindFilter): string {
  return `${k.label} – Aktuelle Serien-News & Updates | serien.de`;
}
export function buildKindDescription(k: KindFilter): string {
  return (
    `Alle aktuellen Serien-News zum Thema „${k.label}". ` +
    `Trailer, Staffel-Starts, Hintergründe und Streaming-Updates auf serien.de.`
  );
}

const MONTH_NAMES_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export function buildMonthH1(year: number, month: number): string {
  return `Serien-News ${MONTH_NAMES_DE[month - 1]} ${year}`;
}
export function buildMonthMetaTitle(year: number, month: number): string {
  return `Serien-News ${MONTH_NAMES_DE[month - 1]} ${year}: Trailer, Staffeln & Updates | serien.de`;
}
export function buildMonthDescription(year: number, month: number): string {
  return (
    `Alle Serien-News aus ${MONTH_NAMES_DE[month - 1]} ${year}: ` +
    `Neue Staffeln, Trailer, Streaming-Starts und Hintergründe im chronologischen Überblick.`
  );
}

/* ────────────────────────────────────────────────────────────────────
 *  Filter-bar links shown on every news page
 * ──────────────────────────────────────────────────────────────────── */

export interface FilterPill {
  label: string;
  href: string;
  active: boolean;
}

export function buildFilterPills(currentSlug: string | null): FilterPill[] {
  const pills: FilterPill[] = [
    { label: 'Alle News', href: '/news', active: currentSlug === null },
  ];
  for (const s of STREAMERS) {
    pills.push({ label: s.label, href: `/news/${s.slug}`, active: currentSlug === s.slug });
  }
  for (const k of KINDS) {
    pills.push({ label: k.label, href: `/news/${k.slug}`, active: currentSlug === k.slug });
  }
  return pills;
}
