'use client';

import { useState, useEffect, useCallback } from 'react';

type QueueType = 'article' | 'reel' | 'carousel' | 'faq' | 'saved';
type QueueStatus = 'pending' | 'done' | 'dismissed';

interface QueueItem {
  id: string;
  type: QueueType;
  status: QueueStatus;
  topic: string;
  question: string;
  headline: string | null;
  category: string | null;
  intentType: string | null;
  recommendedFormat: string | null;
  seoScore: number | null;
  discoverScore: number | null;
  socialScore: number | null;
  monetizationScore: number | null;
  competitionScore: number | null;
  freshness: string | null;
  notes: string | null;
  createdAt: string;
}

const TYPE_META: Record<QueueType, { emoji: string; color: string; label: string }> = {
  article: { emoji: '📝', color: '#06b6d4', label: 'Article' },
  reel: { emoji: '🎬', color: '#ec4899', label: 'Reel' },
  carousel: { emoji: '🖼️', color: '#f59e0b', label: 'Carousel' },
  faq: { emoji: '❓', color: '#a855f7', label: 'FAQ' },
  saved: { emoji: '🔖', color: '#10b981', label: 'Saved' },
};

const STATUS_META: Record<QueueStatus, { color: string; label: string }> = {
  pending: { color: '#f59e0b', label: 'Offen' },
  done: { color: '#10b981', label: 'Erledigt' },
  dismissed: { color: '#64748b', label: 'Verworfen' },
};

export default function ContentQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<{ type: string; status: string; _count: { _all: number } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<QueueType | ''>('');
  const [filterStatus, setFilterStatus] = useState<QueueStatus>('pending');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: filterStatus });
      if (filterType) params.set('type', filterType);
      const res = await fetch(`/api/admin/radar/queue?${params}`);
      const j = await res.json();
      setItems(j.items || []);
      setCounts(j.counts || []);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: QueueStatus) => {
    await fetch('/api/admin/radar/queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    showToast(`✓ ${STATUS_META[status].label}`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Eintrag wirklich löschen?')) return;
    await fetch(`/api/admin/radar/queue?id=${id}`, { method: 'DELETE' });
    showToast('✓ Gelöscht');
    load();
  };

  const sendToPipeline = async (item: QueueItem) => {
    const text = item.headline || item.question;
    await navigator.clipboard.writeText(text);
    showToast('✓ Headline kopiert');
    window.open('/admin/pipeline', '_blank', 'noopener,noreferrer');
  };

  const countFor = (type: QueueType, status: QueueStatus) =>
    counts.find(c => c.type === type && c.status === status)?._count._all || 0;

  const pendingTotal = counts.filter(c => c.status === 'pending').reduce((s, c) => s + c._count._all, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1c', color: '#e6e9ef', fontFamily: 'ui-sans-serif, system-ui, -apple-system' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>
        <header style={{ marginBottom: 32 }}>
          <a href="/admin/dashboard" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none', display: 'inline-block', marginBottom: 12 }} data-testid="back-to-dashboard">← Zurück zum Dashboard</a>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Content Queue</h1>
            {pendingTotal > 0 && (
              <span style={{ padding: '4px 10px', background: '#f59e0b22', color: '#f59e0b', borderRadius: 999, fontSize: 12, fontWeight: 700 }} data-testid="queue-pending-total">
                {pendingTotal} offen
              </span>
            )}
          </div>
          <p style={{ color: '#94a3b8', margin: '6px 0 0', fontSize: 14 }}>
            Alle Aufträge aus dem Question Radar — Articles, Reels, Carousels, FAQs und gespeicherte Topics.
          </p>
        </header>

        {/* Type filter row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => setFilterType('')}
            style={{
              background: filterType === '' ? '#0f172a' : 'transparent',
              border: `1px solid ${filterType === '' ? '#22d3ee' : '#1e293b'}`,
              borderRadius: 10, padding: 12, cursor: 'pointer', textAlign: 'left',
            }}
            data-testid="queue-filter-all"
          >
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2, textTransform: 'uppercase' }}>Alle</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#22d3ee' }}>{pendingTotal}</div>
          </button>
          {(Object.keys(TYPE_META) as QueueType[]).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(filterType === t ? '' : t)}
              style={{
                background: filterType === t ? '#0f172a' : 'transparent',
                border: `1px solid ${filterType === t ? TYPE_META[t].color : '#1e293b'}`,
                borderRadius: 10, padding: 12, cursor: 'pointer', textAlign: 'left',
              }}
              data-testid={`queue-filter-${t}`}
            >
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2, textTransform: 'uppercase' }}>{TYPE_META[t].emoji} {TYPE_META[t].label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: TYPE_META[t].color }}>{countFor(t, 'pending')}</div>
            </button>
          ))}
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content' }}>
          {(['pending', 'done', 'dismissed'] as QueueStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                padding: '6px 14px',
                background: filterStatus === s ? STATUS_META[s].color + '22' : 'transparent',
                border: 'none',
                borderRadius: 7,
                color: filterStatus === s ? STATUS_META[s].color : '#94a3b8',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
              data-testid={`queue-tab-${s}`}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Lädt…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12 }} data-testid="queue-empty">
            Keine Einträge in diesem Filter.
          </div>
        ) : (
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#1e293b', zIndex: 1 }}>
                  <tr>
                    <th style={thStyle}>Typ</th>
                    <th style={thStyle}>Topic · Frage</th>
                    <th style={thStyle}>Headline</th>
                    <th style={thStyle}>Scores (SEO · Disc · Soc · 💰)</th>
                    <th style={thStyle}>Erstellt</th>
                    <th style={thStyle}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const meta = TYPE_META[item.type];
                    return (
                      <tr key={item.id} style={{ borderTop: '1px solid #1e293b' }} data-testid={`queue-item-${item.id}`}>
                        <td style={{ padding: 12, verticalAlign: 'top' }}>
                          <span style={{ padding: '2px 8px', background: meta.color + '22', color: meta.color, borderRadius: 6, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {meta.emoji} {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: 12, verticalAlign: 'top', maxWidth: 360 }}>
                          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>
                            {item.topic}
                            {item.category && <span style={{ marginLeft: 6 }}>· {item.category.split(' / ')[0]}</span>}
                          </div>
                          <div style={{ fontWeight: 500 }}>{item.question}</div>
                        </td>
                        <td style={{ padding: 12, verticalAlign: 'top', maxWidth: 280, color: '#94a3b8' }}>
                          {item.headline || <span style={{ color: '#475569', fontStyle: 'italic' }}>—</span>}
                        </td>
                        <td style={{ padding: 12, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                            <MiniScore v={item.seoScore} c="#06b6d4" />
                            <MiniScore v={item.discoverScore} c="#10b981" />
                            <MiniScore v={item.socialScore} c="#ec4899" />
                            <MiniScore v={item.monetizationScore} c="#f59e0b" bold />
                          </div>
                        </td>
                        <td style={{ padding: 12, verticalAlign: 'top', color: '#64748b', fontSize: 11 }}>
                          {new Date(item.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: 12, verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {item.status === 'pending' && (
                              <>
                                <button onClick={() => sendToPipeline(item)} style={btnPrimary} data-testid={`queue-pipeline-${item.id}`}>→ Pipeline</button>
                                <button onClick={() => updateStatus(item.id, 'done')} style={btnSuccess} data-testid={`queue-done-${item.id}`}>✓ Erledigt</button>
                                <button onClick={() => updateStatus(item.id, 'dismissed')} style={btnGhost} data-testid={`queue-dismiss-${item.id}`}>Verwerfen</button>
                              </>
                            )}
                            {item.status === 'done' && (
                              <button onClick={() => updateStatus(item.id, 'pending')} style={btnGhost}>↺ Zurück</button>
                            )}
                            {item.status === 'dismissed' && (
                              <button onClick={() => updateStatus(item.id, 'pending')} style={btnGhost}>↺ Wiederherstellen</button>
                            )}
                            <button onClick={() => remove(item.id)} style={btnDanger} data-testid={`queue-delete-${item.id}`}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', border: '1px solid #22d3ee', color: '#e6e9ef', padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 50 }} data-testid="queue-toast">
          {toast}
        </div>
      )}
    </div>
  );
}

function MiniScore({ v, c, bold = false }: { v: number | null; c: string; bold?: boolean }) {
  if (v == null) return <span style={{ color: '#475569' }}>—</span>;
  return <span style={{ color: c, fontWeight: bold ? 700 : 500 }}>{v}</span>;
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700,
};
const btnPrimary: React.CSSProperties = {
  padding: '4px 10px', background: 'linear-gradient(90deg, #06b6d4, #22d3ee)', border: 'none',
  borderRadius: 6, color: '#0a0f1c', fontSize: 11, fontWeight: 700, cursor: 'pointer',
};
const btnSuccess: React.CSSProperties = {
  padding: '4px 10px', background: '#064e3b', border: '1px solid #10b981',
  borderRadius: 6, color: '#6ee7b7', fontSize: 11, fontWeight: 600, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '4px 10px', background: '#1e293b', border: '1px solid #334155',
  borderRadius: 6, color: '#94a3b8', fontSize: 11, cursor: 'pointer',
};
const btnDanger: React.CSSProperties = {
  padding: '4px 8px', background: 'transparent', border: '1px solid #7f1d1d',
  borderRadius: 6, color: '#fca5a5', fontSize: 11, cursor: 'pointer',
};
