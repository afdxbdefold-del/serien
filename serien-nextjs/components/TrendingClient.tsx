'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Filter, X } from 'lucide-react';
import FollowButtonLocal from './FollowButtonLocal';

interface Series {
  tmdbId: number;
  title: string;
  slug: string;
  posterLocalUrl: string | null;
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

export default function TrendingClient({ series }: TrendingClientProps) {
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [yearRange, setYearRange] = useState<[number, number]>([1990, 2025]);
  const [seasonRange, setSeasonRange] = useState<[number, number]>([1, 20]);
  const [sortBy, setSortBy] = useState<SortOption>('popularity');

  // Get unique filter options from data
  const filterOptions = useMemo(() => {
    const genres = new Set<string>();
    const statuses = new Set<string>();
    const networks = new Set<string>();

    series.forEach(s => {
      s.genres?.forEach(g => genres.add(g));
      if (s.status) statuses.add(s.status);
      s.networks?.forEach(n => networks.add(n));
    });

    return {
      genres: Array.from(genres).sort(),
      statuses: Array.from(statuses).sort(),
      networks: Array.from(networks).sort(),
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

      // Network filter
      if (selectedNetworks.length > 0) {
        const hasNetwork = selectedNetworks.some(n => show.networks?.includes(n));
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
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="h-8 w-8 text-cyan-500" />
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                Serienfinder
              </h1>
            </div>
            <p className="text-lg text-gray-600 mb-3">
              Finde deine nächste Lieblingsserie mit umfangreichen Filtern
            </p>
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                💡 <strong>Tipp:</strong> Folge deinen Lieblingsserien, um personalisierte News und Serien-Vorschläge zu erhalten!
              </p>
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
                <Link href={`/serie/${show.tmdbId}-${show.slug}`}>
                  <article className="group bg-white rounded-xl border hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer">
                    {/* Poster Image */}
                    <div className="relative aspect-[2/3] overflow-hidden bg-gray-200">
                      {show.posterLocalUrl ? (
                        <Image
                          src={show.posterLocalUrl}
                          alt={show.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          Kein Bild
                        </div>
                      )}
                      
                      {/* Overlay on hover */}
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
                    </div>
                    
                    {/* Series Info Below Cover */}
                    <div className="p-3">
                      <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 group-hover:text-cyan-600 transition-colors">
                        {show.title}
                      </h3>
                      {show.voteAverage && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-yellow-500 text-xs">⭐</span>
                          <span className="text-xs text-gray-600">{show.voteAverage.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </article>
                </Link>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-12 text-center text-sm text-gray-500">
            {filteredSeries.length} von {series.length} Serien angezeigt
          </div>
        </div>
      </main>

      {/* Floating Filter Button */}
      <button
        onClick={() => setShowFilters(true)}
        className="fixed bottom-8 right-8 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 z-40"
      >
        <Filter className="h-5 w-5" />
        <span className="font-semibold">Serienfilter</span>
        {hasActiveFilters && (
          <span className="bg-white text-cyan-600 px-2 py-0.5 rounded-full text-xs font-bold">
            {selectedGenres.length + selectedStatuses.length + selectedNetworks.length + (minRating > 0 ? 1 : 0)}
          </span>
        )}
      </button>

      {/* Filter Modal */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowFilters(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900">Filter & Sortierung</h2>
              <button 
                onClick={() => setShowFilters(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Filter Content */}
            <div className="p-6 space-y-8">
              {/* Sortierung */}
              <div>
                <h3 className="font-bold text-lg mb-4">🔥 Sortierung</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { value: 'popularity', label: 'Popularität' },
                    { value: 'rating', label: 'Bewertung' },
                    { value: 'newest', label: 'Neueste' },
                    { value: 'alphabetical', label: 'A-Z' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value as SortOption)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        sortBy === option.value
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-semibold'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genres */}
              <div>
                <h3 className="font-bold text-lg mb-4">📺 Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.genres.map(genre => (
                    <button
                      key={genre}
                      onClick={() => toggleArrayFilter(genre, selectedGenres, setSelectedGenres)}
                      className={`px-4 py-2 rounded-full border-2 transition-all ${
                        selectedGenres.includes(genre)
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700 font-semibold'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="font-bold text-lg mb-4">📊 Status</h3>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.statuses.map(status => (
                    <button
                      key={status}
                      onClick={() => toggleArrayFilter(status, selectedStatuses, setSelectedStatuses)}
                      className={`px-4 py-2 rounded-full border-2 transition-all ${
                        selectedStatuses.includes(status)
                          ? 'border-green-500 bg-green-50 text-green-700 font-semibold'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Networks */}
              <div>
                <h3 className="font-bold text-lg mb-4">🎬 Sender/Plattform</h3>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.networks.map(network => (
                    <button
                      key={network}
                      onClick={() => toggleArrayFilter(network, selectedNetworks, setSelectedNetworks)}
                      className={`px-4 py-2 rounded-full border-2 transition-all ${
                        selectedNetworks.includes(network)
                          ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {network}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating Slider */}
              <div>
                <h3 className="font-bold text-lg mb-4">⭐ Mindest-Bewertung: {minRating > 0 ? minRating.toFixed(1) : 'Alle'}</h3>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={minRating}
                  onChange={(e) => setMinRating(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-2">
                  <span>0</span>
                  <span>10</span>
                </div>
              </div>

              {/* Year Range */}
              <div>
                <h3 className="font-bold text-lg mb-4">📅 Jahr: {yearRange[0]} - {yearRange[1]}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600">Von</label>
                    <input
                      type="range"
                      min="1990"
                      max="2025"
                      value={yearRange[0]}
                      onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Bis</label>
                    <input
                      type="range"
                      min="1990"
                      max="2025"
                      value={yearRange[1]}
                      onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Season Range */}
              <div>
                <h3 className="font-bold text-lg mb-4">🎭 Anzahl Staffeln: {seasonRange[0]} - {seasonRange[1]}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600">Minimum</label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={seasonRange[0]}
                      onChange={(e) => setSeasonRange([parseInt(e.target.value), seasonRange[1]])}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Maximum</label>
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
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t p-6 flex gap-4">
              <button
                onClick={resetFilters}
                className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold transition-colors"
              >
                Zurücksetzen
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Anwenden ({filteredSeries.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
