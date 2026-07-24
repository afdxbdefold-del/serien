'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface DryRun {
  count: number;
  sample: Array<{ tmdbId: number; slug: string; name: string; popularity: number | null }>;
}

interface DeleteResult {
  ok: boolean;
  deleted?: number;
  error?: string;
}

export default function PurgeEmptySeriesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [dry, setDry] = useState<DryRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<DeleteResult | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('admin_token');
    if (!t) {
      router.push('/admin/login');
      return;
    }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch('/api/admin/purge-empty-series', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setDry(d))
      .catch((e) => setResult({ ok: false, error: String(e) }))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDelete = async () => {
    if (!token || !confirmed) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/purge-empty-series', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, ...data, error: res.ok ? undefined : data.error });
      if (res.ok) {
        setDry({ count: 0, sample: [] });
        setConfirmed(false);
      }
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121318] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Karteileichen-Serien entfernen</h1>
        <p className="text-sm text-gray-400 mb-6">
          Löscht alle Serien in der DB, für die es <strong>keinen einzigen Artikel</strong> gibt
          (weder primary noch über die Junction). Cascade-Delete räumt characters,
          episodes und push-Subscriptions gleich mit.
        </p>

        {loading && !dry && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Dry-Run…
          </div>
        )}

        {dry && (
          <div
            className="rounded-xl border border-yellow-700/40 bg-yellow-950/20 p-4 mb-6"
            data-testid="purge-dryrun-summary"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-yellow-500" />
              <div className="flex-1">
                <div className="font-semibold text-yellow-200">
                  {dry.count.toLocaleString('de-DE')} Serien würden gelöscht
                </div>
                {dry.sample.length > 0 && (
                  <details className="mt-2 text-sm text-gray-300">
                    <summary className="cursor-pointer text-gray-400">
                      Sample der ersten {dry.sample.length}
                    </summary>
                    <ul className="mt-2 space-y-1 font-mono text-xs">
                      {dry.sample.map((s) => (
                        <li key={s.tmdbId} className="flex justify-between gap-4">
                          <span className="truncate">{s.name}</span>
                          <span className="text-gray-500 shrink-0">
                            tmdb {s.tmdbId} · pop {s.popularity?.toFixed(1) ?? '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

        {dry && dry.count > 0 && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-4 h-4"
                data-testid="purge-confirm-checkbox"
              />
              <span className="text-sm">
                Ich bestätige: {dry.count} Serien endgültig löschen (Cascade greift).
              </span>
            </label>

            <button
              onClick={handleDelete}
              disabled={!confirmed || loading}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
              data-testid="purge-execute-button"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
              {loading ? 'Wird gelöscht…' : `Jetzt ${dry.count} Serien löschen`}
            </button>
          </div>
        )}

        {result && (
          <div
            className={`mt-6 p-4 rounded-lg border ${
              result.ok
                ? 'bg-green-950/40 border-green-700 text-green-200'
                : 'bg-red-950/40 border-red-700 text-red-200'
            }`}
            data-testid="purge-result"
          >
            <div className="flex items-start gap-2">
              {result.ok ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
              )}
              <div className="text-sm space-y-1">
                {result.ok ? (
                  <>
                    <div className="font-semibold">Erfolgreich gelöscht ✅</div>
                    <div>{result.deleted?.toLocaleString('de-DE')} Serien entfernt</div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold">Fehler</div>
                    <div>{result.error}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
