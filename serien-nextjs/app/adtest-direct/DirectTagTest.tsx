'use client';

/**
 * Yieldlab Direct-Tag Client-Test.
 *
 * Injiziert den offiziellen AA/YL-Tag ohne jede Prebid-/CMP-Kopplung.
 * Das <script>-Tag wird per document.createElement in einen Container
 * gehängt. Yieldlab-JS führt darin document.write() aus — deshalb muss
 * das Skript SYNCHRON in ein noch offenes Dokument geschrieben werden.
 *
 * Trick: Wir nutzen einen sandboxed iframe (srcDoc), in dem wir das
 * Yieldlab-Script inline ausführen lassen. Damit ist document.write()
 * innerhalb des iframe-Documents sicher, und wir sehen exakt, ob und
 * was Yieldlab zurückliefert.
 */

import { useEffect, useRef, useState } from 'react';

type FetchInfo = {
  status?: number;
  responseSize?: number;
  contentType?: string | null;
  ok?: boolean;
  bodyPreview?: string;
  error?: string;
};

const ADSLOT_ID = '18384401';
const SUPPLY_ID = '35673';

export default function DirectTagTest() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ts, setTs] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'injected' | 'error'>('idle');
  const [fetchInfo, setFetchInfo] = useState<FetchInfo | null>(null);
  const [tcfSummary, setTcfSummary] = useState<string>('—');

  useEffect(() => {
    const stamp = Math.floor(Date.now() / 1000);
    setTs(stamp);

    // 1) TCF-Status auslesen (nur Info, wir warten NICHT darauf)
    try {
      const w = window as unknown as {
        __tcfapi?: (
          cmd: string,
          v: number,
          cb: (d: {
            cmpStatus?: string;
            gdprApplies?: boolean;
            tcString?: string;
            vendor?: { consents?: Record<number, boolean> };
          }, ok: boolean) => void,
        ) => void;
      };
      if (typeof w.__tcfapi === 'function') {
        w.__tcfapi('getTCData', 2, (d, ok) => {
          if (!ok || !d) {
            setTcfSummary('getTCData failed');
            return;
          }
          const v70 = d.vendor?.consents?.[70];
          setTcfSummary(
            `cmpStatus=${d.cmpStatus} · gdpr=${d.gdprApplies} · tcLen=${d.tcString?.length ?? 0} · vendor70=${v70 === undefined ? '—' : String(v70)}`,
          );
        });
      } else {
        setTcfSummary('__tcfapi nicht vorhanden');
      }
    } catch (e) {
      setTcfSummary(`TCF-Fehler: ${String(e)}`);
    }

    // 2) Raw HTTP-Probe des Yieldlab-Endpoints (unabhängig vom iframe),
    //    zeigt sofort ob wir überhaupt eine Response bekommen.
    const url = `https://ad.yieldlab.net/d/${ADSLOT_ID}/${SUPPLY_ID}/?ts=${stamp}`;
    fetch(url, { mode: 'cors', credentials: 'include' })
      .then(async (r) => {
        const text = await r.text().catch(() => '');
        setFetchInfo({
          status: r.status,
          responseSize: text.length,
          contentType: r.headers.get('content-type'),
          ok: r.ok,
          bodyPreview: text.slice(0, 400),
        });
      })
      .catch((err) => {
        // CORS ist zu erwarten; wir loggen es trotzdem
        setFetchInfo({ error: String(err) });
      });

    // 3) Tag im sandboxed iframe injizieren
    const iframe = iframeRef.current;
    if (!iframe) return;

    setStatus('loading');
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body { margin:0; padding:0; background:#fff; color:#111; font-family: system-ui, sans-serif; font-size:12px; }
    .marker { padding:4px 6px; color:#888; }
  </style>
</head>
<body>
  <div class="marker">iframe · Direct-Tag Injection · adslot ${ADSLOT_ID} · supply ${SUPPLY_ID} · ts=${stamp}</div>
  <script type="text/javascript" src="https://ad.yieldlab.net/d/${ADSLOT_ID}/${SUPPLY_ID}/?ts=${stamp}"><\/script>
  <script>
    window.addEventListener('load', () => {
      // Nach Yieldlab-document.write dokumentieren wir das DOM
      try {
        parent.postMessage({
          __direct_tag_debug: true,
          bodyHtmlLen: document.body.innerHTML.length,
          bodyHtmlPreview: document.body.innerHTML.slice(0, 500),
          hasIframe: !!document.querySelector('iframe'),
          hasImg: !!document.querySelector('img'),
          hasIns: !!document.querySelector('ins'),
        }, '*');
      } catch(e) {}
    });
  <\/script>
</body>
</html>`;

    iframe.srcdoc = html;
    setStatus('injected');
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d && typeof d === 'object' && d.__direct_tag_debug) {
        console.log('[direct-tag] iframe body report:', d);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        maxWidth: 820,
        background: '#ffffff',
        color: '#111',
        colorScheme: 'light',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>
        Yieldlab Direct-Tag — Auslieferungs-Test
      </h1>
      <p style={{ color: '#555', marginBottom: 20, fontSize: 13 }}>
        Kein Prebid. Kein AdSense. Kein TheMoneytizer. Nur der offizielle{' '}
        <code>ad.yieldlab.net/d/{ADSLOT_ID}/{SUPPLY_ID}/</code>-Tag von
        Advertising Alliance, in einen sandboxed iframe injiziert.
      </p>

      <div
        style={{
          padding: 12,
          marginBottom: 16,
          border: '1px solid #ddd',
          borderRadius: 8,
          background: '#fafafa',
          fontSize: 12,
          fontFamily: 'ui-monospace, monospace',
          lineHeight: 1.7,
        }}
      >
        <div><strong>adslotId:</strong> {ADSLOT_ID}</div>
        <div><strong>supplyId:</strong> {SUPPLY_ID}</div>
        <div><strong>ts:</strong> {ts ?? '—'}</div>
        <div><strong>iframe-Status:</strong> {status}</div>
        <div><strong>TCF:</strong> {tcfSummary}</div>
        <div style={{ marginTop: 8 }}>
          <strong>fetch()-Probe:</strong>{' '}
          {fetchInfo === null
            ? 'läuft …'
            : fetchInfo.error
            ? `error → ${fetchInfo.error} (CORS erwartet — Netzwerk-Tab prüfen)`
            : `HTTP ${fetchInfo.status} · size=${fetchInfo.responseSize}B · type=${fetchInfo.contentType ?? '—'}`}
        </div>
        {fetchInfo?.bodyPreview && (
          <details style={{ marginTop: 6 }}>
            <summary style={{ cursor: 'pointer' }}>Response-Body (erste 400 Zeichen)</summary>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                margin: '6px 0 0',
                fontSize: 11,
                background: '#fff',
                padding: 6,
                border: '1px solid #eee',
              }}
            >
              {fetchInfo.bodyPreview}
            </pre>
          </details>
        )}
      </div>

      <div
        style={{
          width: 320,
          minHeight: 280,
          border: '1px dashed #999',
          background: '#fff',
        }}
      >
        <iframe
          ref={iframeRef}
          title="Yieldlab Direct Tag Sandbox"
          style={{
            width: 320,
            height: 280,
            border: '0',
            display: 'block',
          }}
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>

      <details style={{ marginTop: 24, fontSize: 12, color: '#555' }}>
        <summary style={{ cursor: 'pointer' }}>Interpretations-Guide</summary>
        <ul style={{ lineHeight: 1.6, paddingLeft: 20 }}>
          <li>
            <strong>Creative im iframe sichtbar</strong> → Yieldlab-Backend liefert.
            Prebid-Integration hat ein separates Problem (schain-Validierung,
            TCF-Vendor 70, Bidder-Timeout, etc.).
          </li>
          <li>
            <strong>iframe leer, fetch HTTP 204 / 0 Bytes</strong> → Yieldlab hat den
            Request angenommen, aber kein Creative — Slot ist entweder inaktiv,
            hat keine Kampagne, oder <code>serien.de</code> ist nicht auf dem
            Slot autorisiert. Ball geht zurück an Advertising Alliance.
          </li>
          <li>
            <strong>fetch HTTP 4xx/5xx</strong> → Slot-Konfiguration bei Yieldlab
            falsch (ID stimmt nicht, oder Supply-ID passt nicht zum Slot).
          </li>
          <li>
            Console-Log <code>[direct-tag] iframe body report</code> zeigt, ob
            das iframe-Body nach dem YL-Skript einen <code>&lt;iframe&gt;</code>{' '}
            oder <code>&lt;img&gt;</code>-Tag hat.
          </li>
        </ul>
      </details>
    </div>
  );
}
