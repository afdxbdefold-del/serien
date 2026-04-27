/**
 * /serien — Comprehensive series catalogue page
 *
 * Mirrors the editorial layout of kino.de/filme but for series.
 * Server-rendered for SEO. Supports filtering via query params:
 *   ?genre=drama  ?streamer=netflix  ?jahrzehnt=2020  ?status=returning
 *   ?sort=popularity|newest|alphabetical|rating
 *   ?page=1
 */
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { Star, Calendar, Tv, Filter as FilterIcon } from 'lucide-react';

const SITE_BASE = 'https://serien.de';
const PAGE_SIZE = 50;

// Top 10 streamers (DE market). Slugs are stable for URLs.
const STREAMERS: { slug: string; label: string; matches: string[] }[] = [
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

const GENRES: { slug: string; label: string }[] = [
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

const GENRE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  GENRES.flatMap((g) => [
    [g.slug, g.label],
    [g.label.toLowerCase(), g.slug],
  ])
);

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950];

const SORT_OPTIONS: { slug: string; label: string }[] = [
  { slug: 'popularity', label: 'Beliebteste' },
  { slug: 'newest', label: 'Neueste' },
  { slug: 'rating', label: 'Bewertung' },
  { slug: 'alphabetical', label: 'A–Z' },
];

const STATUS_FILTERS: { slug: string; label: string; values: string[] }[] = [
  { slug: 'returning', label: 'Laufend', values: ['Returning Series', 'In Production'] },
  { slug: 'ended', label: 'Abgeschlossen', values: ['Ended'] },
  { slug: 'canceled', label: 'Abgesetzt', values: ['Canceled'] },
];

interface SearchParams {
  genre?: string;
  streamer?: string;
  jahrzehnt?: string;
  status?: string;
  sort?: string;
  page?: string;
}

function buildHref(current: SearchParams, override: Partial<SearchParams>): string {
  const merged: SearchParams = { ...current, ...override };
  // Reset page when filter changes (unless explicitly setting page)
  if (override.page === undefined) delete merged.page;
  // Remove falsy values
  const params = new URLSearchParams();
  Object.entries(merged).forEach(([k, v]) => {
    if (v) params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `/serien?${qs}` : '/serien';
}

function buildTitle(sp: SearchParams): string {
  const parts: string[] = ['Alle Serien'];
  if (sp.genre) {
    const label = GENRES.find((g) => g.slug === sp.genre)?.label;
    if (label) parts[0] = `${label}-Serien`;
  }
  if (sp.streamer) {
    const label = STREAMERS.find((s) => s.slug === sp.streamer)?.label;
    if (label) parts.push(`auf ${label}`);
  }
  if (sp.jahrzehnt) parts.push(`aus den ${sp.jahrzehnt}er Jahren`);
  if (sp.status) {
    const label = STATUS_FILTERS.find((s) => s.slug === sp.status)?.label;
    if (label) parts.push(`(${label})`);
  }
  return parts.join(' ');
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const title = buildTitle(sp);
  const canonicalPath = buildHref(sp, {});
  const canonical = `${SITE_BASE}${canonicalPath}`;
  const description =
    `${title} im Überblick — finde deine nächste Lieblingsserie nach Genre, Streamer und Jahrzehnt. ` +
    `Über 1.000 Serien mit Bewertungen, Staffel-Infos und aktuellen News auf serien.de.`;
  return {
    title: `${title} im Überblick | serien.de`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | serien.de`,
      description,
      url: canonical,
      type: 'website',
    },
  };
}

async function fetchSeries(sp: SearchParams) {
  const where: Record<string, unknown> = {
    posterPath: { not: null },
  };

  if (sp.genre) {
    const label = GENRES.find((g) => g.slug === sp.genre)?.label;
    if (label) where.genres = { has: label };
  }

  if (sp.jahrzehnt) {
    const decade = parseInt(sp.jahrzehnt, 10);
    if (!isNaN(decade)) {
      where.firstAirDate = {
        gte: new Date(`${decade}-01-01`),
        lt: new Date(`${decade + 10}-01-01`),
      };
    }
  }

  if (sp.status) {
    const status = STATUS_FILTERS.find((s) => s.slug === sp.status);
    if (status) where.status = { in: status.values };
  }

  let networkFilter: { contains: string; mode: 'insensitive' }[] | null = null;
  if (sp.streamer) {
    const streamer = STREAMERS.find((s) => s.slug === sp.streamer);
    if (streamer) {
      networkFilter = streamer.matches.map((m) => ({ contains: m, mode: 'insensitive' as const }));
    }
  }

  let orderBy: Record<string, 'asc' | 'desc'> = { popularity: 'desc' };
  switch (sp.sort) {
    case 'newest':
      orderBy = { firstAirDate: 'desc' };
      break;
    case 'rating':
      orderBy = { voteAverage: 'desc' };
      break;
    case 'alphabetical':
      orderBy = { title: 'asc' };
      break;
  }

  const SELECT = {
    tmdbId: true,
    title: true,
    slug: true,
    posterPath: true,
    firstAirDate: true,
    lastAirDate: true,
    genres: true,
    networks: true,
    numberOfSeasons: true,
    voteAverage: true,
    overview: true,
    status: true,
  } as const;

  const page = Math.max(1, parseInt(sp.page || '1', 10));
  let total: number;
  let items: Awaited<ReturnType<typeof prisma.series.findMany<{ select: typeof SELECT }>>>;

  if (networkFilter) {
    const all = await prisma.series.findMany({ where, orderBy, select: SELECT, take: 5000 });
    const filtered = all.filter((s) =>
      s.networks?.some((n) =>
        networkFilter!.some((f) => n.toLowerCase().includes(f.contains.toLowerCase()))
      )
    );
    total = filtered.length;
    const start = (page - 1) * PAGE_SIZE;
    items = filtered.slice(start, start + PAGE_SIZE);
  } else {
    const [list, count] = await Promise.all([
      prisma.series.findMany({
        where,
        orderBy,
        select: SELECT,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.series.count({ where }),
    ]);
    items = list;
    total = count;
  }

  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

function tmdbPoster(path: string | null): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/w342${path}`;
}

function formatDate(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default async function SerienPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { items, total, page, totalPages } = await fetchSeries(sp);
  const title = buildTitle(sp);
  const sortLabel = SORT_OPTIONS.find((o) => o.slug === sp.sort)?.label ?? SORT_OPTIONS[0].label;

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: items.length,
    itemListElement: items.map((s, i) => ({
      '@type': 'ListItem',
      position: (page - 1) * PAGE_SIZE + i + 1,
      url: `${SITE_BASE}/serie/${s.slug}`,
      name: s.title,
    })),
  };

  return (
    <main className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="text-xs text-gray-500 mb-4" aria-label="Breadcrumb" data-testid="breadcrumb">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-gray-900">serien.de</Link>
            </li>
            <li aria-hidden>›</li>
            <li className="text-gray-900 font-medium">Serien</li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2" data-testid="page-title">
            {title}
          </h1>
          <p className="text-sm text-gray-600">
            {total.toLocaleString('de-DE')} Serien — sortiert nach {sortLabel.toLowerCase()}
          </p>
        </header>

        {/* Filter sidebar (top-of-page editorial style like kino.de) */}
        <section className="border border-gray-200 rounded-2xl p-5 md:p-6 mb-8 bg-gray-50/50" aria-label="Filter">
          <div className="flex items-center gap-2 mb-4">
            <FilterIcon className="h-4 w-4 text-cyan-500" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Filtern nach</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <FilterColumn label="Genres">
              {GENRES.map((g) => (
                <FilterPill
                  key={g.slug}
                  href={buildHref(sp, { genre: sp.genre === g.slug ? undefined : g.slug })}
                  active={sp.genre === g.slug}
                  testid={`filter-genre-${g.slug}`}
                >
                  {g.label}
                </FilterPill>
              ))}
            </FilterColumn>

            <FilterColumn label="Streamer">
              {STREAMERS.map((s) => (
                <FilterPill
                  key={s.slug}
                  href={buildHref(sp, { streamer: sp.streamer === s.slug ? undefined : s.slug })}
                  active={sp.streamer === s.slug}
                  testid={`filter-streamer-${s.slug}`}
                >
                  {s.label}
                </FilterPill>
              ))}
            </FilterColumn>

            <FilterColumn label="Jahrzehnt">
              {DECADES.map((d) => (
                <FilterPill
                  key={d}
                  href={buildHref(sp, { jahrzehnt: sp.jahrzehnt === String(d) ? undefined : String(d) })}
                  active={sp.jahrzehnt === String(d)}
                  testid={`filter-decade-${d}`}
                >
                  {d}er
                </FilterPill>
              ))}
            </FilterColumn>

            <FilterColumn label="Status">
              {STATUS_FILTERS.map((s) => (
                <FilterPill
                  key={s.slug}
                  href={buildHref(sp, { status: sp.status === s.slug ? undefined : s.slug })}
                  active={sp.status === s.slug}
                  testid={`filter-status-${s.slug}`}
                >
                  {s.label}
                </FilterPill>
              ))}
              <div className="h-3" />
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">Sortieren</div>
              {SORT_OPTIONS.map((o) => (
                <FilterPill
                  key={o.slug}
                  href={buildHref(sp, { sort: o.slug === 'popularity' ? undefined : o.slug })}
                  active={(sp.sort ?? 'popularity') === o.slug}
                  testid={`sort-${o.slug}`}
                >
                  {o.label}
                </FilterPill>
              ))}
            </FilterColumn>
          </div>

          {(sp.genre || sp.streamer || sp.jahrzehnt || sp.status || sp.sort) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Link
                href="/serien"
                data-testid="reset-filters"
                className="text-xs text-cyan-700 hover:text-cyan-900 underline-offset-2 hover:underline"
              >
                Alle Filter zurücksetzen
              </Link>
            </div>
          )}
        </section>

        {/* Series list */}
        <section aria-label="Serien-Liste" className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {sortLabel === 'A–Z' ? 'Alle Serien (A–Z)' : `${sortLabel} Serien`}
          </h2>

          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500" data-testid="empty-state">
              Keine Serien gefunden. Versuche andere Filter.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((s) => {
                const poster = tmdbPoster(s.posterPath);
                return (
                  <li key={s.tmdbId} className="py-4" data-testid={`series-item-${s.slug}`}>
                    <Link
                      href={`/serie/${s.slug}`}
                      className="flex gap-4 group hover:bg-gray-50/60 -mx-3 px-3 py-2 rounded-xl transition-colors"
                    >
                      <div className="flex-shrink-0 w-[88px] sm:w-[110px] aspect-[2/3] relative rounded-lg overflow-hidden bg-gray-100">
                        {poster ? (
                          <Image
                            src={poster}
                            alt={s.title}
                            fill
                            sizes="(max-width: 640px) 88px, 110px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Tv className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-cyan-700 transition-colors line-clamp-2">
                          {s.title}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                          {s.firstAirDate && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(s.firstAirDate)}
                            </span>
                          )}
                          {s.numberOfSeasons ? (
                            <span>
                              {s.numberOfSeasons} Staffel{s.numberOfSeasons === 1 ? '' : 'n'}
                            </span>
                          ) : null}
                          {s.voteAverage ? (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <Star className="h-3 w-3 fill-current" />
                              {s.voteAverage.toFixed(1)}
                            </span>
                          ) : null}
                          {s.networks && s.networks.length > 0 && (
                            <span className="text-gray-500">{s.networks.slice(0, 2).join(', ')}</span>
                          )}
                        </div>
                        {s.genres && s.genres.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500">{s.genres.slice(0, 3).join(' · ')}</div>
                        )}
                        {s.overview && (
                          <p className="mt-2 text-sm text-gray-700 line-clamp-2 sm:line-clamp-3">{s.overview}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="mt-8 flex items-center justify-between" aria-label="Paginierung" data-testid="pagination">
            <div className="text-xs text-gray-500">
              Seite {page} von {totalPages}
            </div>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildHref(sp, { page: String(page - 1) })}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                  data-testid="pagination-prev"
                >
                  ← Zurück
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={buildHref(sp, { page: String(page + 1) })}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                  data-testid="pagination-next"
                >
                  Weiter →
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </main>
  );
}

function FilterColumn({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">{label}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterPill({
  href,
  active,
  testid,
  children,
}: {
  href: string;
  active: boolean;
  testid?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-testid={testid}
      className={`px-2.5 py-1 rounded-full border text-xs transition-all ${
        active
          ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-semibold'
          : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
      }`}
    >
      {children}
    </Link>
  );
}
