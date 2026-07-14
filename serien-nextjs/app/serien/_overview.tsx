/**
 * Shared overview component for /serien and its sub-routes.
 *
 * Props:
 *  - filters: active filter state
 *  - canonicalPath: the canonical URL path used for breadcrumbs & "reset" link base
 *  - forcePrimary: when inside a sub-route (e.g. /serien/genre/drama), keep links
 *    within that path family by pinning the primary filter type
 */
import Link from 'next/link';
import Image from 'next/image';
import { Star, Calendar, Tv, Filter as FilterIcon } from 'lucide-react';
import prisma from '@/lib/prisma';
import FilterPillButton from './_filter-pill-button';
import {
  STREAMERS,
  GENRES,
  DECADES,
  SORT_OPTIONS,
  STATUS_FILTERS,
  PAGE_SIZE,
  SITE_BASE,
  SerienFilters,
  buildHref,
  buildTitle,
} from './_lib';

interface Props {
  filters: SerienFilters;
  forcePrimary?: 'genre' | 'streamer' | 'jahrzehnt' | 'none';
  resetHref?: string;
}

const SELECT = {
  tmdbId: true,
  title: true,
  slug: true,
  posterPath: true,
  firstAirDate: true,
  genres: true,
  networks: true,
  numberOfSeasons: true,
  voteAverage: true,
  overview: true,
  status: true,
} as const;

async function fetchSeries(f: SerienFilters) {
  const where: Record<string, unknown> = {
    posterPath: { not: null },
  };

  if (f.genre) {
    const label = GENRES.find((g) => g.slug === f.genre)?.label;
    if (label) where.genres = { has: label };
  }

  if (f.jahrzehnt) {
    const decade = parseInt(f.jahrzehnt, 10);
    if (!isNaN(decade)) {
      where.firstAirDate = {
        gte: new Date(`${decade}-01-01`),
        lt: new Date(`${decade + 10}-01-01`),
      };
    }
  }

  if (f.status) {
    const status = STATUS_FILTERS.find((s) => s.slug === f.status);
    if (status) where.status = { in: status.values };
  }

  let networkFilter: { contains: string }[] | null = null;
  if (f.streamer) {
    const streamer = STREAMERS.find((s) => s.slug === f.streamer);
    if (streamer) {
      networkFilter = streamer.matches.map((m) => ({ contains: m }));
    }
  }

  let orderBy: Record<string, 'asc' | 'desc'> = { popularity: 'desc' };
  switch (f.sort) {
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

  const page = Math.max(1, parseInt(f.page || '1', 10));
  let total: number;
  let items: Awaited<ReturnType<typeof prisma.series.findMany<{ select: typeof SELECT }>>>;

  if (networkFilter) {
    const all = await prisma.series.findMany({ where, orderBy, select: SELECT, take: 5000 });
    const filtered = all.filter((s) =>
      s.networks?.some((n) =>
        networkFilter!.some((nf) => n.toLowerCase().includes(nf.contains.toLowerCase()))
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

export default async function SerienOverview({ filters, forcePrimary, resetHref = '/serien' }: Props) {
  const { items, total, page, totalPages } = await fetchSeries(filters);
  const title = buildTitle(filters);
  const sortLabel = SORT_OPTIONS.find((o) => o.slug === filters.sort)?.label ?? SORT_OPTIONS[0].label;

  const link = (override: Partial<SerienFilters>) =>
    buildHref(filters, override, forcePrimary ? { forcePrimary } : undefined);

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
    <main className="min-h-screen bg-white dark:bg-gray-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="text-xs text-gray-500 dark:text-gray-400 mb-4" aria-label="Breadcrumb" data-testid="breadcrumb">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-gray-900 dark:hover:text-white">serien.de</Link>
            </li>
            <li aria-hidden>›</li>
            <li>
              <Link href="/serien" className="hover:text-gray-900 dark:hover:text-white">Serien</Link>
            </li>
            {(filters.genre || filters.streamer || filters.jahrzehnt) && (
              <>
                <li aria-hidden>›</li>
                <li className="text-gray-900 dark:text-white font-medium">{title.replace('Alle Serien', 'Alle')}</li>
              </>
            )}
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2" data-testid="page-title">
            {title}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {total.toLocaleString('de-DE')} Serien — sortiert nach {sortLabel.toLowerCase()}
          </p>
        </header>

        {/* Filter sidebar (top-of-page editorial style) */}
        <section className="border border-gray-200 dark:border-gray-800 rounded-2xl p-5 md:p-6 mb-8 bg-gray-50/50 dark:bg-gray-900/40" aria-label="Filter">
          <div className="flex items-center gap-2 mb-4">
            <FilterIcon className="h-4 w-4 text-cyan-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Filtern nach</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <FilterColumn label="Genres">
              {GENRES.map((g) => (
                <FilterPillButton
                  key={g.slug}
                  href={link({ genre: filters.genre === g.slug ? undefined : g.slug })}
                  active={filters.genre === g.slug}
                  testid={`filter-genre-${g.slug}`}
                  ariaLabel={`Genre ${g.label} ${filters.genre === g.slug ? 'entfernen' : 'auswählen'}`}
                >
                  {g.label}
                </FilterPillButton>
              ))}
            </FilterColumn>

            <FilterColumn label="Streamer">
              {STREAMERS.map((s) => (
                <FilterPillButton
                  key={s.slug}
                  href={link({ streamer: filters.streamer === s.slug ? undefined : s.slug })}
                  active={filters.streamer === s.slug}
                  testid={`filter-streamer-${s.slug}`}
                  ariaLabel={`Streamer ${s.label} ${filters.streamer === s.slug ? 'entfernen' : 'auswählen'}`}
                >
                  {s.label}
                </FilterPillButton>
              ))}
            </FilterColumn>

            <FilterColumn label="Jahrzehnt">
              {DECADES.map((d) => (
                <FilterPillButton
                  key={d}
                  href={link({ jahrzehnt: filters.jahrzehnt === String(d) ? undefined : String(d) })}
                  active={filters.jahrzehnt === String(d)}
                  testid={`filter-decade-${d}`}
                  ariaLabel={`Jahrzehnt ${d}er ${filters.jahrzehnt === String(d) ? 'entfernen' : 'auswählen'}`}
                >
                  {d}er
                </FilterPillButton>
              ))}
            </FilterColumn>

            <FilterColumn label="Status">
              {STATUS_FILTERS.map((s) => (
                <FilterPillButton
                  key={s.slug}
                  href={link({ status: filters.status === s.slug ? undefined : s.slug })}
                  active={filters.status === s.slug}
                  testid={`filter-status-${s.slug}`}
                  ariaLabel={`Status ${s.label} ${filters.status === s.slug ? 'entfernen' : 'auswählen'}`}
                >
                  {s.label}
                </FilterPillButton>
              ))}
              <div className="h-3" />
              <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1.5">
                Sortieren
              </div>
              {SORT_OPTIONS.map((o) => (
                <FilterPillButton
                  key={o.slug}
                  href={link({ sort: o.slug === 'popularity' ? undefined : o.slug })}
                  active={(filters.sort ?? 'popularity') === o.slug}
                  testid={`sort-${o.slug}`}
                  ariaLabel={`Sortierung ${o.label}`}
                >
                  {o.label}
                </FilterPillButton>
              ))}
            </FilterColumn>
          </div>

          {(filters.genre || filters.streamer || filters.jahrzehnt || filters.status || filters.sort) && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
              <Link
                href={resetHref}
                data-testid="reset-filters"
                className="text-xs text-cyan-700 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300 underline-offset-2 hover:underline"
              >
                Alle Filter zurücksetzen
              </Link>
            </div>
          )}
        </section>

        {/* Series list */}
        <section aria-label="Serien-Liste" className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {sortLabel === 'A–Z' ? 'Alle Serien (A–Z)' : `${sortLabel} Serien`}
          </h2>

          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400" data-testid="empty-state">
              Keine Serien gefunden. Versuche andere Filter.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((s) => {
                const poster = tmdbPoster(s.posterPath);
                return (
                  <li key={s.tmdbId} className="py-4" data-testid={`series-item-${s.slug}`}>
                    <Link
                      href={`/serie/${s.slug}`}
                      className="flex gap-4 group hover:bg-gray-50/60 dark:hover:bg-gray-900/50 -mx-3 px-3 py-2 rounded-xl transition-colors"
                    >
                      <div className="flex-shrink-0 w-[88px] sm:w-[110px] aspect-[2/3] relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
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
                          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                            <Tv className="h-8 w-8" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors line-clamp-2">
                          {s.title}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
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
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <Star className="h-3 w-3 fill-current" />
                              {s.voteAverage.toFixed(1)}
                            </span>
                          ) : null}
                          {s.networks && s.networks.length > 0 && (
                            <span className="text-gray-500 dark:text-gray-500">{s.networks.slice(0, 2).join(', ')}</span>
                          )}
                        </div>
                        {s.genres && s.genres.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">{s.genres.slice(0, 3).join(' · ')}</div>
                        )}
                        {s.overview && (
                          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 line-clamp-2 sm:line-clamp-3">{s.overview}</p>
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
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Seite {page} von {totalPages}
            </div>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={link({ page: String(page - 1) })}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-800 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                  data-testid="pagination-prev"
                >
                  ← Zurück
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={link({ page: String(page + 1) })}
                  className="px-3 py-1.5 border border-gray-200 dark:border-gray-800 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
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
      <h3 className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-2">{label}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
