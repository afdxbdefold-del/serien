'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Play, RefreshCw, ArrowLeft, Clock, CheckCircle, XCircle, Loader2,
  Youtube, Flame, Tv, ExternalLink, Trash2, ToggleLeft, ToggleRight,
  Zap, FileText, TrendingUp, AlertCircle, ChevronDown, ChevronUp,
  Activity, Timer, Target, Bug, Download, Bell, BellOff, Link2,
  BarChart3, AlertTriangle, Calendar, Video, Newspaper, Plus, X, Film
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

interface LastCreatedArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  createdAt: string;
  publishedAt?: string;
  status: string;
  heroVideoUrl?: string;
  sourceUrl?: string;
  publishMode?: string;
  users?: { name: string };
  series?: { name: string; tmdbId?: number };
  // New fields
  sourceWordCount?: number;
  generatedWordCount?: number;
  antiAiScore?: number | null;
  discoverScore?: number | null;
  discoverVerdict?: string | null;
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

interface TopError {
  message: string;
  count: number;
  lastSeen: string;
  step?: string;
}

interface ChartData {
  date: string;
  success: number;
  failed: number;
  partial: number;
}

interface CronStatus {
  nextRun: string;
  lastRun?: string;
  lastStatus?: string;
  schedule: string;
  successCount?: number;
  failCount?: number;
  avgDuration?: number;
  lastError?: string;
  articlesCreated?: number;
}

export default function AdminPipelinePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [recentArticles, setRecentArticles] = useState<RecentArticle[]>([]);
  const [lastCreatedArticles, setLastCreatedArticles] = useState<LastCreatedArticle[]>([]);
  const [channels, setChannels] = useState<YTChannel[]>([]);
  const [unprocessedVideos, setUnprocessedVideos] = useState<UnprocessedVideo[]>([]);
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [pipelineStats, setPipelineStats] = useState<Record<string, any>>({});
  const [ytStats, setYtStats] = useState<any>({});
  const [articleStats, setArticleStats] = useState<any>({});
  const [topErrors, setTopErrors] = useState<TopError[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [cronStatus, setCronStatus] = useState<Record<string, CronStatus>>({});
  const [hasRunningPipeline, setHasRunningPipeline] = useState(false);
  
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [v2Url, setV2Url] = useState('');
  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [p2DebugLog, setP2DebugLog] = useState<string[]>([]);
  const [p2NewsList, setP2NewsList] = useState<Array<{
    title: string;
    url: string;
    timeAgo: string;
    source: string;
    isImported: boolean;
  }>>([]);
  const [p2NewsLoading, setP2NewsLoading] = useState(false);
  const [p2SelectedUrl, setP2SelectedUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'v2' | 'youtube' | 'logs' | 'articles' | 'videos'>('overview');
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [hoursFilter, setHoursFilter] = useState(24);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorCountRef = useRef(0);

  const getToken = () => localStorage.getItem('admin_token');

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('pipeline_notifications', 'true');
      }
    }
  };

  // Send browser notification
  const sendNotification = (title: string, body: string) => {
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  };

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
      setLastCreatedArticles(data.lastCreatedArticles || []);
      setChannels(data.channels || []);
      setUnprocessedVideos(data.unprocessedVideos || []);
      setPipelineRuns(data.pipelineRuns || []);
      setPipelineStats(data.pipelineStats || {});
      setYtStats(data.ytStats || {});
      setArticleStats(data.articleStats || {});
      setTopErrors(data.topErrors || []);
      setChartData(data.chartData || []);
      setCronStatus(data.cronStatus || {});
      setHasRunningPipeline(data.hasRunningPipeline || false);

      // Check for new errors and send notification
      const currentErrorCount = (data.pipelineRuns || []).filter((r: PipelineRun) => r.status === 'failed').length;
      if (currentErrorCount > lastErrorCountRef.current && lastErrorCountRef.current > 0) {
        sendNotification('Pipeline Fehler', `${currentErrorCount - lastErrorCountRef.current} neue Fehler erkannt`);
      }
      lastErrorCountRef.current = currentErrorCount;
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [router, hoursFilter, notificationsEnabled]);

  // Auto-refresh when pipeline is running
  useEffect(() => {
    if (autoRefresh && hasRunningPipeline) {
      // Neon-Cost-Sprint: 10 s → 30 s + Visibility-Gate.
      autoRefreshRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') fetchDashboard();
      }, 30000);
    } else if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefresh, hasRunningPipeline, fetchDashboard]);

  useEffect(() => {
    fetchDashboard();
    // Check if notifications were previously enabled
    if (localStorage.getItem('pipeline_notifications') === 'true' && 
        'Notification' in window && 
        Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, [fetchDashboard]);

  const runAction = async (action: string, payload: Record<string, any> = {}) => {
    setRunningAction(action);
    setActionMessage(null);
    
    // Clear debug log for P2 actions
    if (action === 'generate-single-p2') {
      setP2DebugLog(['🔄 Starte P2-Pipeline...']);
    }
    
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
      
      // Handle debug logs for P2 generator
      if (action === 'generate-single-p2' && data.debug) {
        setP2DebugLog(data.debug);
      }
      
      if (response.ok && data.success) {
        setActionMessage({ type: 'success', text: data.message || 'Aktion erfolgreich' });
        setTimeout(fetchDashboard, 2000);
      } else {
        setActionMessage({ type: 'error', text: data.error || data.message || 'Aktion fehlgeschlagen' });
        sendNotification('Pipeline Fehler', data.error || 'Aktion fehlgeschlagen');
      }
    } catch (error) {
      setActionMessage({ type: 'error', text: 'Netzwerkfehler' });
      if (action === 'generate-single-p2' || action === 'import-p2-article') {
        setP2DebugLog(prev => [...prev, '❌ Netzwerkfehler']);
      }
    } finally {
      setRunningAction(null);
    }
  };

  // Fetch P2 News List
  const fetchP2NewsList = async () => {
    setP2NewsLoading(true);
    setP2NewsList([]);
    try {
      const response = await fetch('/api/admin/pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ action: 'fetch-p2-news' })
      });
      const data = await response.json();
      if (data.success && data.news) {
        setP2NewsList(data.news);
      } else {
        setActionMessage({ type: 'error', text: data.error || 'News konnten nicht geladen werden' });
      }
    } catch (error) {
      setActionMessage({ type: 'error', text: 'Netzwerkfehler beim Laden der News' });
    } finally {
      setP2NewsLoading(false);
    }
  };

  // Import specific P2 article
  const importP2Article = async (url: string) => {
    setP2SelectedUrl(url);
    setP2DebugLog(['🔄 Importiere Artikel...']);
    setRunningAction('import-p2-article');
    
    try {
      const response = await fetch('/api/admin/pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ action: 'import-p2-article', url })
      });
      const data = await response.json();
      
      if (data.debug) {
        setP2DebugLog(data.debug);
      }
      
      if (data.success) {
        setActionMessage({ type: 'success', text: data.message || 'Artikel importiert' });
        // Mark as imported in the list
        setP2NewsList(prev => prev.map(n => 
          n.url === url ? { ...n, isImported: true } : n
        ));
        setTimeout(fetchDashboard, 2000);
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Import fehlgeschlagen' });
      }
    } catch (error) {
      setP2DebugLog(prev => [...prev, '❌ Netzwerkfehler']);
      setActionMessage({ type: 'error', text: 'Netzwerkfehler' });
    } finally {
      setRunningAction(null);
      setP2SelectedUrl(null);
    }
  };

  // Delete article
  const deleteArticle = async (articleId: string) => {
    try {
      const response = await fetch('/api/admin/articles', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ articleId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setActionMessage({ type: 'success', text: 'Artikel gelöscht' });
        // Remove from local state
        setLastCreatedArticles(prev => prev.filter(a => a.id !== articleId));
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Löschen fehlgeschlagen' });
      }
    } catch (error) {
      setActionMessage({ type: 'error', text: 'Netzwerkfehler beim Löschen' });
    }
  };

  const exportCSV = async () => {
    try {
      const response = await fetch('/api/admin/pipeline', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}` 
        },
        body: JSON.stringify({ action: 'export-csv' })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pipeline-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getPipelineBadge = (pipeline: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      'p4-youtube': { bg: 'bg-red-100', text: 'text-red-700', label: 'YouTube' },
      'pipeline-v2': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'V2' },
      'cron-news': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'News' },
      'cron-releases': { bg: 'bg-green-100', text: 'text-green-700', label: 'Releases' },
      'cron-videos': { bg: 'bg-pink-100', text: 'text-pink-700', label: 'Videos' },
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

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  const formatRelativeTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const diff = new Date(dateStr).getTime() - Date.now();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diff < 0) return 'überfällig';
      if (hours > 0) return `in ${hours}h ${minutes}m`;
      return `in ${minutes}m`;
    } catch {
      return '-';
    }
  };

  // Simple bar chart component
  const SimpleBarChart = ({ data }: { data: ChartData[] }) => {
    const maxValue = Math.max(...data.flatMap(d => [d.success, d.failed, d.partial]), 1);
    
    return (
      <div className="flex items-end gap-2 h-32">
        {data.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: '100px' }}>
              {day.success > 0 && (
                <div 
                  className="w-full bg-green-500 rounded-t" 
                  style={{ height: `${(day.success / maxValue) * 100}%` }}
                  title={`${day.success} erfolgreich`}
                />
              )}
              {day.partial > 0 && (
                <div 
                  className="w-full bg-yellow-500" 
                  style={{ height: `${(day.partial / maxValue) * 100}%` }}
                  title={`${day.partial} teilweise`}
                />
              )}
              {day.failed > 0 && (
                <div 
                  className="w-full bg-red-500 rounded-b" 
                  style={{ height: `${(day.failed / maxValue) * 100}%` }}
                  title={`${day.failed} fehlgeschlagen`}
                />
              )}
            </div>
            <span className="text-xs text-gray-500">{day.date}</span>
          </div>
        ))}
      </div>
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
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  Content Pipelines
                  {hasRunningPipeline && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Läuft
                    </span>
                  )}
                </h1>
                <p className="text-sm text-gray-500">P4-YouTube, Pipeline-V2</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Notification toggle */}
              <button
                onClick={() => notificationsEnabled ? setNotificationsEnabled(false) : requestNotificationPermission()}
                className={`p-2 rounded-lg ${notificationsEnabled ? 'text-cyan-600 bg-cyan-50' : 'text-gray-400 hover:bg-gray-100'}`}
                title={notificationsEnabled ? 'Benachrichtigungen aus' : 'Benachrichtigungen an'}
              >
                {notificationsEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              </button>
              
              {/* 404 Errors Link */}
              <Link
                href="/admin/errors"
                className="flex items-center gap-2 px-3 py-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                title="404 Errors anzeigen"
              >
                <AlertTriangle className="h-4 w-4" />
              </Link>
              
              {/* Trailer Import Link */}
              <Link
                href="/admin/trailers"
                className="flex items-center gap-2 px-3 py-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                title="Trailer Import Manager"
              >
                <Film className="h-4 w-4" />
              </Link>
              
              {/* Export CSV */}
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Logs exportieren"
              >
                <Download className="h-4 w-4" />
              </button>
              
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

      <main className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            { id: 'v2', label: 'Pipeline-V2', icon: Tv },
            { id: 'youtube', label: 'P4-YouTube', icon: Youtube },
            { id: 'articles', label: 'Artikel', icon: Newspaper },
            { id: 'videos', label: 'Video-Queue', icon: Video },
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
            {/* Cron Status with Manual Trigger */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Object.entries(cronStatus)
                .filter(([pipeline]) => pipeline !== 'p3-trends') // Filter out trends
                .map(([pipeline, status]) => {
                const triggerAction = {
                  'p4-youtube': 'trigger-cron-youtube',
                  'cron-news': 'trigger-cron-news',
                  'cron-releases': 'trigger-cron-releases',
                  'cron-videos': 'trigger-cron-videos',
                }[pipeline];
                
                const successRate = status.successCount && status.failCount !== undefined
                  ? Math.round((status.successCount / (status.successCount + status.failCount)) * 100)
                  : null;
                
                return (
                  <div key={pipeline} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      {getPipelineBadge(pipeline)}
                      {status.lastStatus && getStatusBadge(status.lastStatus)}
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-lg font-bold text-green-600">{status.successCount || 0}</div>
                        <div className="text-xs text-gray-500">Erfolge</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center">
                        <div className="text-lg font-bold text-red-600">{status.failCount || 0}</div>
                        <div className="text-xs text-gray-500">Fehler</div>
                      </div>
                    </div>
                    
                    {/* Success Rate Bar */}
                    {successRate !== null && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Erfolgsrate</span>
                          <span className={successRate >= 80 ? 'text-green-600' : successRate >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                            {successRate}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${successRate >= 80 ? 'bg-green-500' : successRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${successRate}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Artikel erstellt */}
                    {status.articlesCreated !== undefined && status.articlesCreated > 0 && (
                      <div className="flex items-center gap-2 text-sm mb-2 p-2 bg-emerald-50 rounded-lg">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-700 font-medium">{status.articlesCreated} Artikel erstellt</span>
                      </div>
                    )}
                    
                    {/* Timing */}
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-500">Nächster:</span>
                        <span className="font-medium text-cyan-600">{formatRelativeTime(status.nextRun)}</span>
                      </div>
                      {status.lastRun && (
                        <div className="flex items-center gap-2">
                          <Timer className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-500">Letzter:</span>
                          <span className="text-gray-700">{formatTime(status.lastRun)}</span>
                        </div>
                      )}
                      {status.avgDuration && (
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-500">Ø Dauer:</span>
                          <span className="text-gray-700">{Math.round(status.avgDuration / 1000)}s</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Last Error */}
                    {status.lastError && status.lastStatus === 'failed' && (
                      <div className="mt-2 p-2 bg-red-50 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-red-700 line-clamp-2">{status.lastError}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Schedule Info */}
                    <div className="mt-2 text-xs text-gray-400">
                      Schedule: {status.schedule}
                    </div>
                    
                    {triggerAction && (
                      <button
                        onClick={() => runAction(triggerAction)}
                        disabled={runningAction === triggerAction || hasRunningPipeline}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-50 text-cyan-700 rounded-lg text-sm font-medium hover:bg-cyan-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {runningAction === triggerAction ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Jetzt starten
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* P2 Artikel-Generator mit News-Liste */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">P2 Artikel-Generator</h3>
                  <p className="text-emerald-100 text-sm">
                    Wähle einen Artikel aus den aktuellsten News (bis 3 Tage alt)
                  </p>
                </div>
                <button
                  onClick={fetchP2NewsList}
                  disabled={p2NewsLoading}
                  className="flex items-center gap-3 px-6 py-4 bg-white text-emerald-600 rounded-xl font-bold text-lg hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {p2NewsLoading ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      Lade News...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-6 w-6" />
                      News laden
                    </>
                  )}
                </button>
              </div>
              
              {/* News Liste */}
              {p2NewsList.length > 0 && (
                <div className="bg-black/20 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-emerald-100">
                      {p2NewsList.length} News gefunden ({p2NewsList.filter(n => !n.isImported).length} neu)
                    </span>
                    <button 
                      onClick={() => setP2NewsList([])}
                      className="text-xs text-emerald-200 hover:text-white"
                    >
                      Schließen
                    </button>
                  </div>
                  <div className="space-y-2">
                    {p2NewsList.map((news, i) => (
                      <div 
                        key={i} 
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          news.isImported 
                            ? 'bg-black/20 opacity-60' 
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              news.source === 'ScreenRant' ? 'bg-blue-500/30 text-blue-100' :
                              news.source === 'Collider' ? 'bg-purple-500/30 text-purple-100' :
                              'bg-orange-500/30 text-orange-100'
                            }`}>
                              {news.source}
                            </span>
                            {news.timeAgo && (
                              <span className="text-xs text-emerald-200">{news.timeAgo}</span>
                            )}
                            {news.isImported && (
                              <span className="text-xs px-2 py-0.5 bg-green-500/30 text-green-100 rounded">
                                ✓ Importiert
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white font-medium truncate" title={news.title}>
                            {news.title}
                          </p>
                          <a 
                            href={news.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-200 hover:text-white truncate block"
                          >
                            {news.url.substring(0, 60)}...
                          </a>
                        </div>
                        {!news.isImported && (
                          <button
                            onClick={() => importP2Article(news.url)}
                            disabled={runningAction === 'import-p2-article'}
                            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                              p2SelectedUrl === news.url
                                ? 'bg-yellow-500 text-yellow-900'
                                : 'bg-white text-emerald-600 hover:bg-emerald-50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {p2SelectedUrl === news.url ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Import...
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4" />
                                Import
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Debug Output */}
              {p2DebugLog.length > 0 && (
                <div className="mt-4 bg-black/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-emerald-100">Debug Log</span>
                    <button 
                      onClick={() => setP2DebugLog([])}
                      className="text-xs text-emerald-200 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
                    {p2DebugLog.map((line, i) => (
                      <div key={i} className="text-emerald-100">{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chart + Error Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Success/Failure Chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-cyan-600" />
                  Erfolgsquote (7 Tage)
                </h2>
                {chartData.length > 0 ? (
                  <>
                    <SimpleBarChart data={chartData} />
                    <div className="flex justify-center gap-4 mt-4 text-xs">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded" /> Erfolg</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded" /> Teilweise</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded" /> Fehler</span>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 text-center py-8">Keine Daten</p>
                )}
              </div>

              {/* Top Errors */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Häufigste Fehler
                </h2>
                {topErrors.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-2" />
                    <p className="text-gray-500">Keine Fehler im Zeitraum</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {topErrors.map((error, i) => (
                      <div key={i} className="p-3 bg-red-50 border border-red-100 rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-red-800 flex-1 break-words">{error.message}</p>
                          <span className="flex-shrink-0 px-2 py-1 bg-red-200 text-red-800 rounded-full text-xs font-bold">
                            {error.count}x
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-red-600">
                          {error.step && <span>Step: {error.step}</span>}
                          <span>Zuletzt: {formatTime(error.lastSeen)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
                          {/* Source URL - prominent display */}
                          {run.inputSource && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-center gap-2 text-blue-700 font-medium mb-1">
                                <Link2 className="h-4 w-4" />
                                Originalquelle:
                              </div>
                              <a 
                                href={run.inputSource} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline break-all text-xs"
                              >
                                {run.inputSource}
                              </a>
                            </div>
                          )}
                          
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

        {/* ARTICLES TAB */}
        {activeTab === 'articles' && (
          <div className="space-y-6">
            {/* Manual Pipeline V2 */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Link2 className="h-5 w-5 text-blue-600" />
                Pipeline-V2: Artikel aus URL
              </h2>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={v2Url}
                  onChange={(e) => setV2Url(e.target.value)}
                  placeholder="https://screenrant.com/..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={() => v2Url && runAction('v2-process', { url: v2Url })}
                  disabled={!v2Url || runningAction !== null}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {runningAction === 'v2-process' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Generieren
                </button>
              </div>
            </div>

            {/* Article Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-1">Publiziert (7d)</div>
                <div className="text-2xl font-bold text-gray-900">{lastCreatedArticles.filter(a => a.status === 'published').length}</div>
              </div>
              <div className="bg-white rounded-xl border border-orange-200 p-4">
                <div className="text-sm text-orange-600 mb-1">Drafts (7d)</div>
                <div className="text-2xl font-bold text-orange-600">{lastCreatedArticles.filter(a => a.status === 'draft').length}</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-1">Ø Wörter generiert</div>
                <div className="text-2xl font-bold text-cyan-600">
                  {lastCreatedArticles.length > 0 
                    ? Math.round(lastCreatedArticles.reduce((sum, a) => sum + (a.generatedWordCount || 0), 0) / lastCreatedArticles.length)
                    : 0}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-1">Ø Anti-AI Score</div>
                <div className="text-2xl font-bold text-green-600">
                  {lastCreatedArticles.filter(a => a.antiAiScore).length > 0 
                    ? Math.round(lastCreatedArticles.filter(a => a.antiAiScore).reduce((sum, a) => sum + (a.antiAiScore || 0), 0) / lastCreatedArticles.filter(a => a.antiAiScore).length)
                    : '-'}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-1">Ø Discover Score</div>
                <div className="text-2xl font-bold text-purple-600">
                  {lastCreatedArticles.filter(a => a.discoverScore).length > 0 
                    ? Math.round(lastCreatedArticles.filter(a => a.discoverScore).reduce((sum, a) => sum + (a.discoverScore || 0), 0) / lastCreatedArticles.filter(a => a.discoverScore).length)
                    : '-'}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm text-gray-500 mb-1">Mit Video</div>
                <div className="text-2xl font-bold text-red-600">
                  {lastCreatedArticles.filter(a => a.heroVideoUrl).length}
                </div>
              </div>
            </div>

            {/* Last Created Articles */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-cyan-600" />
                Zuletzt erstellte Artikel ({lastCreatedArticles.length})
              </h2>
              {lastCreatedArticles.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Keine Artikel in den letzten 7 Tagen</p>
              ) : (
                <div className="space-y-3">
                  {lastCreatedArticles.map((article) => {
                    // Calculate quality badge based on scores
                    const antiAi = article.antiAiScore || 0;
                    const discover = article.discoverScore || 0;
                    const avgScore = (antiAi + discover) / 2;
                    const qualityBadge = avgScore >= 75 ? 'excellent' : avgScore >= 60 ? 'good' : avgScore >= 40 ? 'ok' : 'poor';
                    
                    return (
                      <div key={article.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        {/* Row 1: Title + Quality Badge */}
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {/* Quality Badge */}
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                qualityBadge === 'excellent' ? 'bg-green-100 text-green-700' :
                                qualityBadge === 'good' ? 'bg-blue-100 text-blue-700' :
                                qualityBadge === 'ok' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {qualityBadge === 'excellent' ? '★★★' : qualityBadge === 'good' ? '★★' : qualityBadge === 'ok' ? '★' : '⚠'}
                              </span>
                              
                              {article.status === 'draft' && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                                  DRAFT
                                </span>
                              )}
                              
                              {article.heroVideoUrl && <Video className="h-4 w-4 text-red-500" title="Hat Trailer" />}
                              
                              <a 
                                href={`/${article.slug}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-medium text-gray-900 hover:text-cyan-600 truncate"
                              >
                                {article.title}
                              </a>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <a 
                              href={`/${article.slug}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-cyan-600 rounded hover:bg-white"
                              title="Artikel öffnen"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            {article.series?.tmdbId && (
                              <a 
                                href={`/serie/${article.series.name?.toLowerCase().replace(/\s+/g, '-')}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-white"
                                title="Serie öffnen"
                              >
                                <Tv className="h-4 w-4" />
                              </a>
                            )}
                            <button 
                              onClick={() => {
                                if (confirm(`Artikel "${article.title}" wirklich löschen?`)) {
                                  deleteArticle(article.id);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-white"
                              title="Artikel löschen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Row 2: Metadata */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-2">
                          <span className={`px-2 py-0.5 rounded ${
                            article.id.startsWith('yt-') ? 'bg-red-100 text-red-700' :
                            article.id.startsWith('trend-') ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {article.id.startsWith('yt-') ? 'YouTube' : article.id.startsWith('trend-') ? 'Trends' : 'V2'}
                          </span>
                          {article.series && (
                            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                              {article.series.name}
                            </span>
                          )}
                          {article.users && <span>von {article.users.name}</span>}
                          <span>{formatTime(article.createdAt)}</span>
                        </div>
                        
                        {/* Row 3: Word Count + Scores */}
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          {/* Word Count: Vorher → Nachher */}
                          <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border">
                            <span className="text-gray-500">Wörter:</span>
                            <span className="text-orange-600 font-medium">{article.sourceWordCount || '?'}</span>
                            <span className="text-gray-400">→</span>
                            <span className={`font-medium ${
                              (article.generatedWordCount || 0) >= 1500 ? 'text-green-600' :
                              (article.generatedWordCount || 0) >= 1000 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {article.generatedWordCount || '?'}
                            </span>
                            {article.sourceWordCount && article.generatedWordCount && (
                              <span className={`text-xs ${
                                article.generatedWordCount > article.sourceWordCount ? 'text-green-500' : 'text-red-500'
                              }`}>
                                ({article.generatedWordCount > article.sourceWordCount ? '+' : ''}{Math.round((article.generatedWordCount / article.sourceWordCount - 1) * 100)}%)
                              </span>
                            )}
                          </div>
                          
                          {/* Anti-AI Score */}
                          <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border">
                            <span className="text-gray-500">Anti-AI:</span>
                            <span className={`font-medium ${
                              (article.antiAiScore || 0) >= 80 ? 'text-green-600' :
                              (article.antiAiScore || 0) >= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {article.antiAiScore || '-'}/100
                            </span>
                          </div>
                          
                          {/* Discover Score */}
                          <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border">
                            <span className="text-gray-500">Discover:</span>
                            <span className={`font-medium ${
                              (article.discoverScore || 0) >= 70 ? 'text-green-600' :
                              (article.discoverScore || 0) >= 50 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {article.discoverScore || '-'}/100
                            </span>
                            {article.discoverVerdict && (
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                article.discoverVerdict === 'PUBLISH' ? 'bg-green-100 text-green-700' :
                                article.discoverVerdict === 'SEARCH_ONLY' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {article.discoverVerdict}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Row 4: Source URL */}
                        {article.sourceUrl && (
                          <a 
                            href={article.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-2 truncate max-w-lg"
                          >
                            <Link2 className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{article.sourceUrl}</span>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* V2 PIPELINE TAB */}
        {activeTab === 'v2' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              {/* V2 Actions */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Tv className="h-5 w-5 text-blue-600" />
                  Pipeline-V2: Artikel aus URL
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                  Generiere einen vollständigen Artikel aus einer beliebigen News-URL.
                </p>
                <div className="space-y-3">
                  <input
                    type="url"
                    value={v2Url}
                    onChange={(e) => setV2Url(e.target.value)}
                    placeholder="https://screenrant.com/... oder https://deadline.com/..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => v2Url && runAction('v2-process', { url: v2Url })}
                    disabled={!v2Url || runningAction !== null}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {runningAction === 'v2-process' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Artikel generieren
                  </button>
                </div>
              </div>

              {/* V2 Info */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  Pipeline-V2 Features
                </h2>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Full-Text Extraction (Jina AI)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    TMDB Serie Zuordnung
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Fakten-Extraktion
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Quality Gates (Anti-AI, Fact Safety)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Character & Cast Linking
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Internal Links + Related Articles
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Trailer Download (TMDB/YouTube)
                  </li>
                </ul>
              </div>
            </div>

            <div className="lg:col-span-2">
              {/* V2 Pipeline Stats */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline-V2 Statistiken</h2>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {pipelineStats['pipeline-v2']?.total || 0}
                    </div>
                    <div className="text-sm text-gray-500">Gesamt</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {pipelineStats['pipeline-v2']?.success || 0}
                    </div>
                    <div className="text-sm text-gray-500">Erfolg</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {pipelineStats['pipeline-v2']?.failed || 0}
                    </div>
                    <div className="text-sm text-gray-500">Fehler</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatDuration(pipelineStats['pipeline-v2']?.avgDuration)}
                    </div>
                    <div className="text-sm text-gray-500">Ø Dauer</div>
                  </div>
                </div>
              </div>

              {/* Recent V2 Runs */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Letzte V2 Läufe</h2>
                {pipelineRuns.filter(r => r.pipeline === 'pipeline-v2').length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Keine V2 Läufe im Zeitraum</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {pipelineRuns
                      .filter(r => r.pipeline === 'pipeline-v2')
                      .slice(0, 15)
                      .map((run) => (
                        <div key={run.id} className="border border-gray-100 rounded-lg overflow-hidden">
                          <div 
                            className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                          >
                            <div className="flex items-center gap-3">
                              {getStatusBadge(run.status)}
                              <span className="text-sm text-gray-700 truncate max-w-xs">
                                {run.articleTitle || run.inputQuery || run.inputSource || '-'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                              {run.antiAiScore && (
                                <span className={`px-2 py-1 rounded text-xs ${
                                  run.antiAiScore >= 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  AI: {run.antiAiScore}
                                </span>
                              )}
                              <span>{formatDuration(run.durationMs)}</span>
                              <span>{formatTime(run.startedAt)}</span>
                              {expandedRun === run.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>
                          
                          {expandedRun === run.id && (
                            <div className="p-4 bg-white border-t border-gray-100 text-sm">
                              {/* Source URL - prominent display */}
                              {run.inputSource && (
                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="flex items-center gap-2 text-blue-700 font-medium mb-1">
                                    <Link2 className="h-4 w-4" />
                                    Originalquelle:
                                  </div>
                                  <a 
                                    href={run.inputSource} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline break-all text-xs"
                                  >
                                    {run.inputSource}
                                  </a>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-4 gap-4 mb-4">
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
                                    {run.antiAiScore || '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Dauer:</span>
                                  <span className="ml-2 font-medium">{formatDuration(run.durationMs)}</span>
                                </div>
                              </div>
                              
                              {run.errorMessage && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
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
                                  Artikel ansehen
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Kanäle ({channels.length})</h2>
                  <button
                    onClick={() => setShowAddChannel(!showAddChannel)}
                    className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg"
                    title="Kanal hinzufügen"
                  >
                    {showAddChannel ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </button>
                </div>
                
                {/* Add Channel Form */}
                {showAddChannel && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800 mb-2 font-medium">Neuen YouTube-Kanal hinzufügen</p>
                    <input
                      type="text"
                      value={newChannelUrl}
                      onChange={(e) => setNewChannelUrl(e.target.value)}
                      placeholder="YouTube URL (z.B. youtube.com/@Netflix)"
                      className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg mb-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <input
                      type="text"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="Name (optional)"
                      className="w-full px-3 py-2 text-sm border border-green-300 rounded-lg mb-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                      onClick={async () => {
                        if (!newChannelUrl.trim()) return;
                        await runAction('add-channel', { 
                          channelUrl: newChannelUrl.trim(),
                          channelName: newChannelName.trim() || undefined
                        });
                        setNewChannelUrl('');
                        setNewChannelName('');
                        setShowAddChannel(false);
                      }}
                      disabled={runningAction !== null || !newChannelUrl.trim()}
                      className="w-full px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {runningAction === 'add-channel' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Kanal hinzufügen
                    </button>
                  </div>
                )}
                
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {channels.map((channel) => (
                    <div key={channel.channelId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group">
                      <div className="flex-1 min-w-0">
                        <a href={channel.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:text-red-600 truncate block">
                          {channel.name}
                        </a>
                        <p className="text-xs text-gray-500">{channel._count.videos} Videos</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => runAction('toggle-channel', { channelId: channel.channelId, isActive: !channel.isActive })}
                          className={`p-2 rounded-lg ${channel.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                          title={channel.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        >
                          {channel.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Kanal "${channel.name}" und alle zugehörigen Videos wirklich löschen?`)) {
                              runAction('delete-channel', { channelId: channel.channelId });
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Kanal löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
                            <span>{new Date(video.publishedAt).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}</span>
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

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Bug className="h-5 w-5 text-purple-600" />
                Alle Pipeline-Läufe ({pipelineRuns.length})
              </h2>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <Download className="h-4 w-4" />
                CSV Export
              </button>
            </div>
            
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
                        <td className="py-3 px-4 max-w-xs truncate" title={run.inputSource || run.inputQuery || run.inputVideoId || '-'}>
                          {run.inputSource ? (
                            <a
                              href={run.inputSource}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`pipeline-run-input-link-${run.id}`}
                              className="text-cyan-600 hover:underline"
                            >
                              {run.inputQuery || run.inputVideoId || run.inputSource}
                            </a>
                          ) : (
                            run.inputQuery || run.inputVideoId || '-'
                          )}
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

        {/* VIDEO QUEUE TAB */}
        {activeTab === 'videos' && (
          <VideoQueueTab token={localStorage.getItem('admin_token') || ''} />
        )}
      </main>
    </div>
  );
}

// Video Queue Tab Component
function VideoQueueTab({ token }: { token: string }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [enqueuing, setEnqueuing] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/cron/videos?secret=serien-video-download-2024&action=stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch video stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Neon-Cost-Sprint: 10 s → 60 s + Visibility-Gate.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStats();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/cron/videos?secret=serien-video-download-2024&action=process');
      const data = await res.json();
      console.log('Process result:', data);
      await fetchStats();
    } catch (err) {
      console.error('Process failed:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleEnqueue = async () => {
    setEnqueuing(true);
    try {
      const res = await fetch('/api/cron/videos?secret=serien-video-download-2024&action=enqueue');
      const data = await res.json();
      console.log('Enqueue result:', data);
      await fetchStats();
    } catch (err) {
      console.error('Enqueue failed:', err);
    } finally {
      setEnqueuing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-cyan-600" />
        <p className="mt-2 text-gray-500">Video-Queue wird geladen...</p>
      </div>
    );
  }

  const queueStats = stats?.stats || {};

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-yellow-600 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold">{queueStats.pending || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Loader2 className="h-4 w-4" />
            <span className="text-sm font-medium">Downloading</span>
          </div>
          <p className="text-2xl font-bold">{queueStats.downloading || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Completed</span>
          </div>
          <p className="text-2xl font-bold">{queueStats.completed || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <XCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Failed</span>
          </div>
          <p className="text-2xl font-bold">{queueStats.failed || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Video className="h-4 w-4" />
            <span className="text-sm font-medium">Total</span>
          </div>
          <p className="text-2xl font-bold">
            {(queueStats.pending || 0) + (queueStats.downloading || 0) + (queueStats.completed || 0) + (queueStats.failed || 0)}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleEnqueue}
          disabled={enqueuing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {enqueuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Neue Artikel zur Queue hinzufügen
        </button>
        <button
          onClick={handleProcess}
          disabled={processing}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Queue verarbeiten
        </button>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          <RefreshCw className="h-4 w-4" />
          Aktualisieren
        </button>
      </div>

      {/* Recent Completed */}
      {stats?.recentCompleted?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Zuletzt abgeschlossen
          </h3>
          <div className="space-y-2">
            {stats.recentCompleted.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.seriesName}</p>
                  <p className="text-sm text-gray-500">{item.resultPath}</p>
                </div>
                <span className="text-sm text-green-600">
                  {item.completedAt ? new Date(item.completedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) : '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Failed */}
      {stats?.recentFailed?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            Zuletzt fehlgeschlagen
          </h3>
          <div className="space-y-2">
            {stats.recentFailed.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.seriesName}</p>
                  <p className="text-sm text-red-600">{item.lastError}</p>
                </div>
                <span className="text-sm text-gray-500">
                  Versuche: {item.attempts}/3
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
