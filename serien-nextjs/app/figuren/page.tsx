/**
 * Figuren Overview Page
 * Lists all published fictional characters with search and pagination
 */

import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import prisma from '@/lib/prisma';
import { Search } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Serienfiguren - Charaktere & Rollen | serien.de',
  description: 'Alle wichtigen Serienfiguren im Überblick: Rolle, Bedeutung und Hintergrund zu den Charakteren deiner Lieblingsserien.',
};

interface PageProps {
  searchParams: {
    q?: string;
    page?: string;
  };
}

const SERIES_PER_PAGE = 20;

export default async function FigurenPage({ searchParams }: PageProps) {
  const searchQuery = searchParams.q?.toLowerCase() || '';
  const currentPage = parseInt(searchParams.page || '1', 10);

  // Fetch all published characters with their series and actor
  const allCharacters = await prisma.characters.findMany({
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
  const charactersBySeries = allCharacters.reduce((acc, char) => {
    const seriesName = char.series.name || char.series.title;
    if (!acc[seriesName]) {
      acc[seriesName] = {
        series: char.series,
        characters: [],
      };
    }
    acc[seriesName].characters.push(char);
    return acc;
  }, {} as Record<string, { series: any; characters: typeof allCharacters }>);

  let seriesGroups = Object.values(charactersBySeries);

  // Filter by search query
  if (searchQuery) {
    seriesGroups = seriesGroups.filter((group) => {
      const seriesName = (group.series.name || group.series.title).toLowerCase();
      const hasSeriesMatch = seriesName.includes(searchQuery);
      
      const hasCharacterMatch = group.characters.some((char) => 
        char.name.toLowerCase().includes(searchQuery) ||
        char.actor?.name.toLowerCase().includes(searchQuery)
      );

      return hasSeriesMatch || hasCharacterMatch;
    });
  }

  // Pagination
  const totalSeries = seriesGroups.length;
  const totalPages = Math.ceil(totalSeries / SERIES_PER_PAGE);
  const startIndex = (currentPage - 1) * SERIES_PER_PAGE;
  const endIndex = startIndex + SERIES_PER_PAGE;
  const paginatedGroups = seriesGroups.slice(startIndex, endIndex);

  const totalCharacters = allCharacters.length;

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

          {/* Search Bar */}
          <form method="GET" className="mt-6">
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder="Figur, Schauspieler oder Serie suchen..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </form>

          {/* Search Results Info */}
          {searchQuery && (
            <p className="mt-4 text-sm text-gray-600">
              {totalSeries === 0 ? (
                <>Keine Ergebnisse für "{searchQuery}"</>
              ) : (
                <>
                  {totalSeries} {totalSeries === 1 ? 'Serie gefunden' : 'Serien gefunden'} für "{searchQuery}"
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-6xl py-12">
        {paginatedGroups.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              {searchQuery ? `Keine Figuren gefunden für "${searchQuery}"` : 'Noch keine Figuren vorhanden.'}
            </p>
            {searchQuery && (
              <Link
                href="/figuren"
                className="mt-4 inline-block text-blue-600 hover:text-blue-700 font-medium"
              >
                Alle Figuren anzeigen
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-12">
              {paginatedGroups.map((group) => {
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                {/* Previous Button */}
                {currentPage > 1 && (
                  <Link
                    href={`/figuren?${searchQuery ? `q=${encodeURIComponent(searchQuery)}&` : ''}page=${currentPage - 1}`}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  >
                    ← Zurück
                  </Link>
                )}

                {/* Page Numbers */}
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    // Show first page, last page, current page, and pages around current
                    const showPage =
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1);

                    if (!showPage) {
                      // Show ellipsis
                      if (pageNum === 2 || pageNum === totalPages - 1) {
                        return (
                          <span key={pageNum} className="px-2 text-gray-400">
                            ...
                          </span>
                        );
                      }
                      return null;
                    }

                    return (
                      <Link
                        key={pageNum}
                        href={`/figuren?${searchQuery ? `q=${encodeURIComponent(searchQuery)}&` : ''}page=${pageNum}`}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          pageNum === currentPage
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </Link>
                    );
                  })}
                </div>

                {/* Next Button */}
                {currentPage < totalPages && (
                  <Link
                    href={`/figuren?${searchQuery ? `q=${encodeURIComponent(searchQuery)}&` : ''}page=${currentPage + 1}`}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  >
                    Weiter →
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {/* Stats Footer */}
        {!searchQuery && (
          <div className="mt-16 pt-8 border-t border-gray-200">
            <div className="text-center">
              <p className="text-gray-600">
                Insgesamt <span className="font-semibold text-gray-900">{totalCharacters}</span> Figuren 
                aus <span className="font-semibold text-gray-900">{totalSeries}</span> {totalSeries === 1 ? 'Serie' : 'Serien'}
              </p>
              {totalPages > 1 && (
                <p className="text-sm text-gray-500 mt-2">
                  Seite {currentPage} von {totalPages}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
