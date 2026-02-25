import prisma from '@/lib/prisma';
import HomeClient from '@/components/HomeClient';
import { Metadata } from 'next';

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
  const [articles, series, seriesCount, articlesCount] = await Promise.all([
    prisma.article.findMany({
      where: { status: 'published' },
      include: {
        author: { 
          select: { 
            name: true,
            id: true
          } 
        },
        series: {
          select: {
            title: true,
            slug: true
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

  const stats = {
    series_total: seriesCount,
    news_total: articlesCount,
    series_german: seriesCount // Placeholder
  };

  // Check if user is authenticated (placeholder for now)
  const isAuthenticated = false;

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
