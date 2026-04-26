import prisma from '@/lib/prisma';
import { Metadata } from 'next';
import TrendingClient from '@/components/TrendingClient';
import { normalizeStreamerList } from '@/lib/streamer-names';

// Force dynamic rendering
export const dynamic = 'force-dynamic';


export const metadata: Metadata = {
  title: 'Serienfinder | serien.de',
  description: 'Finde deine nächste Lieblingsserie - mit umfangreichen Filtern nach Genre, Sender, Bewertung und mehr.',
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
  },
  alternates: {
    canonical: 'https://serien.de/serienfinder',
  },
};

export const revalidate = 3600; // Revalidate every hour

export default async function SerienfinderPage() {
  // Fetch all series with necessary fields for filtering
  const series = await prisma.series.findMany({
    select: {
      tmdbId: true,
      title: true,
      slug: true,
      posterLocalUrl: true,
      posterPath: true,
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
      { popularity: { sort: 'desc', nulls: 'last' } },
      { updatedAt: 'desc' },
    ],
    take: 200,
  });

  // Serialize dates for client component + normalize streamer names
  const serializedSeries = series.map(s => ({
    ...s,
    networks: normalizeStreamerList(s.networks ?? []),
    firstAirDate: s.firstAirDate ? s.firstAirDate : null,
    updatedAt: s.updatedAt,
  }));

  return <TrendingClient series={serializedSeries} />;
}
