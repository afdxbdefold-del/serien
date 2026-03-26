'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Play, RefreshCw, ArrowLeft, Clock, CheckCircle, XCircle, Loader2,
  Youtube, Flame, Tv, ExternalLink, Trash2, ToggleLeft, ToggleRight,
  Zap, FileText, TrendingUp, AlertCircle, ChevronDown, ChevronUp,
  Activity, Timer, Target, Bug
} from 'lucide-react';

interface PipelineRun {
  id: string;
  pipeline: string;
  trigger: string;
  status: string;
  inputQuery?: string;
  inputVideoId?: string;
  inputSource?: string;
  articleId?: string;
  articleSlug?: string;
  articleTitle?: string;
  sourcesFound: number;
  wordsCollected: number;
  factsExtracted: number;
  antiAiScore?: number;
  durationMs?: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  errorStep?: string;
  debugLog?: string;
}

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
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [pipelineStats, setPipelineStats] = useState<Record<string, any>>({});
  const [ytStats, setYtStats] = useState<any>({});
  const [trendStats, setTrendStats] = useState<any>({});
  const [articleStats, setArticleStats] = useState<any>({});
  
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [trendSearchTerm, setTrendSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'youtube' | 'trends' | 'logs'>('overview');
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [hoursFilter, setHoursFilter] = useState(24);

  const getToken = () => localStorage.getItem('admin_token');

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/pipeline?hours=${hoursFilter}`, {
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
      setPipelineRuns(data.pipelineRuns || []);
      setPipelineStats(data.pipelineStats || {});
      setYtStats(data.ytStats || {});
      setTrendStats(data.trendStats || {});
      setArticleStats(data.articleStats || {});
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [router, hoursFilter]);

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

  const getPipelineBadge = (pipeline: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      'p4-youtube': { bg: 'bg-red-100', text: 'text-red-700', label: 'YouTube' },
      'p3-trends': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Trends' },
      'pipeline-v2': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'V2' },
      'cron-news': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'News' },
    };
    const badge = badges[pipeline] || { bg: 'bg-gray-100', text: 'text-gray-700', label: pipeline };
    return <span className={`px-2 py-1 ${badge.bg} ${badge.text} rounded-full text-xs font-medium`}>{badge.label}</span>;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: any }> = {
      'success': { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
      'partial': { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertCircle },
      'failed': { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
      'running': { bg: 'bg-blue-100', text: 'text-blue-700', icon: Loader2 },
    };
    const badge = badges[status] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock };
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 ${badge.bg} ${badge.text} rounded-full text-xs font-medium`}>
        <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
        {status}
      </span>
    );
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
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
                <p className="text-sm text-gray-500">P3-Trends, P4-YouTube, Pipeline-V2</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={hoursFilter}
                onChange={(e) => setHoursFilter(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value={6}>Letzte 6h</option>
                <option value={24}>Letzte 24h</option>
                <option value={48}>Letzte 48h</option>
                <option value={168}>Letzte 7 Tage</option>
              </select>
              <button
                onClick={fetchDashboard}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Aktualisieren
              </button>
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
            {actionMessage.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            {actionMessage.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Übersicht', icon: Activity },
            { id: 'youtube', label: 'P4-YouTube', icon: Youtube },
            { id: 'trends', label: 'P3-Trends', icon: Flame },
            { id: 'logs', label: 'Logs & Debug', icon: Bug },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Pipeline Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Object.entries(pipelineStats).map(([pipeline, stats]: [string, any]) => (
                <div key={pipeline} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    {getPipelineBadge(pipeline)}
                    <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-green-600 font-semibold">{stats.success}</div>
                      <div className="text-gray-500">Erfolg</div>
                    </div>
                    <div className="text-center">
                      <div className="text-yellow-600 font-semibold">{stats.partial}</div>
                      <div className="text-gray-500">Teilweise</div>
                    </div>
                    <div className="text-center">
                      <div className="text-red-600 font-semibold">{stats.failed}</div>
                      <div className="text-gray-500">Fehler</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>Artikel erstellt:</span>
                      <span className="font-medium text-gray-700">{stats.articles}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ø Dauer:</span>
                      <span className="font-medium text-gray-700">{formatDuration(stats.avgDuration)}</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {Object.keys(pipelineStats).length === 0 && (
                <div className="col-span-4 bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Keine Pipeline-Läufe im ausgewählten Zeitraum</p>
                </div>
              )}
            </div>

            {/* Recent Pipeline Runs */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Letzte Pipeline-Läufe</h2>
              {pipelineRuns.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Keine Läufe im Zeitraum</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {pipelineRuns.slice(0, 20).map((run) => (
                    <div key={run.id} className="border border-gray-100 rounded-lg overflow-hidden">
                      <div 
                        className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                        onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                      >
                        <div className="flex items-center gap-3">
                          {getPipelineBadge(run.pipeline)}
                          {getStatusBadge(run.status)}
                          <span className="text-sm text-gray-700 truncate max-w-xs">
                            {run.articleTitle || run.inputQuery || run.inputVideoId || '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {formatDuration(run.durationMs)}
                          </span>
                          <span>{formatTime(run.startedAt)}</span>
                          {expandedRun === run.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                      
                      {expandedRun === run.id && (
                        <div className="p-4 bg-white border-t border-gray-100 text-sm">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <span className="text-gray-500">Quellen:</span>
                              <span className="ml-2 font-medium">{run.sourcesFound}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Wörter:</span>
                              <span className="ml-2 font-medium">{run.wordsCollected}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Fakten:</span>
                              <span className="ml-2 font-medium">{run.factsExtracted}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Anti-AI:</span>
                              <span className={`ml-2 font-medium ${run.antiAiScore && run.antiAiScore >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                                {run.antiAiScore ? `${run.antiAiScore}/100` : '-'}
                              </span>
                            </div>
                          </div>
                          
                          {run.errorMessage && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                              <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                                <XCircle className="h-4 w-4" />
                                Fehler {run.errorStep && `in ${run.errorStep}`}
                              </div>
                              <p className="text-red-600 text-sm">{run.errorMessage}</p>
                            </div>
                          )}
                          
                          {run.articleSlug && (
                            <a 
                              href={`/${run.articleSlug}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-cyan-600 hover:text-cyan-700"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Artikel ansehen: /{run.articleSlug}
                            </a>
                          )}
                          
                          {run.debugLog && (
                            <details className="mt-4">
                              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                                Debug Log anzeigen
                              </summary>
                              <pre className="mt-2 p-3 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto max-h-48">
                                {JSON.parse(run.debugLog).join('\n')}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* YOUTUBE TAB */}
        {activeTab === 'youtube' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              {/* Actions */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Youtube className="h-5 w-5 text-red-600" />
                  Aktionen
                </h2>
                <div className="space-y-3">
                  <button
                    onClick={() => runAction('yt-check')}
                    disabled={runningAction !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {runningAction === 'yt-check' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Neue Videos suchen
                  </button>
                  <button
                    onClick={() => runAction('yt-process-batch')}
                    disabled={runningAction !== null || ytStats.unprocessedVideos === 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {runningAction === 'yt-process-batch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    3 Videos verarbeiten
                  </button>
                </div>
              </div>

              {/* Channels */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Kanäle ({channels.length})</h2>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {channels.map((channel) => (
                    <div key={channel.channelId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <a href={channel.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:text-red-600 truncate block">
                          {channel.name}
                        </a>
                        <p className="text-xs text-gray-500">{channel._count.videos} Videos</p>
                      </div>
                      <button
                        onClick={() => runAction('toggle-channel', { channelId: channel.channelId, isActive: !channel.isActive })}
                        className={`p-2 rounded-lg ${channel.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                      >
                        {channel.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              {/* Unprocessed Videos */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Unverarbeitete Videos ({ytStats.unprocessedVideos || 0})
                </h2>
                {unprocessedVideos.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Keine unverarbeiteten Videos</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {unprocessedVideos.map((video) => (
                      <div key={video.videoId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="font-medium text-gray-900 truncate">{video.title}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <span>{video.channel.name}</span>
                            <span>•</span>
                            <span>{new Date(video.publishedAt).toLocaleDateString('de-DE')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => runAction('yt-process-video', { videoId: video.videoId })}
                            disabled={runningAction !== null}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Verarbeiten"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-red-600">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <button onClick={() => runAction('delete-video', { videoId: video.videoId })} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TRENDS TAB */}
        {activeTab === 'trends' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-600" />
                  Manueller Trend-Artikel
                </h2>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={trendSearchTerm}
                    onChange={(e) => setTrendSearchTerm(e.target.value)}
                    placeholder="z.B. Stranger Things Staffel 5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={() => trendSearchTerm && runAction('trends-process', { searchTerm: trendSearchTerm })}
                    disabled={!trendSearchTerm || runningAction !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    {runningAction === 'trends-process' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Artikel generieren
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-600" />
                  Cron-Schedule
                </h2>
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <p className="font-medium text-orange-800">P3-Trends</p>
                    <p className="text-orange-600">4x täglich: 09:00, 13:00, 18:00, 22:00</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="font-medium text-red-800">P4-YouTube</p>
                    <p className="text-red-600">6x täglich: 08:00, 11:00, 14:00, 17:00, 20:00, 23:00</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Trend-Statistiken</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{trendStats.totalTrends || 0}</div>
                    <div className="text-sm text-gray-500">Gesamt</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{trendStats.recentTrends || 0}</div>
                    <div className="text-sm text-gray-500">7 Tage</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{trendStats.processedTrends || 0}</div>
                    <div className="text-sm text-gray-500">Verarbeitet</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Bug className="h-5 w-5 text-purple-600" />
              Alle Pipeline-Läufe ({pipelineRuns.length})
            </h2>
            
            {pipelineRuns.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Keine Läufe im Zeitraum</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4">Zeit</th>
                      <th className="text-left py-3 px-4">Pipeline</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Input</th>
                      <th className="text-left py-3 px-4">Output</th>
                      <th className="text-left py-3 px-4">Metriken</th>
                      <th className="text-left py-3 px-4">Fehler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineRuns.map((run) => (
                      <tr key={run.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 whitespace-nowrap">{formatTime(run.startedAt)}</td>
                        <td className="py-3 px-4">{getPipelineBadge(run.pipeline)}</td>
                        <td className="py-3 px-4">{getStatusBadge(run.status)}</td>
                        <td className="py-3 px-4 max-w-xs truncate" title={run.inputQuery || run.inputVideoId || '-'}>
                          {run.inputQuery || run.inputVideoId || '-'}
                        </td>
                        <td className="py-3 px-4">
                          {run.articleSlug ? (
                            <a href={`/${run.articleSlug}`} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline">
                              Artikel
                            </a>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-gray-500">S:</span>{run.sourcesFound} 
                          <span className="text-gray-500 ml-2">W:</span>{run.wordsCollected}
                          <span className="text-gray-500 ml-2">F:</span>{run.factsExtracted}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-red-600" title={run.errorMessage || ''}>
                          {run.errorMessage || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
