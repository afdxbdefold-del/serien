'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Loader2,
  ExternalLink,
  XCircle,
  Gauge,
  Clock,
  Shield,
} from 'lucide-react';
import CrawlerStatsCard from '@/components/admin/CrawlerStatsCard';

type Health = 'ok' | 'warn' | 'critical';

interface HealthResponse {
  generatedAt: string;
  windowMinutes: number;
  health: Health;
  totals: {
    runs: number;
    byStatus: Record<string, number>;
    byFailStep: Record<string, number>;
    published: number;
    publishPerHour: number;
    successRatePct: number;
  };
  classifier: {
    unknownClassification: number;
    safetyBlocks: number;
    safetyRatePct: number;
    heuristicRescues: number;
  };
  duplicates: {
    total: number;
    byStage: Record<string, number>;
  };
  recentFailures: Array<{
    id: string;
    at: string;
    step: string;
    message: string;
    classifierReasoning: string | null;
    title: string;
  }>;
  lastPublished: Array<{
    slug: string;
    title: string;
    publishedAt: string;
  }>;
}

const WINDOW_OPTIONS = [
  { value: 15, label: '15 Min' },
  { value: 60, label: '1 Std' },
  { value: 240, label: '4 Std' },
  { value: 720, label: '12 Std' },
  { value: 1440, label: '24 Std' },
];

export default function PipelineHealthPage() {
  const router = useRouter();
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [windowMin, setWindowMin] = useState<number>(60);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  const loadPaused = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) return;
    try {
      const r = await fetch('/api/admin/pipeline-toggle', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (r.ok) {
        const d = await r.json();
        setPaused(Boolean(d.paused));
      }
    } catch {}
  }, []);

  const togglePaused = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) return;
    if (paused === null) return;
    const next = !paused;
    if (next && !window.confirm('Pipeline-Cron wirklich pausieren? Keine neuen Artikel werden erzeugt, bis du wieder aktivierst.')) return;
    setToggling(true);
    try {
      const r = await fetch('/api/admin/pipeline-toggle', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: next }),
      });
      if (r.ok) {
        const d = await r.json();
        setPaused(Boolean(d.paused));
      }
    } finally {
      setToggling(false);
    }
  }, [paused]);

  const load = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) {
      router.push('/admin/login');
      return;
    }
    setErr(null);
    try {
      const r = await fetch(`/api/admin/pipeline-health?window=${windowMin}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (r.status === 401) {
        router.push('/admin/login');
        return;
      }
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${r.status}`);
      }
      const raw = (await r.json()) as Partial<HealthResponse>;
      // Normalize against stale/older API shapes: guarantee every nested object exists
      // so UI access like data.totals.runs can never throw even if the backend is a
      // version behind (e.g. Vercel edge cache).
      const safe: HealthResponse = {
        generatedAt: raw.generatedAt ?? new Date().toISOString(),
        windowMinutes: raw.windowMinutes ?? windowMin,
        health: (raw.health as Health) ?? 'ok',
        totals: {
          runs: raw.totals?.runs ?? 0,
          byStatus: raw.totals?.byStatus ?? {},
          byFailStep: raw.totals?.byFailStep ?? {},
          published: raw.totals?.published ?? 0,
          publishPerHour: raw.totals?.publishPerHour ?? 0,
          successRatePct: raw.totals?.successRatePct ?? 0,
        },
        classifier: {
          unknownClassification: raw.classifier?.unknownClassification ?? 0,
          safetyBlocks: raw.classifier?.safetyBlocks ?? 0,
          safetyRatePct: raw.classifier?.safetyRatePct ?? 0,
          heuristicRescues: raw.classifier?.heuristicRescues ?? 0,
        },
        duplicates: {
          total: raw.duplicates?.total ?? 0,
          byStage: raw.duplicates?.byStage ?? {},
        },
        recentFailures: Array.isArray(raw.recentFailures) ? raw.recentFailures : [],
        lastPublished: Array.isArray(raw.lastPublished) ? raw.lastPublished : [],
      };
      setData(safe);
      setLastFetch(new Date());
    } catch (e: any) {
      setErr(e?.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [router, windowMin]);

  useEffect(() => {
    setLoading(true);
    load();
    loadPaused();
  }, [load, loadPaused]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 30_000); // 30s polling
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const healthBadge = useMemo(() => {
    const h = data?.health ?? 'ok';
    if (h === 'critical')
      return {
        label: 'Kritisch',
        cls: 'bg-rose-100 text-rose-700 border-rose-200',
        Icon: XCircle,
      };
    if (h === 'warn')
      return {
        label: 'Warnung',
        cls: 'bg-amber-100 text-amber-800 border-amber-200',
        Icon: AlertTriangle,
      };
    return {
      label: 'Gesund',
      cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      Icon: CheckCircle2,
    };
  }, [data?.health]);

  return (
    <div className="min-h-screen bg-slate-50" data-testid="pipeline-health-page">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="text-slate-500 hover:text-slate-900"
              data-testid="back-link"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-500" /> Pipeline-Health
              </h1>
              <p className="text-xs text-slate-500">
                Live-Monitor für Classifier-Blocks, Publishing-Rate &amp; Fehlerschritte
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              data-testid="window-select"
              value={windowMin}
              onChange={(e) => setWindowMin(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  Letzte {o.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 select-none">
              <input
                type="checkbox"
                data-testid="autorefresh-toggle"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300"
              />
              Auto-Refresh 30s
            </label>
            <button
              onClick={load}
              data-testid="refresh-btn"
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="w-4 h-4" /> Neu laden
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Status banner */}
        <div
          className={`rounded-xl border px-5 py-4 flex items-center justify-between ${healthBadge.cls}`}
          data-testid="health-banner"
        >
          <div className="flex items-center gap-3">
            <healthBadge.Icon className="w-6 h-6" />
            <div>
              <div className="font-semibold text-base">Status: {healthBadge.label}</div>
              <div className="text-xs opacity-80">
                Fenster: {data?.windowMinutes ?? windowMin} Min • Runs:{' '}
                {data?.totals.runs ?? '–'}
                {lastFetch && (
                  <span className="ml-2">
                    • Aktualisiert: {lastFetch.toLocaleTimeString('de-DE')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {loading && <Loader2 className="w-5 h-5 animate-spin" />}
        </div>

        {err && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            data-testid="error-banner"
          >
            {err}
          </div>
        )}

        {/* Kill-switch */}
        {paused !== null && (
          <div
            className={`rounded-xl border px-5 py-4 flex items-center justify-between ${
              paused
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
            data-testid="killswitch-card"
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className={`w-5 h-5 ${paused ? 'text-amber-600' : 'text-slate-400'}`} />
              <div>
                <div className="font-semibold">
                  Pipeline-Cron {paused ? 'PAUSIERT' : 'aktiv'}
                </div>
                <div className="text-xs opacity-80">
                  {paused
                    ? 'Vercel-Scheduler läuft, aber jeder Run wird sofort übersprungen. Keine neuen Artikel werden generiert.'
                    : 'Cron generiert automatisch neue Artikel aus RSS-Feeds.'}
                </div>
              </div>
            </div>
            <button
              onClick={togglePaused}
              disabled={toggling}
              data-testid="killswitch-toggle"
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors ${
                paused
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              } ${toggling ? 'opacity-60 cursor-wait' : ''}`}
            >
              {toggling ? 'Speichert…' : paused ? '▶ Reaktivieren' : '⏸ Pausieren'}
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi
            testid="kpi-runs"
            icon={<Activity className="w-4 h-4" />}
            label="Pipeline-Runs"
            value={data?.totals.runs ?? 0}
            hint={`${data?.totals.byStatus?.success ?? 0} success • ${
              data?.totals.byStatus?.failed ?? 0
            } failed`}
          />
          <Kpi
            testid="kpi-success-rate"
            icon={<Gauge className="w-4 h-4" />}
            label="Success-Rate"
            value={`${data?.totals.successRatePct ?? 0}%`}
            accent={
              (data?.totals.successRatePct ?? 0) < 20
                ? 'rose'
                : (data?.totals.successRatePct ?? 0) < 50
                ? 'amber'
                : 'emerald'
            }
          />
          <Kpi
            testid="kpi-publish-rate"
            icon={<Clock className="w-4 h-4" />}
            label="Veröffentlicht / Stunde"
            value={data?.totals.publishPerHour ?? 0}
            hint={`${data?.totals.published ?? 0} Artikel im Fenster`}
          />
          <Kpi
            testid="kpi-safety-blocks"
            icon={<ShieldAlert className="w-4 h-4" />}
            label="Claude 403 Safety-Blocks"
            value={data?.classifier.safetyBlocks ?? 0}
            hint={`${data?.classifier.safetyRatePct ?? 0}% aller Runs • ${
              data?.classifier.heuristicRescues ?? 0
            } durch Heuristik gerettet`}
            accent={
              (data?.classifier.safetyRatePct ?? 0) > 50
                ? 'rose'
                : (data?.classifier.safetyRatePct ?? 0) > 20
                ? 'amber'
                : 'emerald'
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By status / by step */}
          <section
            className="rounded-xl border border-slate-200 bg-white p-5"
            data-testid="breakdown-card"
          >
            <h2 className="font-semibold text-slate-900 mb-3">Verteilung</h2>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                  Status
                </div>
                <BreakdownRows
                  map={data?.totals.byStatus || {}}
                  total={data?.totals.runs || 0}
                  testid="status"
                />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                  Fehlgeschlagene Schritte
                </div>
                <BreakdownRows
                  map={data?.totals.byFailStep || {}}
                  total={
                    Object.values(data?.totals.byFailStep || {}).reduce(
                      (a, b) => a + b,
                      0,
                    ) || 0
                  }
                  testid="failstep"
                  accent="rose"
                />
              </div>
            </div>
          </section>

          {/* Last published */}
          <section
            className="rounded-xl border border-slate-200 bg-white p-5"
            data-testid="last-published-card"
          >
            <h2 className="font-semibold text-slate-900 mb-3">
              Zuletzt veröffentlicht
            </h2>
            {(data?.lastPublished?.length ?? 0) === 0 ? (
              <div className="text-sm text-slate-500">
                Noch keine Artikel im Fenster.
              </div>
            ) : (
              <ul className="space-y-2" data-testid="last-published-list">
                {data!.lastPublished.map((a) => (
                  <li
                    key={a.slug}
                    className="flex items-center justify-between gap-3 border-b border-slate-100 last:border-0 pb-2 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-slate-900 truncate">
                        {a.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(a.publishedAt).toLocaleString('de-DE')}
                      </div>
                    </div>
                    <Link
                      href={`/${a.slug}`}
                      target="_blank"
                      className="text-slate-400 hover:text-slate-700 shrink-0"
                      data-testid={`view-${a.slug}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Crawler stats */}
        <CrawlerStatsCard />

        {/* Duplicate prevention */}
        <section
          className="rounded-xl border border-slate-200 bg-white p-5"
          data-testid="duplicates-card"
        >
          <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-500" /> Duplikate gestoppt
            <span className="text-xs font-normal text-slate-500 ml-auto">
              {data?.windowMinutes ?? 0}min Fenster
            </span>
          </h2>

          <div className="mb-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-slate-900 tabular-nums" data-testid="duplicates-total">
              {data?.duplicates?.total ?? 0}
            </span>
            <span className="text-xs text-slate-500">Artikel blockiert</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'url-duplicate', label: 'URL exakt', icon: '🔗', tier: 'A' },
              { key: 'url-duplicate-race', label: 'URL Race', icon: '⚡', tier: 'A' },
              { key: 'duplicate-jaccard-title', label: 'Titel ≥65%', icon: '📰', tier: 'B' },
              { key: 'duplicate-core-event', label: 'Core-Event', icon: '🎯', tier: 'B' },
              { key: 'duplicate-fingerprint', label: 'Fact-Fingerprint', icon: '🧬', tier: 'C' },
              { key: 'duplicate-llm', label: 'LLM-Check', icon: '🤖', tier: 'D' },
            ].map((stage) => {
              const count = data?.duplicates?.byStage?.[stage.key] ?? 0;
              return (
                <div
                  key={stage.key}
                  data-testid={`dup-stage-${stage.key}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <span>{stage.icon}</span>
                      {stage.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">
                      {stage.tier}
                    </span>
                  </div>
                  <div className="text-xl font-semibold tabular-nums text-slate-900">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-xs text-slate-500 leading-relaxed">
            <strong>A</strong> Hard URL/Race &middot; <strong>B</strong> Pre-Filter (0 LLM) &middot;
            <strong> C</strong> Facts-Fingerprint &middot; <strong>D</strong> Claude Semantic-Check
          </div>
        </section>

        {/* Recent failures */}
        <section
          className="rounded-xl border border-slate-200 bg-white p-5"
          data-testid="failures-card"
        >          <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Letzte Fehler (15)
          </h2>
          {(data?.recentFailures?.length ?? 0) === 0 ? (
            <div className="text-sm text-slate-500">
              Keine fehlgeschlagenen Runs im Fenster. 🎉
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="failures-table">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3">Zeit</th>
                    <th className="py-2 pr-3">Schritt</th>
                    <th className="py-2 pr-3">Titel / Query</th>
                    <th className="py-2 pr-3">Fehler</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.recentFailures.map((f) => (
                    <tr
                      key={f.id}
                      className="border-b border-slate-100 last:border-0 align-top"
                      data-testid={`failure-${f.id}`}
                    >
                      <td className="py-2 pr-3 text-slate-500 whitespace-nowrap text-xs">
                        {new Date(f.at).toLocaleString('de-DE')}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {f.step}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-800 max-w-xs truncate">
                        {f.title || '—'}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        <div className="text-xs text-rose-700">{f.message}</div>
                        {f.classifierReasoning && (
                          <div className="text-[11px] text-slate-500 mt-1 font-mono line-clamp-2">
                            {f.classifierReasoning}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
  accent,
  testid,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: React.ReactNode;
  accent?: 'rose' | 'amber' | 'emerald';
  testid?: string;
}) {
  const color =
    accent === 'rose'
      ? 'text-rose-600'
      : accent === 'amber'
      ? 'text-amber-600'
      : accent === 'emerald'
      ? 'text-emerald-600'
      : 'text-slate-900';
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-5"
      data-testid={testid}
    >
      <div className="flex items-center justify-between text-slate-500 mb-1">
        <span className="text-xs uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function BreakdownRows({
  map,
  total,
  accent,
  testid,
}: {
  map: Record<string, number>;
  total: number;
  accent?: 'rose';
  testid: string;
}) {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <div className="text-sm text-slate-400">—</div>;
  }
  return (
    <ul className="space-y-1.5" data-testid={`breakdown-${testid}`}>
      {entries.map(([k, v]) => {
        const pct = total > 0 ? Math.round((v / total) * 100) : 0;
        return (
          <li key={k} className="text-sm" data-testid={`breakdown-${testid}-${k}`}>
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-mono text-xs">{k}</span>
              <span className="tabular-nums text-slate-900 text-xs font-semibold">
                {v}{' '}
                <span className="text-slate-400 font-normal">({pct}%)</span>
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
              <div
                className={`h-full ${
                  accent === 'rose' ? 'bg-rose-400' : 'bg-cyan-400'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
