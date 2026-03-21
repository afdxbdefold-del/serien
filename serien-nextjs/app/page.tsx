import prisma from '@/lib/prisma';
import HomeClient from '@/components/HomeClient';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { unstable_cache } from 'next/cache';

// ISR - Revalidate every 60 seconds for fresh content
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Serien-News, Trailer & Updates | serien.de',
  description: 'Serien.de – News, Trailer & Updates zu deinen Lieblingsserien. Folge Serien, entdecke neue Highlights und verpasse keine wichtigen Updates mehr.',
  keywords: ['Serien', 'TV-Serien', 'Streaming', 'Netflix', 'Amazon Prime', 'Disney+', 'HBO Max', 'Serien News', 'Trailer', 'neue Serien'],
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de'),
  openGraph: {
    title: 'Serien-News, Trailer & Updates | serien.de',
    description: 'Serien.de – News, Trailer & Updates zu deinen Lieblingsserien. Folge Serien, entdecke neue Highlights und verpasse keine wichtigen Updates mehr.',
    type: 'website',
    url: '/',
    siteName: 'serien.de',
    locale: 'de_DE',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'serien.de',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Serien-News, Trailer & Updates | serien.de',
    description: 'Serien.de – News, Trailer & Updates zu deinen Lieblingsserien.',
    creator: '@serien_de',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/',
  },
};

// Cached database queries for better performance
const getHomepageData = unstable_cache(
  async () => {
    const [articles, series, seriesCount, articlesCount, streamingSeries] = await Promise.all([
      prisma.articles.findMany({
        where: { 
          OR: [
            { status: 'published' },
            { status: 'PUBLISHED' }
          ]
        },
        include: {
          users: { 
            select: { 
              name: true,
              id: true
            } 
          },
          series: {
            select: {
              title: true,
              slug: true,
              networks: true,
            }
          }
        },
        orderBy: { publishedAt: 'desc' },
        take: 20
      }),
      prisma.series.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.series.count(),
      prisma.articles.count({ 
        where: { 
          OR: [
            { status: 'published' },
            { status: 'PUBLISHED' }
          ]
        } 
      }),
      prisma.series.findMany({
        where: {
          OR: [
            { status: 'RUNNING' },
            { status: 'Returning Series' },
          ]
        },
        orderBy: { updatedAt: 'desc' },
        take: 12,
        select: {
          tmdbId: true,
          title: true,
          slug: true,
          networks: true,
        }
      })
    ]);

    return { articles, series, seriesCount, articlesCount, streamingSeries };
  },
  ['homepage-data'],
  { revalidate: 60, tags: ['homepage'] }
);

export default async function Page() {
  // Fetch cached homepage data
  let articles, series, seriesCount, articlesCount, streamingSeries;
  
  try {
    const data = await getHomepageData();
    articles = data.articles;
    series = data.series;
    seriesCount = data.seriesCount;
    articlesCount = data.articlesCount;
    streamingSeries = data.streamingSeries;
  } catch (error) {
    console.error('Homepage DB query failed:', error);
    articles = [];
    series = [];
    seriesCount = 0;
    articlesCount = 0;
    streamingSeries = [];
  }

  const stats = {
    series_total: seriesCount,
    news_total: articlesCount,
    series_german: seriesCount // Placeholder
  };

  // Check if user is authenticated by verifying JWT cookie
  let isAuthenticated = false;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token');
    
    if (token && process.env.JWT_SECRET) {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      await jwtVerify(token.value, secret);
      isAuthenticated = true;
    }
  } catch (error) {
    // Token invalid or expired
    isAuthenticated = false;
  }

  // Serialize data for client component (convert Dates to strings)
  // Handle both Date objects and already-serialized strings from cache
  const toISOString = (value: any) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    return null;
  };

  const serializedArticles = articles.map((article: any) => ({
    ...article,
    publishedAt: toISOString(article.publishedAt),
    updatedAt: toISOString(article.updatedAt),
    createdAt: toISOString(article.createdAt),
    sourcePublishedAt: toISOString(article.sourcePublishedAt),
  }));

  const serializedSeries = series.map((s: any) => ({
    ...s,
    firstAirDate: toISOString(s.firstAirDate),
    lastAirDate: toISOString(s.lastAirDate),
    createdAt: toISOString(s.createdAt),
    updatedAt: toISOString(s.updatedAt),
    statusLastUpdate: toISOString(s.statusLastUpdate),
    lastNewsDate: toISOString(s.lastNewsDate),
  }));

  // Format streaming series for the component
  const formattedStreamingSeries = streamingSeries.map((s: any) => ({
    tmdbId: s.tmdbId,
    title: s.title,
    slug: s.slug,
    network: Array.isArray(s.networks) ? s.networks[0] : s.networks,
  }));

  return (
    <>
      <HomeClient 
        initialNews={serializedArticles} 
        initialSeries={serializedSeries} 
        stats={stats}
        isAuthenticated={isAuthenticated}
        streamingSeries={formattedStreamingSeries}
      />
    </>
  );
}
