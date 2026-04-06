import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { Metadata } from 'next';
import { generateSeriesSchema } from '@/lib/schema-generator';
import { generateRelevanceContext, generateStatusContext } from '@/lib/editorial-hook';
import { getSeriesQA } from '@/lib/series-qa-action';
import MobileSeriesLayout from '@/components/series/MobileSeriesLayout';
import DesktopSeriesLayout from '@/components/series/DesktopSeriesLayout';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  
  // Try to parse as TMDB ID first (legacy URLs like "259819-serienname")
  const possibleTmdbId = parseInt(slug.split('-')[0]);
  
  let series;
  let tmdbId: number;
  
  if (!isNaN(possibleTmdbId) && possibleTmdbId > 1000) {
    // Looks like a TMDB ID
    tmdbId = possibleTmdbId;
    series = await prisma.series.findUnique({
      where: { tmdbId },
      select: {
        name: true,
        title: true,
        overview: true,
        backdropPath: true,
        tmdbType: true,
        networks: true,
        tmdbId: true,
        slug: true,
      },
    });
  } else {
    // Search by slug
    series = await prisma.series.findFirst({
      where: { slug },
      select: {
        name: true,
        title: true,
        overview: true,
        backdropPath: true,
        tmdbType: true,
        networks: true,
        tmdbId: true,
        slug: true,
      },
    });
    if (series) {
      tmdbId = series.tmdbId;
    }
  }
  
  if (!series) {
    return {
      title: 'Serie nicht gefunden | serien.de',
    };
  }
  
  tmdbId = series.tmdbId;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  const seriesName = series.name || series.title;
  const ogImage = `/img/og/${series.tmdbType}/${tmdbId}`;
  
  // Get primary network for title
  const primaryNetwork = series.networks && series.networks.length > 0 
    ? series.networks[0] 
    : 'Streaming';

  // Use canonical slug for URLs
  const canonicalSlug = series.slug || slug;

  // noindex for broken slugs (non-Latin titles that generated invalid slugs like "-2661")
  const shouldIndex = canonicalSlug && !canonicalSlug.startsWith('-');

  return {
    title: `${seriesName} (${primaryNetwork}): News, Staffeln & aktueller Serien-Status`,
    description: `Alle aktuellen News, Trailer und Infos zur Serie ${seriesName} – mit Serien-Status, Staffeln und Einordnung.`,
    metadataBase: new URL(baseUrl),
    robots: {
      index: shouldIndex,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
    alternates: {
      canonical: `${baseUrl}/serie/${canonicalSlug}`,
    },
    openGraph: {
      title: `${seriesName} | serien.de`,
      description: series.overview || `Alle Neuigkeiten zu ${seriesName}`,
      type: 'website',
      url: `${baseUrl}/serie/${canonicalSlug}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: seriesName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${seriesName} | serien.de`,
      description: series.overview || `Alle Neuigkeiten zu ${seriesName}`,
      images: [ogImage],
    },
  };
}

export default async function SeriesDetailPage({ params }: PageProps) {
  const { slug } = await params;
  
  // Try to parse as TMDB ID first (legacy URLs like "259819-serienname")
  const possibleTmdbId = parseInt(slug.split('-')[0]);
  
  let series;
  let shouldRedirect = false;
  
  if (!isNaN(possibleTmdbId) && possibleTmdbId > 1000) {
    // Looks like a TMDB ID - find series and redirect to new slug
    series = await prisma.series.findUnique({
      where: { tmdbId: possibleTmdbId },
      include: {
        articles: {
          where: { status: 'published' },
          orderBy: { publishedAt: 'desc' },
          take: 10,
          select: {
            slug: true,
            title: true,
            excerpt: true,
            publishedAt: true,
            heroLocalUrl: true,
            cardImageUrl: true,
            authorId: true,
            users: {
              select: { name: true, image: true }
            }
          }
        }
      },
    });
    
    // If found and slug doesn't match, redirect to canonical URL
    if (series && series.slug && series.slug !== slug) {
      redirect(`/serie/${series.slug}`);
    }
  }
  
  // If not found by TMDB ID, try by slug
  if (!series) {
    series = await prisma.series.findFirst({
      where: { slug },
      include: {
        articles: {
          where: { status: 'published' },
          orderBy: { publishedAt: 'desc' },
          take: 10,
          select: {
            slug: true,
            title: true,
            excerpt: true,
            publishedAt: true,
            heroLocalUrl: true,
            cardImageUrl: true,
            authorId: true,
            users: {
              select: { name: true, image: true }
            }
          }
        }
      },
    });
  }

  if (!series) {
    notFound();
  }

  // Get tmdbId from series for use in templates
  const tmdbId = series.tmdbId;

  const cast = (series.cast as any[]) || [];
  const crew = (series.crew as any[]) || [];
  const trailers = (series.trailers as any[]) || [];
  const creators = crew.filter(c => c.job === 'Creator' || c.job === 'Executive Producer').slice(0, 3);
  
  // R2 Trailer URL (self-hosted) - prioritize over YouTube embed
  const localTrailerUrl = series.localTrailerPath && 
    series.localTrailerPath !== 'unavailable' && 
    series.localTrailerPath !== 'SKIP' &&
    series.localTrailerPath.startsWith('http')
    ? series.localTrailerPath 
    : null;
  const seasons = series.seasons as any[] || [];
  
  // Enrich cast with person page slugs for linking (single query instead of 6)
  const castIds = cast.slice(0, 6).map((actor: any) => actor.id).filter(Boolean);
  const personSlugs = castIds.length > 0 
    ? await prisma.persons.findMany({
        where: { tmdbId: { in: castIds } },
        select: { tmdbId: true, slug: true }
      })
    : [];
  
  const slugMap = new Map(personSlugs.map(p => [p.tmdbId, p.slug]));
  const castWithLinks = cast.slice(0, 6).map((actor: any) => ({
    ...actor,
    personSlug: actor.id ? slugMap.get(actor.id) || null : null
  }));
  
  // Fetch fictional characters for this series
  const characters = await prisma.characters.findMany({
    where: {
      seriesTmdbId: series.tmdbId,
      publishStatus: 'published',
    },
    include: {
      persons: {
        select: {
          name: true,
          profilePath: true,
        }
      }
    },
    take: 6,
    orderBy: {
      orderIndex: 'asc'
    }
  });
  
  // Generate Series Q&A (5 evergreen interpretative questions - MODUL 2)
  // Use cached data if available, otherwise generate on-demand
  let seriesQA: any[] = [];
  
  if (series.discoverQA && Array.isArray(series.discoverQA) && (series.discoverQA as any[]).length > 0) {
    // Use cached Q&A
    seriesQA = series.discoverQA as any[];
  } else {
    // Generate on-demand and cache in background (don't block page load)
    // For now, skip to avoid slow page loads - will be pre-generated via script
    seriesQA = [];
  }

  // Extract year information
  const startYear = series.firstAirDate ? new Date(series.firstAirDate).getFullYear() : undefined;
  const endYear = series.lastAirDate ? new Date(series.lastAirDate).getFullYear() : undefined;
  
  // Extract genres
  const genres = series.genres ? (series.genres as any[]).map(g => g.name) : [];
  
  // MODUL 0: "Warum relevant"-Context (kulturelle Relevanz, KEIN News-Ton)
  // Use cached data if available
  let relevanceContext: string | null = null;
  
  if (series.discoverIntro && series.discoverIntro.length > 50) {
    // Use cached intro
    relevanceContext = series.discoverIntro;
  } else {
    // Skip on-demand generation to avoid slow page loads
    // Will be pre-generated via script
    relevanceContext = null;
  }
  
  // MODUL 1: Status Context (NUR bei echtem Mehrwert)
  // Use cached or generate simple version (no LLM needed)
  let statusContext: string | null = null;
  
  if (series.discoverStatus && series.discoverStatus.length > 10) {
    statusContext = series.discoverStatus;
  } else {
    // This function doesn't use LLM, just string templates - safe to call
    statusContext = generateStatusContext(
      series.status,
      series.name || series.title || '',
      series.networks && series.networks.length > 0 ? series.networks[0] : undefined,
      series.lastAirDate,
      series.numberOfSeasons
    );
  }
  
  // Generate structured data
  const seriesSchema = generateSeriesSchema({
    name: series.name || series.title || '',
    description: series.overview || '',
    posterUrl: `/img/poster/${series.tmdbType}/${tmdbId}`,
    tmdbId,
    slug: series.slug || slug, // Use clean slug for canonical URL
    startYear,
    endYear,
    genres,
  });

  // Serialize Prisma Date objects for React Server Components
  const serializedSeries = {
    ...series,
    articles: series.articles?.map((article: any) => ({
      ...article,
      publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
      createdAt: article.createdAt ? article.createdAt.toISOString() : null,
      updatedAt: article.updatedAt ? article.updatedAt.toISOString() : null,
    })) || [],
    firstAirDate: series.firstAirDate || null,
    lastAirDate: series.lastAirDate || null,
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(seriesSchema),
        }}
      />
      
      <MobileSeriesLayout
        series={serializedSeries}
        cast={castWithLinks || []}
        creators={creators || []}
        seasons={seasons || []}
        trailers={trailers || []}
        localTrailerUrl={localTrailerUrl}
        relevanceContext={relevanceContext || null}
        statusContext={statusContext || null}
        seriesQA={seriesQA || []}
        slug={slug}
        characters={characters || []}
      />

      <DesktopSeriesLayout
        series={serializedSeries}
        cast={castWithLinks || []}
        creators={creators || []}
        seasons={seasons || []}
        trailers={trailers || []}
        localTrailerUrl={localTrailerUrl}
        relevanceContext={relevanceContext || null}
        statusContext={statusContext || null}
        seriesQA={seriesQA || []}
        slug={slug}
        characters={characters || []}
      />
    </main>
  );
}
