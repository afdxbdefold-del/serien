'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Loader2,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Eye,
  Users,
  MousePointerClick,
  ArrowUpRight,
  ExternalLink,
  Link2,
} from 'lucide-react';

interface DetailResponse {
  source: string;
  day: string;
  totals: {
    sessions: number;
    distinctVisitors: number;
    pageViews: number;
    bounceRate: number;
  };
  distinctReferrers: Array<{ url: string; count: number }>;
  topPages: Array<{ path: string; count: number; title: string | null }>;
  sessions: Array<{
    sessionId: string;
    visitorId: string;
    startedAt: string;
    duration: number | null;
    pageViews: number;
    referrer: string;
    entryPage: string;
    exitPage: string | null;
    country: string | null;
    device: string | null;
    browser: string | null;
    isBounce: boolean;
    pageSequence: string[];
  }>;
}

function deviceIcon(device: string | null) {
  if (!device) return <Globe className="w-3.5 h-3.5" />;
  const d = device.toLowerCase();
  if (d.includes('mobile') || d.includes('phone')) return <Smartphone className="w-3.5 h-3.5" />;
  if (d.includes('tablet')) return <Tablet className="w-3.5 h-3.5" />;
  return <Monitor className="w-3.5 h-3.5" />;
}

function fmtDuration(s: number | null): string {
  if (!s) return '–';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ReferrerDetailModal({
  source,
  day,
  onClose,
}: {
  source: string;
  day: 'today' | 'yesterday';
  onClose: () => void;
}) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) return;
    const run = async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(
          `/api/admin/analytics/referrer-detail?source=${encodeURIComponent(source)}&day=${day}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setData(await r.json());
      } catch (e: any) {
        setErr(e.message || 'Fehler beim Laden');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [source, day]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
      data-testid="referrer-detail-backdrop"
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        data-testid="referrer-detail-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-cyan-50 to-white dark:from-cyan-950/30 dark:to-gray-900">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-gray-500">
              Traffic-Quelle · {day === 'today' ? 'Heute' : 'Gestern'}
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white text-lg truncate flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-cyan-500" /> {source}
            </h2>
          </div>
          <button
            onClick={onClose}
            data-testid="referrer-detail-close"
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Lade Details…
            </div>
          )}
          {err && (
            <div className="rounded border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{err}</div>
          )}

          {data && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Kpi icon={<Users className="w-4 h-4" />} label="Sessions" value={data.totals.sessions} />
                <Kpi icon={<Users className="w-4 h-4" />} label="Besucher" value={data.totals.distinctVisitors} />
                <Kpi icon={<Eye className="w-4 h-4" />} label="Page-Views" value={data.totals.pageViews} />
                <Kpi icon={<MousePointerClick className="w-4 h-4" />} label="Bounce-Rate" value={`${data.totals.bounceRate}%`} />
              </div>

              {/* Exact referrers */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-cyan-500" /> Exakte Referrer-URLs ({data.distinctReferrers.length})
                </h3>
                {data.distinctReferrers.length === 0 ? (
                  <p className="text-xs text-gray-500">Keine Referrer-Daten</p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden" data-testid="distinct-referrers-list">
                    {data.distinctReferrers.map((r) => (
                      <li key={r.url} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="w-8 text-right tabular-nums text-cyan-600 dark:text-cyan-400 font-semibold">
                          {r.count}
                        </span>
                        <span className="flex-1 truncate text-gray-700 dark:text-gray-300 font-mono text-xs" title={r.url}>
                          {r.url}
                        </span>
                        {r.url !== '(Direct)' && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener nofollow noreferrer"
                            className="text-gray-400 hover:text-cyan-500"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Top pages viewed via this source */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Aufgerufene Seiten ({data.topPages.length})
                </h3>
                {data.topPages.length === 0 ? (
                  <p className="text-xs text-gray-500">Keine Page-Views</p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden" data-testid="top-pages-list">
                    {data.topPages.map((p, i) => (
                      <li key={p.path + i} className="flex items-start gap-3 px-3 py-2 text-sm">
                        <span className="w-8 text-right tabular-nums text-cyan-600 dark:text-cyan-400 font-semibold shrink-0">
                          {p.count}
                        </span>
                        <div className="flex-1 min-w-0">
                          {p.title && (
                            <div className="text-gray-900 dark:text-white truncate">{p.title}</div>
                          )}
                          <div className="text-xs font-mono text-gray-500 truncate">{p.path}</div>
                        </div>
                        <a
                          href={p.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-cyan-500 shrink-0"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Sessions detail */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Sessions ({data.sessions.length})
                </h3>
                {data.sessions.length === 0 ? (
                  <p className="text-xs text-gray-500">Keine Sessions</p>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="w-full text-sm" data-testid="sessions-table">
                      <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Zeit</th>
                          <th className="px-3 py-2 text-left">Gerät</th>
                          <th className="px-3 py-2 text-left">Land</th>
                          <th className="px-3 py-2 text-left">Einstieg</th>
                          <th className="px-3 py-2 text-right">Seiten</th>
                          <th className="px-3 py-2 text-right">Dauer</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.sessions.map((s) => {
                          const isOpen = expandedSession === s.sessionId;
                          return (
                            <>
                              <tr
                                key={s.sessionId}
                                className={`border-t border-gray-100 dark:border-gray-800 ${
                                  s.isBounce ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                                }`}
                              >
                                <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                                  {fmtTime(s.startedAt)}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                    {deviceIcon(s.device)}
                                    <span className="text-xs">{s.browser || '?'}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                                  {s.country || '–'}
                                </td>
                                <td className="px-3 py-2 text-xs font-mono text-gray-600 dark:text-gray-400 truncate max-w-[180px]">
                                  {s.entryPage}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                  {s.pageViews}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-500 text-xs">
                                  {fmtDuration(s.duration)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={() => setExpandedSession(isOpen ? null : s.sessionId)}
                                    className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400"
                                    data-testid={`toggle-session-${s.sessionId}`}
                                  >
                                    {isOpen ? 'Zu' : 'Pfad'}
                                  </button>
                                </td>
                              </tr>
                              {isOpen && (
                                <tr key={s.sessionId + '-detail'} className="bg-gray-50 dark:bg-gray-800/50">
                                  <td colSpan={7} className="px-3 py-2">
                                    <div className="text-xs text-gray-500 mb-1">
                                      Referrer: <span className="font-mono text-gray-700 dark:text-gray-300">{s.referrer}</span>
                                    </div>
                                    <ol className="list-decimal list-inside space-y-0.5 text-xs font-mono text-gray-700 dark:text-gray-300">
                                      {s.pageSequence.map((p, i) => (
                                        <li key={i} className="truncate">
                                          <a
                                            href={p}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-cyan-600"
                                          >
                                            {p}
                                          </a>
                                        </li>
                                      ))}
                                    </ol>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
      <div className="flex items-center justify-between text-gray-500 text-xs">
        <span className="uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</div>
    </div>
  );
}
