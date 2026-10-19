'use client';

import { useCallback, useEffect, useState } from 'react';

type Revision = { id: string; at: string; action: 'append' | 'rollback'; count: number; restoredFrom?: string };
type EditorData = { version: string; lines: string[]; history: Revision[] };

async function readJson(response: Response): Promise<{ error?: string; [key: string]: unknown }> {
  try { return await response.json(); } catch { return {}; }
}

export default function AdsTxtEditorPage() {
  const [password, setPassword] = useState('');
  const [data, setData] = useState<EditorData | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/ads-editor', { cache: 'no-store', credentials: 'same-origin' });
      if (response.status === 401) { setData(null); return; }
      const body = await readJson(response);
      if (!response.ok) { setError(body.error || 'Editor derzeit nicht verfügbar.'); return; }
      setData(body as EditorData);
      setError('');
    } catch {
      setError('Editor derzeit nicht erreichbar. Bitte später erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/ads-editor/login', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || 'Anmeldung fehlgeschlagen.');
      setPassword('');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Anmeldung fehlgeschlagen.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    try {
      const response = await fetch('/api/ads-editor/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw new Error();
      setData(null); setInput(''); setNotice('');
    } catch { setError('Abmeldung fehlgeschlagen. Bitte erneut versuchen.'); }
  }

  async function change(action: 'append' | 'rollback', payload: string) {
    if (!data) return;
    if (action === 'append' && !input.trim()) { setError('Bitte mindestens eine Zeile einfügen.'); return; }
    if (action === 'rollback' && !window.confirm('Diese frühere Version als neue aktive Version veröffentlichen? Die Historie bleibt erhalten.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/ads-editor', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload, expectedVersion: data.version }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || 'Speichern fehlgeschlagen.');
      setInput('');
      await refresh();
      setNotice(action === 'append' ? 'Zeilen gespeichert. Die öffentliche ads.txt kann bis zu 60 Sekunden zwischengespeichert sein.' : 'Frühere Version wiederhergestellt. Die öffentliche ads.txt kann bis zu 60 Sekunden zwischengespeichert sein.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen.');
      if (action === 'rollback') await refresh();
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">serien.de · Verwaltung</p>
            <h1 className="text-3xl font-bold tracking-tight">ads.txt-Editor</h1>
            <p className="mt-2 text-sm text-slate-400">Ergänzungen und Versionshistorie für die öffentliche ads.txt.</p>
          </div>
          <div className="flex gap-3 text-sm">
            <a className="rounded-lg border border-slate-700 px-4 py-2 hover:bg-slate-800" href="/ads.txt" target="_blank" rel="noreferrer">Öffentliche ads.txt ↗</a>
            {data && <button className="rounded-lg border border-slate-700 px-4 py-2 hover:bg-slate-800" onClick={() => void logout()}>Abmelden</button>}
          </div>
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-700 bg-red-950/40 p-4 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mb-5 rounded-xl border border-emerald-700 bg-emerald-950/30 p-4 text-sm text-emerald-200">{notice}</p>}

        {loading ? <p className="text-slate-400">Editor wird geladen …</p> : !data ? (
          <form onSubmit={login} className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold">Anmelden</h2>
            <label htmlFor="ads-password" className="mb-2 block text-sm text-slate-300">Editor-Passwort</label>
            <input id="ads-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-950 px-4 py-3 outline-none focus:border-amber-400" />
            <button disabled={busy} className="mt-5 rounded-lg bg-amber-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Prüfe …' : 'Anmelden'}</button>
          </form>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold">Zeilen hinzufügen</h2>
                <span className="text-sm text-slate-400">{data.lines.length} verwaltete Zeilen · Grundbestand bleibt unverändert</span>
              </div>
              <p className="mb-4 text-sm text-slate-400">Eine oder mehrere vollständige ads.txt-Zeilen einfügen. Leere Zeilen und Dubletten in der Eingabe werden ignoriert. Nur gültige Einträge werden gespeichert.</p>
              <label htmlFor="ads-lines" className="sr-only">Neue ads.txt-Zeilen</label>
              <textarea id="ads-lines" spellCheck={false} value={input} onChange={event => setInput(event.target.value)} rows={9} placeholder="anbieter.example, konto-id, DIRECT, zertifizierung-id" className="w-full rounded-lg border border-slate-600 bg-slate-950 p-4 font-mono text-sm leading-6 outline-none focus:border-amber-400" />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">Maximal 250 verwaltete Zeilen / 50 KB. Änderungen bleiben nach Deployments erhalten.</span>
                <button disabled={busy || !input.trim()} onClick={() => void change('append', input)} className="rounded-lg bg-amber-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Speichere …' : 'Zeilen veröffentlichen'}</button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="mb-4 text-xl font-semibold">Aktive Ergänzungen</h2>
              {data.lines.length ? <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-300">{data.lines.join('\n')}</pre> : <p className="text-sm text-slate-400">Noch keine Ergänzungen. Es gilt nur der fest eingebaute Grundbestand.</p>}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="mb-2 text-xl font-semibold">Rollback</h2>
              <p className="mb-5 text-sm text-slate-400">Eine Wiederherstellung erzeugt eine neue Version; frühere Versionen werden nicht gelöscht.</p>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 p-3 text-sm">
                  <span>Ursprungszustand · keine verwalteten Zeilen</span>
                  <button disabled={busy || !data.lines.length} onClick={() => void change('rollback', 'base')} className="rounded-lg border border-slate-600 px-3 py-2 hover:bg-slate-800 disabled:opacity-40">Wiederherstellen</button>
                </div>
                {data.history.map((revision, index) => <div key={revision.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 p-3 text-sm">
                  <span>{new Date(revision.at).toLocaleString('de-DE')} · {revision.action === 'append' ? 'Ergänzung' : 'Rollback'} · {revision.count} Zeilen {index === 0 && <strong className="ml-2 text-emerald-400">Aktuell</strong>}</span>
                  <button disabled={busy || revision.id === data.version} onClick={() => void change('rollback', revision.id)} className="rounded-lg border border-slate-600 px-3 py-2 hover:bg-slate-800 disabled:opacity-40">Wiederherstellen</button>
                </div>)}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
