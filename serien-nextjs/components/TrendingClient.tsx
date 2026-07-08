'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Filter, X } from 'lucide-react';
import FollowButtonLocal from './FollowButtonLocal';

interface Series {
  tmdbId: number;
  title: string;
  slug: string;
  posterLocalUrl: string | null;
  posterPath: string | null;
  status: string | null;
  genres: string[];
  networks: string[];
  voteAverage: number | null;
  firstAirDate: Date | null;
  numberOfSeasons: number | null;
  popularity: number | null;
  updatedAt: Date;
}

interface TrendingClientProps {
  series: Series[];
}

type SortOption = 'popularity' | 'rating' | 'newest' | 'alphabetical';

function TrendingClientInner({ series }: TrendingClientProps) {
  const searchParams = useSearchParams();

  // Filter states
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [yearRange, setYearRange] = useState<[number, number]>([1990, 2025]);
  const [seasonRange, setSeasonRange] = useState<[number, number]>([1, 20]);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');

  // Initialize filters from URL parameters
  useEffect(() => {
    const networkParam = searchParams?.get('network');
    if (networkParam) setSelectedNetworks([networkParam]);

    const genreParam = searchParams?.get('genre');
    if (genreParam) setSelectedGenres([genreParam]);

    const statusParam = searchParams?.get('status');
    if (statusParam) setSelectedStatuses([statusParam]);
  }, [searchParams]);

  // Streaming services available in Germany (full list — used for filter logic)
  const GERMAN_STREAMERS = [
    'Netflix',
    'Amazon Prime Video',
    'Prime Video',
    'Disney+',
    'Disney Plus',
    'Apple TV+',
    'Apple TV',
    'WOW',
    'Sky',
    'Sky Atlantic',
    'Paramount+',
    'Paramount Plus',
    'RTL+',
    'RTL',
    'Joyn',
    'Joyn Plus',
    'MagentaTV',
    'Crunchyroll',
    'HBO Max',
    'Max',
    'Peacock',
    'ARD',
    'ZDF',
    'Arte',
    'ProSieben',
    'Sat.1',
    'VOX',
    'kabel eins',
    'DAZN',
    'Discovery+',
  ];

  // Top 10 most-relevant streamers (DE market) — only these appear as filter pills.
  // Order matters: pills render in this exact priority.
  const TOP_10_STREAMERS = [
    'Netflix',
    'Prime Video',
    'Disney+',
    'Apple TV+',
    'WOW',
    'Sky',
    'Paramount+',
    'RTL+',
    'Joyn',
    'ARD',
  ];

  // Get unique filter options from data
  const filterOptions = useMemo(() => {
    const genres = new Set<string>();
    const statuses = new Set<string>();
    const networks = new Set<string>();

    series.forEach(s => {
      s.genres?.forEach(g => genres.add(g));
      if (s.status) statuses.add(s.status);
      // Only add German streamers
      s.networks?.forEach(n => {
        if (GERMAN_STREAMERS.some(gs => n.toLowerCase().includes(gs.toLowerCase()) || gs.toLowerCase().includes(n.toLowerCase()))) {
          networks.add(n);
        }
      });
    });

    return {
      genres: Array.from(genres).sort(),
      statuses: Array.from(statuses).sort(),
      // Network filter pills: only show TOP 10 streamers, in priority order, that are present in the dataset
      networks: TOP_10_STREAMERS.filter(top =>
        Array.from(networks).some(n =>
          n.toLowerCase().includes(top.toLowerCase()) || top.toLowerCase().includes(n.toLowerCase())
        )
      ),
    };
  }, [series]);

  // Filter and sort series
  const filteredSeries = useMemo(() => {
    let filtered = series.filter(show => {
      // Genre filter
      if (selectedGenres.length > 0) {
        const hasGenre = selectedGenres.some(g => show.genres?.includes(g));
        if (!hasGenre) return false;
      }

      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(show.status || '')) {
        return false;
      }

      // Network filter (fuzzy match: pill "Disney+" matches show network "Disney Plus" etc.)
      if (selectedNetworks.length > 0) {
        const hasNetwork = selectedNetworks.some(sel =>
          show.networks?.some(n =>
            n.toLowerCase().includes(sel.toLowerCase()) || sel.toLowerCase().includes(n.toLowerCase())
          )
        );
        if (!hasNetwork) return false;
      }

      // Rating filter
      if (minRating > 0 && (show.voteAverage || 0) < minRating) {
        return false;
      }

      // Year filter
      if (show.firstAirDate) {
        const year = new Date(show.firstAirDate).getFullYear();
        if (year < yearRange[0] || year > yearRange[1]) return false;
      }

      // Season filter
      if (show.numberOfSeasons) {
        if (show.numberOfSeasons < seasonRange[0] || show.numberOfSeasons > seasonRange[1]) {
          return false;
        }
      }

      return true;
    });

    // Sort
    switch (sortBy) {
      case 'rating':
        filtered.sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0));
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'popularity':
      default:
        filtered.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        break;
    }

    return filtered;
  }, [series, selectedGenres, selectedStatuses, selectedNetworks, minRating, yearRange, seasonRange, sortBy]);

  const hasActiveFilters = selectedGenres.length > 0 || selectedStatuses.length > 0 || 
    selectedNetworks.length > 0 || minRating > 0 || sortBy !== 'popularity';

  const resetFilters = () => {
    setSelectedGenres([]);
    setSelectedStatuses([]);
    setSelectedNetworks([]);
    setMinRating(0);
    setYearRange([1990, 2025]);
    setSeasonRange([1, 20]);
    setSortBy('popularity');
  };

  const toggleArrayFilter = (value: string, current: string[], setter: (val: string[]) => void) => {
    if (current.includes(value)) {
      setter(current.filter(v => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-6 md:px-12 py-12">
        <div className="max-w-[1000px] mx-auto">
          {/* Hero Section */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-7 w-7 text-cyan-500" />
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Serienfinder
              </h1>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Finde deine nächste Lieblingsserie mit umfangreichen Filtern
            </p>

            {/* Inline Filter Panel (replaces the old Tipp box) */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Filter className="h-4 w-4 text-cyan-500" />
                  Filter & Sortierung
                </h2>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-xs text-gray-500 hover:text-gray-900 underline-offset-2 hover:underline"
                  >
                    Zurücksetzen
                  </button>
                )}
              </div>

              {/* Sortierung */}
              <div className="mb-3">
                <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">Sortierung</h3>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: 'popularity', label: 'Popularität' },
                    { value: 'rating', label: 'Bewertung' },
                    { value: 'newest', label: 'Neueste' },
                    { value: 'alphabetical', label: 'A–Z' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSortBy(opt.value as SortOption)}
                      className={`px-3 py-1 rounded-full border text-xs transition-all ${
                        sortBy === opt.value
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-semibold'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Streamer */}
              {filterOptions.networks.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">Streamer</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {filterOptions.networks.map(network => (
                      <button
                        key={network}
                        onClick={() => toggleArrayFilter(network, selectedNetworks, setSelectedNetworks)}
                        className={`px-2.5 py-1 rounded-full border text-xs transition-all ${
                          selectedNetworks.includes(network)
                            ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {network}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Genres */}
              {filterOptions.genres.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">Genres</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {filterOptions.genres.map(genre => (
                      <button
                        key={genre}
                        onClick={() => toggleArrayFilter(genre, selectedGenres, setSelectedGenres)}
                        className={`px-2.5 py-1 rounded-full border text-xs transition-all ${
                          selectedGenres.includes(genre)
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-semibold'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Status */}
              {filterOptions.statuses.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1.5">Status</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {filterOptions.statuses.map(status => (
                      <button
                        key={status}
                        onClick={() => toggleArrayFilter(status, selectedStatuses, setSelectedStatuses)}
                        className={`px-2.5 py-1 rounded-full border text-xs transition-all ${
                          selectedStatuses.includes(status)
                            ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Erweitert: Rating, Jahr, Staffeln */}
              <details className="group">
                <summary className="cursor-pointer list-none text-sm text-cyan-700 hover:text-cyan-800 font-medium select-none">
                  <span className="group-open:hidden">Erweiterte Filter anzeigen ▾</span>
                  <span className="hidden group-open:inline">Erweiterte Filter ausblenden ▴</span>
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                      Mindest-Bewertung: {minRating > 0 ? minRating.toFixed(1) : 'Alle'}
                    </h3>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={minRating}
                      onChange={(e) => setMinRating(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                      Jahr: {yearRange[0]}–{yearRange[1]}
                    </h3>
                    <input
                      type="range"
                      min="1990"
                      max="2025"
                      value={yearRange[0]}
                      onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500 mb-2"
                    />
                    <input
                      type="range"
                      min="1990"
                      max="2025"
                      value={yearRange[1]}
                      onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                      Staffeln: {seasonRange[0]}–{seasonRange[1]}
                    </h3>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={seasonRange[0]}
                      onChange={(e) => setSeasonRange([parseInt(e.target.value), seasonRange[1]])}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500 mb-2"
                    />
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={seasonRange[1]}
                      onChange={(e) => setSeasonRange([seasonRange[0], parseInt(e.target.value)])}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Aktive Filter:</span>
              
              {selectedGenres.map(genre => (
                <button
                  key={genre}
                  onClick={() => toggleArrayFilter(genre, selectedGenres, setSelectedGenres)}
                  className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-sm flex items-center gap-2 hover:bg-cyan-200 transition-colors"
                >
                  {genre}
                  <X className="h-3 w-3" />
                </button>
              ))}

              {selectedStatuses.map(status => (
                <button
                  key={status}
                  onClick={() => toggleArrayFilter(status, selectedStatuses, setSelectedStatuses)}
                  className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-2 hover:bg-green-200 transition-colors"
                >
                  {status}
                  <X className="h-3 w-3" />
                </button>
              ))}

              {selectedNetworks.map(network => (
                <button
                  key={network}
                  onClick={() => toggleArrayFilter(network, selectedNetworks, setSelectedNetworks)}
                  className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-2 hover:bg-purple-200 transition-colors"
                >
                  {network}
                  <X className="h-3 w-3" />
                </button>
              ))}

              {minRating > 0 && (
                <button
                  onClick={() => setMinRating(0)}
                  className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm flex items-center gap-2 hover:bg-yellow-200 transition-colors"
                >
                  ≥ {minRating} ⭐
                  <X className="h-3 w-3" />
                </button>
              )}

              {sortBy !== 'popularity' && (
                <button
                  onClick={() => setSortBy('popularity')}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2 hover:bg-blue-200 transition-colors"
                >
                  Sortierung: {sortBy === 'rating' ? 'Bewertung' : sortBy === 'newest' ? 'Neueste' : 'Alphabetisch'}
                  <X className="h-3 w-3" />
                </button>
              )}

              <button
                onClick={resetFilters}
                className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm hover:bg-red-200 transition-colors font-medium"
              >
                Alle zurücksetzen
              </button>
            </div>
          )}

          {/* Series Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredSeries.map((show, index) => (
              <div key={show.tmdbId}>
                {/* Series Card */}
                <article className="group bg-white rounded-xl border hover:shadow-lg transition-all duration-300 overflow-hidden">
                  {/* Poster Image */}
                  <Link href={`/serie/${show.slug}`} className="block relative aspect-[2/3] overflow-hidden bg-gray-200">
                    {(show.posterLocalUrl || show.posterPath) ? (
                      <Image
                        src={show.posterLocalUrl || `/img/tmdb/w500${show.posterPath}`}
                        alt={show.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      // Fallback: Try to load from our poster API proxy
                      <Image
                        src={`/img/poster/tv/${show.tmdbId}`}
                        alt={show.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          // If proxy also fails, show placeholder
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement?.querySelector('.placeholder')?.classList.remove('hidden');
                        }}
                      />
                    )}
                    
                    {/* Placeholder for when image fails */}
                    <div className={`placeholder w-full h-full flex items-center justify-center text-gray-400 absolute inset-0 ${(show.posterLocalUrl || show.posterPath) ? 'hidden' : ''}`}>
                      <span className="text-4xl">📺</span>
                    </div>
                    
                    {/* Overlay on hover with info */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {show.voteAverage && (
                        <div className="flex items-center gap-1 mb-2">
                          <span className="text-yellow-400">⭐</span>
                          <span className="text-white text-sm font-semibold">{show.voteAverage.toFixed(1)}</span>
                        </div>
                      )}
                      
                      {show.status && (
                        <span className="text-xs text-white/80">{show.status}</span>
                      )}
                    </div>
                    
                    {/* Follow Button - Top Right */}
                    <div className="absolute top-2 right-2 z-10" onClick={(e) => e.preventDefault()}>
                      <FollowButtonLocal 
                        tmdbId={show.tmdbId} 
                        seriesName={show.title}
                        variant="icon-only"
                      />
                    </div>
                  </Link>
                  
                  {/* Series Info Below Cover */}
                  <Link href={`/serie/${show.slug}`} className="block p-3">
                    <p className="font-semibold text-sm text-gray-900 line-clamp-2 group-hover:text-cyan-600 transition-colors">
                      {show.title}
                    </p>
                    {show.voteAverage && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-yellow-500 text-xs">⭐</span>
                        <span className="text-xs text-gray-600">{show.voteAverage.toFixed(1)}</span>
                      </div>
                    )}
                  </Link>
                </article>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-12 text-center text-sm text-gray-500">
            {filteredSeries.length} von {series.length} Serien angezeigt
          </div>
        </div>
      </main>
    </div>
  );
}

// Export with Suspense wrapper for useSearchParams
export default function TrendingClient({ series }: TrendingClientProps) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Laden...</div>}>
      <TrendingClientInner series={series} />
    </Suspense>
  );
}
