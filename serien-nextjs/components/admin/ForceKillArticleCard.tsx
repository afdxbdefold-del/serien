'use client';

import { useState } from 'react';
import { Skull, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ActionLog {
  step: string;
  ok: boolean;
  detail?: string;
}

interface ForceKillResponse {
  ok?: boolean;
  error?: string;
  slug?: string;
  title?: string;
  user?: string;
  actions?: ActionLog[];
  purged?: string[];
  purgeErrors?: string[];
}

const STEP_LABELS: Record<string, string> = {
  'redirect-301': '301-Redirect gesetzt',
  'blocklist-add': 'Blocklist-Eintrag hinzugefügt',
  'delete-article': 'Artikel gelöscht',
  'isr-purge': 'ISR-Cache geleert',
};

/**
 * Force-Kill-Article Card
 *
 * Ein-Klick-Lösung für durchgerutschte Boulevard-/Off-Topic-Artikel.
 * Eingabe: volle URL oder slug-Pfad.
 * Aktionen: 301-Redirect → /news, Blocklist-Eintrag, Artikel-Delete, ISR-Purge.
 */
export function ForceKillArticleCard() {
  const [url, setUrl] = useState('');
  const [addToBlocklist, setAddToBlocklist] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ForceKillResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleKill = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch('/api/admin/force-kill-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url: url.trim(), addToBlocklist }),
      });
      const json: ForceKillResponse = await res.json();
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
      } else {
        setResult(json);
        setUrl('');
        setConfirming(false);
      }
    } catch (e: any) {
      setError(e?.message || 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    handleKill();
  };

  return (
    <div
      className="bg-white rounded-lg shadow-sm border-2 border-red-200 p-4 mb-6"
      data-testid="force-kill-article-card"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="bg-red-100 p-2 rounded-lg">
          <Skull className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">Force-Kill Article</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Ein Klick: 301-Redirect → /news · Blocklist-Eintrag · Artikel-Delete · ISR-Cache purge.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setConfirming(false); setResult(null); setError(null); }}
          placeholder="https://serien.de/warum-... oder /slug-pfad"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono focus:ring-2 focus:ring-red-500 focus:border-red-500"
          disabled={loading}
          data-testid="force-kill-url-input"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={addToBlocklist}
              onChange={(e) => setAddToBlocklist(e.target.checked)}
              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              data-testid="force-kill-blocklist-checkbox"
            />
            In Blocklist aufnehmen (verhindert Re-Crawl)
          </label>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              confirming
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-300'
            }`}
            data-testid="force-kill-submit-button"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : confirming ? (
              <>
                <AlertTriangle className="w-4 h-4" />
                Wirklich löschen?
              </>
            ) : (
              <>
                <Skull className="w-4 h-4" />
                Force-Kill
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div
          className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex gap-2"
          data-testid="force-kill-error"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">Fehler</div>
            <div className="font-mono text-xs">{error}</div>
          </div>
        </div>
      )}

      {result?.ok && (
        <div
          className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm"
          data-testid="force-kill-success"
        >
          <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
            <CheckCircle2 className="w-4 h-4" />
            Artikel gekillt: <span className="font-mono">/{result.slug}</span>
          </div>
          {result.title && (
            <div className="text-xs text-gray-600 mb-2 italic">"{result.title}"</div>
          )}
          <ul className="space-y-1">
            {result.actions?.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className={a.ok ? 'text-green-600' : 'text-red-600'}>
                  {a.ok ? '✓' : '✗'}
                </span>
                <span className="text-gray-700 font-medium">{STEP_LABELS[a.step] || a.step}</span>
                {a.detail && <span className="text-gray-500 font-mono">— {a.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
