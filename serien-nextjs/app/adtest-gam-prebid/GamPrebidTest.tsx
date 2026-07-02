'use client';

/**
 * Prebid.js + GAM (gpt.js) Header-Bidding Test-Client.
 *
 * Standard-Prebid-+-GAM-Muster nach offizieller Prebid-Doku:
 *   1. `pbjs.setConfig({ consentManagement, schain })`
 *   2. `pbjs.addAdUnits(...)` — Yieldlab-Slot
 *   3. `googletag.pubads().disableInitialLoad()` — WICHTIG: GAM soll den
 *      Ad-Call NICHT sofort machen, sondern warten bis Prebid Targeting
 *      gesetzt hat.
 *   4. `pbjs.requestBids({ bidsBackHandler })`
 *   5. Im bidsBackHandler:
 *        - `pbjs.setTargetingForGPTAsync()` — schreibt hb_pb, hb_bidder,
 *          hb_adid etc auf den GAM-Slot
 *        - `googletag.pubads().refresh()` — löst dann den GAM-Ad-Call aus,
 *          der die Targeting-Werte kennt und die richtige Line-Item findet
 *   6. GAM lädt das Prebid-Universal-Creative → das rendert den
 *      Yieldlab-Bid ins DOM.
 *
 * Timeout-Safety: Wenn Prebid nach PREBID_TIMEOUT_MS keinen Bid liefert,
 * feuern wir `pubads().refresh()` trotzdem — GAM zeigt dann seine House-
 * Ads / andere Line-Items ohne hb_-Targeting.
 */

import { useEffect, useRef, useState } from 'react';
import {
  YIELDLAB_TEST_SLOT,
  PREBID_SCHAIN_CONFIG,
  PREBID_TIMEOUT_MS,
} from '@/lib/prebid-config';

const GAM_AD_UNIT_PATH = '/22479145478/yieldlab-test';
const GAM_SLOT_DIV_ID = 'div-gpt-ad-1782989965569-0';
const GAM_SLOT_SIZE: [number, number] = [300, 250];

// Der DIV-ID muss identisch mit dem GAM-Slot-DivId sein — Prebid setzt
// Targeting per `adUnitCode` und Prebid mappt adUnitCode → GAM-DivId
// (Standard-Mapping in `setTargetingForGPTAsync`).
const PREBID_AD_UNIT_CODE = GAM_SLOT_DIV_ID;

interface PbjsBid {
  bidder: string;
  cpm: number;
  currency: string;
  adId: string;
  adUnitCode: string;
  width: number;
  height: number;
}

interface PbjsApi {
  que: Array<() => void>;
  setConfig: (cfg: Record<string, unknown>) => void;
  addAdUnits: (units: unknown[]) => void;
  requestBids: (req: {
    timeout: number;
    adUnitCodes?: string[];
    bidsBackHandler: () => void;
  }) => void;
  setTargetingForGPTAsync: (codes?: string[]) => void;
  getHighestCpmBids: (code?: string) => PbjsBid[];
  getBidResponses: () => Record<string, { bids: PbjsBid[] }>;
}

interface GptSlot {
  getSlotElementId: () => string;
}
interface SlotRenderEndedEvent {
  slot: GptSlot;
  isEmpty: boolean;
  size: [number, number] | null;
  lineItemId: number | null;
  campaignId: number | null;
  advertiserId: number | null;
  creativeId: number | null;
}
interface GptPubAdsService {
  disableInitialLoad: () => void;
  enableSingleRequest: () => void;
  refresh: (slots?: unknown[]) => void;
  addEventListener: (event: string, cb: (e: SlotRenderEndedEvent) => void) => void;
  setPrivacySettings?: (s: Record<string, unknown>) => void;
}
interface GptSlotBuilder {
  addService: (svc: GptPubAdsService) => GptSlotBuilder;
}
interface GoogleTag {
  cmd: Array<() => void>;
  defineSlot: (path: string, size: [number, number], divId: string) => GptSlotBuilder | null;
  pubads: () => GptPubAdsService;
  enableServices: () => void;
  display: (divId: string) => void;
}

declare global {
  interface Window {
    pbjs?: PbjsApi;
    googletag?: GoogleTag;
  }
}

type Status =
  | 'idle'
  | 'loading-scripts'
  | 'waiting-consent'
  | 'configuring-prebid'
  | 'configuring-gam'
  | 'requesting-bids'
  | 'no-bid'
  | 'targeting-set'
  | 'gam-refreshing'
  | 'rendered-filled'
  | 'rendered-empty'
  | 'error';

interface TcData {
  gdprApplies?: boolean;
  tcString?: string;
  eventStatus?: string;
  cmpStatus?: string;
}

export default function GamPrebidTest() {
  const [status, setStatus] = useState<Status>('idle');
  const [statusDetail, setStatusDetail] = useState<string>('');
  const [prebidWinner, setPrebidWinner] = useState<PbjsBid | null>(null);
  const [renderResult, setRenderResult] = useState<SlotRenderEndedEvent | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    const init = async () => {
      try {
        // Stubs für pbjs / googletag anlegen bevor die Scripts loaden.
        window.pbjs = window.pbjs || ({ que: [] } as unknown as PbjsApi);
        window.googletag = window.googletag || ({ cmd: [] } as unknown as GoogleTag);

        setStatus('loading-scripts');
        setStatusDetail('lade prebid.js + gpt.js parallel …');
        await Promise.all([
          loadScript('/prebid.js', 'data-loader-src'),
          loadScript(
            'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
            'data-loader-src',
            { crossorigin: 'anonymous' },
          ),
        ]);
        if (cancelled) return;
        if (!window.pbjs || !window.googletag) {
          throw new Error('pbjs oder googletag nicht verfügbar nach Script-Load');
        }

        // Consent abwarten — GAM+Prebid ohne TCF-String läuft nur mit NPA.
        setStatus('waiting-consent');
        setStatusDetail('warte auf IAB-TCF __tcfapi …');
        const tcData = await waitForTcfConsent(8000);
        if (cancelled) return;
        console.log('[gam-prebid] Consent config loaded', {
          gdprApplies: tcData?.gdprApplies,
          tcStringLen: tcData?.tcString?.length ?? 0,
        });

        // === PREBID SETUP ===
        setStatus('configuring-prebid');
        setStatusDetail('pbjs.setConfig + addAdUnits …');
        const pbjs = window.pbjs!;
        pbjs.que = pbjs.que || [];
        pbjs.que.push(() => {
          pbjs.setConfig({
            debug: false,
            consentManagement: {
              gdpr: { cmpApi: 'iab', timeout: 8000, defaultGdprScope: true },
            },
            schain: PREBID_SCHAIN_CONFIG,
            enableTIDs: true,
          });
          pbjs.addAdUnits([
            {
              code: PREBID_AD_UNIT_CODE,
              mediaTypes: { banner: { sizes: [YIELDLAB_TEST_SLOT.size] } },
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
          ]);
          console.log('[gam-prebid] Prebid adUnit registered', PREBID_AD_UNIT_CODE);
        });

        // === GAM SETUP ===
        setStatus('configuring-gam');
        setStatusDetail('gpt.defineSlot + disableInitialLoad …');
        const gtag = window.googletag!;
        gtag.cmd.push(() => {
          const slot = gtag
            .defineSlot(GAM_AD_UNIT_PATH, GAM_SLOT_SIZE, GAM_SLOT_DIV_ID)
            ?.addService(gtag.pubads());
          if (!slot) {
            console.error('[gam-prebid] defineSlot returned null');
            setStatus('error');
            setStatusDetail('defineSlot lieferte null.');
            return;
          }

          // KRITISCH: disableInitialLoad() — sonst würde GAM sofort einen
          // Ad-Call machen, bevor Prebid seinen Winner als hb_-Targeting
          // gesetzt hat. Später triggern wir den Call manuell via refresh().
          gtag.pubads().disableInitialLoad();
          gtag.pubads().enableSingleRequest();

          // NPA-Fallback wenn kein CMP Consent.
          if (!tcData || !tcData.tcString) {
            gtag.pubads().setPrivacySettings?.({
              nonPersonalizedAds: true,
              restrictDataProcessing: true,
            });
          }

          gtag.pubads().addEventListener('slotRenderEnded', (e: SlotRenderEndedEvent) => {
            if (cancelled) return;
            if (e.slot.getSlotElementId() !== GAM_SLOT_DIV_ID) return;
            console.log('[gam-prebid] slotRenderEnded', e);
            setRenderResult(e);
            if (e.isEmpty) {
              setStatus('rendered-empty');
              setStatusDetail(
                'GAM lieferte KEIN Creative (isEmpty=true). Ursachen: Line-Item nicht aktiv, kein hb_pb-Targeting-Match, Yieldlab kein Bid.',
              );
            } else {
              setStatus('rendered-filled');
              setStatusDetail(
                `Creative ausgeliefert — lineItemId=${e.lineItemId}, advertiserId=${e.advertiserId}, size=${JSON.stringify(e.size)}`,
              );
            }
          });

          gtag.enableServices();
          // display() reserviert den Container aber macht KEINEN Ad-Call
          // (wegen disableInitialLoad). Der Ad-Call passiert erst später
          // per pubads().refresh() nach Prebid-Auction.
          gtag.display(GAM_SLOT_DIV_ID);
          console.log('[gam-prebid] GAM slot defined + display called (initial load disabled)');
        });

        // === PREBID AUCTION → GAM REFRESH ===
        setStatus('requesting-bids');
        setStatusDetail(`Prebid-Auction läuft (timeout ${PREBID_TIMEOUT_MS} ms) …`);
        pbjs.que.push(() => {
          pbjs.requestBids({
            timeout: PREBID_TIMEOUT_MS,
            adUnitCodes: [PREBID_AD_UNIT_CODE],
            bidsBackHandler: () => {
              if (cancelled) return;
              try {
                const winners = pbjs.getHighestCpmBids(PREBID_AD_UNIT_CODE);
                const responses = pbjs.getBidResponses();
                console.log('[gam-prebid] Prebid responses:', responses);
                console.log('[gam-prebid] Prebid winners:', winners);

                if (winners && winners.length > 0) {
                  setPrebidWinner(winners[0]);
                } else {
                  setStatus('no-bid');
                  setStatusDetail('Prebid: kein Yieldlab-Bid — GAM wird ohne hb_-Targeting geladen.');
                }

                // Targeting IMMER an GAM übergeben (auch bei no-bid, dann sind
                // die Keys leer und GAM matched keine Prebid-Line-Item — das ist OK).
                pbjs.setTargetingForGPTAsync([PREBID_AD_UNIT_CODE]);
                setStatus('targeting-set');

                // Jetzt GAM den Ad-Call auslösen lassen.
                setStatus('gam-refreshing');
                setStatusDetail('googletag.pubads().refresh() — GAM lädt jetzt Creative …');
                window.googletag!.cmd.push(() => {
                  window.googletag!.pubads().refresh();
                });
              } catch (err) {
                console.error('[gam-prebid] bidsBackHandler error', err);
                setStatus('error');
                setStatusDetail(String(err instanceof Error ? err.message : err));
              }
            },
          });
        });
      } catch (err) {
        console.error('[gam-prebid] init error', err);
        if (!cancelled) {
          setStatus('error');
          setStatusDetail(String(err instanceof Error ? err.message : err));
        }
      }
    };

    init();
    return () => {
      cancelled = true;
    };
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
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>
        Prebid + GAM + Yieldlab — Header Bidding Test
      </h1>
      <p style={{ color: '#555', marginBottom: 24, fontSize: 14 }}>
        Prebid.js macht die Yieldlab-Auction im Client, GAM liefert via Prebid
        Universal Creative aus (SafeFrame-safe). Ad-Unit: <code>{GAM_AD_UNIT_PATH}</code>
      </p>

      <div
        data-testid="gam-prebid-status"
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
        <div><strong>Status:</strong> {status}</div>
        <div><strong>Detail:</strong> {statusDetail || '—'}</div>
        <div style={{ marginTop: 6 }}>
          <strong>Prebid:</strong> adUnit=<code>{PREBID_AD_UNIT_CODE}</code> ·{' '}
          bidder=<code>yieldlab</code> ·{' '}
          slotId=<code>{YIELDLAB_TEST_SLOT.adslotId}</code>
        </div>
        <div>
          <strong>GAM:</strong> path=<code>{GAM_AD_UNIT_PATH}</code> ·{' '}
          divId=<code>{GAM_SLOT_DIV_ID}</code> ·{' '}
          size={GAM_SLOT_SIZE[0]}×{GAM_SLOT_SIZE[1]}
        </div>
        {prebidWinner && (
          <div style={{ marginTop: 8, color: '#0a7' }}>
            🎯 Prebid Winner: {prebidWinner.bidder} @ {prebidWinner.cpm} {prebidWinner.currency}
            (adId={prebidWinner.adId})
          </div>
        )}
        {renderResult && !renderResult.isEmpty && (
          <div data-testid="gam-prebid-rendered-filled" style={{ marginTop: 4, color: '#0a7' }}>
            🏆 GAM Line-Item: lineItemId={renderResult.lineItemId},
            campaignId={renderResult.campaignId}, advertiserId={renderResult.advertiserId}
          </div>
        )}
        {renderResult && renderResult.isEmpty && (
          <div style={{ marginTop: 4, color: '#a70' }}>
            ⚠️  isEmpty=true — kein Fill von GAM.
          </div>
        )}
      </div>

      <div
        id={GAM_SLOT_DIV_ID}
        data-testid="gam-prebid-slot"
        style={{
          minWidth: `${GAM_SLOT_SIZE[0]}px`,
          minHeight: `${GAM_SLOT_SIZE[1]}px`,
          border: '1px dashed #999',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#aaa',
          fontSize: 12,
          background: '#fff',
        }}
      >
        Slot · {GAM_SLOT_SIZE[0]}×{GAM_SLOT_SIZE[1]} · wartet auf GAM refresh …
      </div>

      <details style={{ marginTop: 24, fontSize: 12, color: '#555' }}>
        <summary style={{ cursor: 'pointer' }}>Debug-Tipps</summary>
        <ul style={{ lineHeight: 1.6, paddingLeft: 20 }}>
          <li>URL <code>?pbjs_debug=true</code> aktiviert Prebid Verbose-Logging.</li>
          <li><code>pbjs.getBidResponses()</code> — alle Prebid-Responses in DevTools</li>
          <li><code>googletag.pubads().getSlots()[0].getTargetingKeys()</code> — hb_-Keys am GAM-Slot</li>
          <li>URL <code>?google_console</code> öffnet GAM Publisher Console (Alt+P falls Popup)</li>
          <li>
            Falls <code>rendered-empty</code>: GAM-Line-Item Targeting prüfen — muss{' '}
            <code>hb_pb IS PRESENT</code> haben, Werbebuchung + Creative aktiv.
          </li>
        </ul>
      </details>
    </div>
  );
}

// --- Helpers ---------------------------------------------------------------

function loadScript(
  src: string,
  attrName = 'data-loader-src',
  extraAttrs: Record<string, string> = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Existing loader tag?
    const existing = document.querySelector(`script[${attrName}="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      // Check for global-ready signal per script.
      if (src.includes('prebid') && window.pbjs && Array.isArray(window.pbjs.que)) {
        resolve();
        return;
      }
      if (src.includes('gpt.js') && window.googletag && Array.isArray(window.googletag.cmd)) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.setAttribute(attrName, src);
    for (const [k, v] of Object.entries(extraAttrs)) s.setAttribute(k, v);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function waitForTcfConsent(timeoutMs: number): Promise<TcData | null> {
  return new Promise((resolve) => {
    const start = Date.now();

    // Funding Choices installiert `__tcfapi` async — erst pollen bis's da ist.
    const waitForApi = () => {
      if (typeof (window as unknown as { __tcfapi?: unknown }).__tcfapi === 'function') {
        startTcDataPoll();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        console.warn('[gam-prebid] window.__tcfapi never installed within', timeoutMs, 'ms');
        resolve(null);
        return;
      }
      setTimeout(waitForApi, 100);
    };

    const startTcDataPoll = () => {
      const tcfapi = (window as unknown as {
        __tcfapi: (cmd: string, ver: number, cb: (d: TcData, ok: boolean) => void) => void;
      }).__tcfapi;

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
            resolve(data || null);
            return;
          }
          setTimeout(poll, 200);
        });
      };
      poll();
    };

    waitForApi();
  });
}
