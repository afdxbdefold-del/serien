'use client';

import { useState, useEffect } from 'react';
import { 
  Users, Eye, Clock, Globe, Monitor, Smartphone, Tablet,
  TrendingUp, TrendingDown, RefreshCw, ExternalLink, ArrowRight
} from 'lucide-react';

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

  const fetchData = async () => {
    try {
      const res = await fetch('/api/analytics/realtime');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
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

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
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
              />
              <span className="text-sm text-gray-600 dark:text-gray-300">Auto-Refresh</span>
            </label>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Aktualisieren
            </button>
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Real-Time Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Active Users - Big Card */}
          <div className="md:col-span-1 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
              <span className="text-cyan-100 text-sm font-medium">LIVE</span>
            </div>
            <div className="text-5xl font-bold mb-1">
              {data?.realtime.activeUsers || 0}
            </div>
            <div className="text-cyan-100">
              Aktive Benutzer
            </div>
          </div>

          {/* Other Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
              <Eye className="w-4 h-4" />
              <span className="text-sm">Letzte Stunde</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {data?.realtime.pageViewsLastHour || 0}
            </div>
            <div className="text-sm text-gray-500">Page Views</div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Heute</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {data?.today.pageViews || 0}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {changePercent > 0 ? (
                <span className="text-green-500 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> +{changePercent}%
                </span>
              ) : changePercent < 0 ? (
                <span className="text-red-500 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> {changePercent}%
                </span>
              ) : (
                <span className="text-gray-500">0%</span>
              )}
              <span className="text-gray-400">vs. gestern</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-sm">Heute</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {data?.today.uniqueVisitors || 0}
            </div>
            <div className="text-sm text-gray-500">Unique Visitors</div>
          </div>
        </div>

        {/* Yesterday Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-l-4 border-gray-300 dark:border-gray-600">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Gestern</div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-gray-700 dark:text-gray-200">{data?.topPages.yesterday?.length || 0}</span>
              <span className="text-sm text-gray-400">Aktive Seiten</span>
            </div>
          </div>
        </div>

        {/* Active Sessions Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
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
                  <th className="px-4 py-3 text-center">Gerät</th>
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
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                              {formatPath(session.exitPage || session.entryPage)}
                            </span>
                          </div>
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

        {/* Day Toggle + Content */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setDayTab('today')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              dayTab === 'today' 
                ? 'bg-cyan-500 text-white' 
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
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
          >
            Gestern
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Pages Now - only show on "Heute" */}
          {dayTab === 'today' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Top Seiten (Jetzt)
                </h2>
              </div>
              <div className="p-4 space-y-3">
                {data?.topPages.now.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Keine Daten</p>
                ) : (
                  data?.topPages.now.map((page, i) => (
                    <div key={page.path} className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-sm font-medium text-gray-600 dark:text-gray-300">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">
                        {formatPath(page.path)}
                      </span>
                      <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                        {page.views}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Top Pages - Heute or Gestern */}
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm ${dayTab === 'yesterday' ? 'lg:col-span-2' : ''}`}>
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
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-sm font-medium text-gray-600 dark:text-gray-300">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">
                        {formatPath(page.path)}
                      </span>
                      <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                        {page.views}
                      </span>
                    </div>
                  ))
                );
              })()}
            </div>
          </div>

          {/* Traffic Sources - Heute or Gestern */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Traffic-Quellen ({dayTab === 'today' ? 'Heute' : 'Gestern'})
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {(() => {
                const sources = dayTab === 'today' ? data?.trafficSources : data?.trafficSourcesYesterday;
                return !sources || sources.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Keine Daten</p>
                ) : (
                  sources.map((source) => (
                    <div key={source.source} className="flex items-center gap-3">
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                      <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">
                        {parseReferrer(source.source)}
                      </span>
                      <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                        {source.count}
                      </span>
                    </div>
                  ))
                );
              })()}
            </div>
          </div>

          {/* Devices & Countries - Heute or Gestern */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Geräte & Länder ({dayTab === 'today' ? 'Heute' : 'Gestern'})
              </h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-6">
                {/* Devices */}
                <div>
                  <h3 className="text-xs uppercase text-gray-500 mb-3">Geräte</h3>
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
                              <div 
                                className="h-full bg-cyan-500 rounded-full" 
                                style={{ width: `${percent}%` }} 
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Countries */}
                <div>
                  <h3 className="text-xs uppercase text-gray-500 mb-3">Länder</h3>
                  <div className="space-y-2">
                    {(dayTab === 'today' ? data?.countries : data?.countriesYesterday)?.slice(0, 5).map((c) => (
                      <div key={c.country} className="flex items-center gap-2">
                        <span className="text-lg">{COUNTRY_FLAGS[c.country] || '🌍'}</span>
                        <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                          {c.country}
                        </span>
                        <span className="text-sm font-medium text-gray-500">
                          {c.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
