'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, TrendingUp, RefreshCw, Clock } from 'lucide-react';

type Entry = {
  articleId: string | null;
  startedAt: string;
  before: number;
  after: number;
  gain: number;
  originalHeadline: string;
  finalHeadline: string;
  durationMs: number;
  article: { title: string; slug: string; publishMode: string } | null;
};

type Response = {
  windowDays: number;
  totalApplied: number;
  avgGain: number;
  maxGain: number;
  top: Entry[];
};

export default function RewriteLeaderboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(30);

  const load = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) {
      router.push('/admin/login');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/rewrite-leaderboard?limit=20&window=${windowDays}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (r.status === 401) {
        router.push('/admin/login');
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as Response);
    } catch (e: any) {
      setErr(e?.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [router, windowDays]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-50" data-testid="rewrite-leaderboard-page">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/discover-analytics"
              className="text-slate-500 hover:text-slate-900"
              data-testid="back-link"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" /> Best of Rewrites
              </h1>
              <p className="text-xs text-slate-500">
                Die größten Performance-Sprünge des Auto-Rewrite-Loops
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              data-testid="window-select"
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
            >
              <option value={7}>7 Tage</option>
              <option value={30}>30 Tage</option>
              <option value={90}>90 Tage</option>
            </select>
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              data-testid="refresh-btn"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-4">
            {err}
          </div>
        )}

        {/* Stats row */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" data-testid="stats-row">
            <StatTile label="Rewrites angewendet" value={data.totalApplied.toString()} hint={`in ${data.windowDays} Tagen`} />
            <StatTile label="Ø Performance-Gewinn" value={`+${data.avgGain}P`} hint="pro angewendetem Rewrite" />
            <StatTile label="Größter Sprung" value={`+${data.maxGain}P`} hint="bestes Einzelergebnis" />
          </div>
        )}

        {/* Leaderboard */}
        {loading && !data ? (
          <div className="text-center py-12 text-slate-500">Wird geladen …</div>
        ) : !data || data.top.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center" data-testid="empty-state">
            <p className="text-slate-600 mb-2">Noch keine Rewrites im gewählten Zeitraum.</p>
            <p className="text-sm text-slate-500">
              Sobald der Pipeline-Cron Artikel mit schwacher Headline generiert und der Rewrite-Loop verbessert,
              erscheinen sie hier.
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="entries-list">
            {data.top.map((entry, i) => (
              <div
                key={`${entry.articleId}-${entry.startedAt}`}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors"
                data-testid={`entry-${i}`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center font-bold text-emerald-700 tabular-nums">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {entry.article?.title || '(Artikel gelöscht)'}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                        {entry.article?.slug && <span>/{entry.article.slug}</span>}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(entry.startedAt).toLocaleDateString('de-DE')}
                        </span>
                        {entry.article?.publishMode && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            entry.article.publishMode === 'DISCOVER'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {entry.article.publishMode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <div className="text-2xl font-bold tabular-nums text-emerald-600">+{entry.gain}P</div>
                    <div className="text-xs text-slate-500 tabular-nums">
                      {entry.before} → {entry.after} / 30
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center text-sm bg-slate-50 rounded-lg p-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Vorher</div>
                    <div className="text-slate-700 line-through decoration-slate-300">"{entry.originalHeadline}"</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-emerald-500 flex-shrink-0 hidden md:block" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-emerald-700 mb-1">Nachher</div>
                    <div className="text-slate-900 font-medium">"{entry.finalHeadline}"</div>
                  </div>
                </div>

                {entry.articleId && (
                  <div className="mt-3 text-right">
                    <Link
                      href={`/admin/discover/${entry.articleId}`}
                      className="text-xs text-cyan-600 hover:text-cyan-800"
                      data-testid={`entry-detail-${i}`}
                    >
                      Volle Breakdown →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">{label}</div>
      <div className="text-3xl font-bold text-slate-900 tabular-nums mb-1">{value}</div>
      <div className="text-xs text-slate-500">{hint}</div>
    </div>
  );
}
