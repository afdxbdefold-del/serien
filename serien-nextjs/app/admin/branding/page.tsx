'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Loader2, Trash2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

interface SlotView {
  id: string;
  label: string;
  description: string;
  publicPath: string;
  recommendedWidth: number;
  recommendedHeight: number;
  recommendedNote: string;
  acceptedExts: string[];
  maxSizeBytes: number;
  exists: boolean;
  current: { size: number; mtime: string; width: number | null; height: number | null } | null;
  sizeMatchesRecommendation: boolean;
}

export default function BrandingAdminPage() {
  const [slots, setSlots] = useState<SlotView[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ slot: string; text: string; kind: 'ok' | 'err' } | null>(null);
  const [cacheBust, setCacheBust] = useState(Date.now());

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/admin/branding', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      const d = await r.json();
      setSlots(d.slots);
    } catch (e: any) {
      setErr(e.message || 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const upload = async (slotId: string, file: File) => {
    setPending(slotId); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/admin/branding?slot=${slotId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setMsg({ slot: slotId, text: 'Hochgeladen', kind: 'ok' });
      setCacheBust(Date.now());
      await load();
    } catch (e: any) {
      setMsg({ slot: slotId, text: e.message || 'Upload fehlgeschlagen', kind: 'err' });
    } finally {
      setPending(null);
    }
  };

  const remove = async (slotId: string) => {
    if (!confirm(`Datei für "${slotId}" wirklich löschen?`)) return;
    setPending(slotId); setMsg(null);
    try {
      const r = await fetch(`/api/admin/branding?slot=${slotId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setMsg({ slot: slotId, text: 'Gelöscht', kind: 'ok' });
      setCacheBust(Date.now());
      await load();
    } catch (e: any) {
      setMsg({ slot: slotId, text: e.message || 'Löschen fehlgeschlagen', kind: 'err' });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="branding-admin-page">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" data-testid="back-link" className="text-slate-500 hover:text-slate-900">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Branding-Assets</h1>
              <p className="text-xs text-slate-500">Favicons, Logos &amp; Social-Share-Bilder verwalten</p>
            </div>
          </div>
          <button
            onClick={load}
            data-testid="refresh-btn"
            className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4" /> Neu laden
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /> lade Slots…
          </div>
        )}

        {err && (
          <div data-testid="branding-error" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Fehler: {err}
          </div>
        )}

        <div className="space-y-4" data-testid="branding-slots">
          {slots.map((s) => {
            const dimOk = !s.exists || !s.current?.width || s.sizeMatchesRecommendation;
            const msgForSlot = msg?.slot === s.id ? msg : null;
            return (
              <article
                key={s.id}
                data-testid={`slot-${s.id}`}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <div className="grid grid-cols-12 gap-6 p-6">
                  {/* Preview */}
                  <div className="col-span-12 md:col-span-3 flex items-center justify-center">
                    <div
                      className="w-full max-w-[200px] aspect-square rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden"
                      style={{ backgroundImage: 'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, 10px 0px' }}
                    >
                      {s.exists ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${s.publicPath}?v=${cacheBust}`}
                          alt={s.label}
                          data-testid={`slot-preview-${s.id}`}
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 text-center px-2">Kein Bild<br/>vorhanden</span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="col-span-12 md:col-span-6 space-y-2">
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-base font-semibold text-slate-900">{s.label}</h2>
                      <code className="text-xs text-slate-500">{s.publicPath}</code>
                    </div>
                    <p className="text-sm text-slate-600">{s.description}</p>

                    <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">Empfohlen</div>
                        <div className="font-mono text-slate-900">{s.recommendedNote}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">Aktuell</div>
                        {s.exists && s.current ? (
                          <div className="font-mono text-slate-900 flex items-center gap-2">
                            {s.current.width && s.current.height ? `${s.current.width}×${s.current.height}` : 'unbekannt'}
                            <span className="text-slate-400">· {(s.current.size/1024).toFixed(1)} KB</span>
                            {dimOk ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <span title="Weicht von der Empfehlung ab"><AlertTriangle className="w-4 h-4 text-amber-600" /></span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-rose-700">
                            <AlertTriangle className="w-4 h-4" /> fehlt
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 pt-1">
                      Akzeptierte Formate: <code>{s.acceptedExts.join(', ')}</code> · max. {Math.round(s.maxSizeBytes/1024)} KB
                      {s.current?.mtime && ` · zuletzt geändert: ${new Date(s.current.mtime).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`}
                    </div>

                    {msgForSlot && (
                      <div
                        data-testid={`slot-msg-${s.id}`}
                        className={`text-sm rounded-md px-3 py-2 mt-2 ${msgForSlot.kind === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}
                      >
                        {msgForSlot.text}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-12 md:col-span-3 flex flex-col gap-2 md:justify-center">
                    <FileInput
                      slotId={s.id}
                      accept={s.acceptedExts.join(',')}
                      disabled={pending === s.id}
                      onFile={(file) => upload(s.id, file)}
                    />
                    {s.exists && (
                      <button
                        onClick={() => remove(s.id)}
                        disabled={pending === s.id}
                        data-testid={`slot-delete-${s.id}`}
                        className="flex items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" /> Löschen
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <footer className="pt-4 text-xs text-slate-500">
          Hinweis: Nach Änderungen kann es 30–90 Tage dauern, bis Google den Cache aktualisiert. Browser-Cache wird sofort umgangen durch Cache-Buster-Query.
        </footer>
      </main>
    </div>
  );
}

function FileInput({
  slotId, accept, disabled, onFile,
}: { slotId: string; accept: string; disabled: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        data-testid={`slot-file-${slotId}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          if (ref.current) ref.current.value = '';
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={disabled}
        data-testid={`slot-upload-${slotId}`}
        className="flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Hochladen
      </button>
    </>
  );
}
