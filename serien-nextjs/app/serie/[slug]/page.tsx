import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { Metadata } from 'next';
import { generateSeriesSchema, generateBreadcrumbSchema } from '@/lib/schema-generator';
import { seoTitle, seoDescription } from '@/lib/seo-meta';
import SeriesNewsHub from '@/components/series/SeriesNewsHub';
import { unstable_cache } from 'next/cache';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

// ─────────────────────────────────────────────────────────────────────────
// Series-Detail-Page = **News-Hub** (Feb 2026).
// Keine Cast-/Charakter-/Q&A-/Trailer-/LLM-Bausteine mehr — nur eine
// kompakte Info-Box + Liste der jüngsten News zur Serie. Alle Heavy-
// Content-Module wurden entfernt (Google-Discover-Fokus: dünne Serien-
// Meta-Pages werden nicht bevorzugt; News mit klarer Zuordnung schon).
// ─────────────────────────────────────────────────────────────────────────

const getSeriesMeta = (slug: string) => unstable_cache(
  async () => {
    const possibleTmdbId = parseInt(slug.split('-')[0]);
    if (!isNaN(possibleTmdbId) && possibleTmdbId > 1000) {
      return prisma.series.findUnique({
        where: { tmdbId: possibleTmdbId },
        select: {
          name: true, title: true, overview: true, backdropPath: true, tmdbType: true,
          networks: true, tmdbId: true, slug: true, popularity: true,
          _count: { select: { articles: { where: { status: 'published' } } } },
        },
      });
    }
    return prisma.series.findFirst({
      where: { slug },
      select: {
        name: true, title: true, overview: true, backdropPath: true, tmdbType: true,
        networks: true, tmdbId: true, slug: true, popularity: true,
        _count: { select: { articles: { where: { status: 'published' } } } },
      },
    });
  },
  [`series-meta-${slug}`],
  { revalidate: 300, tags: ['series'] }
)();

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeriesMeta(slug);

  if (!series) notFound();

  const tmdbId = series.tmdbId;
  const baseUrl = 'https://serien.de';
  const seriesName = series.name || series.title;
  const ogImage = `/img/og/${series.tmdbType}/${tmdbId}`;
  const primaryNetwork = series.networks && series.networks.length > 0 ? series.networks[0] : 'Streaming';
  const canonicalSlug = series.slug || slug;

  const articleCount = (series as any)._count?.articles ?? 0;
  const popularity = (series as any).popularity ?? 0;
  const isKarteileichen = articleCount === 0 && popularity < 5;
  const shouldIndex = !!canonicalSlug && !canonicalSlug.startsWith('-') && !isKarteileichen;

  const rawTitle = `${seriesName} (${primaryNetwork}) News – Serien-Updates`;
  const rawDescription = `Aktuelle News zur Serie ${seriesName} bei ${primaryNetwork} – gebündelt auf einer Seite.`;
  const ogTitle = seoTitle(rawTitle);
  const ogDescription = seoDescription(rawDescription);

  return {
    title: ogTitle,
    description: ogDescription,
    alternates: { canonical: `${baseUrl}/serie/${canonicalSlug}` },
    robots: shouldIndex ? undefined : { index: false, follow: true },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: `${baseUrl}/serie/${canonicalSlug}`,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: seriesName || '' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: [ogImage],
    },
  };
}

export default async function SeriesDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const possibleTmdbId = parseInt(slug.split('-')[0]);

  // Nur das minimum-Set an Feldern für News-Hub. Kein cast/crew/characters/qa mehr.
  const seriesSelect = {
    name: true,
    title: true,
    overview: true,
    tmdbId: true,
    tmdbType: true,
    slug: true,
    networks: true,
    genres: true,
    status: true,
    firstAirDate: true,
    lastAirDate: true,
    numberOfSeasons: true,
    numberOfEpisodes: true,
    voteAverage: true,
    voteCount: true,
    productionCompanies: true,
    articles: {
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' as const },
      take: 30,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        heroLocalUrl: true,
        heroImageUrl: true,
        heroImagePath: true,
        cardImageUrl: true,
        users: { select: { name: true, image: true } },
      },
    },
  };

  let series: any = null;

  if (!isNaN(possibleTmdbId) && possibleTmdbId > 1000) {
    series = await prisma.series.findUnique({
      where: { tmdbId: possibleTmdbId },
      select: seriesSelect,
    });

    // Falls unter dem TMDB-ID-Pfad gelandet, auf sauberen Slug 301'en
    if (series && series.slug && series.slug !== slug) {
      redirect(`/serie/${series.slug}`);
    }
  }

  if (!series) {
    series = await prisma.series.findFirst({
      where: { slug },
      select: seriesSelect,
    });
  }

  if (!series) notFound();

  const tmdbId = series.tmdbId;
  const seriesName = series.name || series.title || '';
  const primaryNetwork = series.networks && series.networks.length > 0 ? series.networks[0] : null;

  const startYear = series.firstAirDate ? new Date(series.firstAirDate).getFullYear() : undefined;
  const endYear = series.lastAirDate ? new Date(series.lastAirDate).getFullYear() : undefined;
  const genres: string[] = Array.isArray(series.genres)
    ? series.genres.filter((g: unknown): g is string => typeof g === 'string' && g.length > 0)
    : [];

  // Schema.org — kompakte Basis-Serie ohne Trailer/Cast (die haben wir hier bewusst nicht mehr)
  const seriesSchema = generateSeriesSchema({
    name: seriesName,
    description: series.overview || '',
    posterUrl: `/img/poster/${series.tmdbType}/${tmdbId}`,
    tmdbId,
    slug: series.slug || slug,
    firstAirDate: series.firstAirDate,
    lastAirDate: series.lastAirDate,
    status: series.status,
    startYear,
    endYear,
    genres,
    numberOfSeasons: series.numberOfSeasons,
    numberOfEpisodes: series.numberOfEpisodes,
    voteAverage: series.voteAverage,
    voteCount: series.voteCount,
    networks: Array.isArray(series.networks) ? series.networks : [],
    cast: [],
    creators: [],
    productionCompanies: Array.isArray(series.productionCompanies)
      ? series.productionCompanies.filter((c: unknown): c is string => typeof c === 'string' && c.length > 0)
      : [],
    trailerUrl: null,
  });

  const articles = (series.articles || []).map((a: any) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    heroLocalUrl: a.heroLocalUrl,
    heroImageUrl: a.heroImageUrl,
    cardImageUrl: a.cardImageUrl,
    users: a.users,
  }));

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seriesSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Serien', url: '/serienfinder' },
              { name: seriesName, url: `/serie/${series.slug}` },
            ])
          ),
        }}
      />

      <SeriesNewsHub
        seriesName={seriesName}
        tmdbId={tmdbId}
        tmdbType={series.tmdbType}
        primaryNetwork={primaryNetwork}
        status={series.status}
        startYear={startYear}
        endYear={endYear}
        numberOfSeasons={series.numberOfSeasons}
        numberOfEpisodes={series.numberOfEpisodes}
        genres={genres}
        voteAverage={series.voteAverage}
        articles={articles}
      />
    </main>
  );
}
