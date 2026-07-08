'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Angle =
  | 'success' | 'comeback' | 'season_update' | 'quality_praise'
  | 'star_power' | 'underrated' | 'controversy' | 'trend_momentum'
  | 'nostalgia' | 'unknown';

interface Bucket {
  angle: Angle;
  label: string;
  articles: number;
  totalViews: number;
  avgViewsPerArticle: number;
  avgScrollDepth: number | null;
  avgDurationSec: number | null;
  shareOfArticles: number;
  shareOfTraffic: number;
  efficiency: number;
  topArticles: Array<{ id: string; slug: string; title: string; views: number; publishedAt: string }>;
}

interface Sample {
  id: string;
  slug: string;
  title: string;
  angle: Angle;
  confidence: number;
  views: number;
  publishedAt: string;
}

interface Payload {
  days: number;
  minArticles: number;
  totalArticles: number;
  totalViews: number;
  buckets: Bucket[];
  samples: Sample[];
}

const ANGLE_COLORS: Record<Angle, string> = {
  success:         '#0ea5e9',
  comeback:        '#a855f7',
  season_update:   '#f59e0b',
  quality_praise:  '#10b981',
  star_power:      '#ec4899',
  underrated:      '#6366f1',
  controversy:     '#ef4444',
  trend_momentum:  '#f97316',
  nostalgia:       '#8b5cf6',
  unknown:         '#64748b',
};

export default function HeadlineAnglesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState(14);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch(`/api/admin/headline-angles?days=${days}&minArticles=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e: any) {
      setErr(e.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const maxViews = useMemo(() => Math.max(1, ...(data?.buckets || []).map(b => b.totalViews)), [data]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1000px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              data-testid="back-to-dashboard-link"
              className="text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Headline-Angle-Performance</h1>
              <p className="text-xs text-slate-500">Welche Discover-Angles bringen die Klicks?</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="days-select" className="text-sm text-slate-600">Zeitraum:</label>
            <select
              id="days-select"
              data-testid="days-select"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value={7}>Letzte 7 Tage</option>
              <option value={14}>Letzte 14 Tage</option>
              <option value={30}>Letzte 30 Tage</option>
              <option value={60}>Letzte 60 Tage</option>
              <option value={90}>Letzte 90 Tage</option>
            </select>
            <button
              data-testid="refresh-angles-btn"
              onClick={load}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
            >
              Neu laden
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto px-6 py-8 space-y-8" data-testid="headline-angles-page">
        {loading && (
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /> lade Daten…
          </div>
        )}

        {err && (
          <div
            data-testid="angles-error"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            Fehler: {err}
          </div>
        )}

        {!loading && data && (
          <>
            {/* Summary cards */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="angles-summary">
              <StatCard label="Artikel" value={data.totalArticles.toLocaleString('de-DE')} />
              <StatCard label="Pageviews" value={data.totalViews.toLocaleString('de-DE')} />
              <StatCard label="Ø Views / Artikel" value={data.totalArticles > 0 ? (data.totalViews / data.totalArticles).toFixed(1) : '0'} />
              <StatCard label="Angles aktiv" value={String(data.buckets.length)} />
            </section>

            {/* Main table */}
            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden" data-testid="angles-table-wrapper">
              <header className="flex items-baseline justify-between px-6 py-4 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Performance nach Angle</h2>
                  <p className="text-xs text-slate-500">Sortiert nach Pageviews – Efficiency zeigt Traffic-Anteil relativ zum Artikel-Anteil.</p>
                </div>
              </header>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold">Angle</th>
                      <th className="px-4 py-3 text-right font-semibold">Artikel</th>
                      <th className="px-4 py-3 text-right font-semibold">Views</th>
                      <th className="px-4 py-3 text-right font-semibold">Ø pro Artikel</th>
                      <th className="px-4 py-3 text-right font-semibold">Ø Scroll</th>
                      <th className="px-4 py-3 text-right font-semibold">Ø Verweildauer</th>
                      <th className="px-4 py-3 text-right font-semibold">Efficiency</th>
                      <th className="px-6 py-3 text-left font-semibold">Share of Traffic</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.buckets.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                          Noch keine Daten im gewählten Zeitraum.
                        </td>
                      </tr>
                    )}
                    {data.buckets.map((b) => (
                      <tr key={b.angle} className="hover:bg-slate-50" data-testid={`angle-row-${b.angle}`}>
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full"
                              style={{ backgroundColor: ANGLE_COLORS[b.angle] }}
                            />
                            <span className="font-medium text-slate-900">{b.label}</span>
                            <code className="text-[11px] text-slate-400">{b.angle}</code>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-slate-700">{b.articles}</td>
                        <td className="px-4 py-4 text-right font-mono text-slate-900 font-semibold">
                          {b.totalViews.toLocaleString('de-DE')}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-slate-700">{b.avgViewsPerArticle}</td>
                        <td className="px-4 py-4 text-right font-mono text-slate-700">
                          {b.avgScrollDepth != null ? `${b.avgScrollDepth}%` : '—'}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-slate-700">
                          {b.avgDurationSec != null ? `${b.avgDurationSec}s` : '—'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <EfficiencyBadge value={b.efficiency} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full"
                                style={{
                                  width: `${Math.max(2, (b.totalViews / maxViews) * 100)}%`,
                                  backgroundColor: ANGLE_COLORS[b.angle],
                                }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 w-12 text-right">{b.shareOfTraffic}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Top articles per angle */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="top-articles-grid">
              {data.buckets.slice(0, 6).map((b) => (
                <div key={`top-${b.angle}`} className="rounded-xl border border-slate-200 bg-white p-5">
                  <header className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ANGLE_COLORS[b.angle] }} />
                    <h3 className="text-sm font-semibold text-slate-900">{b.label}</h3>
                    <span className="text-xs text-slate-500">· {b.articles} Artikel · {b.totalViews.toLocaleString('de-DE')} Views</span>
                  </header>
                  <ol className="space-y-2">
                    {b.topArticles.length === 0 && <li className="text-xs text-slate-400">Noch keine Views im Zeitraum.</li>}
                    {b.topArticles.map((a) => (
                      <li key={a.id} className="flex items-baseline justify-between gap-3 text-sm">
                        <Link
                          href={`/${a.slug}`}
                          target="_blank"
                          className="text-slate-800 hover:text-slate-950 hover:underline truncate"
                          data-testid={`top-article-${a.id}`}
                        >
                          {a.title || a.slug}
                        </Link>
                        <span className="font-mono text-xs text-slate-500 whitespace-nowrap">{a.views.toLocaleString('de-DE')} V.</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </section>

            {/* Recent sample */}
            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden" data-testid="recent-headlines">
              <header className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">Letzte 15 Headlines & erkannter Angle</h2>
                <p className="text-xs text-slate-500">Confidence = Stärke des Pattern-Matches.</p>
              </header>
              <ul className="divide-y divide-slate-100">
                {data.samples.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-4 px-6 py-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <Link href={`/${s.slug}`} target="_blank" className="text-slate-800 hover:underline truncate block">
                        {s.title}
                      </Link>
                      <span className="text-xs text-slate-400">{new Date(s.publishedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}</span>
                    </div>
                    <div className="flex items-center gap-3 whitespace-nowrap">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: ANGLE_COLORS[s.angle] + '22',
                          color: ANGLE_COLORS[s.angle],
                        }}
                      >
                        {s.angle}
                      </span>
                      <span className="font-mono text-xs text-slate-400">c={s.confidence}</span>
                      <span className="font-mono text-xs text-slate-500 w-14 text-right">{s.views}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function EfficiencyBadge({ value }: { value: number }) {
  let Icon = Minus;
  let bg = 'bg-slate-100';
  let fg = 'text-slate-600';
  if (value >= 1.2) { Icon = TrendingUp; bg = 'bg-emerald-50'; fg = 'text-emerald-700'; }
  else if (value <= 0.8 && value > 0) { Icon = TrendingDown; bg = 'bg-rose-50'; fg = 'text-rose-700'; }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono ${bg} ${fg}`}>
      <Icon className="w-3 h-3" />
      {value.toFixed(2)}
    </span>
  );
}
