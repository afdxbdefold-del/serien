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
      const person = await prisma.persons.findUnique({
        where: { tmdbId: actor.id },
        select: { slug: true, name: true }
      });

      return {
        ...actor,
        hasInternalPage: !!person,
        internalSlug: person?.slug || `${actor.id}-${createPersonSlug(actor.name)}`
      };
    })
  );

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        Besetzung von {seriesName}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {actorsToShow.map((actor) => {
          const ActorCard = (
            <div className="group cursor-pointer">
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 mb-2 shadow-sm">
                {actor.profile_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                    alt={actor.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 200px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="text-sm">
                <p className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {actor.name}
                </p>
                {actor.character && (
                  <p className="text-xs text-gray-600 line-clamp-1 mt-1">
                    als {actor.character}
                  </p>
                )}
              </div>
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
