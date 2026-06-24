/**
 * Series Cast Section Component
 * Top 6 actors with links to internal actor pages
 */

import Image from 'next/image';
import Link from 'next/link';
import { User } from 'lucide-react';
import prisma from '@/lib/prisma';
import { createPersonSlug } from '@/lib/tmdb-person';

interface SeriesCastProps {
  seriesName: string;
  cast: any[]; // TMDB cast array
}

export default async function SeriesCast({ seriesName, cast }: SeriesCastProps) {
  if (!cast || cast.length === 0) return null;

  // Get top 6 actors
  const topCast = cast.slice(0, 6);

  // Check which actors have internal pages (for linking)
  const castWithPages = await Promise.all(
    topCast.map(async (actor) => {
      // Skip if actor doesn't have an ID
      if (!actor.id) {
        return {
          ...actor,
          hasInternalPage: false,
          internalSlug: null
        };
      }

      const person = await prisma.persons.findUnique({
        where: { tmdbId: actor.id },
        select: { slug: true, name: true }
      });

      return {
        ...actor,
        hasInternalPage: !!person,
        internalSlug: person?.slug || null
      };
    })
  );

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        Besetzung von {seriesName}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {castWithPages.map((actor) => {
          // Schauspieler-Fotos site-wide entfernt (Juni 2026, Bildrechte).
          const ActorCard = (
            <div className="group cursor-pointer bg-gray-50 hover:bg-blue-50 rounded-lg p-3 transition-colors h-full">
              <p className="font-semibold text-sm text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                {actor.name}
              </p>
              {actor.character && (
                <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                  als {actor.character}
                </p>
              )}
            </div>
          );

          return actor.hasInternalPage ? (
            <Link key={actor.id} href={`/person/${actor.internalSlug}`}>
              {ActorCard}
            </Link>
          ) : (
            <div key={actor.id}>
              {ActorCard}
            </div>
          );
        })}
      </div>
    </section>
  );
}