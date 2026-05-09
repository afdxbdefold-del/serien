'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, ShieldCheck, Send, AlertTriangle, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

interface RecentCall {
  id: string;
  articleId: string | null;
  url: string;
  eventType: string;
  responseStatus: number | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface IndexingHealth {
  envSet: boolean;
  base64Decoded: boolean;
  jsonParsed: boolean;
  serviceAccountEmail: string | null;
  projectId: string | null;
  tokenGenerated: boolean;
  errors: string[];
}

interface IndexingStats {
  windowDays: number;
  health: IndexingHealth;
  successRate24h: number | null;
  successRateWindow: number | null;
  totalCalls24h: number;
  successCalls24h: number;
  failedCalls24h: number;
  totalCallsWindow: number;
  lastSuccessfulCall: { url: string; at: string; status: number } | null;
  topErrors: { key: string; count: number }[];
  recentCalls: RecentCall[];
  warnings: string[];
}

function fmtRelative(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h}h`;
  return `vor ${Math.floor(h / 24)}T`;
}

export default function GoogleIndexingApiCard() {
  const [data, setData] = useState<IndexingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [manualSlug, setManualSlug] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualResult, setManualResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = typeof document !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/google-indexing-stats?days=${days}`, {
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
  }, [days]);

  useEffect(() => { load(); }, [load]);

  async function triggerManual() {
    const slug = manualSlug.trim().replace(/^\//, '');
    if (!slug) return;
    setManualBusy(true);
    setManualResult(null);
    try {
      const token = localStorage.getItem('admin_token');
      const r = await fetch('/api/admin/google-indexing-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slug }),
      });
      const j = await r.json();
      if (j.success) {
        setManualResult(`✅ ${j.url} → status ${j.status}`);
      } else {
        setManualResult(`❌ ${j.error || 'Fehler'}`);
      }
      load();
    } catch (e: any) {
      setManualResult(`❌ ${e.message}`);
    } finally {
      setManualBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200" data-testid="google-indexing-loading">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Google Indexing API Stats werden geladen …
        </div>
      </div>
    );
  }
  if (err) {
    return (
      <div className="rounded-2xl bg-red-50 p-6 ring-1 ring-red-200 text-red-700" data-testid="google-indexing-error">
        Fehler: {err}
      </div>
    );
  }
  if (!data) return null;

  const isHealthy = data.health.envSet && data.health.tokenGenerated && data.health.errors.length === 0;

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200 space-y-5" data-testid="google-indexing-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {isHealthy ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-amber-600" />}
            Google Indexing API
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Push-Benachrichtigung an Google bei jedem Publish — Observability + Manual-Trigger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="text-sm border rounded-lg px-2 py-1"
            data-testid="google-indexing-days-select"
          >
            <option value={1}>1T</option>
            <option value={7}>7T</option>
            <option value={30}>30T</option>
          </select>
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg" title="Reload" data-testid="google-indexing-refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Health-Check */}
      <div className={`rounded-xl p-4 ${isHealthy ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-amber-50 ring-1 ring-amber-200'}`} data-testid="google-indexing-health">
        <div className="text-xs uppercase tracking-wide font-semibold mb-2 text-gray-700">Health-Check</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          <HealthRow ok={data.health.envSet} label="ENV gesetzt" />
          <HealthRow ok={data.health.base64Decoded} label="Base64-Decode" />
          <HealthRow ok={data.health.jsonParsed} label="JSON-Parse" />
          <HealthRow ok={!!data.health.serviceAccountEmail} label="Service-Account" />
          <HealthRow ok={!!data.health.projectId} label="Project-ID" />
          <HealthRow ok={data.health.tokenGenerated} label="Token-Generation" />
        </div>
        {data.health.serviceAccountEmail && (
          <div className="mt-2 text-xs text-gray-600 font-mono break-all">
            {data.health.serviceAccountEmail}
            {data.health.projectId && <> · project=<span className="font-semibold">{data.health.projectId}</span></>}
          </div>
        )}
        {data.health.errors.length > 0 && (
          <div className="mt-2 text-sm text-red-700">
            <div className="font-semibold">Fehler:</div>
            <ul className="list-disc list-inside text-xs">
              {data.health.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
        {!data.health.envSet && (
          <div className="mt-2 text-sm text-amber-800 bg-amber-100 p-2 rounded">
            ⚠️ <strong>GOOGLE_SERVICE_ACCOUNT_JSON</strong> fehlt in den Vercel-Env-Variables.
            Ohne diese Variable wird KEIN Push an Google gesendet.
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Calls 24h" value={String(data.totalCalls24h)} />
        <Stat
          label="Success-Rate 24h"
          value={data.successRate24h === null ? '–' : `${(data.successRate24h * 100).toFixed(0)}%`}
          color={
            data.successRate24h === null ? 'text-gray-500'
              : data.successRate24h >= 0.9 ? 'text-emerald-700'
              : data.successRate24h >= 0.5 ? 'text-amber-700'
              : 'text-red-700'
          }
        />
        <Stat label="Failed 24h" value={String(data.failedCalls24h)} color={data.failedCalls24h > 0 ? 'text-red-700' : 'text-emerald-700'} />
      </div>

      {data.lastSuccessfulCall && (
        <div className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3" data-testid="google-indexing-last-success">
          <span className="font-semibold">Letzter erfolgreicher Call:</span> {fmtRelative(data.lastSuccessfulCall.at)}
          <a href={data.lastSuccessfulCall.url} target="_blank" rel="noopener" className="block text-xs text-blue-600 hover:underline truncate mt-1">
            <ExternalLink className="inline h-3 w-3 mr-1" />
            {data.lastSuccessfulCall.url}
          </a>
        </div>
      )}

      {/* Top errors */}
      {data.topErrors.length > 0 && (
        <div className="bg-red-50 rounded-xl p-3" data-testid="google-indexing-top-errors">
          <div className="text-xs uppercase tracking-wide font-semibold mb-2 text-red-700">Top Fehler ({data.windowDays}T)</div>
          <ul className="text-xs space-y-1 font-mono">
            {data.topErrors.map((e) => (
              <li key={e.key}><span className="text-red-700 font-semibold">{e.count}×</span> {e.key}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent calls */}
      <div data-testid="google-indexing-recent">
        <div className="text-xs uppercase tracking-wide font-semibold mb-2 text-gray-700">Letzte 20 Calls</div>
        {data.recentCalls.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-6">
            Noch keine API-Calls geloggt. Beim nächsten Article-Publish wird hier ein Eintrag erscheinen.
          </div>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {data.recentCalls.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-100">
                {c.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  c.eventType === 'manual' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                }`}>{c.eventType}</span>
                <span className="text-gray-500 w-16 shrink-0">{fmtRelative(c.createdAt)}</span>
                <span className="font-mono text-gray-600 w-10 shrink-0">{c.responseStatus ?? '–'}</span>
                <span className="truncate flex-1 text-gray-700" title={c.url}>{c.url.replace(/^https?:\/\/[^/]+/, '')}</span>
                {c.errorMessage && <span className="text-red-600 truncate text-[10px]" title={c.errorMessage}>{c.errorMessage.slice(0, 30)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual trigger */}
      <div className="rounded-xl ring-1 ring-gray-200 p-3" data-testid="google-indexing-manual">
        <div className="text-xs uppercase tracking-wide font-semibold mb-2 text-gray-700 flex items-center gap-1">
          <Send className="h-3.5 w-3.5" /> Manueller Push
        </div>
        <div className="flex gap-2">
          <input
            value={manualSlug}
            onChange={(e) => setManualSlug(e.target.value)}
            placeholder="article-slug-ohne-slash"
            className="flex-1 text-sm border rounded-lg px-3 py-1.5"
            data-testid="google-indexing-manual-input"
          />
          <button
            onClick={triggerManual}
            disabled={manualBusy || !manualSlug.trim()}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="google-indexing-manual-trigger"
          >
            {manualBusy ? 'Sende …' : 'Push an Google'}
          </button>
        </div>
        {manualResult && (
          <div className={`mt-2 text-xs font-mono ${manualResult.startsWith('✅') ? 'text-emerald-700' : 'text-red-700'}`}>
            {manualResult}
          </div>
        )}
      </div>

      {/* Warnings */}
      <div className="bg-amber-50 ring-1 ring-amber-200 rounded-xl p-3" data-testid="google-indexing-warnings">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            {data.warnings.map((w, i) => <div key={i}>• {w}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
      <span className={ok ? 'text-emerald-800' : 'text-red-800'}>{label}</span>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color || ''}`}>{value}</div>
    </div>
  );
}
