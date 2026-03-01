/**
 * Series Characters Component
 * Displays fictional characters from a series with links to character pages
 */

import Link from 'next/link';
import Image from 'next/image';
import { PrismaClient } from '@prisma/client';

interface SeriesCharactersProps {
  seriesTmdbId: number;
  seriesName: string;
}

export default async function SeriesCharacters({ seriesTmdbId, seriesName }: SeriesCharactersProps) {
  // Create a new Prisma instance for this component
  const prisma = new PrismaClient();
  
  try {
    // Fetch published characters for this series
    const characters = await prisma.characters.findMany({
      where: {
        seriesTmdbId,
        publishStatus: 'published',
      },
      include: {
        actor: {
          select: {
            name: true,
            profilePath: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      take: 12, // Show max 12 characters
    });
    
    await prisma.$disconnect();

    if (!characters || characters.length === 0) {
      return null;
    }

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>🎭</span>
          <span>Figuren aus {seriesName}</span>
        </h2>
        {characters.length >= 12 && (
          <Link
            href={`/figuren?q=${encodeURIComponent(seriesName)}`}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Alle anzeigen →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {characters.map((character) => (
          <Link
            key={character.id}
            href={`/figur/${character.slug}`}
            className="group bg-gray-50 rounded-lg p-4 hover:bg-blue-50 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-3">
              {character.actor?.profilePath && (
                <div className="flex-shrink-0">
                  <Image
                    src={`https://image.tmdb.org/t/p/w185${character.actor.profilePath}`}
                    alt={character.name}
                    width={48}
                    height={72}
                    className="rounded-md shadow-sm"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 text-sm mb-1">
                  {character.name}
                </h3>
                {character.actor && (
                  <p className="text-xs text-gray-500 line-clamp-1">
                    {character.actor.name}
                  </p>
                )}
                {character.shortDescription && (
                  <p className="text-xs text-gray-600 line-clamp-2 mt-2">
                    {character.shortDescription}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          {characters.length} {characters.length === 1 ? 'Figur' : 'Figuren'} aus {seriesName}
        </p>
      </div>
    </section>
  );
  } catch (error) {
    console.error('[SeriesCharacters] Error:', error);
    await prisma.$disconnect();
    return null;
  }
}
