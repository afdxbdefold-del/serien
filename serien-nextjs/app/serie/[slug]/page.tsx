import { notFound } from 'next/navigation';
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
  const tmdbId = parseInt(slug.split('-')[0]);
  
  if (isNaN(tmdbId)) {
    return {
      title: 'Serie nicht gefunden | serien.de',
    };
  }

  const series = await prisma.series.findUnique({
    where: { tmdbId },
    select: {
      name: true,
      title: true,
      overview: true,
      backdropPath: true,
      tmdbType: true,
      networks: true,
    },
  });

  if (!series) {
    return {
      title: 'Serie nicht gefunden | serien.de',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  const seriesName = series.name || series.title;
  const ogImage = `/img/og/${series.tmdbType}/${tmdbId}`;
  
  // Get primary network for title
  const primaryNetwork = series.networks && series.networks.length > 0 
    ? series.networks[0] 
    : 'Streaming';

  return {
    title: `${seriesName} (${primaryNetwork}): News, Staffeln & aktueller Serien-Status`,
    description: `Alle aktuellen News, Trailer und Infos zur Serie ${seriesName} – mit Serien-Status, Staffeln und Einordnung.`,
    metadataBase: new URL(baseUrl),
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
    alternates: {
      canonical: `/serie/${slug}`,
    },
    openGraph: {
      title: `${seriesName} | serien.de`,
      description: series.overview || `Alle Neuigkeiten zu ${seriesName}`,
      type: 'website',
      url: `/serie/${slug}`,
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
  
  // Extract TMDB ID from slug (format: "123456-series-name")
  const tmdbId = parseInt(slug.split('-')[0]);
  
  if (isNaN(tmdbId)) {
    notFound();
  }

  // Fetch series with all details
  const series = await prisma.series.findUnique({
    where: { tmdbId },
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
    // Select all series fields including extendedOverview
  });

  if (!series) {
    notFound();
  }

  const cast = (series.cast as any[]) || [];
  const crew = (series.crew as any[]) || [];
  const trailers = (series.trailers as any[]) || [];
  const creators = crew.filter(c => c.job === 'Creator' || c.job === 'Executive Producer').slice(0, 3);
  const seasons = series.seasons as any[] || [];
  
  // Enrich cast with person page slugs for linking
  const castWithLinks = await Promise.all(
    cast.slice(0, 6).map(async (actor: any) => {
      if (!actor.id) return { ...actor, personSlug: null };
      
      const person = await prisma.persons.findUnique({
        where: { tmdbId: actor.id },
        select: { slug: true }
      });
      
      return {
        ...actor,
        personSlug: person?.slug || null
      };
    })
  );
  
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
  const seriesQA = await getSeriesQA(
    series.name || series.title,
    series.overview || '',
    series.status || 'UNKNOWN',
    series.numberOfSeasons || 0,
    series.firstAirDate,
    series.lastAirDate
  );

  // Extract year information
  const startYear = series.firstAirDate ? new Date(series.firstAirDate).getFullYear() : undefined;
  const endYear = series.lastAirDate ? new Date(series.lastAirDate).getFullYear() : undefined;
  
  // Extract genres
  const genres = series.genres ? (series.genres as any[]).map(g => g.name) : [];
  
  // MODUL 0: "Warum relevant"-Context (kulturelle Relevanz, KEIN News-Ton)
  const relevanceContext = await generateRelevanceContext(
    series.name || series.title || '',
    series.overview || '',
    series.status || 'UNKNOWN',
    series.voteAverage || 0,
    series.numberOfSeasons || 0
  );
  
  // MODUL 1: Status Context (NUR bei echtem Mehrwert)
  const statusContext = generateStatusContext(
    series.status,
    series.name || series.title || '',
    series.networks && series.networks.length > 0 ? series.networks[0] : undefined,
    series.lastAirDate,
    series.numberOfSeasons
  );
  
  // Generate structured data
  const seriesSchema = generateSeriesSchema({
    name: series.name || series.title || '',
    description: series.overview || '',
    posterUrl: `/img/poster/${series.tmdbType}/${tmdbId}`,
    tmdbId,
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
        relevanceContext={relevanceContext || null}
        statusContext={statusContext || null}
        seriesQA={seriesQA || []}
        slug={slug}
        characters={characters || []}
      />
    </main>
  );
}
