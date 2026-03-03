import prisma from '@/lib/prisma';
import HomeClient from '@/components/HomeClient';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// Force dynamic rendering - homepage needs real-time data
export const dynamic = 'force-dynamic';

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

export const revalidate = 60; // Revalidate every 60 seconds

export default async function Page() {
  // Fetch news, series, and stats from database
  let articles, series, seriesCount, articlesCount;
  
  try {
    // Defensive check for Vercel serverless environment
    if (!prisma) {
      throw new Error('Prisma client is not initialized');
    }
    
    [articles, series, seriesCount, articlesCount] = await Promise.all([
      prisma.article.findMany({
        where: { status: 'published' },
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
      prisma.article.count({ where: { status: 'published' } })
    ]);
  } catch (error) {
    console.error('Homepage DB query failed:', error);
    // Return empty data on error
    articles = [];
    series = [];
    seriesCount = 0;
    articlesCount = 0;
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

  return (
    <>
      <HomeClient 
        initialNews={articles} 
        initialSeries={series} 
        stats={stats}
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}
