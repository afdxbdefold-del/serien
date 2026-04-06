/**
 * Actor Hub - Central page for all actors/persons
 * Route: /personen
 * Server-side pagination + search
 */

import prisma from '@/lib/prisma';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 60;

export const metadata: Metadata = {
  title: 'Schauspieler & Stars - Alle Serien-Darsteller | serien.de',
  description: 'Entdecke alle Schauspieler und Stars aus deinen Lieblingsserien. Profile, Rollen, News und mehr.',
  robots: { index: true, follow: true, 'max-image-preview': 'large' as const, 'max-snippet': -1 },
  alternates: { canonical: 'https://serien.de/personen' },
};

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function PersonenPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const searchQuery = params.q?.trim() || '';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));

  const where = searchQuery
    ? { name: { contains: searchQuery, mode: 'insensitive' as const } }
    : {};

  const [persons, totalCount] = await Promise.all([
    prisma.persons.findMany({
      where,
      orderBy: { popularity: 'desc' },
      skip: (currentPage - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        slug: true,
        name: true,
        profilePath: true,
        knownFor: true,
        popularity: true,
        _count: { select: { article_persons: true } },
      },
    }),
    prisma.persons.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / PER_PAGE);

  function buildUrl(page: number) {
    const p = new URLSearchParams();
    if (searchQuery) p.set('q', searchQuery);
    if (page > 1) p.set('page', String(page));
    const qs = p.toString();
    return `/personen${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="personen-page">
      {/* Hero */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">Schauspieler & Stars</h1>
          <p className="text-lg text-slate-300 mb-6">
            {totalCount.toLocaleString('de-DE')} Schauspieler aus deinen Lieblingsserien
          </p>
          <form method="GET" action="/personen">
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder="Schauspieler suchen..."
                data-testid="personen-search"
                className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/15"
              />
            </div>
          </form>
          {searchQuery && (
            <p className="mt-3 text-sm text-slate-400">
              {totalCount === 0
                ? `Keine Ergebnisse für "${searchQuery}"`
                : `${totalCount} Treffer für "${searchQuery}"`}
              {' · '}
              <Link href="/personen" className="text-blue-400 hover:underline">Alle anzeigen</Link>
            </p>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="container mx-auto px-4 max-w-6xl py-10">
        {persons.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-xl mb-2">Keine Schauspieler gefunden</p>
            {searchQuery && (
              <Link href="/personen" className="text-blue-600 hover:underline">Alle anzeigen</Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4" data-testid="personen-grid">
            {persons.map((person) => (
              <Link key={person.id} href={`/person/${person.slug}`} className="group" data-testid={`person-card-${person.slug}`}>
                <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                  <div className="relative aspect-[2/3] bg-gray-200">
                    {person.profilePath ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w185${person.profilePath}`}
                        alt={person.name}
                        fill
                        sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
                        className="object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                    )}
                    {person._count.article_persons > 0 && (
                      <div className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        {person._count.article_persons}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <h3 className="font-medium text-gray-900 text-xs leading-tight line-clamp-2 group-hover:text-blue-600 transition">
                      {person.name}
                    </h3>
                    {person.knownFor && (
                      <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">{person.knownFor}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2" data-testid="personen-pagination">
            {currentPage > 1 && (
              <Link href={buildUrl(currentPage - 1)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
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
                    href={buildUrl(p)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      p === currentPage ? 'bg-slate-900 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </Link>
                );
              })}
            </div>
            {currentPage < totalPages && (
              <Link href={buildUrl(currentPage + 1)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
                Weiter
              </Link>
            )}
          </nav>
        )}

        {/* Footer Stats */}
        {!searchQuery && totalPages > 1 && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Seite {currentPage} von {totalPages} · {totalCount.toLocaleString('de-DE')} Schauspieler
          </p>
        )}
      </div>
    </div>
  );
}
