'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Save, ShieldCheck, XCircle } from 'lucide-react';

interface ReviewArticle {
  id: string;
  slug: string;
  title: string;
  status: string;
  contentType: string | null;
  isRankingArticle: boolean;
  contentHtml: string;
  excerpt: string | null;
  metaDescription: string | null;
  heroImageUrl: string | null;
  heroLocalUrl: string | null;
  heroImagePath: string | null;
  sourceUrl: string | null;
  sourcePublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  seriesName: string | null;
  reviewReason: string | null;
  canVerifyPublication?: boolean;
}

interface GateResult {
  gate: string;
  status: 'pass' | 'fail' | 'error';
  reason?: string;
}

interface DraftForm {
  title: string;
  excerpt: string;
  metaDescription: string;
  heroImageUrl: string;
  sourceUrl: string;
  sourcePublishedAt: string;
  contentHtml: string;
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '';
  const localTime = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 19);
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host.endsWith('.local') || host.includes(':')) return true;
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return false;
  return octets.some((part) => part < 0 || part > 255)
    || octets[0] === 0
    || octets[0] === 10
    || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 192 && octets[1] === 0 && [0, 2].includes(octets[2]))
    || (octets[0] === 198 && [18, 19, 51].includes(octets[1]))
    || (octets[0] === 203 && octets[1] === 0 && octets[2] === 113)
    || octets[0] >= 224;
}

function getSafeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)
      || parsed.port
      || parsed.username
      || parsed.password
      || isPrivateHostname(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const token = typeof window === 'undefined' ? '' : localStorage.getItem('admin_token') || '';
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export default function ArticleReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<ReviewArticle | null>(null);
  const [form, setForm] = useState<DraftForm | null>(null);
  const [gates, setGates] = useState<GateResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'save-draft' | 'review-and-publish' | 'verify-publication' | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/articles?id=${encodeURIComponent(params.id)}`, {
        headers: authHeaders(),
      });
      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }
      const data = await response.json();
      if (!response.ok || !data.article) throw new Error(data.error || 'Entwurf konnte nicht geladen werden');
      const loaded = data.article as ReviewArticle;
      setArticle(loaded);
      setReviewConfirmed(false);
      setForm({
        title: loaded.title,
        excerpt: loaded.excerpt || '',
        metaDescription: loaded.metaDescription || '',
        heroImageUrl: loaded.heroImageUrl || '',
        sourceUrl: loaded.sourceUrl || '',
        sourcePublishedAt: toDateTimeLocal(loaded.sourcePublishedAt),
        contentHtml: loaded.contentHtml,
      });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Laden fehlgeschlagen' });
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => { void load(); }, [load]);

  const updateForm = (changes: Partial<DraftForm>) => {
    setForm((current) => current ? { ...current, ...changes } : current);
    setReviewConfirmed(false);
  };

  const submit = async (action: 'save-draft' | 'review-and-publish' | 'verify-publication') => {
    if (!form || !article) return;
    const normalizedContentType = (article.contentType || '').trim().toUpperCase();
    const isTimelessEditorial = article.isRankingArticle
      || ['RANKING', 'RANKING_LIST', 'FEATURE', 'FEATURE_ESSAY'].includes(normalizedContentType);
    if (action === 'review-and-publish' && !reviewConfirmed) {
      setMessage({ kind: 'warn', text: isTimelessEditorial
        ? 'Bitte die redaktionelle Prüfung des zeitlosen Inhalts bestätigen.'
        : 'Bitte Originalquelle und Quellzeitpunkt prüfen und bestätigen.' });
      return;
    }
    if (action === 'review-and-publish' && !window.confirm('Finale Gates erneut prüfen und bei Erfolg veröffentlichen?')) return;

    setSaving(action);
    setMessage(null);
    setGates([]);
    try {
      const sourcePublishedAt = form.sourcePublishedAt
        ? new Date(form.sourcePublishedAt).toISOString()
        : '';
      const response = await fetch('/api/admin/articles', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          id: article.id,
          action,
          expectedUpdatedAt: article.updatedAt,
          ...form,
          sourcePublishedAt,
          ...(action === 'review-and-publish'
            ? isTimelessEditorial
              ? { editorialReviewConfirmed: reviewConfirmed }
              : { sourceConfirmed: reviewConfirmed }
            : {}),
        }),
      });
      const data = await response.json();
      setGates(data.gates || []);
      if (!response.ok) throw new Error(data.error || 'Speichern fehlgeschlagen');

      if (data.article?.updatedAt) {
        setArticle((current) => current ? {
          ...current,
          updatedAt: data.article.updatedAt,
          sourceUrl: form.sourceUrl || null,
          sourcePublishedAt: sourcePublishedAt || null,
        } : current);
      }
      if (data.published) {
        setArticle((current) => current ? { ...current, status: 'published', canVerifyPublication: true } : current);
        setMessage(data.publicationVerified === false || data.verificationAuditSaved === false
          ? { kind: 'warn', text: data.warning || 'Artikel gespeichert und freigegeben; öffentliche Anzeige noch nicht bestätigt. Nicht erneut veröffentlichen.' }
          : { kind: 'ok', text: 'Artikel veröffentlicht; öffentliche Artikelansicht, Bild und aktuelle Platzierung bestätigt.' });
      } else if (action === 'review-and-publish') {
        setMessage({ kind: 'warn', text: data.reason || 'Mindestens eine Prüfung ist noch nicht bestanden.' });
      } else {
        setMessage({ kind: 'ok', text: 'Entwurf gespeichert.' });
      }
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Speichern fehlgeschlagen' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }
  if (!article || !form) {
    return <div className="min-h-screen bg-gray-50 p-8"><div className="max-w-4xl mx-auto text-red-700">{message?.text || 'Artikel nicht gefunden'}</div></div>;
  }

  const isDraft = article.status === 'draft';
  const normalizedContentType = (article.contentType || '').trim().toUpperCase();
  const isTimelessEditorial = article.isRankingArticle
    || ['RANKING', 'RANKING_LIST', 'FEATURE', 'FEATURE_ESSAY'].includes(normalizedContentType);
  const safeSourceUrl = getSafeHttpUrl(form.sourceUrl);
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/admin/articles" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" /> Zur Artikel-Verwaltung
          </Link>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${isDraft ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
            {isDraft ? 'Review-Entwurf' : 'Veröffentlicht'}
          </span>
        </div>

        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Artikel prüfen</h1>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div><span className="text-gray-500">Serie:</span> {article.seriesName || '–'}</div>
            <div><span className="text-gray-500">Autor:</span> {article.authorName}</div>
            <div><span className="text-gray-500">Inhaltstyp:</span> {article.contentType || 'Nicht klassifiziert'}{article.isRankingArticle ? ' (Ranking)' : ''}</div>
            <div><span className="text-gray-500">Quellzeitpunkt:</span> {form.sourcePublishedAt || 'Nicht vorhanden'}</div>
            <div className="min-w-0">
              <span className="text-gray-500">Quelle:</span>{' '}
              {safeSourceUrl ? (
                <a href={safeSourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                  Quelle öffnen <ExternalLink className="inline h-3.5 w-3.5" />
                </a>
              ) : form.sourceUrl ? 'Ungültige Quell-URL' : '–'}
            </div>
          </div>
          {article.reviewReason && isDraft && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Letzter Review-Grund: {article.reviewReason}
            </div>
          )}
        </section>

        {message && (
          <div className={`rounded-lg border p-4 text-sm ${message.kind === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : message.kind === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
            {message.text}
            {!isDraft && (
              <a href={`/${article.slug}`} target="_blank" rel="noopener noreferrer" className="ml-2 font-medium underline">Live ansehen</a>
            )}
          </div>
        )}

        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Titel</span>
            <input value={form.title} disabled={!isDraft} onChange={(event) => updateForm({ title: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Kurztext</span>
            <textarea value={form.excerpt} disabled={!isDraft} onChange={(event) => updateForm({ excerpt: event.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Meta-Beschreibung</span>
            <textarea value={form.metaDescription} disabled={!isDraft} onChange={(event) => updateForm({ metaDescription: event.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Hero-Bild-URL</span>
            <input value={form.heroImageUrl} disabled={!isDraft} onChange={(event) => updateForm({ heroImageUrl: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
            <span className="mt-1 block text-xs text-gray-500">Zulässig sind lokale Bilder, TMDB und der konfigurierte R2-Speicher. Das Motiv redaktionell prüfen; vor Freigabe werden Bilddatei, Querformat und Mindestgröße geprüft.</span>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Quell-URL</span>
            <input type="url" value={form.sourceUrl} disabled={!isDraft} onChange={(event) => updateForm({ sourceUrl: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
            <span className="mt-1 block text-xs text-gray-500">Für normale News ist eine öffentliche HTTP(S)-Quelle Pflicht.</span>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Quellzeitpunkt</span>
            <input type="datetime-local" step="1" value={form.sourcePublishedAt} disabled={!isDraft} onChange={(event) => updateForm({ sourcePublishedAt: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
            <span className="mt-1 block text-xs text-gray-500">Keine Schätzung: Zeitpunkt an der Originalquelle prüfen und exakt eintragen. Normale News bleiben ohne belastbaren Zeitpunkt gesperrt.</span>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Artikelinhalt (HTML)</span>
            <textarea value={form.contentHtml} disabled={!isDraft} onChange={(event) => updateForm({ contentHtml: event.target.value })} rows={24} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm disabled:bg-gray-100" />
          </label>

          {isDraft && (
            <div className="space-y-4 border-t pt-5">
              <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <input
                  type="checkbox"
                  checked={reviewConfirmed}
                  onChange={(event) => setReviewConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>{isTimelessEditorial
                  ? 'Ich habe Inhalt und zeitlose Feature-/Ranking-Klassifizierung redaktionell geprüft.'
                  : 'Ich habe die Originalquelle geöffnet und Quell-URL sowie Quellzeitpunkt geprüft.'}</span>
              </label>
              <div className="flex flex-wrap gap-3">
              <button onClick={() => void submit('save-draft')} disabled={saving !== null} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {saving === 'save-draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Entwurf speichern
              </button>
              <button onClick={() => void submit('review-and-publish')} disabled={saving !== null || !reviewConfirmed} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {saving === 'review-and-publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Prüfen & veröffentlichen
              </button>
              </div>
            </div>
          )}
          {!isDraft && article.status === 'published' && article.canVerifyPublication && (
            <button onClick={() => void submit('verify-publication')} disabled={saving !== null} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {saving === 'verify-publication' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Live-Anzeige nachprüfen
            </button>
          )}
        </section>

        {gates.length > 0 && (
          <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3">Prüfergebnis</h2>
            <div className="space-y-2">
              {gates.map((gate) => (
                <div key={gate.gate} className="flex items-start gap-2 rounded-lg border border-gray-200 p-3 text-sm">
                  {gate.status === 'pass' ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-600 mt-0.5" />}
                  <div><span className="font-medium">{gate.gate}</span>{gate.reason ? `: ${gate.reason}` : ''}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
