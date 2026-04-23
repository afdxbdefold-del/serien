'use client';

import { useState, useEffect } from 'react';
import { 
  Users, Eye, Clock, Globe, Monitor, Smartphone, Tablet,
  TrendingUp, TrendingDown, RefreshCw, ExternalLink, ArrowUpRight,
  MousePointerClick, Timer, BarChart3, Activity, X, Loader2
} from 'lucide-react';
import ReferrerDetailModal from '@/components/admin/ReferrerDetailModal';

interface SourceCategory {
  category: string;
  name: string;
  count: number;
}

interface RealtimeData {
  realtime: {
    activeUsers: number;
    activeSessions: Array<{
      sessionId: string;
      entryPage: string;
      exitPage: string;
      pageViews: number;
      country: string | null;
      device: string | null;
      browser: string | null;
      startedAt: string;
      lastSeenAt: string;
      referrer: string | null;
    }>;
    pageViewsLastHour: number;
  };
  today: {
    pageViews: number;
    uniqueVisitors: number;
    yesterdayPageViews: number;
  };
  yesterday: {
    pageViews: number;
    uniqueVisitors: number;
  };
  topPages: {
    now: Array<{ path: string; views: number }>;
    today: Array<{ path: string; views: number }>;
    yesterday: Array<{ path: string; views: number }>;
  };
  trafficSources: Array<{ source: string; count: number }>;
  trafficSourcesYesterday: Array<{ source: string; count: number }>;
  devices: Array<{ device: string; count: number }>;
  devicesYesterday: Array<{ device: string; count: number }>;
  countries: Array<{ country: string; count: number }>;
  countriesYesterday: Array<{ country: string; count: number }>;
  hourlyViews: Array<{ hour: string; views: number }>;
  sourceCategories: {
    today: SourceCategory[];
    yesterday: SourceCategory[];
  };
  bounceRate: {
    today: number;
    yesterday: number;
    todaySessions: number;
    yesterdaySessions: number;
  };
  engagement: {
    today: Array<{ score: string; count: number }>;
    yesterday: Array<{ score: string; count: number }>;
  };
  avgDuration: {
    today: number;
    yesterday: number;
  };
  internalClicks: {
    today: Array<{ linkType: string; count: number }>;
    yesterday: Array<{ linkType: string; count: number }>;
  };
  timestamp: string;
}

const COUNTRY_FLAGS: Record<string, string> = {
  'DE': '🇩🇪', 'AT': '🇦🇹', 'CH': '🇨🇭', 'US': '🇺🇸', 'GB': '🇬🇧',
  'FR': '🇫🇷', 'NL': '🇳🇱', 'BE': '🇧🇪', 'IT': '🇮🇹', 'ES': '🇪🇸',
  'PL': '🇵🇱', 'CZ': '🇨🇿', 'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰',
};

const DEVICE_ICONS: Record<string, any> = {
  'desktop': Monitor,
  'mobile': Smartphone,
  'tablet': Tablet,
};

const CATEGORY_COLORS: Record<string, string> = {
  'discover': 'bg-orange-500',
  'google_news': 'bg-blue-600',
  'organic_search': 'bg-green-500',
  'social': 'bg-pink-500',
  'messaging': 'bg-emerald-500',
  'aggregator': 'bg-purple-500',
  'direct': 'bg-gray-500',
  'referral': 'bg-yellow-500',
  'internal': 'bg-cyan-500',
};

const CATEGORY_LABELS: Record<string, string> = {
  'discover': 'Google Discover',
  'google_news': 'Google News',
  'organic_search': 'Organische Suche',
  'social': 'Social Media',
  'messaging': 'Messenger',
  'aggregator': 'Aggregatoren',
  'direct': 'Direkt',
  'referral': 'Referral',
  'internal': 'Intern',
};

const LINK_TYPE_LABELS: Record<string, string> = {
  'breadcrumb': 'Breadcrumb',
  'series_card': 'Serien-Karte',
  'inline_link': 'Inline-Link',
  'navigation': 'Navigation',
  'other': 'Sonstige',
};

const ENGAGEMENT_COLORS: Record<string, string> = {
  'high': 'bg-green-500',
  'medium': 'bg-yellow-500',
  'low': 'bg-red-400',
};

function formatTimeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

function formatPath(path: string): string {
  if (path === '/') return 'Startseite';
  if (path.length > 40) return path.substring(0, 40) + '...';
  return path;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function parseReferrer(referrer: string | null): string {
  if (!referrer) return 'Direct';
  try {
    const url = new URL(referrer);
    return url.hostname.replace('www.', '');
  } catch {
    return referrer.substring(0, 30);
  }
}

export default function AnalyticsPage() {
  const [data, setData] = useState<RealtimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [dayTab, setDayTab] = useState<'today' | 'yesterday'>('today');
  const [detailReferrer, setDetailReferrer] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/analytics/realtime');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
      setError(null);
    } catch {
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  const changePercent = data?.today.yesterdayPageViews 
    ? Math.round(((data.today.pageViews - data.today.yesterdayPageViews) / data.today.yesterdayPageViews) * 100)
    : 0;

  // Aggregate source categories by category for display
  const aggregateByCategory = (sources: SourceCategory[]) => {
    const map = new Map<string, { category: string; label: string; count: number; sources: string[] }>();
    for (const s of sources) {
      const existing = map.get(s.category);
      if (existing) {
        existing.count += s.count;
        if (!existing.sources.includes(s.name)) existing.sources.push(s.name);
      } else {
        map.set(s.category, {
          category: s.category,
          label: CATEGORY_LABELS[s.category] || s.category,
          count: s.count,
          sources: [s.name],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  };

  const sourceCats = dayTab === 'today' 
    ? aggregateByCategory(data?.sourceCategories?.today || [])
    : aggregateByCategory(data?.sourceCategories?.yesterday || []);

  const sourceCatsTotal = sourceCats.reduce((sum, s) => sum + s.count, 0);

  const engagementData = dayTab === 'today' ? data?.engagement?.today : data?.engagement?.yesterday;
  const engagementTotal = engagementData?.reduce((sum, e) => sum + e.count, 0) || 0;

  const clicksData = dayTab === 'today' ? data?.internalClicks?.today : data?.internalClicks?.yesterday;
  const clicksTotal = clicksData?.reduce((sum, c) => sum + c.count, 0) || 0;

  const bounceRate = dayTab === 'today' ? data?.bounceRate?.today : data?.bounceRate?.yesterday;
  const bounceRateOther = dayTab === 'today' ? data?.bounceRate?.yesterday : data?.bounceRate?.today;
  const avgDuration = dayTab === 'today' ? data?.avgDuration?.today : data?.avgDuration?.yesterday;
  const avgDurationOther = dayTab === 'today' ? data?.avgDuration?.yesterday : data?.avgDuration?.today;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8" data-testid="analytics-dashboard">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="analytics-title">
              Live Analytics
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Echtzeit-Besucher und Statistiken
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500"
                data-testid="auto-refresh-toggle"
              />
              <span className="text-sm text-gray-600 dark:text-gray-300">Auto-Refresh</span>
            </label>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
              data-testid="refresh-btn"
            >
              <RefreshCw className="w-4 h-4" />
              Aktualisieren
            </button>
            {lastUpdate && (
              <span className="text-xs text-gray-500" data-testid="last-update">
                {lastUpdate.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' })}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-4 rounded-lg" data-testid="error-banner">
            {error}
          </div>
        )}

        {/* Real-Time Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="stats-row">
          {/* Active Users */}
          <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-6 text-white" data-testid="active-users-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              <span className="text-cyan-100 text-sm font-medium">LIVE</span>
            </div>
            <div className="text-5xl font-bold mb-1">{data?.realtime.activeUsers || 0}</div>
            <div className="text-cyan-100">Aktive Benutzer</div>
          </div>

          {/* Page Views Last Hour */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm" data-testid="views-last-hour">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
              <Eye className="w-4 h-4" />
              <span className="text-xs">Letzte Stunde</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{data?.realtime.pageViewsLastHour || 0}</div>
            <div className="text-xs text-gray-500">Page Views</div>
          </div>

          {/* Page Views Today */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm" data-testid="views-today">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Heute</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{data?.today.pageViews || 0}</div>
            <div className="flex items-center gap-1 text-xs mt-1">
              {changePercent > 0 ? (
                <span className="text-green-500 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> +{changePercent}%
                </span>
              ) : changePercent < 0 ? (
                <span className="text-red-500 flex items-center gap-0.5">
                  <TrendingDown className="w-3 h-3" /> {changePercent}%
                </span>
              ) : (
                <span className="text-gray-500">0%</span>
              )}
              <span className="text-gray-400">vs. gestern</span>
            </div>
          </div>

          {/* Unique Visitors Today */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm" data-testid="visitors-today">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs">Heute</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{data?.today.uniqueVisitors || 0}</div>
            <div className="text-xs text-gray-500">Unique Visitors</div>
          </div>

          {/* Bounce Rate */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm" data-testid="bounce-rate-card">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-xs">Bounce Rate</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{data?.bounceRate?.today ?? 0}%</div>
            <div className="flex items-center gap-1 text-xs mt-1">
              <span className="text-gray-400">Gestern: {data?.bounceRate?.yesterday ?? 0}%</span>
            </div>
          </div>
        </div>

        {/* Yesterday summary + Avg Duration Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 border-gray-300 dark:border-gray-600">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Gestern</div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-gray-700 dark:text-gray-200">{data?.yesterday?.pageViews || 0}</span>
              <span className="text-sm text-gray-400">Page Views</span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 border-gray-300 dark:border-gray-600">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Gestern</div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-gray-700 dark:text-gray-200">{data?.yesterday?.uniqueVisitors || 0}</span>
              <span className="text-sm text-gray-400">Unique Visitors</span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 border-cyan-400 dark:border-cyan-600" data-testid="avg-duration-today">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1">
              <Timer className="w-3 h-3" /> Verweildauer Heute
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-gray-700 dark:text-gray-200">{formatDuration(data?.avgDuration?.today || 0)}</span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 border-gray-300 dark:border-gray-600" data-testid="avg-duration-yesterday">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1">
              <Timer className="w-3 h-3" /> Verweildauer Gestern
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-gray-700 dark:text-gray-200">{formatDuration(data?.avgDuration?.yesterday || 0)}</span>
            </div>
          </div>
        </div>

        {/* Active Sessions Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden" data-testid="active-sessions-table">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Aktive Besucher ({data?.realtime.activeSessions.length || 0})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">Aktuelle Seite</th>
                  <th className="px-4 py-3 text-left">Quelle</th>
                  <th className="px-4 py-3 text-center">Seiten</th>
                  <th className="px-4 py-3 text-center">Land</th>
                  <th className="px-4 py-3 text-center">Ger&auml;t</th>
                  <th className="px-4 py-3 text-right">Aktiv</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data?.realtime.activeSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Keine aktiven Besucher
                    </td>
                  </tr>
                ) : (
                  data?.realtime.activeSessions.map((session) => {
                    const DeviceIcon = DEVICE_ICONS[session.device || 'desktop'] || Monitor;
                    return (
                      <tr key={session.sessionId} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs block">
                            {formatPath(session.exitPage || session.entryPage)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {parseReferrer(session.referrer)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 px-2 py-1 rounded text-sm">
                            {session.pageViews}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-lg">
                          {COUNTRY_FLAGS[session.country || ''] || session.country || '🌍'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <DeviceIcon className="w-4 h-4 mx-auto text-gray-500" />
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">
                          {formatTimeAgo(session.lastSeenAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Day Toggle */}
        <div className="flex items-center gap-2" data-testid="day-toggle">
          <button
            onClick={() => setDayTab('today')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              dayTab === 'today' 
                ? 'bg-cyan-500 text-white' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            data-testid="tab-today"
          >
            Heute
          </button>
          <button
            onClick={() => setDayTab('yesterday')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              dayTab === 'yesterday' 
                ? 'bg-gray-600 text-white' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            data-testid="tab-yesterday"
          >
            Gestern
          </button>
        </div>

        {/* NEW: Traffic Sources by Category + Engagement Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Traffic Sources by Category */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm" data-testid="source-categories">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-500" />
                Traffic-Quellen nach Kategorie ({dayTab === 'today' ? 'Heute' : 'Gestern'})
              </h2>
            </div>
            <div className="p-4">
              {sourceCats.length === 0 ? (
                <p className="text-gray-500 text-center py-6 text-sm">
                  Noch keine kategorisierten Sessions. Neue Besucher werden automatisch erfasst.
                </p>
              ) : (
                <div className="space-y-3">
                  {sourceCats.map((cat) => {
                    const pct = sourceCatsTotal > 0 ? Math.round((cat.count / sourceCatsTotal) * 100) : 0;
                    const color = CATEGORY_COLORS[cat.category] || 'bg-gray-400';
                    return (
                      <div key={cat.category} data-testid={`source-cat-${cat.category}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${color}`} />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{cat.label}</span>
                            {cat.sources.length > 1 && (
                              <span className="text-xs text-gray-400">({cat.sources.join(', ')})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{cat.count}</span>
                            <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Engagement + Bounce + Duration */}
          <div className="space-y-4">
            {/* Engagement Score */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm" data-testid="engagement-scores">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-500" />
                  Engagement
                </h2>
              </div>
              <div className="p-4">
                {engagementTotal === 0 ? (
                  <p className="text-gray-500 text-center py-4 text-sm">Noch keine Daten</p>
                ) : (
                  <div className="space-y-3">
                    {['high', 'medium', 'low'].map(level => {
                      const item = engagementData?.find(e => e.score === level);
                      const count = item?.count || 0;
                      const pct = engagementTotal > 0 ? Math.round((count / engagementTotal) * 100) : 0;
                      return (
                        <div key={level} data-testid={`engagement-${level}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm capitalize text-gray-700 dark:text-gray-300">
                              {level === 'high' ? 'Hoch' : level === 'medium' ? 'Mittel' : 'Niedrig'}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                            <div className={`h-full rounded-full ${ENGAGEMENT_COLORS[level]} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bounce + Duration compact */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm" data-testid="bounce-rate-detail">
                <div className="text-xs uppercase text-gray-400 mb-1">Bounce</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{bounceRate ?? 0}%</div>
                <div className="text-xs text-gray-400 mt-1">
                  {dayTab === 'today' ? 'Gestern' : 'Heute'}: {bounceRateOther ?? 0}%
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm" data-testid="avg-duration-detail">
                <div className="text-xs uppercase text-gray-400 mb-1">Verweildauer</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatDuration(avgDuration || 0)}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {dayTab === 'today' ? 'Gestern' : 'Heute'}: {formatDuration(avgDurationOther || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Internal Link Clicks + Top Pages Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Internal Link Clicks */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm" data-testid="internal-clicks">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-cyan-500" />
                Interne Klicks ({dayTab === 'today' ? 'Heute' : 'Gestern'})
                {clicksTotal > 0 && <span className="text-sm font-normal text-gray-400">({clicksTotal} gesamt)</span>}
              </h2>
            </div>
            <div className="p-4">
              {clicksTotal === 0 ? (
                <p className="text-gray-500 text-center py-6 text-sm">Noch keine Klick-Daten</p>
              ) : (
                <div className="space-y-3">
                  {clicksData?.map(click => {
                    const pct = clicksTotal > 0 ? Math.round((click.count / clicksTotal) * 100) : 0;
                    return (
                      <div key={click.linkType} className="flex items-center gap-3" data-testid={`click-${click.linkType}`}>
                        <span className="text-sm text-gray-700 dark:text-gray-300 w-28">
                          {LINK_TYPE_LABELS[click.linkType] || click.linkType}
                        </span>
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                          <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white w-16 text-right">{click.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Top Pages Now - only on Today */}
          {dayTab === 'today' ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm" data-testid="top-pages-now">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">Top Seiten (Jetzt)</h2>
              </div>
              <div className="p-4 space-y-3">
                {data?.topPages.now.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Keine Daten</p>
                ) : (
                  data?.topPages.now.map((page, i) => (
                    <div key={page.path} className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-sm font-medium text-gray-600 dark:text-gray-300">{i + 1}</span>
                      <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">{formatPath(page.path)}</span>
                      <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">{page.views}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm" data-testid="top-pages-yesterday">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">Top Seiten (Gestern)</h2>
              </div>
              <div className="p-4 space-y-3">
                {!data?.topPages.yesterday || data.topPages.yesterday.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Keine Daten</p>
                ) : (
                  data.topPages.yesterday.map((page, i) => (
                    <div key={page.path} className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-sm font-medium text-gray-600 dark:text-gray-300">{i + 1}</span>
                      <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">{formatPath(page.path)}</span>
                      <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">{page.views}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Top Pages Today/Yesterday + Traffic Sources */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm" data-testid="top-pages-day">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Top Seiten ({dayTab === 'today' ? 'Heute' : 'Gestern'})
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {(() => {
                const pages = dayTab === 'today' ? data?.topPages.today : data?.topPages.yesterday;
                return !pages || pages.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Keine Daten</p>
                ) : (
                  pages.map((page, i) => (
                    <div key={page.path} className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-sm font-medium text-gray-600 dark:text-gray-300">{i + 1}</span>
                      <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">{formatPath(page.path)}</span>
                      <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">{page.views}</span>
                    </div>
                  ))
                );
              })()}
            </div>
          </div>

          {/* Raw Traffic Sources */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm" data-testid="traffic-sources-raw">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Traffic-Quellen Referrer ({dayTab === 'today' ? 'Heute' : 'Gestern'})
              </h2>
              {(() => {
                const sources = dayTab === 'today' ? data?.trafficSources : data?.trafficSourcesYesterday;
                const count = sources?.length ?? 0;
                return count > 0 ? (
                  <span className="text-xs text-gray-500 tabular-nums" data-testid="referrer-count">
                    {count} Quellen
                  </span>
                ) : null;
              })()}
            </div>
            <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
              {(() => {
                const sources = dayTab === 'today' ? data?.trafficSources : data?.trafficSourcesYesterday;
                return !sources || sources.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Keine Daten</p>
                ) : (
                  sources.map((source) => (
                    <button
                      key={source.source}
                      onClick={() => setDetailReferrer(source.source)}
                      className="w-full flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded-md px-2 py-1.5 transition-colors"
                      data-testid={`referrer-row-${source.source}`}
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">{parseReferrer(source.source)}</span>
                      <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400 tabular-nums">{source.count}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  ))
                );
              })()}
            </div>
          </div>
        </div>

        {/* Devices & Countries */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm" data-testid="devices-countries">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Ger&auml;te & L&auml;nder ({dayTab === 'today' ? 'Heute' : 'Gestern'})
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs uppercase text-gray-500 mb-3">Ger&auml;te</h3>
                <div className="space-y-2">
                  {(dayTab === 'today' ? data?.devices : data?.devicesYesterday)?.map((d) => {
                    const DeviceIcon = DEVICE_ICONS[d.device] || Monitor;
                    const deviceList = dayTab === 'today' ? data?.devices : data?.devicesYesterday;
                    const total = deviceList?.reduce((sum, x) => sum + x.count, 0) || 1;
                    const percent = total > 0 ? Math.round((d.count / total) * 100) : 0;
                    return (
                      <div key={d.device} className="flex items-center gap-2">
                        <DeviceIcon className="w-4 h-4 text-gray-500" />
                        <div className="flex-1">
                          <div className="flex justify-between text-sm">
                            <span className="capitalize text-gray-700 dark:text-gray-300">{d.device}</span>
                            <span className="text-gray-500">{percent}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-xs uppercase text-gray-500 mb-3">L&auml;nder</h3>
                <div className="space-y-2">
                  {(dayTab === 'today' ? data?.countries : data?.countriesYesterday)?.slice(0, 5).map((c) => (
                    <div key={c.country} className="flex items-center gap-2">
                      <span className="text-lg">{COUNTRY_FLAGS[c.country] || '🌍'}</span>
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{c.country}</span>
                      <span className="text-sm font-medium text-gray-500">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Referrer Detail Modal */}
      {detailReferrer && (
        <ReferrerDetailModal
          source={detailReferrer}
          day={dayTab}
          onClose={() => setDetailReferrer(null)}
        />
      )}
    </div>
  );
}
