/**
 * Figuren Overview Page
 * Lists all published fictional characters with search, A-Z filter and pagination
 */

import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import prisma from '@/lib/prisma';
import { Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 48;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const letter = params.letter?.toUpperCase() || '';
  const base = 'https://serien.de/figuren';
  const paramParts: string[] = [];
  if (page > 1) paramParts.push(`page=${page}`);
  if (letter) paramParts.push(`letter=${letter}`);
  const canonical = paramParts.length > 0 ? `${base}?${paramParts.join('&')}` : base;
  const suffix = page > 1 ? ` – Seite ${page}` : '';

  return {
    title: `Serienfiguren - Charaktere & Rollen${suffix} | serien.de`,
    description: 'Alle wichtigen Serienfiguren im Überblick: Rolle, Bedeutung und Hintergrund zu den Charakteren deiner Lieblingsserien.',
    robots: { index: true, follow: true, 'max-image-preview': 'large' as const, 'max-snippet': -1 },
    alternates: { canonical },
  };
}

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; letter?: string }>;
}

export default async function FigurenPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const searchQuery = params.q?.trim() || '';
  const activeLetter = params.letter?.toUpperCase() || '';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));

  const where: any = { publishStatus: 'published' };
  const conditions: any[] = [{ publishStatus: 'published' }];

  if (searchQuery) {
    conditions.push({
      OR: [
        { name: { contains: searchQuery, mode: 'insensitive' } },
        { series: { title: { contains: searchQuery, mode: 'insensitive' } } },
        { series: { name: { contains: searchQuery, mode: 'insensitive' } } },
      ],
    });
  }
  if (activeLetter && LETTERS.includes(activeLetter)) {
    conditions.push({ name: { startsWith: activeLetter, mode: 'insensitive' } });
  }

  const finalWhere = conditions.length > 1 ? { AND: conditions } : conditions[0];
  const orderBy = activeLetter
    ? [{ name: 'asc' as const }]
    : [{ series: { popularity: 'desc' as const } }, { name: 'asc' as const }];

  const [characters, totalCharacters] = await Promise.all([
    prisma.characters.findMany({
      where: finalWhere,
      include: {
        series: { select: { tmdbId: true, name: true, title: true, posterPath: true, slug: true } },
        actor: { select: { name: true, profilePath: true } },
      },
      orderBy,
      skip: (currentPage - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.characters.count({ where: finalWhere }),
  ]);

  const totalPages = Math.ceil(totalCharacters / PER_PAGE);

  function buildUrl(opts: { page?: number; letter?: string; q?: string }) {
    const p = new URLSearchParams();
    const q = opts.q ?? searchQuery;
    const l = opts.letter ?? activeLetter;
    if (q) p.set('q', q);
    if (l) p.set('letter', l);
    if (opts.page && opts.page > 1) p.set('page', String(opts.page));
    const qs = p.toString();
    return `/figuren${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="figuren-page">
      {/* Hero */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white py-10">
        <div className="container mx-auto px-4 max-w-6xl">
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Serienfiguren</h1>
          <p className="text-base text-slate-300 mb-5">
            {totalCharacters.toLocaleString('de-DE')} Figuren{activeLetter ? ` mit "${activeLetter}"` : ''} aus deinen Lieblingsserien
          </p>
          <form method="GET" action="/figuren">
            {activeLetter && <input type="hidden" name="letter" value={activeLetter} />}
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text" name="q" defaultValue={searchQuery}
                placeholder="Figur, Schauspieler oder Serie suchen..."
                data-testid="figuren-search"
                className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/15"
              />
            </div>
          </form>
          {searchQuery && (
            <p className="mt-2 text-sm text-slate-400">
              {totalCharacters === 0 ? `Keine Ergebnisse für "${searchQuery}"` : `${totalCharacters} Treffer für "${searchQuery}"`}
              {' · '}<Link href={activeLetter ? `/figuren?letter=${activeLetter}` : '/figuren'} className="text-blue-400 hover:underline">Suche zurücksetzen</Link>
            </p>
          )}
        </div>
      </div>

      {/* A-Z Filter */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10" data-testid="figuren-letter-filter">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center gap-0.5 py-2 overflow-x-auto scrollbar-hide">
            <Link
              href={searchQuery ? `/figuren?q=${encodeURIComponent(searchQuery)}` : '/figuren'}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                !activeLetter ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
              data-testid="figuren-filter-all"
            >
              Alle
            </Link>
            {LETTERS.map((letter) => (
              <Link
                key={letter}
                href={buildUrl({ letter, page: 1, q: searchQuery })}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
                  activeLetter === letter ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
                data-testid={`figuren-filter-${letter}`}
              >
                {letter}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="container mx-auto px-4 max-w-6xl py-8">
        {characters.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg">{searchQuery ? `Keine Figuren für "${searchQuery}"` : activeLetter ? `Keine Figuren mit "${activeLetter}"` : 'Noch keine Figuren vorhanden.'}</p>
            <Link href="/figuren" className="mt-3 inline-block text-blue-600 hover:underline">Alle anzeigen</Link>
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
                          alt={character.name} width={50} height={75}
                          className="rounded-lg shadow-sm flex-shrink-0" loading="lazy"
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
                  <Link href={buildUrl({ page: currentPage - 1 })} className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
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
                      <Link key={p} href={buildUrl({ page: p })}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                          p === currentPage ? 'bg-slate-900 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >{p}</Link>
                    );
                  })}
                </div>
                {currentPage < totalPages && (
                  <Link href={buildUrl({ page: currentPage + 1 })} className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
                    Weiter
                  </Link>
                )}
              </nav>
            )}
          </>
        )}

        {totalPages > 1 && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Seite {currentPage} von {totalPages} · {totalCharacters.toLocaleString('de-DE')} Figuren
          </p>
        )}
      </div>
    </div>
  );
}
