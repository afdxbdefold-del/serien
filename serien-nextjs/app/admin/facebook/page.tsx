'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Facebook, CheckCircle2, XCircle, AlertTriangle, Send, RefreshCw } from 'lucide-react';

interface TokenInfo {
  valid: boolean;
  type?: string;
  expiresAt?: number;
  scopes?: string[];
  pageName?: string;
  pageId?: string;
  error?: string;
}

interface LogRow {
  id: string;
  articleSlug: string;
  fbPostId: string | null;
  success: boolean;
  statusCode: number | null;
  errorMessage: string | null;
  trigger: string;
  createdAt: string;
}

interface StatusResponse {
  autopostEnabled: boolean;
  tokenInfo: TokenInfo;
  recent: LogRow[];
  stats: { totalSuccess: number; totalFailed: number };
}

export default function FacebookAdminPage() {
  const router = useRouter();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manualSlug, setManualSlug] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const authHeaders = useCallback(() => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('admin_token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/facebook', { headers: authHeaders() });
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authHeaders, router]);

  useEffect(() => {
    load();
  }, [load]);

  const callAction = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/facebook?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        setFeedback({ ok: true, msg: action === 'test' ? `Test-Post erfolgreich (FB-ID: ${json.fbPostId})` : action === 'post-article' ? `Artikel gepostet (FB-ID: ${json.fbPostId})` : 'OK' });
      } else {
        setFeedback({ ok: false, msg: json.errorMessage || json.error || 'Fehler' });
      }
      await load();
    } catch (e: any) {
      setFeedback({ ok: false, msg: e?.message || 'Netzwerkfehler' });
    } finally {
      setBusy(false);
    }
  };

  const tokenExpiresInDays = (() => {
    const ts = data?.tokenInfo.expiresAt;
    if (!ts) return null;
    const diff = ts * 1000 - Date.now();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Facebook className="h-7 w-7 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Facebook Auto-Poster</h1>
              <p className="text-sm text-gray-500">Page-Posting & Token-Status</p>
            </div>
          </div>
          <Link
            href="/admin/dashboard"
            data-testid="back-to-dashboard-link"
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {loading && !data ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : !data ? (
          <div className="bg-white rounded-xl border p-6 text-gray-500">Keine Daten verfügbar.</div>
        ) : (
          <>
            {feedback && (
              <div
                className={`rounded-xl border p-4 flex items-start gap-3 ${
                  feedback.ok ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'
                }`}
                data-testid="feedback-banner"
              >
                {feedback.ok ? <CheckCircle2 className="h-5 w-5 mt-0.5" /> : <XCircle className="h-5 w-5 mt-0.5" />}
                <div className="text-sm">{feedback.msg}</div>
              </div>
            )}

            {/* Token-Status */}
            <section className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Verbindungs-Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Token gültig</div>
                  <div className="font-semibold flex items-center gap-2">
                    {data.tokenInfo.valid ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" /> Ja ({data.tokenInfo.type})
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-600" /> Nein — {data.tokenInfo.error}
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Page</div>
                  <div className="font-semibold">
                    {data.tokenInfo.pageName ?? '–'}{' '}
                    <span className="text-gray-400">({data.tokenInfo.pageId ?? '–'})</span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Token läuft ab</div>
                  <div className="font-semibold flex items-center gap-2">
                    {tokenExpiresInDays === null ? (
                      'Niemals'
                    ) : tokenExpiresInDays < 7 ? (
                      <>
                        <AlertTriangle className="h-4 w-4 text-red-600" /> in {tokenExpiresInDays} Tagen
                      </>
                    ) : tokenExpiresInDays < 14 ? (
                      <>
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> in {tokenExpiresInDays} Tagen
                      </>
                    ) : (
                      <>in {tokenExpiresInDays} Tagen</>
                    )}
                  </div>
                </div>
              </div>
              {data.tokenInfo.scopes && data.tokenInfo.scopes.length > 0 && (
                <div className="mt-4 text-xs text-gray-500">
                  <span className="font-medium">Scopes:</span> {data.tokenInfo.scopes.join(', ')}
                </div>
              )}
            </section>

            {/* Auto-Post Toggle */}
            <section className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Auto-Posting</h2>
                  <p className="text-sm text-gray-500">
                    Wenn aktiv, wird jeder neu veröffentlichte Artikel automatisch auf der FB-Page gepostet.
                  </p>
                </div>
                <button
                  data-testid="autopost-toggle-button"
                  disabled={busy || !data.tokenInfo.valid}
                  onClick={() => callAction('toggle', { enabled: !data.autopostEnabled })}
                  className={`px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    data.autopostEnabled
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {data.autopostEnabled ? 'Aktiv (klicken zum Deaktivieren)' : 'Inaktiv (klicken zum Aktivieren)'}
                </button>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  data-testid="send-test-post-button"
                  disabled={busy || !data.tokenInfo.valid}
                  onClick={() => callAction('test')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> Test-Post senden
                </button>
                <button
                  data-testid="reload-button"
                  onClick={load}
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" /> Neu laden
                </button>
              </div>
            </section>

            {/* Manueller Post */}
            <section className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Manuell Artikel posten</h2>
              <div className="flex gap-3">
                <input
                  data-testid="manual-slug-input"
                  type="text"
                  placeholder="Artikel-Slug (z.B. running-point-ueberzeugt-aber-reicht-es-fuer-staffel-3)"
                  value={manualSlug}
                  onChange={(e) => setManualSlug(e.target.value)}
                  className="flex-1 px-4 py-2 border rounded-lg"
                />
                <button
                  data-testid="post-manual-button"
                  disabled={busy || !manualSlug.trim() || !data.tokenInfo.valid}
                  onClick={() => callAction('post-article', { slug: manualSlug.trim() })}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Posten
                </button>
              </div>
            </section>

            {/* Stats */}
            <section className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border p-6">
                <div className="text-sm text-gray-500">Erfolgreich gepostet</div>
                <div className="text-3xl font-bold text-green-600">{data.stats.totalSuccess}</div>
              </div>
              <div className="bg-white rounded-xl border p-6">
                <div className="text-sm text-gray-500">Fehlgeschlagen</div>
                <div className="text-3xl font-bold text-red-600">{data.stats.totalFailed}</div>
              </div>
            </section>

            {/* Log */}
            <section className="bg-white rounded-xl border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Letzte 30 Posts</h2>
              {data.recent.length === 0 ? (
                <p className="text-gray-500 text-sm">Noch keine Posts geloggt.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Artikel</th>
                        <th className="py-2 pr-4">FB Post-ID</th>
                        <th className="py-2 pr-4">Trigger</th>
                        <th className="py-2 pr-4">Zeitpunkt</th>
                        <th className="py-2 pr-4">Fehler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((row) => (
                        <tr key={row.id} className="border-b last:border-0" data-testid={`fb-log-row-${row.id}`}>
                          <td className="py-2 pr-4">
                            {row.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            <Link href={`/${row.articleSlug}`} className="text-blue-600 hover:underline" target="_blank">
                              {row.articleSlug}
                            </Link>
                          </td>
                          <td className="py-2 pr-4 text-xs font-mono">{row.fbPostId ?? '–'}</td>
                          <td className="py-2 pr-4">{row.trigger}</td>
                          <td className="py-2 pr-4 text-gray-500">
                            {new Date(row.createdAt).toLocaleString('de-DE')}
                          </td>
                          <td className="py-2 pr-4 text-red-600 text-xs">{row.errorMessage ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
