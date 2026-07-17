'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, CheckCircle2, XCircle } from 'lucide-react';

interface KillResult {
  ok: boolean;
  slug?: string;
  title?: string;
  redirectCreated?: boolean;
  blocklistAdded?: boolean;
  error?: string;
}

export default function ForceKillArticlePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [reason, setReason] = useState('');
  const [addToBlocklist, setAddToBlocklist] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KillResult | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('admin_token');
    if (!t) {
      router.push('/admin/login');
      return;
    }
    setToken(t);
  }, [router]);

  const handleKill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/force-kill-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: url.trim(),
          addToBlocklist,
          blocklistReason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, ...data, error: res.ok ? undefined : (data.error || data.detail || 'Fehler') });
      if (res.ok) {
        setUrl('');
        setReason('');
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
        <h1 className="text-2xl font-bold mb-2">Force-Kill Article</h1>
        <p className="text-sm text-gray-400 mb-6">
          Off-Topic-Artikel dauerhaft entfernen (Delete + 301-Redirect nach /news + optional Keyword-Blocklist).
        </p>

        <form onSubmit={handleKill} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Artikel-URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://serien.de/foo-bar-slug"
              required
              className="w-full px-4 py-2 bg-[#1e1f26] border border-[#33343d] rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              data-testid="force-kill-url-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Begründung (optional, für Blocklist-Log)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z.B. Off-Topic Boulevard"
              className="w-full px-4 py-2 bg-[#1e1f26] border border-[#33343d] rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              data-testid="force-kill-reason-input"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={addToBlocklist}
              onChange={(e) => setAddToBlocklist(e.target.checked)}
              className="w-4 h-4"
              data-testid="force-kill-blocklist-toggle"
            />
            <span className="text-sm">Keywords/Serie automatisch zur Blocklist hinzufügen</span>
          </label>

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
            data-testid="force-kill-submit-button"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
            {loading ? 'Wird gelöscht...' : 'Artikel löschen'}
          </button>
        </form>

        {result && (
          <div
            className={`mt-6 p-4 rounded-lg border ${
              result.ok
                ? 'bg-green-950/40 border-green-700 text-green-200'
                : 'bg-red-950/40 border-red-700 text-red-200'
            }`}
            data-testid="force-kill-result"
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
                    <div className="font-semibold">Artikel gelöscht ✅</div>
                    {result.slug && <div>Slug: <code>{result.slug}</code></div>}
                    {result.title && <div>Titel: {result.title}</div>}
                    {result.redirectCreated && <div>301-Redirect nach /news angelegt</div>}
                    {result.blocklistAdded && <div>Zur Blocklist hinzugefügt</div>}
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
