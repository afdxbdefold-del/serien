/**
 * Related Series Component
 * Shows up to 4 similar series based on genre/platform
 */

import Image from 'next/image';  
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Tv } from 'lucide-react';

interface RelatedSeriesProps {
  currentSeriesId: number;
  genres?: string[];
  networks?: string[];
}

export default async function RelatedSeries({ currentSeriesId, genres, networks }: RelatedSeriesProps) {
  if (!genres || genres.length === 0) return null;

  // Find related series by genre
  const relatedSeries = await prisma.series.findMany({
    where: {
      AND: [
        { tmdbId: { not: currentSeriesId } },
        {
          OR: [
            // Match by genre
            { genres: { hasSome: genres.slice(0, 2) } },
            // Match by network
            networks && networks.length > 0
              ? { networks: { hasSome: networks.slice(0, 1) } }
              : {}
          ]
        }
      ]
    },
    take: 4,
    orderBy: {
      popularity: 'desc'
    },
    select: {
      tmdbId: true,
      slug: true,
      name: true,
      title: true,
      posterPath: true,
      firstAirDate: true,
      voteAverage: true
    }
  });

  if (relatedSeries.length === 0) return null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        Ähnliche Serien
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {relatedSeries.map((series) => (
          <Link
            key={series.tmdbId}
            href={`/serie/${series.slug}`}
            className="group"
          >
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 mb-2 shadow-sm">
              {series.posterPath ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w342${series.posterPath}`}
                  alt={series.name || series.title}
                  fill
                  sizes="(max-width: 640px) 50vw, 200px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Tv className="h-12 w-12 text-gray-400" />
                </div>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
              {series.name || series.title}
            </p>
            {series.firstAirDate && (
              <p className="text-xs text-gray-600 mt-1">
                {new Date(series.firstAirDate).getFullYear()}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
