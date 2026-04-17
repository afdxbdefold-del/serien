'use client';

import { useState, useRef } from 'react';

interface SeoResult {
  url: string;
  timestamp: string;
  httpStatus: number;
  ttfb: number;
  renderTime: number;
  raw: { title: string; metaDescription: string; h1: string; wordCount: number; textContent: string };
  rendered: { title: string; metaDescription: string; h1: string; wordCount: number; textContent: string } | null;
  seoChecks: {
    h1Present: boolean; titlePresent: boolean; metaDescriptionPresent: boolean;
    contentInRawHtml: boolean; canonicalCorrect: boolean; canonical: string | null;
    robotsMeta: string | null; noindexDetected: boolean; jsonLdPresent: boolean;
    jsonLdTypes: string[]; lazyLoadedContent: boolean; ogImage: string | null; ogTitle: string | null;
  };
  contentDiff: { rawWords: number; renderedWords: number; diffPercent: number; contentOnlyViaJs: boolean };
  errors: string[];
  warnings: string[];
  score: number;
  screenshots: { raw: string | null; rendered: string | null };
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#16a34a' : score >= 50 ? '#ca8a04' : '#dc2626';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', border: `3px solid ${color}`, color, fontWeight: 700, fontSize: 18 }}>
      {score}
    </span>
  );
}

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid #1e293b' }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{ok ? '\u2705' : '\u274c'}</span>
      <div>
        <span style={{ color: ok ? '#a3e635' : '#f87171', fontWeight: 600 }}>{label}</span>
        {detail && <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>{detail}</div>}
      </div>
    </div>
  );
}

function SingleResult({ result }: { result: SeoResult }) {
  const [showText, setShowText] = useState(false);

  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24, marginBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 700, margin: 0, wordBreak: 'break-all' }}>{result.url}</h2>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            HTTP {result.httpStatus} &middot; TTFB {result.ttfb}ms &middot; Render {result.renderTime}ms &middot; {result.timestamp.substring(0, 19).replace('T', ' ')}
          </div>
        </div>
        <ScoreBadge score={result.score} />
      </div>

      {/* Verdict */}
      <div style={{
        padding: '12px 16px', borderRadius: 6, marginBottom: 20, fontWeight: 600, fontSize: 15,
        background: result.score >= 80 ? '#052e16' : result.score >= 50 ? '#422006' : '#450a0a',
        color: result.score >= 80 ? '#4ade80' : result.score >= 50 ? '#fbbf24' : '#f87171',
        border: `1px solid ${result.score >= 80 ? '#166534' : result.score >= 50 ? '#854d0e' : '#991b1b'}`,
      }}>
        {result.score >= 80
          ? 'Google sieht deine Seite korrekt.'
          : result.score >= 50
            ? 'Google sieht Content, aber es gibt Optimierungspotenzial.'
            : 'Google sieht nur leere Seite / zu wenig Content.'}
      </div>

      {/* Errors & Warnings */}
      {result.errors.length > 0 && (
        <div style={{ background: '#450a0a', border: '1px solid #991b1b', borderRadius: 6, padding: 12, marginBottom: 16 }}>
          {result.errors.map((e, i) => <div key={i} style={{ color: '#f87171', fontSize: 14, padding: '2px 0' }}>{e}</div>)}
        </div>
      )}
      {result.warnings.length > 0 && (
        <div style={{ background: '#422006', border: '1px solid #854d0e', borderRadius: 6, padding: 12, marginBottom: 16 }}>
          {result.warnings.map((w, i) => <div key={i} style={{ color: '#fbbf24', fontSize: 14, padding: '2px 0' }}>{w}</div>)}
        </div>
      )}

      {/* Content Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: '#1e293b', borderRadius: 6, padding: 16 }}>
          <h3 style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>Raw HTML (ohne JS)</h3>
          <div style={{ color: '#e2e8f0', fontSize: 14 }}>
            <div><strong>Title:</strong> {result.raw.title || <span style={{ color: '#f87171' }}>FEHLT</span>}</div>
            <div><strong>H1:</strong> {result.raw.h1 || <span style={{ color: '#f87171' }}>FEHLT</span>}</div>
            <div><strong>Description:</strong> {result.raw.metaDescription?.substring(0, 80) || <span style={{ color: '#f87171' }}>FEHLT</span>}</div>
            <div style={{ marginTop: 8, fontWeight: 700, color: result.raw.wordCount >= 500 ? '#4ade80' : result.raw.wordCount >= 100 ? '#fbbf24' : '#f87171' }}>
              {result.raw.wordCount} Wörter
            </div>
          </div>
        </div>
        <div style={{ background: '#1e293b', borderRadius: 6, padding: 16 }}>
          <h3 style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>Gerendert (mit JS)</h3>
          {result.rendered ? (
            <div style={{ color: '#e2e8f0', fontSize: 14 }}>
              <div><strong>Title:</strong> {result.rendered.title || <span style={{ color: '#f87171' }}>FEHLT</span>}</div>
              <div><strong>H1:</strong> {result.rendered.h1 || <span style={{ color: '#f87171' }}>FEHLT</span>}</div>
              <div><strong>Description:</strong> {result.rendered.metaDescription?.substring(0, 80) || <span style={{ color: '#f87171' }}>FEHLT</span>}</div>
              <div style={{ marginTop: 8, fontWeight: 700, color: result.rendered.wordCount >= 500 ? '#4ade80' : '#fbbf24' }}>
                {result.rendered.wordCount} Wörter
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>Rendering nicht verfügbar</div>
          )}
        </div>
      </div>

      {/* Content Diff */}
      <div style={{ background: '#1e293b', borderRadius: 6, padding: 16, marginBottom: 20 }}>
        <h3 style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Content Differenz</h3>
        <div style={{ display: 'flex', gap: 24, color: '#e2e8f0', fontSize: 14 }}>
          <div>Raw: <strong>{result.contentDiff.rawWords}</strong> Wörter</div>
          <div>Rendered: <strong>{result.contentDiff.renderedWords}</strong> Wörter</div>
          <div style={{ color: result.contentDiff.diffPercent > 30 ? '#f87171' : result.contentDiff.diffPercent > 10 ? '#fbbf24' : '#4ade80' }}>
            Diff: <strong>{result.contentDiff.diffPercent}%</strong>
          </div>
          {result.contentDiff.contentOnlyViaJs && (
            <div style={{ color: '#f87171', fontWeight: 700 }}>NUR PER JS</div>
          )}
        </div>
      </div>

      {/* SEO Checks */}
      <div style={{ background: '#1e293b', borderRadius: 6, padding: 16, marginBottom: 20 }}>
        <h3 style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>SEO Checks</h3>
        <Check ok={result.seoChecks.h1Present} label="H1 vorhanden" detail={result.raw.h1} />
        <Check ok={result.seoChecks.titlePresent} label="Title-Tag vorhanden" detail={result.raw.title} />
        <Check ok={result.seoChecks.metaDescriptionPresent} label="Meta Description" detail={result.raw.metaDescription?.substring(0, 100)} />
        <Check ok={result.seoChecks.contentInRawHtml} label="Content im Raw HTML (100+ Wörter)" detail={`${result.raw.wordCount} Wörter`} />
        <Check ok={result.seoChecks.canonicalCorrect} label="Canonical korrekt" detail={result.seoChecks.canonical || 'nicht gesetzt'} />
        <Check ok={!result.seoChecks.noindexDetected} label="Kein Noindex" detail={result.seoChecks.robotsMeta || 'kein robots meta'} />
        <Check ok={result.seoChecks.jsonLdPresent} label="Strukturierte Daten (JSON-LD)" detail={result.seoChecks.jsonLdTypes.join(', ') || 'keine'} />
        <Check ok={!!result.seoChecks.ogImage} label="OG Image" detail={result.seoChecks.ogImage?.substring(0, 80) || 'fehlt'} />
        <Check ok={!result.seoChecks.lazyLoadedContent} label="Erstes Bild nicht lazy" />
      </div>

      {/* Screenshots */}
      {(result.screenshots.raw || result.screenshots.rendered) && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>Google Screenshot Simulation</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {result.screenshots.raw && (
              <div>
                <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>Sofort (ohne JS-Warten)</div>
                <img src={result.screenshots.raw} alt="Raw" style={{ width: '100%', borderRadius: 6, border: '1px solid #334155' }} />
              </div>
            )}
            {result.screenshots.rendered && (
              <div>
                <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>Nach vollständigem Rendering</div>
                <img src={result.screenshots.rendered} alt="Rendered" style={{ width: '100%', borderRadius: 6, border: '1px solid #334155' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Text Content Toggle */}
      <button onClick={() => setShowText(!showText)} style={{ background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 4, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
        {showText ? 'Text ausblenden' : 'Sichtbaren Text anzeigen'}
      </button>
      {showText && (
        <pre style={{ background: '#020617', borderRadius: 6, padding: 12, marginTop: 8, color: '#94a3b8', fontSize: 12, maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {result.raw.textContent}
        </pre>
      )}
    </div>
  );
}

function BulkTable({ results }: { results: SeoResult[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#1e293b', color: '#94a3b8', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px' }}>URL</th>
            <th style={{ padding: '8px 12px' }}>Status</th>
            <th style={{ padding: '8px 12px' }}>Content</th>
            <th style={{ padding: '8px 12px' }}>Wörter</th>
            <th style={{ padding: '8px 12px' }}>TTFB</th>
            <th style={{ padding: '8px 12px' }}>H1</th>
            <th style={{ padding: '8px 12px' }}>Title</th>
            <th style={{ padding: '8px 12px' }}>JSON-LD</th>
            <th style={{ padding: '8px 12px' }}>Noindex</th>
            <th style={{ padding: '8px 12px' }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1e293b', color: '#e2e8f0' }}>
              <td style={{ padding: '8px 12px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.url.replace('https://serien.de', '')}</td>
              <td style={{ padding: '8px 12px', color: r.httpStatus === 200 ? '#4ade80' : '#f87171' }}>{r.httpStatus}</td>
              <td style={{ padding: '8px 12px', color: r.seoChecks.contentInRawHtml ? '#4ade80' : '#f87171' }}>{r.seoChecks.contentInRawHtml ? 'Ja' : 'Nein'}</td>
              <td style={{ padding: '8px 12px' }}>{r.raw.wordCount}</td>
              <td style={{ padding: '8px 12px', color: r.ttfb < 1000 ? '#4ade80' : '#fbbf24' }}>{r.ttfb}ms</td>
              <td style={{ padding: '8px 12px' }}>{r.seoChecks.h1Present ? '\u2705' : '\u274c'}</td>
              <td style={{ padding: '8px 12px' }}>{r.seoChecks.titlePresent ? '\u2705' : '\u274c'}</td>
              <td style={{ padding: '8px 12px' }}>{r.seoChecks.jsonLdPresent ? '\u2705' : '\u274c'}</td>
              <td style={{ padding: '8px 12px' }}>{r.seoChecks.noindexDetected ? '\u274c' : '\u2705'}</td>
              <td style={{ padding: '8px 12px' }}><ScoreBadge score={r.score} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SeoDebugPage() {
  const [url, setUrl] = useState('https://serien.de/');
  const [bulkUrls, setBulkUrls] = useState('');
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SeoResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const analyze = async () => {
    setLoading(true);
    setResults([]);

    const urls = mode === 'single'
      ? [url.trim()]
      : bulkUrls.split('\n').map(u => u.trim()).filter(Boolean);

    if (urls.length === 0) { setLoading(false); return; }

    try {
      const res = await fetch('/api/admin/seo-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (err: any) {
      setResults([]);
    }
    setLoading(false);
  };

  const exportCsv = () => {
    if (results.length === 0) return;
    const headers = ['URL', 'Status', 'Content im HTML', 'Wörter', 'TTFB', 'Renderzeit', 'H1', 'Title', 'JSON-LD', 'Noindex', 'Score', 'Fehler'];
    const rows = results.map(r => [
      r.url, r.httpStatus, r.seoChecks.contentInRawHtml ? 'Ja' : 'Nein', r.raw.wordCount,
      r.ttfb, r.renderTime, r.seoChecks.h1Present ? 'Ja' : 'Nein', r.seoChecks.titlePresent ? 'Ja' : 'Nein',
      r.seoChecks.jsonLdPresent ? 'Ja' : 'Nein', r.seoChecks.noindexDetected ? 'Ja' : 'Nein', r.score, r.errors.join('; '),
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `seo-debug-${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#f8fafc', margin: '0 0 4px' }}>SEO Debug Dashboard</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 24px' }}>Simuliert exakt, was Googlebot beim Crawlen sieht.</p>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setMode('single')}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, background: mode === 'single' ? '#0ea5e9' : '#1e293b', color: mode === 'single' ? '#fff' : '#94a3b8' }}
          >
            Einzel-URL
          </button>
          <button
            onClick={() => setMode('bulk')}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, background: mode === 'bulk' ? '#0ea5e9' : '#1e293b', color: mode === 'bulk' ? '#fff' : '#94a3b8' }}
          >
            Bulk-Modus
          </button>
        </div>

        {/* Input */}
        {mode === 'single' ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://serien.de/..."
              style={{ flex: 1, padding: '10px 14px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 15, outline: 'none' }}
              onKeyDown={(e) => e.key === 'Enter' && analyze()}
              data-testid="seo-url-input"
            />
            <button
              onClick={analyze}
              disabled={loading}
              style={{ padding: '10px 24px', borderRadius: 6, border: 'none', background: loading ? '#334155' : '#0ea5e9', color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
              data-testid="seo-analyze-btn"
            >
              {loading ? 'Analysiere...' : 'Analyse starten'}
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            <textarea
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              placeholder={"https://serien.de/artikel-1\nhttps://serien.de/artikel-2\nhttps://serien.de/serie/the-boys"}
              rows={6}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'monospace' }}
              data-testid="seo-bulk-input"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={analyze}
                disabled={loading}
                style={{ padding: '10px 24px', borderRadius: 6, border: 'none', background: loading ? '#334155' : '#0ea5e9', color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'wait' : 'pointer' }}
                data-testid="seo-bulk-analyze-btn"
              >
                {loading ? 'Analysiere...' : `${bulkUrls.split('\n').filter(Boolean).length} URLs analysieren`}
              </button>
              {results.length > 0 && (
                <button
                  onClick={exportCsv}
                  style={{ padding: '10px 24px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                  data-testid="seo-export-csv"
                >
                  CSV Export
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>Crawle und rendere...</div>
            <div style={{ fontSize: 14 }}>Googlebot-Simulation läuft. Bei Einzel-URL inkl. Screenshots.</div>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          mode === 'single' || results.length === 1
            ? results.map((r, i) => <SingleResult key={i} result={r} />)
            : <>
                {results.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ color: '#64748b', fontSize: 14 }}>{results.length} URLs geprüft</div>
                    <button onClick={exportCsv} style={{ padding: '6px 16px', borderRadius: 4, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
                      CSV Export
                    </button>
                  </div>
                )}
                <BulkTable results={results} />
              </>
        )}
      </div>
    </div>
  );
}
