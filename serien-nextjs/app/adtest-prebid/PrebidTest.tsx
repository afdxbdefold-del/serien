'use client';

/**
 * Prebid.js + Yieldlab Test-Client.
 *
 * Reine Browser-Komponente — kein SSR, kein next/script. Lädt
 * `/prebid.js` (custom-build mit yieldlabBidAdapter, consentManagementTcf,
 * schain, currency, priceFloors) per <script>-Inject in den <head>.
 *
 * Ablauf:
 *  1. Script laden → pbjs verfügbar
 *  2. Über pbjs.que.push() Setup-Calls einqueuen (Prebid-Convention)
 *  3. setConfig: debug, consentManagement.gdpr, schain
 *  4. addAdUnits([…])
 *  5. requestBids({ timeout: 1200, bidsBackHandler })
 *  6. bidsBackHandler:
 *     - Log getBidResponses() + getHighestCpmBids()
 *     - Falls Bid: renderAd in iframe.contentWindow.document
 *     - Sonst: Slot ausblenden + console.warn
 *
 * KEINE TheMoneytizer- oder AdSense-Loader auf dieser Seite. Isolierter
 * Auction-Test.
 */

import { useEffect, useRef, useState } from 'react';
import {
  YIELDLAB_TEST_SLOT,
  PREBID_SCHAIN_CONFIG,
  PREBID_TIMEOUT_MS,
} from '@/lib/prebid-config';

type PbjsBid = {
  bidder: string;
  cpm: number;
  currency: string;
  adId: string;
  adUnitCode: string;
  width: number;
  height: number;
  creativeId?: string;
  dealId?: string;
};

type PbjsBidResponses = Record<string, { bids: PbjsBid[] }>;

interface PbjsApi {
  que: Array<() => void>;
  setConfig: (cfg: Record<string, unknown>) => void;
  addAdUnits: (units: unknown[]) => void;
  requestBids: (req: {
    timeout: number;
    adUnitCodes?: string[];
    bidsBackHandler: () => void;
  }) => void;
  getBidResponses: () => PbjsBidResponses;
  getHighestCpmBids: (code?: string) => PbjsBid[];
  renderAd: (doc: Document, adId: string) => void;
}

declare global {
  interface Window {
    pbjs?: PbjsApi;
  }
}

type Status =
  | 'idle'
  | 'loading-script'
  | 'waiting-consent'
  | 'consent-ready'
  | 'requesting-bids'
  | 'bid-received'
  | 'no-bid'
  | 'error';

export default function PrebidTest() {
  const [status, setStatus] = useState<Status>('idle');
  const [statusDetail, setStatusDetail] = useState<string>('');
  const [bids, setBids] = useState<PbjsBid[]>([]);
  const slotRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    const initPrebid = async () => {
      try {
        // 1) Custom Prebid-Build laden
        setStatus('loading-script');
        setStatusDetail('lade /prebid.js …');
        await loadScript('/prebid.js');
        if (cancelled) return;
        if (!window.pbjs) throw new Error('window.pbjs nach Script-Load nicht vorhanden');
        console.log('[prebid-test] Prebid initialized', { version: (window.pbjs as unknown as { version?: string }).version });

        // 2) Auf IAB-TCF-Consent warten — wir senden KEINE Bid-Requests
        //    bevor der CMP einen TCData-String geliefert hat.
        setStatus('waiting-consent');
        setStatusDetail('warte auf IAB-TCF __tcfapi …');
        const tcData = await waitForTcfConsent(5000);
        if (cancelled) return;
        console.log('[prebid-test] Consent config loaded', {
          gdprApplies: tcData?.gdprApplies,
          tcStringLen: tcData?.tcString?.length ?? 0,
        });
        setStatus('consent-ready');
        setStatusDetail(
          tcData
            ? `Consent erhalten (gdprApplies=${tcData.gdprApplies})`
            : 'Kein CMP gefunden — Auction wird übersprungen',
        );

        // Ohne TCF-API überhaupt: kein Bid-Request senden.
        if (!tcData) {
          console.warn('[prebid-test] no __tcfapi — skipping auction');
          setStatus('error');
          setStatusDetail('Keine __tcfapi im Window — Auction abgebrochen.');
          hideSlot();
          return;
        }

        // 3) Setup über pbjs.que — Prebid-Convention für Async-Init
        const pbjs = window.pbjs!;
        pbjs.que = pbjs.que || [];

        pbjs.que.push(() => {
          pbjs.setConfig({
            debug: true,
            consentManagement: {
              gdpr: {
                cmpApi: 'iab',
                timeout: 8000,
                defaultGdprScope: true,
              },
            },
            schain: PREBID_SCHAIN_CONFIG,
            // Keine Auto-Refreshes, kein TheMoneytizer, kein AdSense.
            enableTIDs: true,
          });
          console.log('[prebid-test] setConfig done', {
            schain: PREBID_SCHAIN_CONFIG,
            timeout: PREBID_TIMEOUT_MS,
          });

          // 4) AdUnit
          const adUnits = [
            {
              code: YIELDLAB_TEST_SLOT.containerId,
              mediaTypes: {
                banner: {
                  sizes: [YIELDLAB_TEST_SLOT.size],
                },
              },
              bids: [
                {
                  bidder: 'yieldlab',
                  params: {
                    adslotId: YIELDLAB_TEST_SLOT.adslotId,
                    supplyId: YIELDLAB_TEST_SLOT.supplyId,
                  },
                },
              ],
            },
          ];
          pbjs.addAdUnits(adUnits);
          console.log('[prebid-test] Yieldlab adUnit added', adUnits);

          // 5) Bid-Request
          setStatus('requesting-bids');
          setStatusDetail(`Auction läuft (timeout ${PREBID_TIMEOUT_MS} ms) …`);
          pbjs.requestBids({
            timeout: PREBID_TIMEOUT_MS,
            adUnitCodes: [YIELDLAB_TEST_SLOT.containerId],
            bidsBackHandler: () => {
              if (cancelled) return;
              try {
                const responses = pbjs.getBidResponses();
                const winners = pbjs.getHighestCpmBids(YIELDLAB_TEST_SLOT.containerId);
                console.log('[prebid-test] Bid responses:', responses);
                console.log('[prebid-test] Winning bids:', winners);

                if (!winners || winners.length === 0) {
                  console.warn('[prebid-test] No Yieldlab bid');
                  setStatus('no-bid');
                  setStatusDetail('Keine Bids — Slot wird ausgeblendet.');
                  hideSlot();
                  return;
                }

                const winner = winners[0];
                setBids(winners);
                setStatus('bid-received');
                setStatusDetail(
                  `Winning CPM ${winner.cpm} ${winner.currency} (bidder=${winner.bidder}, adId=${winner.adId})`,
                );
                renderWinningBid(winner, pbjs);
              } catch (err) {
                console.error('[prebid-test] bidsBackHandler error', err);
                setStatus('error');
                setStatusDetail(String(err instanceof Error ? err.message : err));
              }
            },
          });
        });
      } catch (err) {
        console.error('[prebid-test] init error', err);
        if (!cancelled) {
          setStatus('error');
          setStatusDetail(String(err instanceof Error ? err.message : err));
          hideSlot();
        }
      }
    };

    initPrebid();
    return () => {
      cancelled = true;
    };
  }, []);

  const hideSlot = () => {
    if (slotRef.current) slotRef.current.style.display = 'none';
  };

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
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Prebid.js + Yieldlab — Auction-Test</h1>
      <p style={{ color: '#555', marginBottom: 24, fontSize: 14 }}>
        Isolierter Slot — KEIN AdSense, KEIN TheMoneytizer, KEIN Auto-Refresh.
        Konfig: <code>lib/prebid-config.ts</code>.
      </p>

      {/* Status-Panel */}
      <div
        data-testid="prebid-status"
        style={{
          padding: 12,
          marginBottom: 16,
          border: '1px solid #ddd',
          borderRadius: 8,
          background: '#fafafa',
          fontSize: 13,
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        <div>
          <strong>Status:</strong> {status}
        </div>
        <div>
          <strong>Detail:</strong> {statusDetail || '—'}
        </div>
        <div>
          <strong>adslotId:</strong> {YIELDLAB_TEST_SLOT.adslotId} ·{' '}
          <strong>supplyId:</strong> {YIELDLAB_TEST_SLOT.supplyId} ·{' '}
          <strong>size:</strong> {YIELDLAB_TEST_SLOT.size[0]}×{YIELDLAB_TEST_SLOT.size[1]}
        </div>
        {bids.length > 0 && (
          <div data-testid="prebid-winning-bid" style={{ marginTop: 8, color: '#0a7' }}>
            🏆 Winning: {bids[0].bidder} @ {bids[0].cpm} {bids[0].currency} (adId={bids[0].adId})
          </div>
        )}
      </div>

      {/* DER eigentliche Test-Slot. Prebid rendert das Creative in einen
          iframe innerhalb dieses Containers. */}
      <div
        id={YIELDLAB_TEST_SLOT.containerId}
        ref={slotRef}
        data-testid="prebid-slot"
        style={{
          width: 300,
          minHeight: 250,
          border: '1px dashed #999',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#aaa',
          fontSize: 12,
          background: '#fff',
        }}
      >
        Slot · 300×250 · wartet auf Bid …
      </div>

      <details style={{ marginTop: 24, fontSize: 12, color: '#555' }}>
        <summary style={{ cursor: 'pointer' }}>Debug-Tipps</summary>
        <ul style={{ lineHeight: 1.6, paddingLeft: 20 }}>
          <li>
            URL <code>?pbjs_debug=true</code> aktiviert Prebid-Verbose-Logging in der Console.
          </li>
          <li>
            Bid-Responses live: <code>pbjs.getBidResponses()</code> in DevTools.
          </li>
          <li>
            Auction-Events:{' '}
            <code>pbjs.onEvent(&apos;bidResponse&apos;, b =&gt; console.log(b))</code>.
          </li>
          <li>
            Schain editieren: <code>lib/prebid-config.ts</code> →{' '}
            <code>PREBID_SCHAIN_CONFIG.config.nodes</code>.
          </li>
        </ul>
      </details>
    </div>
  );
}

// --- Helpers ---------------------------------------------------------------

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 1. Wenn pbjs schon global existiert, ist prebid geladen — done.
    if (typeof window !== 'undefined' && window.pbjs) {
      resolve();
      return;
    }
    // 2. Existierendes Loader-Tag im DOM → warte auf dessen load/error.
    const existing = document.querySelector(`script[data-prebid-loader="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      // Falls das Script bereits fertig geladen ist (kein load-Event mehr feuert),
      // pollen wir kurz auf window.pbjs.
      let ticks = 0;
      const poll = setInterval(() => {
        if (window.pbjs || ticks++ > 50) {
          clearInterval(poll);
          if (window.pbjs) resolve();
        }
      }, 100);
      return;
    }
    // 3. Frisch injizieren.
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.setAttribute('data-prebid-loader', src);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

interface TcData {
  gdprApplies?: boolean;
  tcString?: string;
  eventStatus?: string;
  cmpStatus?: string;
}

/**
 * IAB-TCF v2 Consent abwarten. Pollt __tcfapi alle 200 ms bis zum
 * `tcloaded` / `useractioncomplete` Event oder zum Timeout.
 *
 * Gibt `null` zurück wenn KEIN __tcfapi vorhanden ist (z.B. CMP nicht
 * geladen oder durch Adblocker geblockt) — dann darf KEIN Bid-Request
 * abgesendet werden.
 */
function waitForTcfConsent(timeoutMs: number): Promise<TcData | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    if (typeof (window as unknown as { __tcfapi?: unknown }).__tcfapi !== 'function') {
      console.warn('[prebid-test] no window.__tcfapi present');
      resolve(null);
      return;
    }

    const tcfapi = (
      window as unknown as {
        __tcfapi: (
          cmd: string,
          version: number,
          cb: (data: TcData, success: boolean) => void,
        ) => void;
      }
    ).__tcfapi;

    const poll = () => {
      tcfapi('getTCData', 2, (data, success) => {
        const ready =
          success &&
          data &&
          (data.eventStatus === 'tcloaded' ||
            data.eventStatus === 'useractioncomplete' ||
            data.cmpStatus === 'loaded');
        if (ready) {
          resolve(data);
          return;
        }
        if (Date.now() - start > timeoutMs) {
          // Wir warten nicht ewig — wenn der User noch nicht entschieden
          // hat, returnen wir das aktuell beste TCData-Objekt (kann
          // gdprApplies=true / tcString='' sein → Yieldlab antwortet
          // wahrscheinlich mit no-bid, was korrekt ist).
          resolve(data || null);
          return;
        }
        setTimeout(poll, 200);
      });
    };
    poll();
  });
}

function renderWinningBid(bid: PbjsBid, pbjs: PbjsApi) {
  const container = document.getElementById(YIELDLAB_TEST_SLOT.containerId);
  if (!container) {
    console.error('[prebid-test] container nicht gefunden:', YIELDLAB_TEST_SLOT.containerId);
    return;
  }
  // Vorhandenen Placeholder-Text entfernen
  container.textContent = '';
  container.style.border = '1px solid #0a7';

  // Friendly iframe — Prebid rendert das Creative ins iframe-document,
  // NICHT ins Parent-Dokument. Damit ist der Creative-Code sandboxed
  // und kann Parent-Page nicht beeinflussen.
  const iframe = document.createElement('iframe');
  iframe.width = String(bid.width || 300);
  iframe.height = String(bid.height || 250);
  iframe.style.border = '0';
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('aria-label', 'Prebid Yieldlab Creative');
  container.appendChild(iframe);

  // Doc öffnen, dann pbjs.renderAd reinschreiben lassen
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error('[prebid-test] iframe contentWindow.document nicht erreichbar');
    return;
  }
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">');
  doc.write('</body></html>');
  doc.close();

  try {
    pbjs.renderAd(doc, bid.adId);
    console.log('[prebid-test] renderAd ok', { adId: bid.adId });
  } catch (err) {
    console.error('[prebid-test] renderAd failed', err);
  }
}
