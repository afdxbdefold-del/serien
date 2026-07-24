/**
 * Actor Hub - Central page for all actors/persons
 * Route: /personen
 * Server-side pagination + search + A-Z filter
 */

import prisma from '@/lib/prisma';
import { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 60;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const letter = params.letter?.toUpperCase() || '';
  const base = 'https://serien.de/personen';
  const paramParts: string[] = [];
  if (page > 1) paramParts.push(`page=${page}`);
  if (letter) paramParts.push(`letter=${letter}`);
  const canonical = paramParts.length > 0 ? `${base}?${paramParts.join('&')}` : base;
  const suffix = page > 1 ? ` – Seite ${page}` : '';

  return {
    title: `Schauspieler & Stars - Alle Serien-Darsteller${suffix} | serien.de`,
    description: 'Entdecke alle Schauspieler und Stars aus deinen Lieblingsserien. Profile, Rollen, News und mehr.',
    // Feb 2026 (User-Direktive): noindex,follow — Seite selbst nicht
    // indiziert, aber Google darf den internen Links folgen.
    robots: { index: false, follow: true },
    alternates: { canonical },
  };
}

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; letter?: string }>;
}

export default async function PersonenPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const searchQuery = params.q?.trim() || '';
  const activeLetter = params.letter?.toUpperCase() || '';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));

  // Build where clause
  const conditions: any[] = [];
  if (searchQuery) {
    conditions.push({ name: { contains: searchQuery, mode: 'insensitive' } });
  }
  if (activeLetter && LETTERS.includes(activeLetter)) {
    conditions.push({ name: { startsWith: activeLetter, mode: 'insensitive' } });
  }
  const where = conditions.length > 0 ? { AND: conditions } : {};

  // When filtering by letter, sort alphabetically; otherwise by popularity
  const orderBy = activeLetter ? { name: 'asc' as const } : { popularity: 'desc' as const };

  const [persons, totalCount] = await Promise.all([
    prisma.persons.findMany({
      where,
      orderBy,
      skip: (currentPage - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, slug: true, name: true,
        knownFor: true, popularity: true,
        _count: { select: { article_persons: true } },
      },
    }),
    prisma.persons.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / PER_PAGE);

  function buildUrl(opts: { page?: number; letter?: string; q?: string }) {
    const p = new URLSearchParams();
    const q = opts.q ?? searchQuery;
    const l = opts.letter ?? activeLetter;
    if (q) p.set('q', q);
    if (l) p.set('letter', l);
    if (opts.page && opts.page > 1) p.set('page', String(opts.page));
    const qs = p.toString();
    return `/personen${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="personen-page">
      {/* Hero */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white py-10">
        <div className="container mx-auto px-4 max-w-6xl">
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">Schauspieler & Stars</h1>
          <p className="text-base text-slate-300 mb-5">
            {totalCount.toLocaleString('de-DE')} Schauspieler{activeLetter ? ` mit "${activeLetter}"` : ''} aus deinen Lieblingsserien
          </p>
          <form method="GET" action="/personen">
            {activeLetter && <input type="hidden" name="letter" value={activeLetter} />}
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text" name="q" defaultValue={searchQuery}
                placeholder="Schauspieler suchen..."
                data-testid="personen-search"
                className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/15"
              />
            </div>
          </form>
          {searchQuery && (
            <p className="mt-2 text-sm text-slate-400">
              {totalCount === 0 ? `Keine Ergebnisse für "${searchQuery}"` : `${totalCount} Treffer für "${searchQuery}"`}
              {' · '}<Link href={activeLetter ? `/personen?letter=${activeLetter}` : '/personen'} className="text-blue-400 hover:underline">Suche zurücksetzen</Link>
            </p>
          )}
        </div>
      </div>

      {/* A-Z Filter */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10" data-testid="letter-filter">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center gap-0.5 py-2 overflow-x-auto scrollbar-hide">
            <Link
              href={searchQuery ? `/personen?q=${encodeURIComponent(searchQuery)}` : '/personen'}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                !activeLetter ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
              data-testid="filter-all"
            >
              Alle
            </Link>
            {LETTERS.map((letter) => (
              <Link
                key={letter}
                href={buildUrl({ letter, page: 1, q: searchQuery })}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
                  activeLetter === letter
                    ? 'bg-slate-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                data-testid={`filter-${letter}`}
              >
                {letter}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="container mx-auto px-4 max-w-6xl py-8">
        {persons.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-xl mb-2">Keine Schauspieler gefunden</p>
            <Link href="/personen" className="text-blue-600 hover:underline">Alle anzeigen</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="personen-grid">
            {persons.map((person) => (
              <Link key={person.id} href={`/person/${person.slug}`} className="group" data-testid={`person-card-${person.slug}`}>
                <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 p-4 h-full flex flex-col justify-between border border-gray-100">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-base leading-tight group-hover:text-blue-600 transition">
                      {person.name}
                    </h3>
                    {person.knownFor && (
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">{person.knownFor}</p>
                    )}
                  </div>
                  {person._count.article_persons > 0 && (
                    <div className="mt-3 text-xs text-gray-400">
                      {person._count.article_persons} {person._count.article_persons === 1 ? 'Artikel' : 'Artikel'}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2" data-testid="personen-pagination">
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

        {!searchQuery && totalPages > 1 && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Seite {currentPage} von {totalPages} · {totalCount.toLocaleString('de-DE')} Schauspieler
          </p>
        )}
      </div>
    </div>
  );
}
