'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Play, 
  RefreshCw, 
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Youtube,
  Flame,
  Tv,
  ExternalLink,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Zap,
  FileText,
  TrendingUp
} from 'lucide-react';

interface RecentArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  createdAt: string;
  sourceUrl?: string;
}

interface YTChannel {
  id: string;
  channelId: string;
  name: string;
  url: string;
  isActive: boolean;
  lastCheckedAt: string | null;
  _count: { videos: number };
}

interface UnprocessedVideo {
  id: string;
  videoId: string;
  title: string;
  publishedAt: string;
  channel: { name: string };
}

export default function AdminPipelinePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [recentArticles, setRecentArticles] = useState<RecentArticle[]>([]);
  const [channels, setChannels] = useState<YTChannel[]>([]);
  const [unprocessedVideos, setUnprocessedVideos] = useState<UnprocessedVideo[]>([]);
  const [ytStats, setYtStats] = useState<any>({});
  const [trendStats, setTrendStats] = useState<any>({});
  const [articleStats, setArticleStats] = useState<any>({});
  
  // Action states
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Form states
  const [trendSearchTerm, setTrendSearchTerm] = useState('');
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'youtube' | 'trends'>('youtube');

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
      setChannels(data.channels || []);
      setUnprocessedVideos(data.unprocessedVideos || []);
      setYtStats(data.ytStats || {});
      setTrendStats(data.trendStats || {});
      setArticleStats(data.articleStats || {});
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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
      
      if (response.ok && data.success) {
        setActionMessage({ type: 'success', text: data.message || 'Aktion erfolgreich' });
        setTimeout(fetchDashboard, 2000);
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Aktion fehlgeschlagen' });
      }
    } catch (error) {
      setActionMessage({ type: 'error', text: 'Netzwerkfehler' });
    } finally {
      setRunningAction(null);
    }
  };

  const getSourceBadge = (article: RecentArticle) => {
    if (article.id.startsWith('yt-')) {
      return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">YouTube</span>;
    }
    if (article.id.startsWith('trend-')) {
      return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">Trends</span>;
    }
    return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">Andere</span>;
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
                <h1 className="text-xl font-bold text-gray-900">Content Pipelines</h1>
                <p className="text-sm text-gray-500">P3-Trends & P4-YouTube</p>
              </div>
            </div>
            <button
              onClick={fetchDashboard}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Aktualisieren
            </button>
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
              <div className="p-3 bg-red-100 rounded-lg">
                <Youtube className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">YouTube Videos</p>
                <p className="text-2xl font-bold text-gray-900">{ytStats.totalVideos || 0}</p>
                <p className="text-xs text-gray-400">{ytStats.unprocessedVideos || 0} unverarbeitet</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Flame className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Trends (7 Tage)</p>
                <p className="text-2xl font-bold text-gray-900">{trendStats.recentTrends || 0}</p>
                <p className="text-xs text-gray-400">{trendStats.processedTrends || 0} verarbeitet</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">YT-Artikel (7 Tage)</p>
                <p className="text-2xl font-bold text-gray-900">{articleStats.ytArticles || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Trend-Artikel (7 Tage)</p>
                <p className="text-2xl font-bold text-gray-900">{articleStats.trendArticles || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'youtube'
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Youtube className="h-4 w-4" />
            P4-YouTube
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'trends'
                ? 'bg-orange-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Flame className="h-4 w-4" />
            P3-Trends
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Actions */}
          <div className="lg:col-span-1 space-y-6">
            {activeTab === 'youtube' ? (
              <>
                {/* YouTube Actions */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Youtube className="h-5 w-5 text-red-600" />
                    YouTube Aktionen
                  </h2>
                  <div className="space-y-3">
                    <button
                      onClick={() => runAction('yt-check')}
                      disabled={runningAction !== null}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {runningAction === 'yt-check' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Neue Videos suchen
                    </button>
                    
                    <button
                      onClick={() => runAction('yt-process-batch')}
                      disabled={runningAction !== null || ytStats.unprocessedVideos === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {runningAction === 'yt-process-batch' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      3 Videos verarbeiten
                    </button>
                  </div>
                </div>

                {/* YouTube Channels */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Tv className="h-5 w-5 text-gray-600" />
                    Kanäle ({channels.length})
                  </h2>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {channels.map((channel) => (
                      <div 
                        key={channel.channelId}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <a 
                            href={channel.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-gray-900 hover:text-red-600 truncate block"
                          >
                            {channel.name}
                          </a>
                          <p className="text-xs text-gray-500">
                            {channel._count.videos} Videos
                          </p>
                        </div>
                        <button
                          onClick={() => runAction('toggle-channel', { 
                            channelId: channel.channelId, 
                            isActive: !channel.isActive 
                          })}
                          className={`p-2 rounded-lg transition-colors ${
                            channel.isActive 
                              ? 'text-green-600 hover:bg-green-50' 
                              : 'text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          {channel.isActive ? (
                            <ToggleRight className="h-5 w-5" />
                          ) : (
                            <ToggleLeft className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Trends Actions */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-600" />
                    Trend-Artikel erstellen
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Suchbegriff / Trend
                      </label>
                      <input
                        type="text"
                        value={trendSearchTerm}
                        onChange={(e) => setTrendSearchTerm(e.target.value)}
                        placeholder="z.B. Stranger Things Staffel 5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (trendSearchTerm) {
                          runAction('trends-process', { searchTerm: trendSearchTerm });
                        }
                      }}
                      disabled={!trendSearchTerm || runningAction !== null}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {runningAction === 'trends-process' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                      Artikel generieren
                    </button>
                  </div>
                </div>

                {/* Cron Info */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-gray-600" />
                    Automatisierung
                  </h2>
                  <div className="space-y-3 text-sm">
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <p className="font-medium text-orange-800">P3-Trends</p>
                      <p className="text-orange-600">4x täglich (09:00, 13:00, 18:00, 22:00)</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="font-medium text-red-800">P4-YouTube</p>
                      <p className="text-red-600">6x täglich (08:00, 11:00, 14:00, 17:00, 20:00, 23:00)</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Column - Content */}
          <div className="lg:col-span-2 space-y-6">
            {activeTab === 'youtube' && (
              /* Unprocessed Videos */
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Unverarbeitete Videos ({ytStats.unprocessedVideos || 0})
                  </h2>
                </div>
                
                {unprocessedVideos.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Keine unverarbeiteten Videos.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {unprocessedVideos.map((video) => (
                      <div 
                        key={video.videoId} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="font-medium text-gray-900 truncate">{video.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">{video.channel.name}</span>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(video.publishedAt).toLocaleDateString('de-DE')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => runAction('yt-process-video', { videoId: video.videoId })}
                            disabled={runningAction !== null}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Verarbeiten"
                          >
                            {runningAction === `yt-process-video-${video.videoId}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                          <a
                            href={`https://www.youtube.com/watch?v=${video.videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Auf YouTube öffnen"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => runAction('delete-video', { videoId: video.videoId })}
                            disabled={runningAction !== null}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recent Articles */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Letzte Artikel (24h)</h2>
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
                          {getSourceBadge(article)}
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
