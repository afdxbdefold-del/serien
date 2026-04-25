'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Clock, RefreshCw, TrendingUp, Info } from 'lucide-react';

interface Category {
  id: 'google' | 'google-news' | 'google-discover';
  label: string;
  description: string;
  hits: number;
  firstAt: string | null;
  lastAt: string | null;
  shared?: boolean;
  legacyUaHits?: number;
}

interface CrawlerStats {
  windowHours: number;
  generatedAt: string;
  totalHits: number;
  categories: Category[];
  googleNews: {
    totalHits: number;
    legacyUaHits: number;
    lastHitAt: string | null;
    avgIntervalMinutes: number | null;
    hourlyBuckets: Array<{ hour: string; count: number }>;
    topPaths: Array<{ path: string; hits: number }>;
  };
  recent: Array<{ bot: string; path: string; at: string }>;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '–';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h}h ${m % 60}min`;
  return `vor ${Math.floor(h / 24)}T`;
}

function fmtInterval(min: number | null): string {
  if (min === null) return '–';
  if (min < 60) return `alle ~${min}min`;
  const h = min / 60;
  return `alle ~${h.toFixed(1)}h`;
}

const CATEGORY_ICON: Record<Category['id'], string> = {
  google: '🔍',
  'google-news': '📰',
  'google-discover': '✨',
};

export default function CrawlerStatsCard() {
  const [data, setData] = useState<CrawlerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [window, setWindow] = useState(24);

  const load = useCallback(async () => {
    const token =
      typeof document !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/crawler-stats?window=${window}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => {
    load();
  }, [load]);

  const peakCount = Math.max(1, ...(data?.googleNews.hourlyBuckets ?? []).map((b) => b.count));

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5"
      data-testid="crawler-stats-card"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-500" /> Google Crawler-Aktivität
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={window}
            onChange={(e) => setWindow(Number(e.target.value))}
            data-testid="crawler-window"
            className="text-xs rounded border border-slate-200 px-2 py-1 bg-white"
          >
            <option value={1}>1h</option>
            <option value={6}>6h</option>
            <option value={24}>24h</option>
            <option value={72}>72h</option>
            <option value={168}>7T</option>
          </select>
          <button
            onClick={load}
            className="text-slate-400 hover:text-slate-700"
            data-testid="crawler-refresh"
            disabled={loading}
            title="Neu laden"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {err && (
        <div className="text-xs text-rose-600 bg-rose-50 rounded px-3 py-2 mb-3">{err}</div>
      )}

      {data && (
        <>
          {/* Google News spotlight (path-based, post UA-consolidation) */}
          <div
            className="rounded-lg border border-cyan-200 bg-gradient-to-r from-cyan-50 to-white p-4 mb-4"
            data-testid="googlenews-spotlight"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-cyan-700">
                  Google News (pfadbasiert)
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-slate-900 tabular-nums">
                    {data.googleNews.totalHits}
                  </span>
                  <span className="text-xs text-slate-500">
                    Hits in {data.windowHours}h
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Zuletzt: <b>{fmtRelative(data.googleNews.lastHitAt)}</b>
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Takt: <b>{fmtInterval(data.googleNews.avgIntervalMinutes)}</b>
                  </span>
                  <span
                    className="flex items-center gap-1"
                    title="Anteil mit klassischem Googlebot-News User-Agent. Niedrig = Google nutzt nur noch generischen Googlebot."
                  >
                    <Info className="w-3 h-3" />
                    legacy UA: <b>{data.googleNews.legacyUaHits}</b>
                  </span>
                </div>
              </div>
            </div>

            {/* Hourly sparkline */}
            {data.googleNews.hourlyBuckets.length > 0 && (
              <div className="mt-3">
                <div className="flex items-end gap-0.5 h-8" data-testid="googlenews-sparkline">
                  {data.googleNews.hourlyBuckets.map((b) => (
                    <div
                      key={b.hour}
                      title={`${b.hour}: ${b.count} hits`}
                      className="flex-1 bg-cyan-400 rounded-t-sm"
                      style={{ height: `${(b.count / peakCount) * 100}%`, minHeight: '2px' }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Top paths breakdown */}
            {data.googleNews.topPaths.length > 0 && (
              <div className="mt-3" data-testid="googlenews-top-paths">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
                  Top News-Pfade
                </div>
                <ul className="space-y-1 text-xs">
                  {data.googleNews.topPaths.map((p) => (
                    <li
                      key={p.path}
                      className="flex items-center justify-between gap-2 text-slate-700"
                    >
                      <span className="font-mono truncate">{p.path}</span>
                      <span className="tabular-nums text-slate-500 shrink-0">
                        {p.hits.toLocaleString('de-DE')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 3 Category cards: Google / Google News / Google Discover */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="category-cards">
            {data.categories.map((cat) => (
              <div
                key={cat.id}
                data-testid={`category-${cat.id}`}
                className={`rounded-lg border p-4 ${
                  cat.shared
                    ? 'border-slate-200 bg-slate-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-900 flex items-center gap-2">
                    <span className="text-base">{CATEGORY_ICON[cat.id]}</span>
                    {cat.label}
                  </span>
                  {cat.shared && (
                    <span
                      title="Identisch mit Google – Discover hat keinen eigenen User-Agent"
                      className="inline-flex"
                    >
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold tabular-nums text-slate-900">
                  {cat.hits.toLocaleString('de-DE')}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-tight">
                  {cat.description}
                </div>
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Zuletzt: <b>{fmtRelative(cat.lastAt)}</b>
                </div>
              </div>
            ))}
          </div>

          {/* Recent feed */}
          {data.recent.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-800">
                Live-Feed (letzte 50 Hits)
              </summary>
              <ul
                className="mt-2 space-y-1 max-h-64 overflow-y-auto text-xs font-mono"
                data-testid="recent-feed"
              >
                {data.recent.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-600">
                    <span className="w-20 text-slate-400 shrink-0">{fmtRelative(r.at)}</span>
                    <span className="w-40 text-cyan-700 shrink-0 truncate">{r.bot}</span>
                    <span className="truncate text-slate-700">{r.path}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
