'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  RefreshCw, 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Film,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BarChart3,
  Settings,
  Trash2
} from 'lucide-react';

interface Stats {
  total: number;
  withTrailer: number;
  withoutTrailer: number;
  withTmdbTrailers: number;
  percentComplete: number;
}

interface ImportStatus {
  isRunning: boolean;
  startedAt: string | null;
  currentIndex: number;
  totalSeries: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  noTrailer: number;
  currentSeries: string;
  lastError: string;
  shouldStop: boolean;
}

interface Series {
  tmdbId: number;
  name: string | null;
  title: string;
  posterPath: string | null;
  localTrailerPath: string | null;
  trailers: any;
  updatedAt: string;
}

export default function TrailerImportPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [filter, setFilter] = useState('without-trailer');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<number | null>(null);
  
  // Import options
  const [importOptions, setImportOptions] = useState({
    skip: 0,
    limit: 100,
    filter: 'without-trailer'
  });

  // Fetch stats and status
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/trailers?action=stats');
      const data = await res.json();
      setStats(data.stats);
      setImportStatus(data.importStatus);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  // Fetch series list
  const fetchSeries = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        action: 'list',
        filter,
        page: pagination.page.toString(),
        limit: '50',
        search
      });
      const res = await fetch(`/api/admin/trailers?${params}`);
      const data = await res.json();
      setSeries(data.series || []);
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
    } catch (error) {
      console.error('Failed to fetch series:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, pagination.page, search]);

  // Initial load and polling
  useEffect(() => {
    fetchStats();
    fetchSeries();
    
    const interval = setInterval(() => {
      fetchStats();
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Reload when filter changes
  useEffect(() => {
    setLoading(true);
    setPagination(p => ({ ...p, page: 1 }));
    fetchSeries();
  }, [filter, search]);

  // Start import
  const startImport = async () => {
    try {
      await fetch('/api/admin/trailers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', options: importOptions })
      });
      fetchStats();
    } catch (error) {
      console.error('Failed to start import:', error);
    }
  };

  // Stop import
  const stopImport = async () => {
    try {
      await fetch('/api/admin/trailers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      fetchStats();
    } catch (error) {
      console.error('Failed to stop import:', error);
    }
  };

  // Download single trailer
  const downloadSingle = async (tmdbId: number) => {
    setDownloading(tmdbId);
    try {
      const res = await fetch('/api/admin/trailers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download-single', tmdbId })
      });
      const data = await res.json();
      if (data.success) {
        fetchSeries();
        fetchStats();
      } else {
        alert(`Fehler: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to download:', error);
    } finally {
      setDownloading(null);
    }
  };

  // Refresh TMDB data
  const refreshTmdb = async () => {
    try {
      const res = await fetch('/api/admin/trailers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh-tmdb' })
      });
      const data = await res.json();
      alert(data.message);
      fetchStats();
    } catch (error) {
      console.error('Failed to refresh TMDB:', error);
    }
  };

  const getProgressPercent = () => {
    if (!importStatus || importStatus.totalSeries === 0) return 0;
    return Math.round((importStatus.processed / importStatus.totalSeries) * 100);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/pipeline" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Film className="w-6 h-6 text-purple-600" />
                  Trailer Import Manager
                </h1>
                <p className="text-sm text-gray-500">Verwalte Trailer für alle Serien</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshTmdb}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                TMDB Sync
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="text-sm text-gray-500">Gesamt Serien</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200 bg-green-50">
              <div className="text-sm text-green-600">Mit Trailer</div>
              <div className="text-2xl font-bold text-green-700">{stats.withTrailer}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-red-200 bg-red-50">
              <div className="text-sm text-red-600">Ohne Trailer</div>
              <div className="text-2xl font-bold text-red-700">{stats.withoutTrailer}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200 bg-blue-50">
              <div className="text-sm text-blue-600">TMDB verfügbar</div>
              <div className="text-2xl font-bold text-blue-700">{stats.withTmdbTrailers}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-200 bg-purple-50">
              <div className="text-sm text-purple-600">Fortschritt</div>
              <div className="text-2xl font-bold text-purple-700">{stats.percentComplete}%</div>
            </div>
          </div>
        )}

        {/* Import Control Panel */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Bulk Import
            </h2>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Import Options */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter</label>
                <select
                  value={importOptions.filter}
                  onChange={(e) => setImportOptions({ ...importOptions, filter: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={importStatus?.isRunning}
                >
                  <option value="without-trailer">Ohne Trailer</option>
                  <option value="has-tmdb">Mit TMDB Trailer (ungeladen)</option>
                  <option value="all">Alle</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Überspringen</label>
                <input
                  type="number"
                  value={importOptions.skip}
                  onChange={(e) => setImportOptions({ ...importOptions, skip: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={importStatus?.isRunning}
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limit (0 = alle)</label>
                <input
                  type="number"
                  value={importOptions.limit}
                  onChange={(e) => setImportOptions({ ...importOptions, limit: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={importStatus?.isRunning}
                  min={0}
                />
              </div>
              <div className="flex items-end">
                {importStatus?.isRunning ? (
                  <button
                    onClick={stopImport}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <Pause className="w-4 h-4" />
                    Stop
                  </button>
                ) : (
                  <button
                    onClick={startImport}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Import starten
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {importStatus?.isRunning && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {importStatus.currentIndex} / {importStatus.totalSeries}: {importStatus.currentSeries}
                  </span>
                  <span className="font-medium">{getProgressPercent()}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercent()}%` }}
                  />
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600">✓ {importStatus.success}</span>
                  <span className="text-red-600">✗ {importStatus.failed}</span>
                  <span className="text-gray-500">⏭ {importStatus.skipped}</span>
                  <span className="text-yellow-600">⚠ {importStatus.noTrailer}</span>
                </div>
                {importStatus.lastError && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    Letzter Fehler: {importStatus.lastError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Series List */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Serien ({pagination.total})
            </h2>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Suchen..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 border rounded-lg text-sm w-48"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="all">Alle</option>
                <option value="with-trailer">Mit Trailer</option>
                <option value="without-trailer">Ohne Trailer</option>
                <option value="has-tmdb">TMDB verfügbar</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-left text-sm text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Serie</th>
                      <th className="px-4 py-3">TMDB ID</th>
                      <th className="px-4 py-3">TMDB Trailer</th>
                      <th className="px-4 py-3">Lokaler Trailer</th>
                      <th className="px-4 py-3">Aktion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {series.map((s) => (
                      <tr key={s.tmdbId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {s.posterPath ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w92${s.posterPath}`}
                                alt=""
                                className="w-10 h-14 object-cover rounded"
                              />
                            ) : (
                              <div className="w-10 h-14 bg-gray-200 rounded flex items-center justify-center">
                                <Film className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <span className="font-medium text-gray-900">
                              {s.name || s.title}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{s.tmdbId}</td>
                        <td className="px-4 py-3">
                          {s.trailers && Array.isArray(s.trailers) && s.trailers.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              {s.trailers.length}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-gray-400">
                              <XCircle className="w-4 h-4" />
                              Nein
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {s.localTrailerPath ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-xs truncate max-w-[150px]">{s.localTrailerPath}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500">
                              <XCircle className="w-4 h-4" />
                              Fehlt
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!s.localTrailerPath && (
                            <button
                              onClick={() => downloadSingle(s.tmdbId)}
                              disabled={downloading === s.tmdbId}
                              className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50 flex items-center gap-1"
                            >
                              {downloading === s.tmdbId ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              Download
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Seite {pagination.page} von {pagination.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
