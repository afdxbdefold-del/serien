'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, FileText, Activity, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface Prewarm {
  articleSlug: string | null;
  success: boolean;
  statusCode: number | null;
  errorMessage: string | null;
  durationMs: number | null;
  at: string;
}

interface Hit {
  bot: string;
  at: string;
  ip: string | null;
}

interface SitemapHealth {
  generatedAt: string;
  newestArticle: { slug: string; title: string; publishedAt: string | null } | null;
  lastGooglebotHit: { bot: string; at: string } | null;
  staleDeltaMinutes: number | null;
  hitsLast24h: number;
  hitsLast7d: number;
  avgIntervalMinutes: number | null;
  prewarm24h: { total: number; success: number; failed: number };
  recentHits: Hit[];
  recentPrewarms: Prewarm[];
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

function fmtMinutes(min: number | null): string {
  if (min === null) return '–';
  if (Math.abs(min) < 60) return `${min}min`;
  const h = min / 60;
  return `${h.toFixed(1)}h`;
}

export default function SitemapHealthCard() {
  const [data, setData] = useState<SitemapHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token =
      typeof document !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/sitemap-health', {
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div
        className="rounded-2xl bg-white p-6 ring-1 ring-gray-200"
        data-testid="sitemap-health-loading"
      >
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Sitemap-Health wird geladen …
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div
        className="rounded-2xl bg-red-50 p-6 ring-1 ring-red-200 text-red-700"
        data-testid="sitemap-health-error"
      >
        Fehler: {err}
      </div>
    );
  }

  if (!data) return null;

  // Staleness categorisation: negative or 0 = good (bot saw newest article).
  // Otherwise the latest bot fetch happened before the most recent publish.
  const stale = data.staleDeltaMinutes;
  const staleStatus: 'good' | 'warn' | 'bad' =
    stale === null
      ? 'warn'
      : stale <= 0
      ? 'good'
      : stale <= 30
      ? 'warn'
      : 'bad';

  const prewarmOk =
    data.prewarm24h.total > 0 && data.prewarm24h.failed === 0;
  const prewarmStatus: 'good' | 'warn' | 'bad' =
    data.prewarm24h.total === 0
      ? 'warn'
      : prewarmOk
      ? 'good'
      : data.prewarm24h.failed < data.prewarm24h.success
      ? 'warn'
      : 'bad';

  const statusColor = (s: 'good' | 'warn' | 'bad') =>
    s === 'good'
      ? 'text-emerald-600 bg-emerald-50 ring-emerald-200'
      : s === 'warn'
      ? 'text-amber-600 bg-amber-50 ring-amber-200'
      : 'text-red-600 bg-red-50 ring-red-200';

  const statusIcon = (s: 'good' | 'warn' | 'bad') => {
    if (s === 'good') return <CheckCircle2 className="h-4 w-4" />;
    if (s === 'warn') return <AlertTriangle className="h-4 w-4" />;
    return <XCircle className="h-4 w-4" />;
  };

  return (
    <div
      className="rounded-2xl bg-white p-6 ring-1 ring-gray-200"
      data-testid="sitemap-health-card"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-cyan-600" />
          <h3 className="text-base font-semibold text-gray-900">Sitemap Health</h3>
          <span className="text-xs text-gray-500">/news-sitemap.xml</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
          data-testid="sitemap-health-refresh-btn"
          aria-label="Neu laden"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status tiles */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div
          className={`rounded-xl p-3 ring-1 ${statusColor(staleStatus)}`}
          data-testid="sitemap-stale-status"
        >
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
            {statusIcon(staleStatus)} Googlebot vs. neuester Artikel
          </div>
          <div className="mt-1 text-xl font-semibold">
            {stale === null
              ? '–'
              : stale <= 0
              ? 'aktuell'
              : `${fmtMinutes(stale)} veraltet`}
          </div>
          <div className="mt-1 text-xs text-gray-600">
            Letzter Hit:&nbsp;
            <span className="font-medium text-gray-900">
              {fmtRelative(data.lastGooglebotHit?.at ?? null)}
            </span>
          </div>
        </div>

        <div
          className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200"
          data-testid="sitemap-hit-frequency"
        >
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-600">
            <Activity className="h-4 w-4" /> Crawl-Frequenz
          </div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            {fmtInterval(data.avgIntervalMinutes)}
          </div>
          <div className="mt-1 text-xs text-gray-600">
            {data.hitsLast24h} in 24h · {data.hitsLast7d} in 7T
          </div>
        </div>

        <div
          className={`rounded-xl p-3 ring-1 ${statusColor(prewarmStatus)}`}
          data-testid="sitemap-prewarm-status"
        >
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
            {statusIcon(prewarmStatus)} Prewarm (24h)
          </div>
          <div className="mt-1 text-xl font-semibold">
            {data.prewarm24h.success}/{data.prewarm24h.total} OK
          </div>
          <div className="mt-1 text-xs text-gray-600">
            {data.prewarm24h.failed === 0
              ? 'keine Fehler'
              : `${data.prewarm24h.failed} Fehler`}
          </div>
        </div>
      </div>

      {/* Newest article reference */}
      {data.newestArticle && (
        <div
          className="mb-5 rounded-lg bg-gray-50 p-3 text-sm ring-1 ring-gray-200"
          data-testid="sitemap-newest-article"
        >
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Neuester Artikel
          </div>
          <div className="mt-1 font-medium text-gray-900">
            {data.newestArticle.title}
          </div>
          <div className="text-xs text-gray-500">
            publiziert {fmtRelative(data.newestArticle.publishedAt)} ·{' '}
            <span className="font-mono">/{data.newestArticle.slug}</span>
          </div>
        </div>
      )}

      {/* Two-column: recent hits + recent prewarms */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div data-testid="sitemap-recent-hits">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Letzte Googlebot-Hits ({data.recentHits.length})
          </h4>
          <div className="max-h-64 overflow-y-auto rounded-lg ring-1 ring-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2">Bot</th>
                  <th className="px-3 py-2">Wann</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentHits.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-center text-xs text-gray-400">
                      Keine Hits
                    </td>
                  </tr>
                ) : (
                  data.recentHits.map((h, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-700">
                        {h.bot}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">
                        {fmtRelative(h.at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div data-testid="sitemap-recent-prewarms">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Letzte Prewarms ({data.recentPrewarms.length})
          </h4>
          <div className="max-h-64 overflow-y-auto rounded-lg ring-1 ring-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Artikel</th>
                  <th className="px-3 py-2">ms</th>
                  <th className="px-3 py-2">Wann</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentPrewarms.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-gray-400">
                      Noch keine Prewarms geloggt
                    </td>
                  </tr>
                ) : (
                  data.recentPrewarms.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5">
                        {p.success ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {p.statusCode ?? 'OK'}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-red-600"
                            title={p.errorMessage ?? undefined}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {p.statusCode ?? 'ERR'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-600">
                        {p.articleSlug ?? '–'}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">
                        {p.durationMs ?? '–'}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-500">
                        {fmtRelative(p.at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-4 text-right text-xs text-gray-400">
        aktualisiert {fmtRelative(data.generatedAt)}
      </div>
    </div>
  );
}
