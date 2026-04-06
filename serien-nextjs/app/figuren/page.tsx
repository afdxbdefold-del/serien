/**
 * Figuren Overview Page
 * Lists all published fictional characters with search and pagination
 */

import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import prisma from '@/lib/prisma';
import { Search } from 'lucide-react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';


export const metadata: Metadata = {
  title: 'Serienfiguren - Charaktere & Rollen | serien.de',
  description: 'Alle wichtigen Serienfiguren im Überblick: Rolle, Bedeutung und Hintergrund zu den Charakteren deiner Lieblingsserien.',
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
  },
  alternates: {
    canonical: 'https://serien.de/figuren',
  },
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
}

const PER_PAGE = 48;

export default async function FigurenPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const searchQuery = params.q?.trim() || '';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));

  const where: any = { publishStatus: 'published' };
  if (searchQuery) {
    where.OR = [
      { name: { contains: searchQuery, mode: 'insensitive' } },
      { series: { title: { contains: searchQuery, mode: 'insensitive' } } },
      { series: { name: { contains: searchQuery, mode: 'insensitive' } } },
    ];
  }

  const [characters, totalCharacters] = await Promise.all([
    prisma.characters.findMany({
      where,
      include: {
        series: { select: { tmdbId: true, name: true, title: true, posterPath: true, slug: true } },
        actor: { select: { name: true, profilePath: true } },
      },
      orderBy: [{ series: { popularity: 'desc' } }, { name: 'asc' }],
      skip: (currentPage - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.characters.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCharacters / PER_PAGE);
  const totalSeries = totalCharacters; // simplified for display

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

      <div className="container mx-auto px-4 max-w-6xl py-10">
        {characters.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">{searchQuery ? `Keine Figuren gefunden für "${searchQuery}"` : 'Noch keine Figuren vorhanden.'}</p>
            {searchQuery && (
              <Link href="/figuren" className="mt-3 inline-block text-blue-600 hover:underline">Alle anzeigen</Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="figuren-grid">
              {characters.map((character) => {
                const seriesName = character.series?.name || character.series?.title || '';
                return (
                  <Link
                    key={character.id}
                    href={`/figur/${character.slug}`}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow group"
                    data-testid={`figur-card-${character.slug}`}
                  >
                    <div className="flex items-start gap-3">
                      {character.actor?.profilePath && (
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${character.actor.profilePath}`}
                          alt={character.name}
                          width={50}
                          height={75}
                          className="rounded-lg shadow-sm flex-shrink-0"
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors text-sm line-clamp-2">
                          {character.name}
                        </h3>
                        {character.actor && (
                          <p className="text-xs text-gray-500 mt-0.5">{character.actor.name}</p>
                        )}
                        {seriesName && (
                          <p className="text-xs text-blue-600 mt-1 line-clamp-1">{seriesName}</p>
                        )}
                        {character.shortDescription && (
                          <p className="text-xs text-gray-600 line-clamp-2 mt-1">{character.shortDescription}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2" data-testid="figuren-pagination">
                {currentPage > 1 && (
                  <Link
                    href={`/figuren?${searchQuery ? `q=${encodeURIComponent(searchQuery)}&` : ''}page=${currentPage - 1}`}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
                  >
                    Zurück
                  </Link>
                )}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                    const show = p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2);
                    if (!show) {
                      if (p === 2 || p === totalPages - 1) return <span key={p} className="px-1 text-gray-400 text-sm">...</span>;
                      return null;
                    }
                    return (
                      <Link
                        key={p}
                        href={`/figuren?${searchQuery ? `q=${encodeURIComponent(searchQuery)}&` : ''}page=${p}`}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                          p === currentPage ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </Link>
                    );
                  })}
                </div>
                {currentPage < totalPages && (
                  <Link
                    href={`/figuren?${searchQuery ? `q=${encodeURIComponent(searchQuery)}&` : ''}page=${currentPage + 1}`}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
                  >
                    Weiter
                  </Link>
                )}
              </nav>
            )}
          </>
        )}

        {/* Stats */}
        {!searchQuery && (
          <p className="text-center text-sm text-gray-500 mt-6">
            {totalCharacters} Figuren · Seite {currentPage} von {totalPages}
          </p>
        )}
      </div>
    </div>
  );
}
