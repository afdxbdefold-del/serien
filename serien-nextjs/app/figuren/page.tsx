/**
 * Figuren Overview Page
 * Lists all published fictional characters
 */

import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import prisma from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Serienfiguren - Charaktere & Rollen | serien.de',
  description: 'Alle wichtigen Serienfiguren im Überblick: Rolle, Bedeutung und Hintergrund zu den Charakteren deiner Lieblingsserien.',
};

export default async function FigurenPage() {
  // Fetch all published characters with their series and actor
  const characters = await prisma.characters.findMany({
    where: {
      publishStatus: 'published',
    },
    include: {
      series: {
        select: {
          tmdbId: true,
          name: true,
          title: true,
          posterPath: true,
        },
      },
      actor: {
        select: {
          name: true,
          profilePath: true,
        },
      },
    },
    orderBy: [
      { seriesTmdbId: 'asc' },
      { name: 'asc' },
    ],
  });

  // Group characters by series
  const charactersBySeries = characters.reduce((acc, char) => {
    const seriesName = char.series.name || char.series.title;
    if (!acc[seriesName]) {
      acc[seriesName] = {
        series: char.series,
        characters: [],
      };
    }
    acc[seriesName].characters.push(char);
    return acc;
  }, {} as Record<string, { series: any; characters: typeof characters }>);

  const seriesGroups = Object.values(charactersBySeries);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-blue-50 to-white py-12 border-b border-gray-200">
        <div className="container mx-auto px-4 max-w-6xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            🎭 Serienfiguren
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Entdecke die wichtigsten Charaktere deiner Lieblingsserien: Rolle, Bedeutung, 
            Hintergrund und aktuelle News zu den fiktiven Figuren.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-6xl py-12">
        {seriesGroups.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">Noch keine Figuren vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {seriesGroups.map((group) => {
              const seriesName = group.series.name || group.series.title;
              
              return (
                <section key={seriesName} className="space-y-6">
                  {/* Series Header */}
                  <div className="flex items-center gap-4">
                    {group.series.posterPath && (
                      <Link href={`/serie/${group.series.tmdbId}`}>
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${group.series.posterPath}`}
                          alt={seriesName}
                          width={60}
                          height={90}
                          className="rounded-lg shadow-md hover:shadow-lg transition-shadow"
                        />
                      </Link>
                    )}
                    <div>
                      <Link
                        href={`/serie/${group.series.tmdbId}`}
                        className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {seriesName}
                      </Link>
                      <p className="text-sm text-gray-500 mt-1">
                        {group.characters.length} {group.characters.length === 1 ? 'Figur' : 'Figuren'}
                      </p>
                    </div>
                  </div>

                  {/* Characters Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {group.characters.map((character) => (
                      <Link
                        key={character.id}
                        href={`/figur/${character.slug}`}
                        className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-shadow group"
                      >
                        <div className="flex items-start gap-4">
                          {character.actor?.profilePath && (
                            <Image
                              src={`https://image.tmdb.org/t/p/w185${character.actor.profilePath}`}
                              alt={character.name}
                              width={60}
                              height={90}
                              className="rounded-lg shadow-sm"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1 line-clamp-2">
                              {character.name}
                            </h3>
                            {character.actor && (
                              <p className="text-sm text-gray-500 mb-2">
                                {character.actor.name}
                              </p>
                            )}
                            {character.shortDescription && (
                              <p className="text-xs text-gray-600 line-clamp-3">
                                {character.shortDescription}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Stats Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200">
          <div className="text-center">
            <p className="text-gray-600">
              Insgesamt <span className="font-semibold text-gray-900">{characters.length}</span> Figuren 
              aus <span className="font-semibold text-gray-900">{seriesGroups.length}</span> Serien
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
