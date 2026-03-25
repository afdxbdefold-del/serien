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
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
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
    const [articles, series, seriesCount, articlesCount] = await Promise.all([
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
        take: 11  // 5 for carousel + 6 for initial grid (reduces LCP)
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
    ]);

    // Fetch trending series from streaming_releases (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const trendingReleases = await prisma.streaming_releases.findMany({
      where: {
        date: { gte: sevenDaysAgo },
        // Exclude anime providers
        NOT: {
          provider: { in: ['Crunchyroll', 'Anime on Demand', 'Wakanim'] }
        }
      },
      orderBy: [
        { voteAverage: 'desc' },
        { date: 'desc' }
      ],
      take: 50,
      distinct: ['tmdbId'],
    });

    // Get TMDB IDs to look up real slugs
    const tmdbIds = trendingReleases.map(r => r.tmdbId);
    const existingSeries = await prisma.series.findMany({
      where: { tmdbId: { in: tmdbIds } },
      select: { tmdbId: true, slug: true }
    });
    const slugMap = new Map(existingSeries.map(s => [s.tmdbId, s.slug]));

    // Helper to generate slug from title (without ID)
    const generateSlug = (title: string): string => {
      return title
        .toLowerCase()
        .replace(/[äÄ]/g, 'ae')
        .replace(/[öÖ]/g, 'oe')
        .replace(/[üÜ]/g, 'ue')
        .replace(/[ß]/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 60);
    };

    // Map to the expected format and deduplicate by tmdbId
    // Also filter out anime by checking for common anime indicators in the name
    const animeKeywords = ['anime', 'dragon ball', 'naruto', 'one piece anime', 'attack on titan', 'demon slayer', 'jujutsu', 'my hero academia', 'bleach', 'hunter x hunter'];
    const seen = new Set<number>();
    const streamingSeries = trendingReleases
      .filter(r => {
        if (seen.has(r.tmdbId)) return false;
        // Filter out anime by name
        const nameLower = r.name.toLowerCase();
        if (animeKeywords.some(kw => nameLower.includes(kw))) return false;
        seen.add(r.tmdbId);
        return true;
      })
      .slice(0, 12)
      .map(r => ({
        tmdbId: r.tmdbId,
        title: r.name,
        slug: slugMap.get(r.tmdbId) || generateSlug(r.name),
        networks: [r.provider],
      }));

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

  // Get the first article's hero image for preload
  const firstArticle = serializedArticles[0];
  const heroPreloadUrl = firstArticle?.tmdbId && firstArticle?.tmdbType 
    ? `/img/hero/${firstArticle.tmdbType}/${firstArticle.tmdbId}`
    : firstArticle?.heroLocalUrl;

  return (
    <>
      {heroPreloadUrl && (
        <link 
          rel="preload" 
          as="image" 
          href={heroPreloadUrl}
          fetchPriority="high"
        />
      )}
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
