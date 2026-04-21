'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Bot, Clock, RefreshCw, TrendingUp } from 'lucide-react';

interface ByBot {
  bot: string;
  hits: number;
  firstAt: string | null;
  lastAt: string | null;
}

interface CrawlerStats {
  windowHours: number;
  generatedAt: string;
  totalHits: number;
  byBot: ByBot[];
  googleNews: {
    totalHits: number;
    lastHitAt: string | null;
    avgIntervalMinutes: number | null;
    hourlyBuckets: Array<{ hour: string; count: number }>;
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
          <Search className="w-4 h-4 text-cyan-500" /> Crawler-Aktivität
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
          {/* Googlebot-News spotlight */}
          <div
            className="rounded-lg border border-cyan-200 bg-gradient-to-r from-cyan-50 to-white p-4 mb-4"
            data-testid="googlenews-spotlight"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-cyan-700">
                  Googlebot-News
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
          </div>

          {/* All bots table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="bots-table">
              <thead className="text-xs uppercase tracking-wider text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-3 text-left">Bot</th>
                  <th className="py-2 pr-3 text-right">Hits</th>
                  <th className="py-2 pr-3 text-left">Erster</th>
                  <th className="py-2 pr-3 text-left">Letzter</th>
                </tr>
              </thead>
              <tbody>
                {data.byBot.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400 text-xs">
                      Noch keine Crawler-Hits im Fenster.
                    </td>
                  </tr>
                )}
                {data.byBot.map((b) => (
                  <tr
                    key={b.bot}
                    data-testid={`bot-${b.bot}`}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-slate-400" />
                        {b.bot}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                      {b.hits}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">
                      {fmtRelative(b.firstAt)}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-500">
                      {fmtRelative(b.lastAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
