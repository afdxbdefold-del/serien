'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, AlertTriangle, ExternalLink } from 'lucide-react';

interface RecentRejection {
  id: string;
  articleId: string | null;
  articleTitle: string | null;
  sourceUrl: string | null;
  sourceHost: string | null;
  kind: string;
  claimedStreamer: string | null;
  actualDeProviders: string[];
  excerpt: string | null;
  at: string;
}

interface HostStat {
  host: string | null;
  count: number;
}

interface WatchData {
  generatedAt: string;
  totals: {
    last24h: number;
    last7d: number;
    byKind24h: Record<string, number>;
  };
  topHosts: HostStat[];
  recent: RecentRejection[];
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h}h`;
  return `vor ${Math.floor(h / 24)}T`;
}

const KIND_LABEL: Record<string, string> = {
  positive_claim: 'Positiver Streamer-Claim falsch',
  negative_de_claim: 'Behauptung „nicht in DE" obwohl verfügbar',
};

export default function HallucinationWatchCard() {
  const [data, setData] = useState<WatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token =
      typeof document !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/hallucination-watch', {
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
        data-testid="hallucination-watch-loading"
      >
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="h-4 w-4 animate-spin" /> Halluzinations-Watch wird geladen …
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div
        className="rounded-2xl bg-red-50 p-6 ring-1 ring-red-200 text-red-700"
        data-testid="hallucination-watch-error"
      >
        Fehler: {err}
      </div>
    );
  }

  if (!data) return null;

  const has24h = data.totals.last24h > 0;
  const has7d = data.totals.last7d > 0;
  const positive24h = data.totals.byKind24h.positive_claim || 0;
  const negative24h = data.totals.byKind24h.negative_de_claim || 0;

  return (
    <div
      className="rounded-2xl bg-white p-6 ring-1 ring-gray-200"
      data-testid="hallucination-watch-card"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-rose-600" />
          <h3 className="text-base font-semibold text-gray-900">Halluzinations-Watch</h3>
          <span className="text-xs text-gray-500">Body-Fact-Verifier</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
          data-testid="hallucination-watch-refresh-btn"
          aria-label="Neu laden"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Totals */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div
          className={`rounded-xl p-3 ring-1 ${has24h ? 'bg-rose-50 ring-rose-200 text-rose-700' : 'bg-emerald-50 ring-emerald-200 text-emerald-700'}`}
          data-testid="hallucination-total-24h"
        >
          <div className="text-xs font-medium uppercase tracking-wide">Blockiert (24h)</div>
          <div className="mt-1 text-2xl font-bold">{data.totals.last24h}</div>
          <div className="mt-1 text-xs">
            {positive24h} positiv · {negative24h} negativ
          </div>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-600">Blockiert (7T)</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{data.totals.last7d}</div>
          <div className="mt-1 text-xs text-gray-500">
            {has7d ? 'Quellen siehe rechts' : 'keine Halluzinationen erkannt'}
          </div>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
          <div className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Top-Quellen (7T)
          </div>
          {data.topHosts.length === 0 ? (
            <div className="mt-1 text-xs text-gray-500">keine Treffer</div>
          ) : (
            <ul className="mt-1 space-y-0.5 text-xs">
              {data.topHosts.slice(0, 4).map(h => (
                <li key={h.host} className="flex justify-between text-gray-700">
                  <span className="truncate font-mono">{h.host}</span>
                  <span className="ml-2 font-semibold text-rose-600">{h.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent rejections list */}
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Letzte {data.recent.length} Halluzinations-Blocks
      </h4>
      <div className="max-h-[28rem] overflow-y-auto rounded-lg ring-1 ring-gray-200">
        <table className="w-full text-left text-sm" data-testid="hallucination-watch-table">
          <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2">Typ</th>
              <th className="px-3 py-2">Artikel</th>
              <th className="px-3 py-2">Claim</th>
              <th className="px-3 py-2">TMDB DE</th>
              <th className="px-3 py-2">Quelle</th>
              <th className="px-3 py-2">Wann</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.recent.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">
                  Noch keine Halluzinations-Blocks erfasst. (Verifier seit v5.7 aktiv.)
                </td>
              </tr>
            ) : (
              data.recent.map(r => (
                <tr key={r.id} className="hover:bg-rose-50/40">
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        r.kind === 'positive_claim'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.kind === 'positive_claim' ? 'POS' : 'NEG-DE'}
                    </span>
                    <div className="mt-1 text-[10px] text-gray-500">
                      {KIND_LABEL[r.kind] || r.kind}
                    </div>
                  </td>
                  <td className="max-w-[14rem] px-3 py-2 align-top text-xs">
                    <div className="line-clamp-2 font-medium text-gray-900">
                      {r.articleTitle || '–'}
                    </div>
                    {r.excerpt && (
                      <div className="mt-1 line-clamp-2 text-[11px] italic text-gray-500">
                        „{r.excerpt}"
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs">
                    {r.claimedStreamer ? (
                      <span className="rounded bg-rose-100 px-2 py-0.5 font-mono text-rose-800">
                        {r.claimedStreamer}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">(implizit)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-gray-600">
                    {r.actualDeProviders.length === 0 ? (
                      <span className="text-[10px] text-gray-400">leer</span>
                    ) : (
                      <span className="font-mono">{r.actualDeProviders.join(', ')}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs">
                    {r.sourceUrl ? (
                      <a
                        href={r.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-gray-700 hover:text-gray-900"
                      >
                        <span className="truncate font-mono text-[11px]">
                          {r.sourceHost || 'link'}
                        </span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-400">–</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-gray-500">
                    {fmtRelative(r.at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-right text-xs text-gray-400">
        aktualisiert {fmtRelative(data.generatedAt)}
      </div>
    </div>
  );
}
