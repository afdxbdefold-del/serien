'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Play, 
  RefreshCw, 
  FileText, 
  Search, 
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Terminal,
  Zap,
  Film,
  Calendar,
  ExternalLink
} from 'lucide-react';

interface RecentArticle {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  createdAt: string;
  series?: { name: string } | null;
}

interface PipelineStats {
  contentType: string;
  _count: number;
}

export default function AdminPipelinePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [recentArticles, setRecentArticles] = useState<RecentArticle[]>([]);
  const [stats, setStats] = useState<PipelineStats[]>([]);
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [logs, setLogs] = useState('');
  const [selectedLogType, setSelectedLogType] = useState<'tvline' | 'cinemaholic' | 'manual'>('tvline');
  const [showLogs, setShowLogs] = useState(false);
  
  // Form states
  const [singleUrl, setSingleUrl] = useState('');
  const [singleTitle, setSingleTitle] = useState('');
  const [tmdbQuery, setTmdbQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<any[]>([]);
  const [searchingTmdb, setSearchingTmdb] = useState(false);
  
  // Action states
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getToken = () => localStorage.getItem('admin_token');

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/pipeline', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!response.ok) {
        if (response.status === 401) router.push('/admin/login');
        return;
      }
      const data = await response.json();
      setRecentArticles(data.recentArticles || []);
      setStats(data.stats || []);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/pipeline?action=scheduler-status', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSchedulerRunning(data.running);
      }
    } catch (error) {
      console.error('Failed to fetch scheduler status:', error);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/pipeline?action=logs&type=${selectedLogType}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || 'No logs available.');
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  }, [selectedLogType]);

  useEffect(() => {
    fetchDashboard();
    fetchSchedulerStatus();
  }, [fetchDashboard, fetchSchedulerStatus]);

  useEffect(() => {
    if (showLogs) {
      fetchLogs();
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [showLogs, fetchLogs]);

  const runAction = async (action: string, payload: Record<string, any> = {}) => {
    setRunningAction(action);
    setActionMessage(null);
    
    try {
      const response = await fetch('/api/admin/pipeline', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}` 
        },
        body: JSON.stringify({ action, ...payload })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setActionMessage({ type: 'success', text: data.message || 'Action completed' });
        // Refresh dashboard after a delay
        setTimeout(fetchDashboard, 3000);
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Action failed' });
      }
    } catch (error) {
      setActionMessage({ type: 'error', text: 'Network error' });
    } finally {
      setRunningAction(null);
    }
  };

  const searchTmdb = async () => {
    if (!tmdbQuery || tmdbQuery.length < 2) return;
    
    setSearchingTmdb(true);
    try {
      const response = await fetch(`/api/admin/tmdb?query=${encodeURIComponent(tmdbQuery)}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTmdbResults(data.results || []);
      }
    } catch (error) {
      console.error('TMDB search failed:', error);
    } finally {
      setSearchingTmdb(false);
    }
  };

  const getContentTypeBadge = (type: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      GENERATED: { bg: 'bg-green-100 text-green-800', text: 'Generiert' },
      NEWS: { bg: 'bg-blue-100 text-blue-800', text: 'News' },
      IMPORTED: { bg: 'bg-gray-100 text-gray-800', text: 'Importiert' },
      IMPORTED_WITH_SERIES: { bg: 'bg-purple-100 text-purple-800', text: 'Import+Serie' },
      MANUAL: { bg: 'bg-yellow-100 text-yellow-800', text: 'Manuell' },
    };
    const badge = badges[type] || { bg: 'bg-gray-100 text-gray-800', text: type };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg}`}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Content Pipeline</h1>
                <p className="text-sm text-gray-500">Automatische Artikel-Generierung</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                schedulerRunning 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {schedulerRunning ? (
                  <>
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Scheduler aktiv
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 bg-gray-400 rounded-full" />
                    Scheduler inaktiv
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Message */}
        {actionMessage && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            actionMessage.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {actionMessage.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            {actionMessage.text}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Generiert (7 Tage)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.find(s => s.contentType === 'GENERATED')?._count || 0}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">News (7 Tage)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.find(s => s.contentType === 'NEWS')?._count || 0}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Film className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Letzte 24h</p>
                <p className="text-2xl font-bold text-gray-900">
                  {recentArticles.length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-100 rounded-lg">
                <Calendar className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Scheduler</p>
                <p className="text-lg font-semibold text-gray-900">
                  {schedulerRunning ? 'Läuft' : 'Gestoppt'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Actions */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Schnellaktionen</h2>
              <div className="space-y-3">
                <button
                  onClick={() => runAction('run-tvline')}
                  disabled={runningAction !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {runningAction === 'run-tvline' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  TVLine Pipeline starten
                </button>
                
                <button
                  onClick={() => runAction('run-cinemaholic')}
                  disabled={runningAction !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {runningAction === 'run-cinemaholic' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  CinemaHolic Pipeline starten
                </button>
                
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Terminal className="h-4 w-4" />
                  {showLogs ? 'Logs ausblenden' : 'Logs anzeigen'}
                </button>
              </div>
            </div>

            {/* Single Article */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Einzelnen Artikel erstellen</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Artikel-URL
                  </label>
                  <input
                    type="url"
                    value={singleUrl}
                    onChange={(e) => setSingleUrl(e.target.value)}
                    placeholder="https://tvline.com/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titel (optional)
                  </label>
                  <input
                    type="text"
                    value={singleTitle}
                    onChange={(e) => setSingleTitle(e.target.value)}
                    placeholder="Wird automatisch erkannt"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => runAction('run-single', { url: singleUrl, title: singleTitle })}
                  disabled={!singleUrl || runningAction !== null}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {runningAction === 'run-single' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Pipeline ausführen
                </button>
              </div>
            </div>

            {/* TMDB Search */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">TMDB Serie suchen</h2>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tmdbQuery}
                    onChange={(e) => setTmdbQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchTmdb()}
                    placeholder="Serienname eingeben..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                  <button
                    onClick={searchTmdb}
                    disabled={searchingTmdb || tmdbQuery.length < 2}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    {searchingTmdb ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </button>
                </div>
                
                {tmdbResults.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {tmdbResults.map((result) => (
                      <div key={result.tmdbId} className="p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          {result.posterPath && (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
                              alt={result.name}
                              className="w-12 h-18 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{result.name}</p>
                            <p className="text-xs text-gray-500">
                              TMDB ID: {result.tmdbId} • {result.firstAirDate?.slice(0, 4)}
                            </p>
                            <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                              {result.overview}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => runAction('create-from-tmdb', { 
                            tmdbId: result.tmdbId, 
                            seriesName: result.name 
                          })}
                          disabled={runningAction !== null}
                          className="mt-2 w-full text-sm px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded hover:bg-cyan-100 transition-colors"
                        >
                          Artikel erstellen
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Recent Articles & Logs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Logs Panel */}
            {showLogs && (
              <div className="bg-gray-900 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Pipeline Logs</h2>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedLogType}
                      onChange={(e) => setSelectedLogType(e.target.value as any)}
                      className="px-3 py-1.5 bg-gray-800 text-white rounded-lg border border-gray-700 text-sm"
                    >
                      <option value="tvline">TVLine</option>
                      <option value="cinemaholic">CinemaHolic</option>
                      <option value="manual">Manuell</option>
                    </select>
                    <button
                      onClick={fetchLogs}
                      className="p-2 bg-gray-800 text-gray-400 rounded-lg hover:text-white transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <pre className="text-sm text-green-400 font-mono overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap">
                  {logs || 'Keine Logs vorhanden.'}
                </pre>
              </div>
            )}

            {/* Recent Articles */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Letzte Artikel (24h)</h2>
                <button
                  onClick={fetchDashboard}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              
              {recentArticles.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Keine Artikel in den letzten 24 Stunden erstellt.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentArticles.map((article) => (
                    <div 
                      key={article.id} 
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="font-medium text-gray-900 truncate">{article.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getContentTypeBadge(article.contentType)}
                          {article.series && (
                            <span className="text-xs text-gray-500">
                              {article.series.name}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(article.createdAt).toLocaleString('de-DE', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      <a
                        href={`/${article.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-cyan-600 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
