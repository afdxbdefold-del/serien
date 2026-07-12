'use client';

/**
 * Social-Referrer Truth-Dashboard.
 *
 * Zeigt für jeden angeblichen Social-Referrer (Facebook, X, Instagram, …)
 * ob der Traffic wahrscheinlich ECHT, SUSPICIOUS oder FAKE ist — basierend
 * auf Header-Signalen (Sec-Fetch-*, Client-Hints, In-App-UA-Marker,
 * Referrer-Format).
 *
 * KEIN Blocking — nur Anzeige.
 */
import { useEffect, useState } from 'react';

interface SourceStats {
  source: string;
  total24h: number;
  total7d: number;
  total30d: number;
  real: number;
  suspicious: number;
  fake: number;
}
interface Stats {
  totals: {
    last24h: number;
    last7d: number;
    last30d: number;
    real24h: number;
    suspicious24h: number;
    fake24h: number;
  };
  bySource: SourceStats[];
  topSignals: Array<{ source: string; verdict: string; signals: string; count: number }>;
  topCountries: Array<{ country: string; count: number }>;
  topUaFamilies: Array<{ uaFamily: string; count: number }>;
  daily: Array<{ date: string; real: number; suspicious: number; fake: number }>;
}

const SIGNAL_LABELS: Record<string, string> = {
  bare_ref: 'Nackte Referrer-Domain (kein /l.php, kein t.co)',
  no_sfs: 'Sec-Fetch-Site fehlt bei Chrome-UA',
  no_sfd: 'Sec-Fetch-Dest fehlt bei Chrome-UA',
  no_lang: 'Accept-Language fehlt',
  no_ch_ua: 'Sec-CH-UA fehlt bei Chrome-UA',
  no_ch_mobile: 'Sec-CH-UA-Mobile fehlt bei Mobile-Chrome',
  ua_mismatch_fb: 'FB-Referrer aber kein FB-InApp-UA (FBAN/FBAV)',
  ua_mismatch_ig: 'IG-Referrer aber kein Instagram-UA',
  ua_mismatch_tt: 'TikTok-Referrer aber kein TikTok-UA',
  country_non_dach: 'Non-DACH-Land',
  none: '(keine Fake-Signale)',
};

const SOURCE_EMOJI: Record<string, string> = {
  facebook: 'FB',
  x: 'X',
  instagram: 'IG',
  tiktok: 'TT',
  reddit: 'RD',
  linkedin: 'LI',
  pinterest: 'PT',
  youtube: 'YT',
  whatsapp: 'WA',
  telegram: 'TG',
  snapchat: 'SC',
};

export default function SocialReferrerPage() {
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
      const r = await fetch('/api/admin/social-referrer-stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStats(await r.json());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Polling alle 5 min statt jede Minute (Cost-Optimierung Feb 2026).
    // Admin-Tabs die dauerhaft offen bleiben produzierten sonst 1440
    // Function-Aufrufe pro Tag pro Tab.
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 300000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1200, fontFamily: 'system-ui, sans-serif' }} data-testid="social-referrer-dashboard">
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Social-Referrer Truth-Analyse</h1>
      <p style={{ color: '#555', fontSize: 13, marginBottom: 24 }}>
        Traffic der sich als Facebook / X / Instagram / TikTok / … ausgibt, klassifiziert nach{' '}
        <b>echt</b> vs. <b>verdächtig</b> vs. <b>fake</b> — anhand von HTTP-Header-Signalen (kein
        Blocking, reine Analyse). Aktualisiert alle 60 s.
      </p>

      {loading && <div>Lade …</div>}
      {err && <div style={{ color: '#c00' }}>Fehler: {err}</div>}

      {stats && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 12 }}>
            <StatCard label="Letzte 24 h" value={stats.totals.last24h} />
            <StatCard label="Letzte 7 Tage" value={stats.totals.last7d} />
            <StatCard label="Letzte 30 Tage" value={stats.totals.last30d} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            <MiniStat label="24h ECHT" value={stats.totals.real24h} color="#2b8a3e" />
            <MiniStat label="24h VERDÄCHTIG" value={stats.totals.suspicious24h} color="#e67700" />
            <MiniStat label="24h FAKE" value={stats.totals.fake24h} color="#c92a2a" />
          </div>

          <Section title="Pro Plattform — Real vs. Fake (letzte 30 Tage)">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }} data-testid="source-table">
              <thead>
                <tr>
                  <Th>Plattform</Th>
                  <Th right>24 h</Th>
                  <Th right>7 T</Th>
                  <Th right>30 T</Th>
                  <Th right>Echt</Th>
                  <Th right>Verdächtig</Th>
                  <Th right>Fake</Th>
                  <Th>Anteil</Th>
                </tr>
              </thead>
              <tbody>
                {stats.bySource.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 12, color: '#999' }}>
                      Noch keine Daten — sobald Traffic mit Social-Referrer eingeht, füllt sich das hier.
                    </td>
                  </tr>
                )}
                {stats.bySource.map((s) => (
                  <tr key={s.source}>
                    <Td>
                      <b>{SOURCE_EMOJI[s.source] || '?'}</b> {s.source}
                    </Td>
                    <Td right mono>{s.total24h.toLocaleString('de-DE')}</Td>
                    <Td right mono>{s.total7d.toLocaleString('de-DE')}</Td>
                    <Td right mono>{s.total30d.toLocaleString('de-DE')}</Td>
                    <Td right mono style={{ color: '#2b8a3e' }}>{s.real.toLocaleString('de-DE')}</Td>
                    <Td right mono style={{ color: '#e67700' }}>{s.suspicious.toLocaleString('de-DE')}</Td>
                    <Td right mono style={{ color: '#c92a2a' }}>{s.fake.toLocaleString('de-DE')}</Td>
                    <Td>
                      <VerdictBar real={s.real} suspicious={s.suspicious} fake={s.fake} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Warum wurde etwas als 'fake' oder 'verdächtig' eingestuft? (Top-Signal-Kombinationen 30 T)">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <Th>Plattform</Th>
                  <Th>Verdict</Th>
                  <Th>Signale</Th>
                  <Th right>Hits</Th>
                </tr>
              </thead>
              <tbody>
                {stats.topSignals.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 12, color: '#999' }}>Keine Auffälligkeiten.</td></tr>
                )}
                {stats.topSignals.map((s, i) => (
                  <tr key={i}>
                    <Td><b>{SOURCE_EMOJI[s.source] || '?'}</b> {s.source}</Td>
                    <Td>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s.verdict === 'fake' ? '#c92a2a' : '#e67700', color: '#fff' }}>
                        {s.verdict}
                      </span>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(s.signals || 'none').split('|').map((code) => (
                          <span key={code} title={SIGNAL_LABELS[code] || code} style={{ padding: '1px 6px', background: '#f1f3f5', borderRadius: 3, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
                            {code}
                          </span>
                        ))}
                      </div>
                    </Td>
                    <Td right mono>{s.count.toLocaleString('de-DE')}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
              <summary style={{ cursor: 'pointer' }}>Was bedeuten die Signal-Codes?</summary>
              <table style={{ marginTop: 8, fontSize: 12 }}>
                <tbody>
                  {Object.entries(SIGNAL_LABELS).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: '2px 12px 2px 0', fontFamily: 'ui-monospace, monospace' }}>{k}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </Section>

          <Section title="Timeline letzte 14 Tage (gestapelt)">
            <StackedChart data={stats.daily} />
          </Section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <Section title="Top-Länder">
              <SimpleTable
                rows={stats.topCountries.map((r) => [`${r.country} ${flagFor(r.country)}`, r.count])}
                headers={['Land', 'Hits (30d)']}
              />
            </Section>
            <Section title="Top-UA-Families">
              <SimpleTable
                rows={stats.topUaFamilies.map((r) => [r.uaFamily, r.count])}
                headers={['UA-Family', 'Hits (30d)']}
              />
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, background: '#fff' }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
        {value.toLocaleString('de-DE')}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ border: `2px solid ${color}`, borderRadius: 8, padding: 12, background: '#fff' }}>
      <div style={{ fontSize: 11, color, marginBottom: 4, fontWeight: 700, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
        {value.toLocaleString('de-DE')}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 15, marginBottom: 12, borderBottom: '1px solid #eee', paddingBottom: 4 }}>{title}</h2>
      {children}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{ textAlign: right ? 'right' : 'left', padding: '6px 8px', borderBottom: '1px solid #eee', color: '#666', fontWeight: 600, fontSize: 12 }}>
      {children}
    </th>
  );
}

function Td({ children, right, mono, style }: { children: React.ReactNode; right?: boolean; mono?: boolean; style?: React.CSSProperties }) {
  return (
    <td
      style={{
        padding: '6px 8px',
        textAlign: right ? 'right' : 'left',
        fontFamily: mono ? 'ui-monospace, monospace' : undefined,
        borderBottom: '1px solid #f5f5f5',
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function VerdictBar({ real, suspicious, fake }: { real: number; suspicious: number; fake: number }) {
  const total = real + suspicious + fake;
  if (total === 0) return <span style={{ color: '#bbb' }}>—</span>;
  const pctReal = (real / total) * 100;
  const pctSus = (suspicious / total) * 100;
  const pctFake = (fake / total) * 100;
  return (
    <div style={{ display: 'flex', height: 12, borderRadius: 3, overflow: 'hidden', minWidth: 140 }}>
      <div style={{ width: `${pctReal}%`, background: '#2b8a3e' }} title={`Echt: ${pctReal.toFixed(1)}%`} />
      <div style={{ width: `${pctSus}%`, background: '#e67700' }} title={`Verdächtig: ${pctSus.toFixed(1)}%`} />
      <div style={{ width: `${pctFake}%`, background: '#c92a2a' }} title={`Fake: ${pctFake.toFixed(1)}%`} />
    </div>
  );
}

function StackedChart({ data }: { data: Array<{ date: string; real: number; suspicious: number; fake: number }> }) {
  if (data.length === 0) return <div style={{ color: '#999', fontSize: 13 }}>Keine Daten</div>;
  const max = Math.max(...data.map((d) => d.real + d.suspicious + d.fake), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 }}>
        {data.map((d) => {
          const total = d.real + d.suspicious + d.fake;
          const h = (total / max) * 100;
          return (
            <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
              <div
                title={`${d.date}\nEcht: ${d.real} / Verdächtig: ${d.suspicious} / Fake: ${d.fake}`}
                style={{ height: `${Math.max(2, h)}%`, borderRadius: 2, marginBottom: 4, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
              >
                {d.fake > 0 && <div style={{ flex: d.fake, background: '#c92a2a' }} />}
                {d.suspicious > 0 && <div style={{ flex: d.suspicious, background: '#e67700' }} />}
                {d.real > 0 && <div style={{ flex: d.real, background: '#2b8a3e' }} />}
              </div>
              <div style={{ fontSize: 9, color: '#999' }}>{d.date.slice(5)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: '#666' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#2b8a3e', marginRight: 4, borderRadius: 2 }} />Echt</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#e67700', marginRight: 4, borderRadius: 2 }} />Verdächtig</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#c92a2a', marginRight: 4, borderRadius: 2 }} />Fake</span>
      </div>
    </div>
  );
}

function SimpleTable({ rows, headers }: { rows: Array<[string, number]>; headers: [string, string] }) {
  if (rows.length === 0) return <div style={{ color: '#999', fontSize: 13 }}>Keine Daten</div>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr><Th>{headers[0]}</Th><Th right>{headers[1]}</Th></tr>
      </thead>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <Td mono>{k}</Td>
            <Td right mono>{v.toLocaleString('de-DE')}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function flagFor(cc: string): string {
  if (cc.length !== 2) return '';
  const codePoints = cc.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
