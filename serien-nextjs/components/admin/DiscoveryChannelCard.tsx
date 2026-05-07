'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Compass, ChevronRight } from 'lucide-react';

interface ChannelStats {
  channel: string;
  runs: number;
  published: number;
  failed: number;
  skipped: number;
  conversionRate: number;
  lastRun: string | null;
  topFailSteps: { step: string; count: number }[];
}

interface DiscoveryChannelData {
  windowDays: number;
  since: string;
  totalRuns: number;
  totalPublished: number;
  channels: ChannelStats[];
}

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  'rss-direct':         { label: 'RSS-Direct (Screenrant/Collider/…)', color: 'bg-blue-100 text-blue-800' },
  'googlenews':         { label: 'Google News (Discovery)',           color: 'bg-emerald-100 text-emerald-800' },
  'tudum':              { label: 'Netflix Tudum',                     color: 'bg-rose-100 text-rose-800' },
  'tvline-rss':         { label: 'TVLine RSS',                        color: 'bg-purple-100 text-purple-800' },
  'tvline-deep':        { label: 'TVLine Deep-Scraper',               color: 'bg-purple-100 text-purple-800' },
  'screenrant-deep':    { label: 'Screenrant Deep-Scraper',           color: 'bg-blue-100 text-blue-800' },
  'admin-manual':       { label: 'Admin Manual (Pipeline-UI)',        color: 'bg-amber-100 text-amber-800' },
  'replay':             { label: 'Replay-Job',                        color: 'bg-gray-100 text-gray-700' },
  'youtube-trailer':    { label: 'YouTube-Trailer (Streamer-Channels)', color: 'bg-orange-100 text-orange-800' },
  'streamer-aggregator': { label: 'Streamer-Aggregator',              color: 'bg-cyan-100 text-cyan-800' },
  'unknown':            { label: 'Unbekannt (Legacy)',                color: 'bg-gray-100 text-gray-500' },
};

function fmtRelative(iso: string | null): string {
  if (!iso) return '–';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h}h`;
  return `vor ${Math.floor(h / 24)}T`;
}

export default function DiscoveryChannelCard() {
  const [data, setData] = useState<DiscoveryChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = typeof document !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/discovery-channel-stats?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const overallConv = useMemo(() => {
    if (!data || data.totalRuns === 0) return 0;
    return data.totalPublished / data.totalRuns;
  }, [data]);

  if (loading && !data) {
    return (
      <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200" data-testid="discovery-channel-loading">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Discovery-Channel-Stats werden geladen …
        </div>
      </div>
    );
  }
  if (err) {
    return (
      <div className="rounded-2xl bg-red-50 p-6 ring-1 ring-red-200 text-red-700" data-testid="discovery-channel-error">
        Fehler: {err}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-gray-200" data-testid="discovery-channel-card">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Compass className="h-5 w-5 text-emerald-600" />
            Discovery-Channel-Performance
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Woher kommen unsere publizierten Artikel? Letzte {data.windowDays} Tage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="text-sm border rounded-lg px-2 py-1"
            data-testid="discovery-channel-days-select"
          >
            <option value={7}>7T</option>
            <option value={30}>30T</option>
            <option value={90}>90T</option>
          </select>
          <button
            onClick={load}
            className="p-2 hover:bg-gray-100 rounded-lg"
            data-testid="discovery-channel-refresh"
            title="Neu laden"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl bg-gray-50 p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Total Runs</div>
          <div className="text-2xl font-semibold mt-1">{data.totalRuns}</div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3">
          <div className="text-xs text-emerald-700 uppercase tracking-wide">Publiziert</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-800">{data.totalPublished}</div>
        </div>
        <div className="rounded-xl bg-blue-50 p-3">
          <div className="text-xs text-blue-700 uppercase tracking-wide">Conversion</div>
          <div className="text-2xl font-semibold mt-1 text-blue-800">
            {(overallConv * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {data.channels.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-6">
            Keine Pipeline-Runs im Zeitraum.
          </div>
        ) : (
          data.channels.map((c) => {
            const meta = CHANNEL_LABELS[c.channel] || { label: c.channel, color: 'bg-gray-100 text-gray-700' };
            const isOpen = expanded === c.channel;
            return (
              <div
                key={c.channel}
                className="rounded-xl ring-1 ring-gray-200 overflow-hidden"
                data-testid={`discovery-channel-${c.channel}`}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : c.channel)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                >
                  <ChevronRight
                    className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />
                  <span className={`text-xs px-2 py-0.5 rounded-full ${meta.color}`}>
                    {meta.label}
                  </span>
                  <div className="ml-auto flex items-center gap-4 text-sm">
                    <span className="text-gray-500">
                      {c.runs} Runs
                    </span>
                    <span className="font-semibold text-emerald-700">
                      {c.published} publiziert
                    </span>
                    <span className={`font-mono w-14 text-right ${
                      c.conversionRate >= 0.4 ? 'text-emerald-600'
                      : c.conversionRate >= 0.15 ? 'text-amber-600'
                      : 'text-red-600'
                    }`}>
                      {(c.conversionRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 py-3 bg-gray-50 text-sm border-t border-gray-200" data-testid={`discovery-channel-detail-${c.channel}`}>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <Stat label="Erfolgreich" value={c.published} color="text-emerald-700" />
                      <Stat label="Fehler" value={c.failed} color="text-red-700" />
                      <Stat label="Skipped" value={c.skipped} color="text-gray-600" />
                      <Stat label="Letzter Run" value={fmtRelative(c.lastRun)} color="text-gray-700" small />
                    </div>
                    {c.topFailSteps.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">
                          Top Fail-Steps
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {c.topFailSteps.map((f) => (
                            <span
                              key={f.step}
                              className="text-xs px-2 py-0.5 bg-white rounded-full ring-1 ring-gray-200 font-mono"
                            >
                              {f.step} <span className="text-gray-400">×{f.count}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color, small }: { label: string; value: string | number; color: string; small?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-0.5 font-semibold ${small ? 'text-sm' : 'text-lg'} ${color}`}>{value}</div>
    </div>
  );
}
