'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Facebook,
} from 'lucide-react';

interface RecentPost {
  id: string;
  articleSlug: string | null;
  fbPostId: string | null;
  success: boolean;
  statusCode: number | null;
  errorMessage: string | null;
  trigger: string;
  createdAt: string;
}

interface TokenInfo {
  valid: boolean;
  pageId?: string;
  pageName?: string;
  type?: string;
  scopes?: string[];
  expiresAt?: number | null;
  expiryDays: number | null;
  error?: string;
}

interface Visibility {
  checked: boolean;
  publicVisible: boolean | null;
  htmlBytes: number;
  matchedSlugs: number;
  totalChecked: number;
  pageUrl: string;
  reason: string;
}

interface QuickLinks {
  appDashboard: string;
  appSettings: string;
  pageQuality: string;
  accountCenter: string;
  tokenRefresh: string;
}

interface FbStatus {
  tokenInfo: TokenInfo;
  visibility: Visibility;
  stats: {
    success24h: number;
    failed24h: number;
    success7d: number;
    avgPerDay: number;
  };
  postsPerDay: { day: string; count: number }[];
  recent: RecentPost[];
  warnings: string[];
  quickLinks: QuickLinks;
}

function fmtRelative(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h}h`;
  return `vor ${Math.floor(h / 24)}T`;
}

export default function FacebookStatusCard() {
  const [data, setData] = useState<FbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token =
      typeof document !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/facebook-status', {
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
        data-testid="fb-status-loading"
      >
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Facebook-Status wird geladen …
        </div>
      </div>
    );
  }
  if (err) {
    return (
      <div
        className="rounded-2xl bg-red-50 p-6 ring-1 ring-red-200 text-red-700"
        data-testid="fb-status-error"
      >
        Fehler: {err}
      </div>
    );
  }
  if (!data) return null;

  const isPublic = data.visibility.checked && data.visibility.publicVisible === true;
  const isUnpublished = data.visibility.checked && data.visibility.publicVisible === false;
  const tokenOk = data.tokenInfo.valid && (data.tokenInfo.expiryDays ?? 99) > 7;
  const overallHealthy = isPublic && tokenOk;

  // Max für Bar-Chart
  const maxPerDay = Math.max(1, ...data.postsPerDay.map((d) => d.count));

  return (
    <div
      className="rounded-2xl bg-white p-6 ring-1 ring-gray-200 space-y-5"
      data-testid="fb-status-card"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {overallHealthy ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-600" />
            )}
            <Facebook className="h-5 w-5 text-blue-600" />
            Facebook Auto-Poster Status
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            App-Mode-Check (Live vs Development), Token-Health, Posting-Frequenz.
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title="Reload"
          data-testid="fb-status-refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* App-Mode-Detection (KRITISCH) */}
      <div
        className={`rounded-xl p-4 ${
          isPublic
            ? 'bg-emerald-50 ring-1 ring-emerald-200'
            : isUnpublished
            ? 'bg-red-50 ring-2 ring-red-300'
            : 'bg-gray-50 ring-1 ring-gray-200'
        }`}
        data-testid="fb-app-mode"
      >
        <div className="text-xs uppercase tracking-wide font-semibold mb-2 text-gray-700">
          App-Mode (Public-Visibility-Test)
        </div>
        <div className="flex items-start gap-2">
          {isPublic ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : isUnpublished ? (
            <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="text-sm">
            <div
              className={`font-semibold ${
                isPublic ? 'text-emerald-800' : isUnpublished ? 'text-red-800' : 'text-gray-700'
              }`}
            >
              {isPublic
                ? 'App ist LIVE – Posts öffentlich sichtbar.'
                : isUnpublished
                ? 'App vermutlich UNVERÖFFENTLICHT – Posts NICHT öffentlich!'
                : 'App-Mode unbekannt'}
            </div>
            <div className="text-xs text-gray-700 mt-1">{data.visibility.reason}</div>
            {data.visibility.checked && (
              <div className="text-xs text-gray-500 mt-1 font-mono">
                Crawl: {data.visibility.htmlBytes.toLocaleString('de-DE')} bytes ·{' '}
                {data.visibility.matchedSlugs}/{data.visibility.totalChecked} Slugs gefunden
              </div>
            )}
            {isUnpublished && (
              <a
                href={data.quickLinks.appDashboard}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 mt-2 text-sm font-semibold text-red-700 hover:text-red-900 underline"
                data-testid="fb-app-dashboard-link"
              >
                <ExternalLink className="h-3 w-3" />
                App im Developer Dashboard veröffentlichen
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Token-Health */}
      <div
        className={`rounded-xl p-4 ${
          tokenOk ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-amber-50 ring-1 ring-amber-200'
        }`}
        data-testid="fb-token-health"
      >
        <div className="text-xs uppercase tracking-wide font-semibold mb-2 text-gray-700">
          Token-Health
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <HealthRow ok={data.tokenInfo.valid} label="Token gültig" />
          <HealthRow
            ok={(data.tokenInfo.expiryDays ?? 99) > 7}
            label={
              data.tokenInfo.expiryDays !== null
                ? `Läuft in ${data.tokenInfo.expiryDays}T`
                : 'Expiry unbekannt'
            }
          />
          <HealthRow ok={!!data.tokenInfo.pageId} label="Page-ID" />
          <HealthRow ok={data.tokenInfo.type === 'PAGE'} label="Page-Token-Typ" />
        </div>
        <div className="mt-2 text-xs text-gray-600">
          <span className="font-semibold">Page:</span> {data.tokenInfo.pageName || '–'}{' '}
          <span className="font-mono">({data.tokenInfo.pageId || '–'})</span>
        </div>
        {(data.tokenInfo.expiryDays ?? 99) <= 14 && (
          <a
            href={data.quickLinks.tokenRefresh}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-amber-800 hover:text-amber-900 underline"
            data-testid="fb-token-refresh-link"
          >
            <ExternalLink className="h-3 w-3" />
            Neuen Long-Lived-Token generieren
          </a>
        )}
      </div>

      {/* Posting-Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Erfolg 24h" value={String(data.stats.success24h)} />
        <Stat
          label="Fehler 24h"
          value={String(data.stats.failed24h)}
          color={data.stats.failed24h > 0 ? 'text-red-700' : 'text-emerald-700'}
        />
        <Stat label="Erfolg 7T" value={String(data.stats.success7d)} />
        <Stat
          label="⌀/Tag"
          value={String(data.stats.avgPerDay)}
          color={
            data.stats.avgPerDay > 20
              ? 'text-red-700'
              : data.stats.avgPerDay > 10
              ? 'text-amber-700'
              : 'text-emerald-700'
          }
        />
      </div>

      {/* Posts pro Tag (7 Tage Bar-Chart) */}
      {data.postsPerDay.length > 0 && (
        <div data-testid="fb-posts-per-day">
          <div className="text-xs uppercase tracking-wide font-semibold mb-2 text-gray-700">
            Posts pro Tag (letzte 7 Tage)
          </div>
          <div className="flex items-end gap-1 h-24">
            {data.postsPerDay.map((d) => {
              const heightPct = (d.count / maxPerDay) * 100;
              const isHigh = d.count > 20;
              const isMedium = d.count > 10 && d.count <= 20;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t ${
                      isHigh ? 'bg-red-500' : isMedium ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ height: `${heightPct}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                    title={`${d.day}: ${d.count} Posts`}
                  />
                  <div className="text-[10px] text-gray-500 font-mono leading-none">
                    {d.count}
                  </div>
                  <div className="text-[9px] text-gray-400 leading-none">
                    {d.day.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Letzte 20 Posts */}
      <div data-testid="fb-recent-posts">
        <div className="text-xs uppercase tracking-wide font-semibold mb-2 text-gray-700">
          Letzte 20 Post-Versuche
        </div>
        {data.recent.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-6">
            Noch keine FB-Posts geloggt.
          </div>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {data.recent.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-100"
              >
                {c.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                )}
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    c.trigger === 'manual'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {c.trigger}
                </span>
                <span className="text-gray-500 w-16 shrink-0">{fmtRelative(c.createdAt)}</span>
                <span className="font-mono text-gray-600 w-10 shrink-0">
                  {c.statusCode ?? '–'}
                </span>
                <span
                  className="truncate flex-1 text-gray-700"
                  title={c.articleSlug || ''}
                >
                  {c.articleSlug}
                </span>
                {c.fbPostId && (
                  <a
                    href={`https://www.facebook.com/${c.fbPostId.replace('_', '/posts/')}`}
                    target="_blank"
                    rel="noopener"
                    className="text-blue-600 hover:underline shrink-0"
                    title="Auf Facebook öffnen"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {c.errorMessage && (
                  <span
                    className="text-red-600 truncate text-[10px] max-w-[120px]"
                    title={c.errorMessage}
                  >
                    {c.errorMessage.slice(0, 30)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div
          className="bg-amber-50 ring-1 ring-amber-200 rounded-xl p-3"
          data-testid="fb-warnings"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              {data.warnings.map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="rounded-xl ring-1 ring-gray-200 p-3" data-testid="fb-quicklinks">
        <div className="text-xs uppercase tracking-wide font-semibold mb-2 text-gray-700">
          Quick Links
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <a
            href={data.quickLinks.appDashboard}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
          >
            <ExternalLink className="h-3 w-3" /> App Dashboard
          </a>
          <a
            href={data.quickLinks.appSettings}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
          >
            <ExternalLink className="h-3 w-3" /> App Settings
          </a>
          <a
            href={data.quickLinks.pageQuality}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
          >
            <ExternalLink className="h-3 w-3" /> Page Quality
          </a>
          <a
            href={data.quickLinks.accountCenter}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
          >
            <ExternalLink className="h-3 w-3" /> Account Center
          </a>
          <a
            href={data.quickLinks.tokenRefresh}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
          >
            <ExternalLink className="h-3 w-3" /> Graph API Explorer
          </a>
        </div>
      </div>
    </div>
  );
}

function HealthRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600" />
      )}
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
