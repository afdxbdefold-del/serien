'use client';

import { useState, useMemo, useEffect } from 'react';

type Competition = 'Low' | 'Medium' | 'High';
type IntentType = 'Informational' | 'Commercial' | 'Navigational' | 'Transactional';
type Format = 'article' | 'reel' | 'carousel' | 'faq';
type Freshness = 'Evergreen' | 'Seasonal' | 'Breaking';
type Trend = 'up' | 'down' | 'flat' | 'new';

interface QuestionItem {
  question: string;
  category: string;
  searchIntent: number;
  discoverPotential: number;
  evergreen: number;
  competition: Competition;
  articleHeadlines: string[];
  intentType: IntentType;
  seoScore: number;
  discoverScore: number;
  socialScore: number;
  monetizationScore: number;
  competitionScore: number;
  freshness: Freshness;
  recommendedFormat: Format;
  trend?: Trend;
  trendDelta?: number;
}

interface RadarResponse {
  topic: string;
  topicKey: string;
  boost: boolean;
  total: number;
  byCategory: Record<string, number>;
  byFormat: Record<Format, number>;
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

const FORMAT_EMOJI: Record<Format, string> = {
  article: '📝',
  reel: '🎬',
  carousel: '🖼️',
  faq: '❓',
};

const INTENT_COLORS: Record<IntentType, string> = {
  Informational: '#60a5fa',
  Commercial: '#22c55e',
  Navigational: '#94a3b8',
  Transactional: '#f97316',
};

const FRESHNESS_COLORS: Record<Freshness, string> = {
  Evergreen: '#a855f7',
  Seasonal: '#f59e0b',
  Breaking: '#ef4444',
};

const DAILY_TRACKED = ['Fallout', 'Wednesday', 'Reacher', 'Stranger Things', 'The Boys', 'House of the Dragon'];

function rowKey(r: QuestionItem) {
  return `${r.category}::${r.question}`;
}

type SortKey = 'seoScore' | 'discoverScore' | 'socialScore' | 'monetizationScore' | 'competitionScore';

export default function QuestionRadarPage() {
  const [topic, setTopic] = useState('');
  const [boost, setBoost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RadarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterFormat, setFilterFormat] = useState<Format | ''>('');
  const [filterIntent, setFilterIntent] = useState<IntentType | ''>('');
  const [filterLowComp, setFilterLowComp] = useState(false);
  const [filterHighMon, setFilterHighMon] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('monetizationScore');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [queueBusy, setQueueBusy] = useState<Set<string>>(new Set());
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const [clusterByCat, setClusterByCat] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const run = async (t = topic, b = boost) => {
    if (!t.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    setSelected(new Set());
    setSavedItems(new Set());
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
    if (filterFormat) rows = rows.filter(r => r.recommendedFormat === filterFormat);
    if (filterIntent) rows = rows.filter(r => r.intentType === filterIntent);
    if (filterLowComp) rows = rows.filter(r => r.competitionScore <= 40);
    if (filterHighMon) rows = rows.filter(r => r.monetizationScore >= 70);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.question.toLowerCase().includes(q));
    }
    rows.sort((a, b) => b[sortBy] - a[sortBy]);
    return rows;
  }, [data, filterCategory, filterFormat, filterIntent, filterLowComp, filterHighMon, search, sortBy]);

  const clustered = useMemo(() => {
    if (!clusterByCat) return [{ key: 'all', label: '', rows: filtered }];
    const groups = new Map<string, QuestionItem[]>();
    for (const row of filtered) {
      const g = groups.get(row.category) || [];
      g.push(row);
      groups.set(row.category, g);
    }
    return CATEGORIES
      .filter(c => groups.has(c))
      .map(c => ({ key: c, label: c, rows: groups.get(c)! }));
  }, [clusterByCat, filtered]);

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

  const queueAction = async (r: QuestionItem, type: 'article' | 'reel' | 'carousel' | 'faq' | 'saved') => {
    if (!data) return;
    const k = rowKey(r) + '::' + type;
    setQueueBusy(prev => new Set(prev).add(k));
    try {
      const res = await fetch('/api/admin/radar/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          topic: data.topic,
          question: r.question,
          headline: r.articleHeadlines[0] || null,
          category: r.category,
          intentType: r.intentType,
          recommendedFormat: r.recommendedFormat,
          seoScore: r.seoScore,
          discoverScore: r.discoverScore,
          socialScore: r.socialScore,
          monetizationScore: r.monetizationScore,
          competitionScore: r.competitionScore,
          freshness: r.freshness,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');

      setSavedItems(prev => new Set(prev).add(rowKey(r)));

      const labels: Record<string, string> = {
        article: 'Artikel-Auftrag erstellt',
        reel: 'Reel-Auftrag erstellt',
        carousel: 'Carousel-Auftrag erstellt',
        faq: 'FAQ-Auftrag erstellt',
        saved: 'Topic gespeichert',
      };
      showToast(`✓ ${labels[type]}`);

      // For article type, also open the pipeline so user can start generation.
      if (type === 'article') {
        await navigator.clipboard.writeText(r.articleHeadlines[0] || r.question);
        window.open('/admin/pipeline', '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      showToast('✗ Fehler: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setQueueBusy(prev => {
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const source = selected.size > 0 ? filtered.filter(r => selected.has(rowKey(r))) : filtered;
    const rows = [
      ['Question', 'Category', 'IntentType', 'SEO', 'Discover', 'Social', 'Monetization', 'Competition', 'Freshness', 'Format', 'Trend', 'Headline1', 'Headline2', 'Headline3'],
      ...source.map(r => [
        r.question, r.category, r.intentType,
        r.seoScore, r.discoverScore, r.socialScore, r.monetizationScore, r.competitionScore,
        r.freshness, r.recommendedFormat, r.trend || '',
        r.articleHeadlines[0] || '', r.articleHeadlines[1] || '', r.articleHeadlines[2] || '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(csv, `radar-${data.topic.replace(/\s+/g, '-')}.csv`, 'text/csv;charset=utf-8');
    showToast(`✓ CSV: ${source.length} Zeilen exportiert`);
  };

  const exportJson = () => {
    if (!data) return;
    const source = selected.size > 0 ? filtered.filter(r => selected.has(rowKey(r))) : filtered;
    downloadBlob(JSON.stringify({ ...data, items: source }, null, 2),
      `radar-${data.topic.replace(/\s+/g, '-')}.json`, 'application/json');
    showToast(`✓ JSON: ${source.length} Einträge`);
  };

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const selectedCount = selected.size;
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(rowKey(r)));

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1c', color: '#e6e9ef', fontFamily: 'ui-sans-serif, system-ui, -apple-system' }}>
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '32px 24px' }}>
        <header style={{ marginBottom: 32 }}>
          <a href="/admin/dashboard" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 12 }} data-testid="back-to-dashboard">← Zurück zum Dashboard</a>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>
            User Question Radar <span style={{ color: '#06b6d4', fontSize: 18, fontWeight: 600 }}>// Content Command Center</span>
          </h1>
          <p style={{ color: '#94a3b8', margin: '6px 0 0', fontSize: 14 }}>
            30 reale User-Intent-Fragen pro Topic · Scoring für SEO, Discover, Social, Monetization · Direkt in Pipeline oder Queue
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
              style={{ padding: '12px 24px', background: loading ? '#334155' : 'linear-gradient(90deg, #06b6d4, #22d3ee)', border: 'none', borderRadius: 10, color: '#0a0f1c', fontWeight: 700, fontSize: 14, cursor: loading ? 'wait' : 'pointer' }}
              data-testid="question-radar-generate-btn"
            >
              {loading ? 'Analysiere…' : 'Generieren'}
            </button>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Daily Tracked:</span>
            {DAILY_TRACKED.map(t => (
              <button key={t} onClick={() => { setTopic(t); run(t, boost); }} style={{ padding: '4px 12px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 999, color: '#94a3b8', fontSize: 12, cursor: 'pointer' }} data-testid={`question-radar-tracked-${t.toLowerCase().replace(/\s+/g, '-')}`}>{t}</button>
            ))}
          </div>
        </div>

        {error && <div style={{ background: '#7f1d1d', border: '1px solid #b91c1c', borderRadius: 10, padding: 16, marginBottom: 24, color: '#fecaca' }} data-testid="question-radar-error">❌ {error}</div>}
        {loading && <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}><div style={{ display: 'inline-block', width: 48, height: 48, border: '3px solid #1e293b', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /><div style={{ marginTop: 16 }}>Generiere Fragen für „{topic}"…</div></div>}

        {data && (
          <>
            {/* Top stats row: Category + Format counts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)} style={{ background: filterCategory === cat ? '#0f172a' : 'transparent', border: `1px solid ${filterCategory === cat ? CATEGORY_COLORS[cat] : '#1e293b'}`, borderRadius: 10, padding: 12, textAlign: 'left', cursor: 'pointer' }} data-testid={`question-radar-category-${cat.split(' / ')[0].toLowerCase()}`}>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2, textTransform: 'uppercase' }}>{cat.split(' / ')[0]}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: CATEGORY_COLORS[cat] }}>{data.byCategory[cat] || 0}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
              {(['article', 'reel', 'carousel', 'faq'] as Format[]).map(fmt => (
                <button key={fmt} onClick={() => setFilterFormat(filterFormat === fmt ? '' : fmt)} style={{ background: filterFormat === fmt ? '#0f172a' : 'transparent', border: `1px solid ${filterFormat === fmt ? '#22d3ee' : '#1e293b'}`, borderRadius: 10, padding: 12, cursor: 'pointer', textAlign: 'left' }} data-testid={`question-radar-format-${fmt}`}>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2, textTransform: 'uppercase' }}>{FORMAT_EMOJI[fmt]} {fmt}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#22d3ee' }}>{data.byFormat?.[fmt] ?? 0}</div>
                </button>
              ))}
            </div>

            {/* Filters & Actions */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Fragen durchsuchen…" style={{ flex: '1 1 200px', padding: 9, background: '#0a0f1c', border: '1px solid #1e293b', borderRadius: 8, color: '#e6e9ef', fontSize: 12 }} data-testid="question-radar-search-input" />
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} style={{ padding: 9, background: '#0a0f1c', border: '1px solid #1e293b', borderRadius: 8, color: '#e6e9ef', fontSize: 12 }} data-testid="question-radar-sort-select">
                <option value="monetizationScore">💰 Monetization ↓</option>
                <option value="seoScore">🔍 SEO ↓</option>
                <option value="discoverScore">📡 Discover ↓</option>
                <option value="socialScore">🎬 Social ↓</option>
                <option value="competitionScore">⚔️ Competition ↓</option>
              </select>
              <select value={filterIntent} onChange={e => setFilterIntent(e.target.value as IntentType | '')} style={{ padding: 9, background: '#0a0f1c', border: '1px solid #1e293b', borderRadius: 8, color: '#e6e9ef', fontSize: 12 }}>
                <option value="">Alle Intents</option>
                <option value="Informational">Informational</option>
                <option value="Commercial">Commercial</option>
                <option value="Navigational">Navigational</option>
                <option value="Transactional">Transactional</option>
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: filterLowComp ? '#10b981' : '#94a3b8', fontSize: 11, cursor: 'pointer' }}><input type="checkbox" checked={filterLowComp} onChange={e => setFilterLowComp(e.target.checked)} />Low Comp</label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: filterHighMon ? '#f59e0b' : '#94a3b8', fontSize: 11, cursor: 'pointer' }}><input type="checkbox" checked={filterHighMon} onChange={e => setFilterHighMon(e.target.checked)} />High $</label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: clusterByCat ? '#06b6d4' : '#94a3b8', fontSize: 11, cursor: 'pointer' }}><input type="checkbox" checked={clusterByCat} onChange={e => setClusterByCat(e.target.checked)} />Cluster</label>

              <div style={{ flex: '1 1 auto' }} />
              {selectedCount > 0 && <span style={{ color: '#22d3ee', fontSize: 12, fontWeight: 600 }} data-testid="question-radar-selected-count">{selectedCount} ausgewählt</span>}
              <button onClick={exportCsv} style={btnSecondary} data-testid="question-radar-export-csv">CSV{selectedCount > 0 ? ` (${selectedCount})` : ''}</button>
              <button onClick={exportJson} style={btnSecondary} data-testid="question-radar-export-json">JSON{selectedCount > 0 ? ` (${selectedCount})` : ''}</button>
            </div>

            {/* Results */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: '#1e293b', borderBottom: '1px solid #334155', fontSize: 12, color: '#94a3b8', display: 'flex', gap: 12, alignItems: 'center' }}>
                <span><strong style={{ color: '#e6e9ef' }}>{filtered.length}</strong> von {data.total} Fragen</span>
                <span>· Topic: <strong style={{ color: '#e6e9ef' }}>{data.topic}</strong></span>
                {data.boost && <span style={{ padding: '2px 8px', background: '#b91c1c', color: '#fff', borderRadius: 4, fontSize: 10 }}>🔥 BOOST</span>}
                <span style={{ marginLeft: 'auto', color: '#64748b' }}>Trend-Basis: letzte 7-30 Tage</span>
              </div>

              <div style={{ maxHeight: '75vh', overflow: 'auto' }}>
                {clustered.map(group => (
                  <div key={group.key}>
                    {group.label && (
                      <div style={{ padding: '8px 16px', background: '#1a2942', borderTop: '1px solid #1e293b', borderBottom: '1px solid #1e293b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: CATEGORY_COLORS[group.label] || '#e6e9ef' }}>
                        {group.label} · {group.rows.length}
                      </div>
                    )}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      {group.key === clustered[0].key && (
                        <thead style={{ position: 'sticky', top: 0, background: '#1e293b', zIndex: 1 }}>
                          <tr>
                            <th style={{ ...thStyle, width: 32 }}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} data-testid="question-radar-select-all" /></th>
                            <th style={thStyle}>Frage</th>
                            <th style={thStyle}>Intent</th>
                            <th style={thStyle}>SEO</th>
                            <th style={thStyle}>Discover</th>
                            <th style={thStyle}>Social</th>
                            <th style={thStyle}>💰</th>
                            <th style={thStyle}>Comp</th>
                            <th style={thStyle}>Fresh</th>
                            <th style={thStyle}>Format</th>
                            <th style={thStyle}>Aktionen</th>
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {group.rows.map((r, i) => {
                          const k = rowKey(r);
                          const isSel = selected.has(k);
                          const isSaved = savedItems.has(k);
                          return (
                            <tr key={k} style={{ borderTop: '1px solid #1e293b', background: isSel ? 'rgba(34,211,238,0.04)' : isSaved ? 'rgba(16,185,129,0.04)' : undefined }} data-testid={`question-radar-row-${i}`}>
                              <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                <input type="checkbox" checked={isSel} onChange={() => toggleRow(r)} />
                              </td>
                              <td style={{ padding: '8px 10px', verticalAlign: 'top', maxWidth: 320 }}>
                                <div style={{ fontWeight: 500, color: '#e6e9ef', lineHeight: 1.35 }}>{r.question}</div>
                                {r.articleHeadlines[0] && (
                                  <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 3, lineHeight: 1.3 }}>
                                    → {r.articleHeadlines[0].substring(0, 80)}
                                  </div>
                                )}
                                {!clusterByCat && (
                                  <span style={{ display: 'inline-block', marginTop: 4, padding: '1px 6px', background: `${CATEGORY_COLORS[r.category]}22`, color: CATEGORY_COLORS[r.category], borderRadius: 4, fontSize: 9.5, fontWeight: 600 }}>{r.category.split(' / ')[0]}</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                <span style={{ padding: '1px 6px', background: `${INTENT_COLORS[r.intentType]}22`, color: INTENT_COLORS[r.intentType], borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{r.intentType.substring(0, 4).toUpperCase()}</span>
                              </td>
                              <td style={{ padding: '8px 10px', verticalAlign: 'top' }}><ScoreBar value={r.seoScore} color="#06b6d4" /></td>
                              <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                <ScoreBar value={r.discoverScore} color="#10b981" />
                                <TrendBadge trend={r.trend} delta={r.trendDelta} />
                              </td>
                              <td style={{ padding: '8px 10px', verticalAlign: 'top' }}><ScoreBar value={r.socialScore} color="#ec4899" /></td>
                              <td style={{ padding: '8px 10px', verticalAlign: 'top' }}><ScoreBar value={r.monetizationScore} color="#f59e0b" /></td>
                              <td style={{ padding: '8px 10px', verticalAlign: 'top' }}><ScoreBar value={r.competitionScore} color="#ef4444" invert /></td>
                              <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                                <span style={{ padding: '1px 6px', background: `${FRESHNESS_COLORS[r.freshness]}22`, color: FRESHNESS_COLORS[r.freshness], borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{r.freshness.substring(0, 4)}</span>
                              </td>
                              <td style={{ padding: '8px 10px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 11 }}>{FORMAT_EMOJI[r.recommendedFormat]} {r.recommendedFormat}</span>
                              </td>
                              <td style={{ padding: '8px 10px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                <RowActions
                                  r={r}
                                  onAction={(type) => queueAction(r, type)}
                                  busy={queueBusy}
                                  rowKeyStr={k}
                                  isSaved={isSaved}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', border: '1px solid #22d3ee', color: '#e6e9ef', padding: '10px 18px', borderRadius: 10, fontSize: 13, boxShadow: '0 0 20px rgba(34,211,238,0.25)', zIndex: 50 }} data-testid="question-radar-toast">{toast}</div>
      )}

      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function RowActions({ r, onAction, busy, rowKeyStr, isSaved }: {
  r: QuestionItem;
  onAction: (type: 'article' | 'reel' | 'carousel' | 'faq' | 'saved') => void;
  busy: Set<string>;
  rowKeyStr: string;
  isSaved: boolean;
}) {
  const isBusy = (type: string) => busy.has(rowKeyStr + '::' + type);
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 220 }}>
      <ActionBtn icon="📝" label="Write" disabled={isBusy('article')} onClick={() => onAction('article')} primary data-testid={`action-article-${rowKeyStr}`} />
      <ActionBtn icon="🎬" label="Reel" disabled={isBusy('reel')} onClick={() => onAction('reel')} />
      <ActionBtn icon="🖼️" label="Carousel" disabled={isBusy('carousel')} onClick={() => onAction('carousel')} />
      <ActionBtn icon="❓" label="FAQ" disabled={isBusy('faq')} onClick={() => onAction('faq')} />
      <ActionBtn icon={isSaved ? '✓' : '🔖'} label={isSaved ? 'Saved' : 'Save'} disabled={isBusy('saved')} onClick={() => onAction('saved')} accent={isSaved} />
    </div>
  );
}

function ActionBtn({ icon, label, onClick, disabled, primary, accent, ...rest }: {
  icon: string; label: string; onClick: () => void; disabled?: boolean; primary?: boolean; accent?: boolean;
  [k: string]: unknown;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        padding: '3px 7px',
        background: primary ? 'linear-gradient(90deg, #06b6d4, #22d3ee)' : accent ? '#064e3b' : '#1e293b',
        border: primary ? 'none' : `1px solid ${accent ? '#10b981' : '#334155'}`,
        borderRadius: 5,
        color: primary ? '#0a0f1c' : accent ? '#6ee7b7' : '#e6e9ef',
        fontSize: 10,
        fontWeight: primary ? 700 : 500,
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      {...rest}
    >
      {icon} {label}
    </button>
  );
}

function ScoreBar({ value, color, invert = false }: { value: number; color: string; invert?: boolean }) {
  // When invert=true (competition), LOW is good — we show lower bar = "easier"
  return (
    <div style={{ minWidth: 48 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: invert ? (value > 60 ? '#ef4444' : value > 40 ? '#f59e0b' : '#10b981') : color, marginBottom: 2 }}>{value}</div>
      <div style={{ width: '100%', height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

function TrendBadge({ trend, delta }: { trend?: Trend; delta?: number }) {
  if (!trend || trend === 'new') {
    return <div style={{ fontSize: 9, color: '#64748b', marginTop: 3, fontWeight: 600 }}>NEW</div>;
  }
  const colors: Record<'up' | 'down' | 'flat', string> = { up: '#10b981', down: '#ef4444', flat: '#64748b' };
  const arrows: Record<'up' | 'down' | 'flat', string> = { up: '↑', down: '↓', flat: '→' };
  return (
    <div style={{ fontSize: 9, color: colors[trend], marginTop: 3, fontWeight: 700 }}>
      {arrows[trend]} {delta && delta > 0 ? `+${delta}` : delta ?? 0} 7d
    </div>
  );
}

const btnSecondary: React.CSSProperties = {
  padding: '7px 12px', background: '#1e293b', border: '1px solid #334155',
  borderRadius: 7, color: '#e6e9ef', fontSize: 11, fontWeight: 500, cursor: 'pointer',
};

const thStyle: React.CSSProperties = {
  padding: '9px 10px', textAlign: 'left', fontSize: 10, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, whiteSpace: 'nowrap',
};
