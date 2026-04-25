/**
 * Neue Serien - Daily Releases Aggregator
 * URL: /neue-serien
 * 
 * Shows daily new releases across all streaming platforms
 * Similar to werstreamt.es/filme-serien/neu/
 */

import { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { unstable_cache } from 'next/cache';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Star, Play, Sparkles, Clock, Filter, Tv, RefreshCw } from 'lucide-react';
import { generateSeriesSlug } from '@/lib/slug-utils';

// ISR - Revalidate every hour
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Neue Serien heute: Alle Streaming-Neuheiten auf einen Blick | serien.de',
  description: 'Welche Serien starten heute? Alle neuen Serien & Episoden bei Netflix, Prime Video, Disney+, HBO Max und mehr. Täglich aktualisiert.',
  keywords: ['Neue Serien', 'Serien heute', 'Streaming Neuheiten', 'Netflix neu', 'Prime Video neu', 'Disney+ neu'],
  openGraph: {
    title: 'Neue Serien heute: Alle Streaming-Neuheiten',
    description: 'Täglich aktualisiert: Alle neuen Serien und Episoden bei Netflix, Prime Video, Disney+ und mehr.',
    type: 'website',
    url: '/neue-serien',
  },
  alternates: {
    canonical: 'https://serien.de/neue-serien',
  },
};

// Provider colors and styling
const PROVIDER_STYLES: Record<string, { bg: string; text: string; accent: string; href: string }> = {
  'Netflix': { bg: 'bg-red-600', text: 'text-white', accent: 'text-red-600', href: '/netflix-serien' },
  'Prime Video': { bg: 'bg-cyan-500', text: 'text-white', accent: 'text-cyan-600', href: '/prime-video-serien' },
  'Disney+': { bg: 'bg-blue-600', text: 'text-white', accent: 'text-blue-600', href: '/disney-plus-serien' },
  'HBO Max': { bg: 'bg-purple-600', text: 'text-white', accent: 'text-purple-600', href: '/hbo-serien' },
  'Apple TV+': { bg: 'bg-gray-800', text: 'text-white', accent: 'text-gray-800', href: '/apple-tv-serien' },
  'Joyn': { bg: 'bg-pink-500', text: 'text-white', accent: 'text-pink-600', href: '/joyn-serien' },
  'Paramount+': { bg: 'bg-blue-600', text: 'text-white', accent: 'text-blue-600', href: '/paramount-plus-serien' },
  'Crunchyroll': { bg: 'bg-orange-500', text: 'text-white', accent: 'text-orange-600', href: '/crunchyroll-serien' },
  'WOW': { bg: 'bg-sky-500', text: 'text-white', accent: 'text-sky-600', href: '/wow-serien' },
  'MagentaTV': { bg: 'bg-fuchsia-600', text: 'text-white', accent: 'text-fuchsia-600', href: '/magenta-tv-serien' },
  'Discovery+': { bg: 'bg-blue-600', text: 'text-white', accent: 'text-blue-600', href: '/discovery-plus-serien' },
  'RTL+': { bg: 'bg-orange-500', text: 'text-white', accent: 'text-orange-600', href: '/rtl-plus-serien' },
  'Rakuten TV': { bg: 'bg-violet-600', text: 'text-white', accent: 'text-violet-600', href: '/rakuten-tv-serien' },
  'maxdome': { bg: 'bg-teal-600', text: 'text-white', accent: 'text-teal-600', href: '/maxdome-serien' },
  'ZDF Mediathek': { bg: 'bg-orange-500', text: 'text-white', accent: 'text-orange-600', href: '/zdf-mediathek-serien' },
  'ARD Mediathek': { bg: 'bg-blue-700', text: 'text-white', accent: 'text-blue-700', href: '/ard-mediathek-serien' },
  'CHILI': { bg: 'bg-red-600', text: 'text-white', accent: 'text-red-600', href: '/chili-serien' },
  'freenet Video': { bg: 'bg-green-600', text: 'text-white', accent: 'text-green-600', href: '/freenet-video-serien' },
};

// Provider order (most popular first)
const PROVIDER_ORDER = [
  'Netflix', 'Prime Video', 'Disney+', 'HBO Max', 'Apple TV+', 
  'WOW', 'RTL+', 'Paramount+', 'Joyn', 'MagentaTV',
  'Discovery+', 'Crunchyroll', 'ARD Mediathek', 'ZDF Mediathek',
  'CHILI', 'Rakuten TV', 'maxdome', 'freenet Video'
];

// Date range options for the "Heute / Woche / Monat" toggle
type DateRange = 'today' | 'week' | 'month';

const RANGE_DAYS: Record<DateRange, number> = {
  today: 1,
  week: 7,
  month: 30,
};

const RANGE_LABEL: Record<DateRange, string> = {
  today: 'Heute',
  week: 'Diese Woche',
  month: 'Diesen Monat',
};

function parseRange(value: string | string[] | undefined): DateRange {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === 'today' || v === 'week' || v === 'month') return v;
  return 'week';
}

// Cached data fetching (per-range cache via parameterized key)
const getNewReleasesData = unstable_cache(
  async (range: DateRange) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Lookup window for the selected range
    const rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - (RANGE_DAYS[range] - 1));

    // "Truly new" cutoff for the NEU badge: only releases within the last 3 days.
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Get releases for the selected window
    const releases = await prisma.streaming_releases.findMany({
      where: {
        date: { gte: rangeStart },
      },
      orderBy: [
        { date: 'desc' },
        { voteAverage: 'desc' },
      ],
    });

    // Get slug + display titles from series table for all releases.
    // We fetch German title + English name so we can fall back when the
    // streaming_releases.name is in a non-Latin script (Korean / Japanese / Chinese).
    const tmdbIds = [...new Set(releases.map((r) => r.tmdbId))];
    const seriesMeta = await prisma.series.findMany({
      where: { tmdbId: { in: tmdbIds } },
      select: { tmdbId: true, slug: true, title: true, name: true, originalName: true },
    });
    const metaByTmdb = new Map(seriesMeta.map((s) => [s.tmdbId, s]));

    // Detect CJK / Hangul / Kana characters – these names are unhelpful for German users.
    const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uff66-\uff9f]/;
    const isCjk = (s: string | null | undefined) => !!s && CJK.test(s);

    /**
     * Pick the best display title:
     *   1. release.name if it's Latin script
     *   2. series.title (German)
     *   3. series.name (English / TMDB display)
     *   4. series.originalName as last resort
     * If none are usable (all CJK / null), the release will be filtered out.
     */
    function pickTitle(release: typeof releases[number], meta: typeof seriesMeta[number] | undefined): string | null {
      if (!isCjk(release.name)) return release.name;
      if (meta?.title && !isCjk(meta.title)) return meta.title;
      if (meta?.name && !isCjk(meta.name)) return meta.name;
      if (meta?.originalName && !isCjk(meta.originalName)) return meta.originalName;
      return null;
    }

    // Enrich releases with slugs + chosen display title; drop entries with no
    // usable Latin title at all.
    const enrichedReleases = releases.flatMap((release) => {
      const meta = metaByTmdb.get(release.tmdbId);
      const displayName = pickTitle(release, meta);
      if (!displayName) return [];
      return [
        {
          ...release,
          name: displayName,
          slug: meta?.slug || generateSeriesSlug(release.name, release.tmdbId),
          isFreshRelease: release.date >= threeDaysAgo,
        },
      ];
    });

    // De-duplicate per (provider, tmdbId): keep only the most recent date
    // (releases are already ordered by date DESC). This collapses the
    // "Only Margo 3x / Navy CIS 5x" duplicates seen on the live site.
    const seenPerProvider = new Map<string, Set<number>>();
    const dedupedReleases: typeof enrichedReleases = [];
    for (const r of enrichedReleases) {
      let seen = seenPerProvider.get(r.provider);
      if (!seen) {
        seen = new Set<number>();
        seenPerProvider.set(r.provider, seen);
      }
      if (seen.has(r.tmdbId)) continue;
      seen.add(r.tmdbId);
      dedupedReleases.push(r);
    }

    // Group by provider using a plain object (Maps don't serialize in unstable_cache)
    const releasesByProvider: Record<string, typeof dedupedReleases> = {};

    for (const release of dedupedReleases) {
      if (!releasesByProvider[release.provider]) {
        releasesByProvider[release.provider] = [];
      }
      releasesByProvider[release.provider].push(release);
    }

    // Get today's releases count (using deduped list so the stat matches what's displayed)
    const todayReleases = dedupedReleases.filter((r) => {
      const releaseDate = new Date(r.date);
      releaseDate.setHours(0, 0, 0, 0);
      return releaseDate.getTime() === today.getTime();
    });

    // Get most recent fetch timestamp
    const latestFetch = dedupedReleases.length > 0
      ? Math.max(...dedupedReleases.map((r) => r.fetchedAt.getTime()))
      : null;

    // Pick a Top Highlight: best-rated fresh release with a backdrop, so we can
    // build a hero card. Falls back to best-rated release of the whole window
    // when no fresh + backdrop combo is available.
    const candidates = dedupedReleases.filter(
      (r) => r.backdropPath && (r.voteAverage ?? 0) >= 6.5,
    );
    const fresh = candidates.filter((r) => r.isFreshRelease);
    const pool = fresh.length > 0 ? fresh : candidates;
    const topHighlight = pool.length > 0
      ? pool.reduce((best, r) =>
          (r.voteAverage ?? 0) > (best.voteAverage ?? 0) ? r : best,
        )
      : null;

    return {
      releasesByProvider,
      totalCount: dedupedReleases.length,
      todayCount: todayReleases.length,
      providerCount: Object.keys(releasesByProvider).length,
      lastUpdated: latestFetch ? new Date(latestFetch) : null,
      topHighlight,
      // Top 30 deduped releases for ItemList schema (already date-DESC,
      // voteAverage-DESC ordered by the SQL query)
      schemaItems: dedupedReleases.slice(0, 30).map((r) => ({
        name: r.name,
        slug: r.slug,
        posterPath: r.posterPath,
      })),
    };
  },
  ['new-releases-data-v2'],
  { revalidate: 3600, tags: ['new-releases'] }
);

// Schema.org structured data
function generateNewReleasesSchema(
  totalCount: number,
  items: Array<{ name: string; slug: string; posterPath: string | null }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Neue Serien heute',
    description: 'Täglich aktualisierte Übersicht aller neuen Serien und Episoden auf deutschen Streaming-Plattformen',
    url: 'https://serien.de/neue-serien',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: totalCount,
      itemListElement: items.map((it, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `https://serien.de/serie/${it.slug}`,
        name: it.name,
        ...(it.posterPath
          ? { image: `https://image.tmdb.org/t/p/w500${it.posterPath}` }
          : {}),
      })),
    },
    publisher: {
      '@type': 'Organization',
      name: 'serien.de',
      url: 'https://serien.de',
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://serien.de',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Neue Serien',
          item: 'https://serien.de/neue-serien',
        },
      ],
    },
  };
}

export default async function NeueSerienPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const {
    releasesByProvider,
    totalCount,
    todayCount,
    providerCount,
    lastUpdated,
    topHighlight,
    schemaItems,
  } = await getNewReleasesData(range);

  const schema = generateNewReleasesSchema(totalCount, schemaItems);

  // Format date helper
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', 
      month: 'short', 
      year: 'numeric' });
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit',
      minute: '2-digit' });
  };

  // Sort providers by their order
  const sortedProviders = PROVIDER_ORDER.filter(p => p in releasesByProvider);
  
  // Add any providers not in the order list
  Object.keys(releasesByProvider).forEach(provider => {
    if (!sortedProviders.includes(provider)) {
      sortedProviders.push(provider);
    }
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <main className="min-h-screen bg-gray-50 dark:bg-[hsl(230,25%,7%)]">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 dark:from-emerald-900 dark:via-teal-900 dark:to-cyan-900 overflow-hidden">
          <div className="absolute inset-0 bg-[url('/patterns/grid.svg')] opacity-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          
          <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-20">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span className="text-sm font-medium text-white/90">Täglich aktualisiert</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
                Neue Serien heute
              </h1>
              
              <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-8">
                Alle Streaming-Neuheiten auf einen Blick. Entdecke, welche Serien und 
                Episoden heute bei Netflix, Prime, Disney+ und anderen Diensten starten.
              </p>

              {/* Range Toggle: Heute / Diese Woche / Diesen Monat */}
              <div
                className="mt-8 inline-flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-full p-1"
                role="tablist"
                aria-label="Zeitraum"
                data-testid="neue-serien-range-toggle"
              >
                {(['today', 'week', 'month'] as DateRange[]).map((r) => {
                  const active = r === range;
                  return (
                    <Link
                      key={r}
                      href={`/neue-serien${r === 'week' ? '' : `?range=${r}`}`}
                      role="tab"
                      aria-selected={active}
                      data-testid={`neue-serien-range-${r}`}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                        active
                          ? 'bg-white text-emerald-700 shadow'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {RANGE_LABEL[r]}
                    </Link>
                  );
                })}
              </div>

              {/* Stats */}
              <div className="flex flex-wrap justify-center gap-8 mt-10">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-white">{todayCount}</div>
                  <div className="text-sm text-white/60 mt-1">Heute neu</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-white">{totalCount}</div>
                  <div className="text-sm text-white/60 mt-1">{RANGE_LABEL[range]}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-white">{providerCount}</div>
                  <div className="text-sm text-white/60 mt-1">Streaming-Dienste</div>
                </div>
              </div>

              {/* Last Updated */}
              {lastUpdated && (
                <div className="mt-8 flex items-center justify-center gap-2 text-white/60 text-sm">
                  <RefreshCw className="w-4 h-4" />
                  <span>Zuletzt aktualisiert: {formatDate(lastUpdated)} um {formatTime(lastUpdated)} Uhr</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-12">
          
          {/* Quick Jump Navigation */}
          <div className="mb-10 overflow-x-auto pb-2">
            <div className="flex gap-2 min-w-max">
              {sortedProviders.map((provider) => {
                const style = PROVIDER_STYLES[provider] || { bg: 'bg-gray-600', text: 'text-white' };
                const count = releasesByProvider[provider]?.length || 0;
                
                return (
                  <a
                    key={provider}
                    href={`#${provider.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${style.bg} ${style.text} text-sm font-medium hover:opacity-90 transition-opacity shadow-md`}
                  >
                    {provider}
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{count}</span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Top Highlight Hero – best-rated fresh release with backdrop */}
          {topHighlight && (
            <Link
              href={`/serie/${topHighlight.slug}`}
              data-testid="neue-serien-top-highlight"
              className="group relative block mb-10 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
            >
              <div className="relative aspect-[21/9] w-full">
                {topHighlight.backdropPath && (
                  <Image
                    src={`/img/tmdb/w1280${topHighlight.backdropPath}`}
                    alt={topHighlight.name}
                    fill
                    priority
                    sizes="(max-width: 1280px) 100vw, 1280px"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8">
                  <div className="flex items-center gap-2 mb-3">
                    {topHighlight.isFreshRelease && (
                      <span className="bg-emerald-500 text-white text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded animate-pulse">
                        Heute neu
                      </span>
                    )}
                    <span
                      className={`${
                        PROVIDER_STYLES[topHighlight.provider]?.bg || 'bg-gray-700'
                      } text-white text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded`}
                    >
                      {topHighlight.provider}
                    </span>
                    {topHighlight.voteAverage && topHighlight.voteAverage > 0 && (
                      <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded">
                        <Star className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" />
                        {topHighlight.voteAverage.toFixed(1)}
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white drop-shadow-lg max-w-3xl line-clamp-2">
                    {topHighlight.name}
                  </h2>

                  {topHighlight.overview && (
                    <p className="hidden sm:block mt-3 text-white/85 text-sm sm:text-base max-w-2xl line-clamp-2 drop-shadow">
                      {topHighlight.overview}
                    </p>
                  )}

                  <div className="mt-4 inline-flex items-center gap-2 text-white text-sm font-semibold">
                    <span className="bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 group-hover:bg-white group-hover:text-gray-900 transition-colors">
                      Jetzt entdecken →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* No Data Message */}
          {sortedProviders.length === 0 && (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full mb-6">
                <Tv className="w-10 h-10 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Keine Daten verfügbar
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Die Neuheiten werden täglich automatisch aktualisiert. 
                Bitte versuche es später erneut.
              </p>
            </div>
          )}

          {/* Provider Sections */}
          <div className="space-y-12">
            {sortedProviders.map((provider) => {
              const releases = releasesByProvider[provider] || [];
              const style = PROVIDER_STYLES[provider] || { 
                bg: 'bg-gray-600', 
                text: 'text-white', 
                accent: 'text-gray-600',
                href: '#'
              };
              
              if (releases.length === 0) return null;
              
              return (
                <section 
                  key={provider} 
                  id={provider.toLowerCase().replace(/[^a-z0-9]/g, '-')}
                  className="scroll-mt-20"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 ${style.bg} rounded-lg shadow`}>
                        <Play className={`w-5 h-5 ${style.text}`} fill="currentColor" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                          {provider}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {releases.length} {releases.length === 1 ? 'Neuheit' : 'Neuheiten'}
                        </p>
                      </div>
                    </div>
                    
                    <Link
                      href={style.href}
                      className={`text-sm font-medium ${style.accent} dark:opacity-80 hover:underline`}
                    >
                      Alle {provider} Serien →
                    </Link>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {releases.slice(0, 12).map((release) => (
                      <Link
                        key={`${release.tmdbId}-${provider}`}
                        href={`/serie/${release.slug}`}
                        className="group"
                      >
                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 shadow-md group-hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1">
                          {release.posterPath ? (
                            <Image
                              src={`/img/tmdb/w342${release.posterPath}`}
                              alt={release.name}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Tv className="w-12 h-12" />
                            </div>
                          )}
                          
                          {/* Provider Badge */}
                          <div className={`absolute top-2 right-2 ${style.bg} ${style.text} text-[10px] font-bold px-2 py-1 rounded shadow`}>
                            {provider.split(' ')[0]}
                          </div>
                          
                          {/* NEU-Badge nur für echte Neuzugänge der letzten 3 Tage,
                              nicht für Katalog-Einträge wie Outlander/Family Guy etc. */}
                          {release.isFreshRelease && (
                            <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow animate-pulse">
                              NEU
                            </div>
                          )}
                          
                          {/* Rating */}
                          {release.voteAverage && release.voteAverage > 0 && (
                            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1">
                              <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
                              <span className="text-xs text-white font-medium">
                                {release.voteAverage.toFixed(1)}
                              </span>
                            </div>
                          )}
                          
                          {/* Overlay on hover */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                            {release.overview && (
                              <p className="text-white text-xs line-clamp-3">
                                {release.overview}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {release.name}
                          </h3>
                          <p
                            className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1"
                            title="Datum, an dem dieser Eintrag in der Streaming-Datenbank registriert wurde"
                          >
                            <Calendar className="w-3 h-3" />
                            {release.isFreshRelease
                              ? `verfügbar seit ${formatDate(release.date)}`
                              : formatDate(release.date)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  
                  {releases.length > 12 && (
                    <div className="mt-6 text-center">
                      <Link
                        href={style.href}
                        className={`inline-flex items-center gap-2 ${style.bg} ${style.text} font-medium px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity shadow`}
                      >
                        Alle {releases.length} {provider} Neuheiten
                      </Link>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* Info Section */}
          <section className="mt-16 bg-white dark:bg-[hsl(230,25%,10%)] rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-800">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Über diese Seite
            </h2>
            
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>
                Auf dieser Seite findest du <strong>täglich aktualisiert</strong> alle neuen Serien und Episoden, 
                die bei den wichtigsten deutschen Streaming-Diensten starten. Die Daten werden automatisch 
                aus der TMDB-Datenbank abgerufen und nach Streaming-Anbieter sortiert.
              </p>
              
              <h3>Welche Streaming-Dienste werden erfasst?</h3>
              <p>
                Wir tracken Neuheiten von <strong>Netflix</strong>, <strong>Prime Video</strong>, 
                <strong>Disney+</strong>, <strong>HBO Max</strong>, <strong>Apple TV+</strong>, 
                <strong>WOW</strong>, <strong>RTL+</strong>, <strong>Paramount+</strong>, 
                <strong>Joyn</strong> und vielen weiteren deutschen Streaming-Plattformen.
              </p>
              
              <h3>Wie oft werden die Daten aktualisiert?</h3>
              <p>
                Die Streaming-Neuheiten werden <strong>täglich automatisch</strong> aktualisiert. 
                Die letzte Aktualisierung siehst du oben auf der Seite.
              </p>
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
