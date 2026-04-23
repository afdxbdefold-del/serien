'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Loader2, RefreshCw, ShieldBan, ShieldCheck, Edit2, Save, X } from 'lucide-react';

interface Entry {
  id: string;
  label: string;
  tmdbIds: number[];
  urlPatterns: string[];
  titleKeywords: string[];
  enabled: boolean;
  hits: number;
  lastHitAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

function joinCsv(arr: (string | number)[]) { return arr.join(', '); }
function parseIds(s: string): number[] {
  return s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean).map(Number).filter((n) => Number.isFinite(n));
}
function parseList(s: string): string[] {
  return s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
}

export default function BlocklistAdminPage() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/admin/blocklist', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      const d = await r.json();
      setRows(d.entries);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function save(id: string | null, payload: any) {
    const url = '/api/admin/blocklist' + (id ? `?id=${id}` : '');
    const r = await fetch(url, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    setEditing(null); setCreating(false);
    await load();
  }

  async function del(id: string) {
    if (!confirm('Eintrag wirklich löschen?')) return;
    await fetch(`/api/admin/blocklist?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await load();
  }

  async function toggle(e: Entry) {
    await fetch(`/api/admin/blocklist?id=${e.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ enabled: !e.enabled }),
    });
    await load();
  }

  const totalHits = rows.reduce((s, r) => s + r.hits, 0);
  const activeCount = rows.filter((r) => r.enabled).length;

  return (
    <div className="min-h-screen bg-slate-50" data-testid="blocklist-page">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="text-slate-500 hover:text-slate-900" data-testid="back-link"><ArrowLeft className="w-5 h-5"/></Link>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2"><ShieldBan className="w-5 h-5 text-rose-500"/>Serien-Blocklist</h1>
              <p className="text-xs text-slate-500">Regeln, die verhindern, dass Artikel aus Pipeline veröffentlicht werden</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} data-testid="refresh-btn" className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              <RefreshCw className="w-4 h-4"/> Neu laden
            </button>
            <button onClick={() => { setCreating(true); setEditing(null); }} data-testid="add-entry-btn" className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700">
              <Plus className="w-4 h-4"/> Neuer Eintrag
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Einträge gesamt" value={rows.length}/>
          <Stat label="Aktiv" value={activeCount} accent="emerald"/>
          <Stat label="Summe Treffer" value={totalHits} accent="rose"/>
        </div>

        {loading && <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin"/> lade…</div>}
        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>}

        {creating && <EntryForm onSave={(p) => save(null, p)} onCancel={() => setCreating(false)}/>}

        <div className="space-y-3" data-testid="blocklist-entries">
          {rows.map((e) => (
            <article key={e.id} data-testid={`entry-${e.id}`} className={`rounded-xl border bg-white p-5 ${e.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              {editing === e.id ? (
                <EntryForm initial={e} onSave={(p) => save(e.id, p)} onCancel={() => setEditing(null)}/>
              ) : (
                <div className="flex gap-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {e.enabled ? <ShieldBan className="w-4 h-4 text-rose-500"/> : <ShieldCheck className="w-4 h-4 text-slate-400"/>}
                      <h2 className="font-semibold text-slate-900">{e.label}</h2>
                      <span className={`text-xs rounded-full px-2 py-0.5 ${e.enabled ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                        {e.enabled ? 'aktiv' : 'deaktiviert'}
                      </span>
                    </div>
                    {e.note && <p className="text-sm text-slate-600 mb-2">{e.note}</p>}
                    <dl className="grid grid-cols-3 gap-3 text-xs">
                      <Field label="TMDB-IDs" value={e.tmdbIds.length ? joinCsv(e.tmdbIds) : '—'}/>
                      <Field label="URL-Patterns" value={e.urlPatterns.length ? joinCsv(e.urlPatterns) : '—'}/>
                      <Field label="Titel-Keywords" value={e.titleKeywords.length ? joinCsv(e.titleKeywords) : '—'}/>
                    </dl>
                  </div>
                  <div className="w-44 flex flex-col items-end text-right">
                    <div className="text-2xl font-bold text-slate-900 tabular-nums">{e.hits}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Treffer</div>
                    {e.lastHitAt && <div className="text-xs text-slate-400 mt-1">zuletzt: {new Date(e.lastHitAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}</div>}
                    <div className="flex gap-1 mt-3">
                      <button onClick={() => toggle(e)} data-testid={`toggle-${e.id}`} title={e.enabled ? 'Deaktivieren' : 'Aktivieren'} className="p-2 rounded border border-slate-200 hover:bg-slate-50">
                        {e.enabled ? <ShieldCheck className="w-4 h-4 text-emerald-600"/> : <ShieldBan className="w-4 h-4 text-rose-600"/>}
                      </button>
                      <button onClick={() => { setEditing(e.id); setCreating(false); }} data-testid={`edit-${e.id}`} title="Bearbeiten" className="p-2 rounded border border-slate-200 hover:bg-slate-50"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={() => del(e.id)} data-testid={`delete-${e.id}`} title="Löschen" className="p-2 rounded border border-rose-200 hover:bg-rose-50 text-rose-600"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          ))}
          {!loading && rows.length === 0 && !creating && (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
              Keine Einträge. <button onClick={() => setCreating(true)} className="underline">Ersten Eintrag anlegen</button>.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const color = accent === 'rose' ? 'text-rose-600' : accent === 'emerald' ? 'text-emerald-600' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="font-mono text-slate-700 break-words">{value}</div>
    </div>
  );
}

function EntryForm({ initial, onSave, onCancel }: {
  initial?: Entry;
  onSave: (p: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label || '');
  const [tmdb, setTmdb] = useState(initial ? joinCsv(initial.tmdbIds) : '');
  const [urls, setUrls] = useState(initial ? joinCsv(initial.urlPatterns) : '');
  const [kw, setKw] = useState(initial ? joinCsv(initial.titleKeywords) : '');
  const [note, setNote] = useState(initial?.note || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      await onSave({
        label,
        tmdbIds: parseIds(tmdb),
        urlPatterns: parseList(urls),
        titleKeywords: parseList(kw),
        note,
      });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border-2 border-slate-900 bg-white p-5" data-testid="entry-form">
      <h3 className="font-semibold text-slate-900 mb-3">{initial ? 'Bearbeiten' : 'Neuer Eintrag'}</h3>
      <div className="space-y-3">
        <Input label="Label" value={label} onChange={setLabel} testid="form-label" placeholder="z.B. Jeopardy! (US Game Show)" />
        <Input label="TMDB-IDs" hint="Komma- oder Space-getrennt. Quelle: themoviedb.org" value={tmdb} onChange={setTmdb} testid="form-tmdb" placeholder="2912, 103081"/>
        <Input label="URL-Patterns" hint="Substring-Matches in der Source-URL (case-insensitive)" value={urls} onChange={setUrls} testid="form-urls" placeholder="/jeopardy, -jeopardy-" />
        <Input label="Titel-Keywords" hint="Substring-Matches im Artikel-Titel" value={kw} onChange={setKw} testid="form-keywords" placeholder="jeopardy, ken jennings" />
        <Input label="Notiz (optional)" value={note} onChange={setNote} testid="form-note" placeholder="Warum dieser Eintrag?"/>
        {err && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">{err}</div>}
        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={busy || !label} data-testid="form-save" className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Speichern
          </button>
          <button onClick={onCancel} data-testid="form-cancel" className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <X className="w-4 h-4"/> Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, hint, testid, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; testid?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        data-testid={testid}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
      />
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
