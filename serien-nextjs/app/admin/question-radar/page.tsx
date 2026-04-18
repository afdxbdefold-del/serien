'use client';

import { useState, useMemo, useRef } from 'react';

type Competition = 'Low' | 'Medium' | 'High';
interface QuestionItem {
  question: string;
  category: string;
  searchIntent: number;
  discoverPotential: number;
  evergreen: number;
  competition: Competition;
  articleHeadlines: string[];
}

interface RadarResponse {
  topic: string;
  boost: boolean;
  total: number;
  byCategory: Record<string, number>;
  generatedAt: string;
  items: QuestionItem[];
}

const CATEGORIES = [
  'Staffel / Release',
  'Streaming / Availability',
  'Bewertung / Lohnt sich?',
  'Story / Ende erklärt',
  'Cast / Produktion',
  'Empfehlungen',
];

const CATEGORY_COLORS: Record<string, string> = {
  'Staffel / Release': '#06b6d4',
  'Streaming / Availability': '#10b981',
  'Bewertung / Lohnt sich?': '#f59e0b',
  'Story / Ende erklärt': '#a855f7',
  'Cast / Produktion': '#ec4899',
  'Empfehlungen': '#3b82f6',
};

const DAILY_TRACKED = ['Fallout', 'Wednesday', 'Reacher', 'Stranger Things', 'The Boys', 'House of the Dragon'];

function rowKey(r: QuestionItem) {
  return `${r.category}::${r.question}`;
}

export default function QuestionRadarPage() {
  const [topic, setTopic] = useState('');
  const [boost, setBoost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RadarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterLowComp, setFilterLowComp] = useState(false);
  const [filterHighDiscover, setFilterHighDiscover] = useState(false);
  const [filterHighEvergreen, setFilterHighEvergreen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'searchIntent' | 'discoverPotential' | 'evergreen'>('searchIntent');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const run = async (t = topic, b = boost) => {
    if (!t.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    setSelected(new Set());
    try {
      const res = await fetch('/api/admin/question-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, boost: b }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = [...data.items];
    if (filterCategory) rows = rows.filter(r => r.category === filterCategory);
    if (filterLowComp) rows = rows.filter(r => r.competition === 'Low');
    if (filterHighDiscover) rows = rows.filter(r => r.discoverPotential >= 70);
    if (filterHighEvergreen) rows = rows.filter(r => r.evergreen >= 70);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.question.toLowerCase().includes(q));
    }
    rows.sort((a, b) => b[sortBy] - a[sortBy]);
    return rows;
  }, [data, filterCategory, filterLowComp, filterHighDiscover, filterHighEvergreen, search, sortBy]);

  const toggleRow = (r: QuestionItem) => {
    const k = rowKey(r);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    const keys = filtered.map(rowKey);
    const allSelected = keys.length > 0 && keys.every(k => selected.has(k));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) keys.forEach(k => next.delete(k));
      else keys.forEach(k => next.add(k));
      return next;
    });
  };

  const exportRows = (rows: QuestionItem[]) => rows.length ? rows : filtered;

  const exportCsv = () => {
    if (!data) return;
    const source = selected.size > 0 ? filtered.filter(r => selected.has(rowKey(r))) : filtered;
    const rows = [
      ['Question', 'Category', 'SearchIntent', 'DiscoverPotential', 'Evergreen', 'Competition', 'Headline1', 'Headline2', 'Headline3'],
      ...source.map(r => [
        r.question,
        r.category,
        r.searchIntent,
        r.discoverPotential,
        r.evergreen,
        r.competition,
        r.articleHeadlines[0] || '',
        r.articleHeadlines[1] || '',
        r.articleHeadlines[2] || '',
      ]),
    ];
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(csv, `question-radar-${data.topic.replace(/\s+/g, '-')}.csv`, 'text/csv;charset=utf-8');
    showToast(`CSV-Export: ${source.length} Zeilen`);
  };

  const exportJson = () => {
    if (!data) return;
    const source = selected.size > 0 ? filtered.filter(r => selected.has(rowKey(r))) : filtered;
    downloadBlob(
      JSON.stringify({ ...data, items: source }, null, 2),
      `question-radar-${data.topic.replace(/\s+/g, '-')}.json`,
      'application/json'
    );
    showToast(`JSON-Export: ${source.length} Einträge`);
  };

  const copyToClipboard = async (text: string, label = 'Kopiert') => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label}: ${text.substring(0, 48)}${text.length > 48 ? '…' : ''}`);
    } catch {
      showToast('Kopieren fehlgeschlagen');
    }
  };

  const sendToPipeline = async (headline: string) => {
    await copyToClipboard(headline, 'Headline kopiert');
    window.open('/admin/pipeline', '_blank', 'noopener,noreferrer');
  };

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedCount = selected.size;
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(rowKey(r)));

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1c', color: '#e6e9ef', fontFamily: 'ui-sans-serif, system-ui, -apple-system' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>
        <header style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>
            User Question Radar
          </h1>
          <p style={{ color: '#94a3b8', margin: '6px 0 0', fontSize: 14 }}>
            Entdecke reale Suchintentionen zu Serien, Streamern und Franchises — 30 Fragen pro Lauf, kategorisiert und bewertet.
          </p>
        </header>

        {/* Input Card */}
        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #0a0f1c 100%)', border: '1px solid #1e293b', borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && run()}
              placeholder="z.B. Fallout, Wednesday, Netflix, Reacher, Marvel Serien…"
              style={{ flex: '1 1 360px', padding: '12px 16px', background: '#0a0f1c', border: '1px solid #1e293b', borderRadius: 10, color: '#e6e9ef', fontSize: 15, outline: 'none' }}
              data-testid="question-radar-topic-input"
            />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={boost} onChange={e => setBoost(e.target.checked)} data-testid="question-radar-boost-checkbox" />
              🔥 Trend Boost
            </label>
            <button
              onClick={() => run()}
              disabled={loading || !topic.trim()}
              style={{ padding: '12px 24px', background: loading ? '#334155' : 'linear-gradient(90deg, #06b6d4, #22d3ee)', border: 'none', borderRadius: 10, color: '#0a0f1c', fontWeight: 700, fontSize: 14, cursor: loading ? 'wait' : 'pointer', boxShadow: loading ? 'none' : '0 0 20px rgba(6,182,212,0.3)' }}
              data-testid="question-radar-generate-btn"
            >
              {loading ? 'Analysiere…' : 'Generieren'}
            </button>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Daily Tracked:</span>
            {DAILY_TRACKED.map(t => (
              <button
                key={t}
                onClick={() => { setTopic(t); run(t, boost); }}
                style={{ padding: '4px 12px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 999, color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
                data-testid={`question-radar-tracked-${t.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: '#7f1d1d', border: '1px solid #b91c1c', borderRadius: 10, padding: 16, marginBottom: 24, color: '#fecaca' }} data-testid="question-radar-error">
            ❌ {error}
          </div>
        )}

        {loading && (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ display: 'inline-block', width: 48, height: 48, border: '3px solid #1e293b', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: 16 }}>Generiere Fragen für „{topic}"…</div>
          </div>
        )}

        {data && (
          <>
            {/* Category Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
                  style={{
                    background: filterCategory === cat ? '#0f172a' : 'transparent',
                    border: `1px solid ${filterCategory === cat ? CATEGORY_COLORS[cat] : '#1e293b'}`,
                    borderRadius: 12, padding: 16, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  data-testid={`question-radar-category-${cat.split(' / ')[0].toLowerCase()}`}
                >
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cat}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: CATEGORY_COLORS[cat] }}>{data.byCategory[cat] || 0}</div>
                </button>
              ))}
            </div>

            {/* Filters & Actions */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Fragen durchsuchen…"
                style={{ flex: '1 1 220px', padding: 10, background: '#0a0f1c', border: '1px solid #1e293b', borderRadius: 8, color: '#e6e9ef', fontSize: 13 }}
                data-testid="question-radar-search-input"
              />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'searchIntent' | 'discoverPotential' | 'evergreen')}
                style={{ padding: 10, background: '#0a0f1c', border: '1px solid #1e293b', borderRadius: 8, color: '#e6e9ef', fontSize: 13 }}
                data-testid="question-radar-sort-select"
              >
                <option value="searchIntent">Search Intent ↓</option>
                <option value="discoverPotential">Discover ↓</option>
                <option value="evergreen">Evergreen ↓</option>
              </select>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: filterLowComp ? '#10b981' : '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={filterLowComp} onChange={e => setFilterLowComp(e.target.checked)} />
                Low Competition
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: filterHighDiscover ? '#06b6d4' : '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={filterHighDiscover} onChange={e => setFilterHighDiscover(e.target.checked)} />
                High Discover
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: filterHighEvergreen ? '#a855f7' : '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={filterHighEvergreen} onChange={e => setFilterHighEvergreen(e.target.checked)} />
                High Evergreen
              </label>

              <div style={{ flex: '1 1 auto' }} />
              {selectedCount > 0 && (
                <span style={{ color: '#22d3ee', fontSize: 12, fontWeight: 600 }} data-testid="question-radar-selected-count">
                  {selectedCount} ausgewählt
                </span>
              )}
              <button onClick={exportCsv} style={btnSecondary} data-testid="question-radar-export-csv">
                Export CSV{selectedCount > 0 ? ` (${selectedCount})` : ''}
              </button>
              <button onClick={exportJson} style={btnSecondary} data-testid="question-radar-export-json">
                Export JSON{selectedCount > 0 ? ` (${selectedCount})` : ''}
              </button>
            </div>

            {/* Results table */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#1e293b', borderBottom: '1px solid #334155', fontSize: 13, color: '#94a3b8' }}>
                {filtered.length} von {data.total} Fragen — Topic: <strong style={{ color: '#e6e9ef' }}>{data.topic}</strong>
                {data.boost && <span style={{ marginLeft: 8, padding: '2px 8px', background: '#b91c1c', color: '#fff', borderRadius: 4, fontSize: 11 }}>🔥 TREND BOOST</span>}
              </div>
              <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#1e293b', zIndex: 1 }}>
                    <tr>
                      <th style={{ ...thStyle, width: 36 }}>
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleAllFiltered}
                          title="Alle auswählen"
                          data-testid="question-radar-select-all"
                        />
                      </th>
                      <th style={thStyle}>Frage</th>
                      <th style={thStyle}>Kategorie</th>
                      <th style={thStyle}>Intent</th>
                      <th style={thStyle}>Discover</th>
                      <th style={thStyle}>Evergreen</th>
                      <th style={thStyle}>Comp.</th>
                      <th style={thStyle}>Artikel-Headlines</th>
                      <th style={thStyle}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const k = rowKey(r);
                      const isSel = selected.has(k);
                      return (
                        <tr key={k} style={{ borderTop: '1px solid #1e293b', background: isSel ? 'rgba(34,211,238,0.04)' : undefined }} data-testid={`question-radar-row-${i}`}>
                          <td style={{ padding: 12, verticalAlign: 'top' }}>
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => toggleRow(r)}
                              data-testid={`question-radar-row-select-${i}`}
                            />
                          </td>
                          <td style={{ padding: 12, verticalAlign: 'top', maxWidth: 360 }}>
                            <div style={{ fontWeight: 500, color: '#e6e9ef' }}>{r.question}</div>
                          </td>
                          <td style={{ padding: 12, verticalAlign: 'top' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', background: `${CATEGORY_COLORS[r.category]}22`, color: CATEGORY_COLORS[r.category], borderRadius: 999, fontSize: 11, fontWeight: 500 }}>
                              {r.category.split(' / ')[0]}
                            </span>
                          </td>
                          <td style={{ padding: 12, verticalAlign: 'top' }}><ScoreBar value={r.searchIntent} color="#06b6d4" /></td>
                          <td style={{ padding: 12, verticalAlign: 'top' }}><ScoreBar value={r.discoverPotential} color="#10b981" /></td>
                          <td style={{ padding: 12, verticalAlign: 'top' }}><ScoreBar value={r.evergreen} color="#a855f7" /></td>
                          <td style={{ padding: 12, verticalAlign: 'top' }}>
                            <span style={compBadge(r.competition)}>{r.competition}</span>
                          </td>
                          <td style={{ padding: 12, verticalAlign: 'top', color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>
                            {r.articleHeadlines.map((h, idx) => (
                              <div key={idx} style={{ marginBottom: 4, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                <span>• {h}</span>
                                <button
                                  onClick={() => copyToClipboard(h, 'Headline kopiert')}
                                  title="Headline kopieren"
                                  style={iconBtn}
                                  data-testid={`question-radar-copy-headline-${i}-${idx}`}
                                >
                                  📋
                                </button>
                              </div>
                            ))}
                          </td>
                          <td style={{ padding: 12, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => copyToClipboard(r.question, 'Frage kopiert')}
                              style={{ ...btnTiny, marginRight: 4 }}
                              title="Frage kopieren"
                              data-testid={`question-radar-copy-question-${i}`}
                            >
                              📋 Frage
                            </button>
                            <button
                              onClick={() => sendToPipeline(r.articleHeadlines[0] || r.question)}
                              style={btnTinyPrimary}
                              title="Headline kopieren und Pipeline öffnen"
                              data-testid={`question-radar-send-to-pipeline-${i}`}
                            >
                              → Pipeline
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#0f172a', border: '1px solid #22d3ee', color: '#e6e9ef',
            padding: '10px 18px', borderRadius: 10, fontSize: 13,
            boxShadow: '0 0 20px rgba(34,211,238,0.25)', zIndex: 50,
          }}
          data-testid="question-radar-toast"
        >
          {toast}
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 14px', background: '#1e293b', border: '1px solid #334155',
  borderRadius: 8, color: '#e6e9ef', fontSize: 12, fontWeight: 500, cursor: 'pointer',
};

const btnTiny: React.CSSProperties = {
  padding: '4px 8px', background: '#1e293b', border: '1px solid #334155',
  borderRadius: 6, color: '#e6e9ef', fontSize: 11, cursor: 'pointer',
};

const btnTinyPrimary: React.CSSProperties = {
  padding: '4px 10px', background: 'linear-gradient(90deg, #06b6d4, #22d3ee)', border: 'none',
  borderRadius: 6, color: '#0a0f1c', fontSize: 11, fontWeight: 700, cursor: 'pointer',
};

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
  fontSize: 11, padding: '0 4px',
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
};

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ minWidth: 70 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color, marginBottom: 2 }}>{value}</div>
      <div style={{ width: '100%', height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

function compBadge(c: Competition): React.CSSProperties {
  const colors: Record<Competition, { bg: string; fg: string }> = {
    Low: { bg: '#064e3b', fg: '#6ee7b7' },
    Medium: { bg: '#78350f', fg: '#fcd34d' },
    High: { bg: '#7f1d1d', fg: '#fca5a5' },
  };
  const col = colors[c];
  return {
    display: 'inline-block', padding: '2px 10px', background: col.bg, color: col.fg,
    borderRadius: 999, fontSize: 11, fontWeight: 500,
  };
}
