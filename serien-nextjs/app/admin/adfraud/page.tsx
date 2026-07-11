'use client';

/**
 * Ad-Fraud Firewall Stats-Dashboard.
 *
 * Zeigt Blocks der letzten 24 h / 7 T / 30 T, Top-Länder, Top-Bots.
 * Auto-refresh alle 60 s, nur wenn Tab sichtbar (Neon-Cost).
 */
import { useEffect, useState } from 'react';

interface Stats {
  totals: { last24h: number; last7d: number; last30d: number };
  topReasons: Array<{ reason: string; count: number }>;
  topCountries: Array<{ country: string; count: number }>;
  topBots: Array<{ signal: string; count: number }>;
  daily: Array<{ date: string; count: number }>;
}

export default function AdFraudStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      if (!token) {
        setErr('Nicht eingeloggt — bitte /admin/login öffnen.');
        setLoading(false);
        return;
      }
      const r = await fetch('/api/admin/adfraud-stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: Stats = await r.json();
      setStats(data);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const tick = () => {
      if (document.visibilityState === 'visible') load();
    };
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1100, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Ad-Fraud Firewall</h1>
      <p style={{ color: '#555', fontSize: 13, marginBottom: 24 }}>
        Requests die von der Middleware mit HTTP 204 geblockt wurden. Diese Requests
        haben KEINE HTML-Page gesehen → KEINE Ad-Impression → schützt AdSense-IVT-Rate.
      </p>

      {loading && <div>Lade …</div>}
      {err && <div style={{ color: '#c00' }}>Fehler: {err}</div>}

      {stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            <StatCard label="Letzte 24 h" value={stats.totals.last24h} highlight />
            <StatCard label="Letzte 7 Tage" value={stats.totals.last7d} />
            <StatCard label="Letzte 30 Tage" value={stats.totals.last30d} />
          </div>

          <Section title="Blocks pro Tag (letzte 14 Tage)">
            <TimelineChart data={stats.daily} />
          </Section>

          <Section title="Blockgründe">
            <SimpleTable
              rows={stats.topReasons.map((r) => [r.reason, r.count])}
              headers={['Grund', 'Blocks (30d)']}
            />
          </Section>

          <Section title="Top-Länder">
            <SimpleTable
              rows={stats.topCountries.map((r) => [`${r.country} ${flagFor(r.country)}`, r.count])}
              headers={['Land', 'Blocks (30d)']}
            />
          </Section>

          <Section title="Top-Bot-Signale">
            <SimpleTable
              rows={stats.topBots.map((r) => [r.signal, r.count])}
              headers={['Signal (Regex-Fragment)', 'Blocks (30d)']}
            />
          </Section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: 8,
        padding: 16,
        background: highlight ? '#fff8e0' : '#fff',
      }}
    >
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
        {value.toLocaleString('de-DE')}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 4 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function SimpleTable({ rows, headers }: { rows: Array<[string, number]>; headers: [string, string] }) {
  if (rows.length === 0) return <div style={{ color: '#999', fontSize: 13 }}>Keine Daten</div>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666' }}>{headers[0]}</th>
          <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666' }}>{headers[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td style={{ padding: '4px 8px', fontFamily: 'ui-monospace, monospace' }}>{k}</td>
            <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
              {v.toLocaleString('de-DE')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TimelineChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (data.length === 0) return <div style={{ color: '#999', fontSize: 13 }}>Keine Daten</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
      {data.map((d) => (
        <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
          <div
            title={`${d.date}: ${d.count.toLocaleString('de-DE')} Blocks`}
            style={{
              height: `${Math.max(2, (d.count / max) * 100)}%`,
              background: '#c00',
              borderRadius: 2,
              marginBottom: 4,
            }}
          />
          <div style={{ fontSize: 9, color: '#999' }}>{d.date.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

function flagFor(cc: string): string {
  if (cc.length !== 2) return '';
  const codePoints = cc.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
