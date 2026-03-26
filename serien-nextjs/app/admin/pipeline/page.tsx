'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Play, RefreshCw, ArrowLeft, Clock, CheckCircle, XCircle, Loader2,
  Youtube, Flame, Tv, ExternalLink, Trash2, ToggleLeft, ToggleRight,
  Zap, FileText, TrendingUp, AlertCircle, ChevronDown, ChevronUp,
  Activity, Timer, Target, Bug, Download, Bell, BellOff, Link2,
  BarChart3, AlertTriangle, Calendar, Video, Newspaper, Plus, X
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
  users?: { name: string };
  series?: { name: string };
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
  const [trendStats, setTrendStats] = useState<any>({});
  const [articleStats, setArticleStats] = useState<any>({});
  const [topErrors, setTopErrors] = useState<TopError[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [cronStatus, setCronStatus] = useState<Record<string, CronStatus>>({});
  const [hasRunningPipeline, setHasRunningPipeline] = useState(false);
  
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [trendSearchTerm, setTrendSearchTerm] = useState('');
  const [v2Url, setV2Url] = useState('');
  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'v2' | 'youtube' | 'trends' | 'logs' | 'articles'>('overview');
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
      setTrendStats(data.trendStats || {});
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
      autoRefreshRef.current = setInterval(fetchDashboard, 10000); // 10 seconds
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
        sendNotification('Pipeline Fehler', data.error || 'Aktion fehlgeschlagen');
      }
    } catch (error) {
      setActionMessage({ type: 'error', text: 'Netzwerkfehler' });
    } finally {
      setRunningAction(null);
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

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                <p className="text-sm text-gray-500">P3-Trends, P4-YouTube, Pipeline-V2</p>
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
            { id: 'v2', label: 'Pipeline-V2', icon: Tv },
            { id: 'youtube', label: 'P4-YouTube', icon: Youtube },
            { id: 'trends', label: 'P3-Trends', icon: Flame },
            { id: 'articles', label: 'Artikel', icon: Newspaper },
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
              {Object.entries(cronStatus).map(([pipeline, status]) => {
                const triggerAction = {
                  'p3-trends': 'trigger-cron-trends',
                  'p4-youtube': 'trigger-cron-youtube',
                  'cron-news': 'trigger-cron-news',
                  'cron-releases': 'trigger-cron-releases',
                }[pipeline];
                
                return (
                  <div key={pipeline} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      {getPipelineBadge(pipeline)}
                      {status.lastStatus && getStatusBadge(status.lastStatus)}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">Nächster Lauf:</span>
                      <span className="font-medium text-cyan-600">{formatRelativeTime(status.nextRun)}</span>
                    </div>
                    {status.lastRun && (
                      <div className="text-xs text-gray-500 mt-1">
                        Letzter: {formatTime(status.lastRun)}
                      </div>
                    )}
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
                  {lastCreatedArticles.map((article) => (
                    <div key={article.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
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
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className={`px-2 py-0.5 rounded ${
                            article.id.startsWith('yt-') ? 'bg-red-100 text-red-700' :
                            article.id.startsWith('trend-') ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {article.id.startsWith('yt-') ? 'YouTube' : article.id.startsWith('trend-') ? 'Trends' : 'V2'}
                          </span>
                          {article.series && <span>{article.series.name}</span>}
                          {article.users && <span>von {article.users.name}</span>}
                          <span>{formatTime(article.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          article.status === 'published' || article.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {article.status}
                        </span>
                        <a 
                          href={`/${article.slug}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-cyan-600"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  ))}
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
