import prisma from '@/lib/prisma';
import { Metadata } from 'next';
import TrendingClient from '@/components/TrendingClient';

export const metadata: Metadata = {
  title: 'Trending Serien | serien.de',
  description: 'Die beliebtesten und angesagtesten Serien im Trend - entdecke was gerade alle schauen.',
};

export const revalidate = 3600; // Revalidate every hour

export default async function TrendingPage() {
  // Fetch all series with necessary fields for filtering
  const series = await prisma.series.findMany({
    select: {
      tmdbId: true,
      title: true,
      slug: true,
      posterLocalUrl: true,
      status: true,
      genres: true,
      networks: true,
      voteAverage: true,
      firstAirDate: true,
      numberOfSeasons: true,
      popularity: true,
      updatedAt: true,
    },
    orderBy: [
      { popularity: 'desc' },
      { updatedAt: 'desc' },
    ],
    take: 200,
  });

  // Serialize dates for client component
  const serializedSeries = series.map(s => ({
    ...s,
    firstAirDate: s.firstAirDate ? s.firstAirDate : null,
    updatedAt: s.updatedAt,
  }));

  return <TrendingClient series={serializedSeries} />;
}
