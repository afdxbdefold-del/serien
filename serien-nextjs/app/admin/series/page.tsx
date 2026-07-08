'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Loader2, Search, ChevronLeft, Download, CheckCircle, 
  ExternalLink, Tv, Calendar, Star 
} from 'lucide-react';

interface TMDBResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  popularity: number;
  vote_average: number;
}

interface LocalSeries {
  tmdbId: number;
  name: string;
  slug: string;
}

export default function AdminSeriesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [localSeries, setLocalSeries] = useState<LocalSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [importing, setImporting] = useState<number | null>(null);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getAuthHeaders = () => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('admin_token');
    return { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  // Fetch local series on mount
  useEffect(() => {
    const fetchLocalSeries = async () => {
      try {
        const response = await fetch('/api/admin/series', {
          headers: getAuthHeaders()
        });
        
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        
        if (response.ok) {
          const data = await response.json();
          setLocalSeries(data.series || []);
          setImportedIds(new Set(data.series?.map((s: LocalSeries) => s.tmdbId) || []));
        }
      } catch (err) {
        console.error('Error fetching local series:', err);
      } finally {
        setLoadingLocal(false);
      }
    };
    
    fetchLocalSeries();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    setLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/tv?api_key=c0e0553140b7bd5f982df64c86319c1b&query=${encodeURIComponent(searchQuery)}&language=de-DE`
      );
      
      if (!response.ok) throw new Error('TMDB search failed');
      
      const data = await response.json();
      setSearchResults(data.results || []);
      
      if (data.results?.length === 0) {
        setMessage({ type: 'error', text: 'Keine Serien gefunden' });
      }
    } catch (err) {
      console.error('Search error:', err);
      setMessage({ type: 'error', text: 'Suche fehlgeschlagen' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (series: TMDBResult) => {
    setImporting(series.id);
    setMessage(null);
    
    try {
      const response = await fetch('/api/admin/tmdb', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tmdbId: series.id,
          slug: series.name
            .toLowerCase()
            .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setImportedIds(prev => new Set([...prev, series.id]));
        setMessage({ 
          type: 'success', 
          text: `"${series.name}" erfolgreich importiert! URL: /serie/${data.series?.slug}` 
        });
      } else {
        setMessage({ type: 'error', text: data.error || 'Import fehlgeschlagen' });
      }
    } catch (err) {
      console.error('Import error:', err);
      setMessage({ type: 'error', text: 'Import fehlgeschlagen' });
    } finally {
      setImporting(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Unbekannt';
    return new Date(dateStr).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric',
      month: 'long',
      day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Serien importieren</h1>
                <p className="text-sm text-gray-500">
                  Serien aus TMDB suchen und in die Datenbank importieren
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Tv className="w-4 h-4" />
              <span>{localSeries.length} Serien in DB</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search Box */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Serie suchen (z.B. 'Love Story', 'The Boys', 'Stranger Things')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                data-testid="series-search-input"
              />
            </div>
            <button
              type="submit"
              disabled={loading || searchQuery.length < 2}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
              data-testid="series-search-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              Suchen
            </button>
          </form>
          
          {/* Message */}
          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-900">
                {searchResults.length} Ergebnisse für "{searchQuery}"
              </h2>
            </div>
            
            <div className="divide-y">
              {searchResults.map((series) => {
                const isImported = importedIds.has(series.id);
                const isImporting = importing === series.id;
                
                return (
                  <div 
                    key={series.id} 
                    className={`p-4 flex gap-4 hover:bg-gray-50 transition-colors ${
                      isImported ? 'bg-green-50' : ''
                    }`}
                    data-testid={`series-result-${series.id}`}
                  >
                    {/* Poster */}
                    <div className="flex-shrink-0 w-20 h-28 bg-gray-200 rounded overflow-hidden">
                      {series.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w154${series.poster_path}`}
                          alt={series.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Tv className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">
                            {series.name}
                            {series.original_name !== series.name && (
                              <span className="text-gray-500 text-sm ml-2">
                                ({series.original_name})
                              </span>
                            )}
                          </h3>
                          
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(series.first_air_date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-500" />
                              {series.vote_average.toFixed(1)}
                            </span>
                            <span className="text-gray-400">
                              TMDB ID: {series.id}
                            </span>
                          </div>
                        </div>
                        
                        {/* Import Button */}
                        <div className="flex-shrink-0">
                          {isImported ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                              <CheckCircle className="w-5 h-5" />
                              <span className="font-medium">Importiert</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleImport(series)}
                              disabled={isImporting}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              data-testid={`import-btn-${series.id}`}
                            >
                              {isImporting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Download className="w-5 h-5" />
                              )}
                              <span className="font-medium">Importieren</span>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Overview */}
                      {series.overview && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                          {series.overview}
                        </p>
                      )}
                      
                      {/* Link to TMDB */}
                      <a
                        href={`https://www.themoviedb.org/tv/${series.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Auf TMDB ansehen
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && searchResults.length === 0 && searchQuery === '' && (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <Tv className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-700 mb-2">
              Serien aus TMDB importieren
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Gib den Namen einer Serie ein, um sie in TMDB zu suchen. 
              Du kannst dann die gewünschte Serie mit einem Klick importieren.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
