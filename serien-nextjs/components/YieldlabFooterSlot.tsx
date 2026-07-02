'use client';

/**
 * YieldlabFooterSlot — Production-Slot für Yieldlab Header-Bidding via Prebid.js.
 *
 * Ist eine schlanke Variante von `app/adtest-prebid/PrebidTest.tsx` ohne
 * Debug-UI. Mountet auf jeder Public-Page direkt über dem Footer, NUR auf
 * Desktop (`hidden lg:block`-Wrapper im LayoutWrapper). Mobile bleibt
 * unangetastet — auf Mobile läuft AdSense/AdMob mit Funding Choices, dort
 * würde der Yieldlab-Slot mit FC-Vendor-Liste vermutlich keinen Bid bekommen.
 *
 * Was passiert beim Mount:
 *  1. `/prebid.js` (custom gulp-Bundle mit consentManagementTcf + yieldlab-
 *     Adapter) wird einmal pro Page-Load geladen.
 *  2. Wartet auf IAB-TCF-Consent via `window.__tcfapi` (CMP-Switch lädt InMobi
 *     auf Desktop / `/adtest-prebid`, Funding Choices auf Mobile — siehe
 *     `app/layout.tsx`).
 *  3. Schickt 1 Bid-Request an Yieldlab. Bei Bid → Prebid rendert Creative
 *     in den Slot. Bei kein Bid → Wrapper wird via `display:none` versteckt
 *     (Layout-Shift unterdrückt).
 *  4. Kein Auto-Refresh, kein zweiter Auction-Cycle.
 *
 * Slot-Konfig (adslotId/supplyId/size/schain): `lib/prebid-config.ts`.
 */

import { useEffect, useRef } from 'react';
import { YIELDLAB_TEST_SLOT, PREBID_SCHAIN_CONFIG, PREBID_TIMEOUT_MS } from '@/lib/prebid-config';

interface PbjsBid {
  bidder: string;
  cpm: number;
  currency: string;
  adId: string;
}

interface PbjsApi {
  que: Array<() => void>;
  setConfig: (cfg: unknown) => void;
  addAdUnits: (units: unknown[]) => void;
  requestBids: (req: { timeout: number; adUnitCodes?: string[]; bidsBackHandler: () => void }) => void;
  getHighestCpmBids: (code?: string) => PbjsBid[];
  renderAd: (doc: Document, adId: string) => void;
  version?: string;
}

declare global {
  interface Window {
    pbjs?: PbjsApi;
  }
}

interface TcData {
  gdprApplies?: boolean;
  tcString?: string;
  eventStatus?: string;
  cmpStatus?: string;
}

const FOOTER_CONTAINER_ID = 'ad-yieldlab-footer-300x250';

export default function YieldlabFooterSlot() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  useEffect(() => {
    // Strict-Mode in Dev mounts effects 2× — Guard verhindert doppelten
    // Auction-Cycle (Prebid würde sonst „adUnitCode already used" werfen).
    if (initRef.current) return;
    initRef.current = true;

    // Skip auf /adtest-prebid — dort mountet die dedizierte PrebidTest-
    // Komponente, die eigene Prebid-Config setzt. Zwei parallele
    // loadScript()-Calls für /prebid.js können racen und `onerror`
    // fälschlich feuern (dedup via data-attribute reicht nicht wenn beide
    // Effekte im gleichen Tick starten). Der Footer-Slot wird auf dieser
    // Debug-Route eh nicht gebraucht.
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/adtest-prebid')) {
      return;
    }

    let cancelled = false;

    const hideSlot = () => {
      if (wrapperRef.current) wrapperRef.current.style.display = 'none';
    };

    const init = async () => {
      try {
        await loadScript('/prebid.js');
        if (cancelled || !window.pbjs) return;

        const tcData = await waitForTcfConsent(5000);
        // Ohne CMP keinen Bid-Request senden — Yieldlab würde requests
        // ohne TC-String ohnehin droppen.
        if (cancelled) return;
        if (!tcData) {
          hideSlot();
          return;
        }

        const pbjs = window.pbjs;
        pbjs.que = pbjs.que || [];
        pbjs.que.push(() => {
          pbjs.setConfig({
            debug: false,
            consentManagement: {
              gdpr: {
                cmpApi: 'iab',
                timeout: 8000,
                defaultGdprScope: true,
              },
            },
            schain: PREBID_SCHAIN_CONFIG,
            enableTIDs: true,
          });

          pbjs.addAdUnits([
            {
              code: FOOTER_CONTAINER_ID,
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

          pbjs.requestBids({
            timeout: PREBID_TIMEOUT_MS,
            adUnitCodes: [FOOTER_CONTAINER_ID],
            bidsBackHandler: () => {
              if (cancelled) return;
              const winners = pbjs.getHighestCpmBids(FOOTER_CONTAINER_ID);
              if (!winners || winners.length === 0) {
                hideSlot();
                return;
              }
              renderWinningBid(winners[0], pbjs);
            },
          });
        });
      } catch {
        hideSlot();
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="hidden lg:flex w-full justify-center py-6"
      aria-label="Werbung (Prebid/Yieldlab)"
      data-ad-slot-wrapper="yieldlab_footer"
    >
      <div
        id={FOOTER_CONTAINER_ID}
        data-testid="yieldlab-footer-slot"
        style={{ width: YIELDLAB_TEST_SLOT.size[0], minHeight: YIELDLAB_TEST_SLOT.size[1] }}
      />
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

function waitForTcfConsent(timeoutMs: number): Promise<TcData | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    if (typeof (window as unknown as { __tcfapi?: unknown }).__tcfapi !== 'function') {
      resolve(null);
      return;
    }
    const tick = () => {
      try {
        (window as unknown as {
          __tcfapi: (
            cmd: string,
            ver: number,
            cb: (data: TcData, success: boolean) => void,
          ) => void;
        }).__tcfapi('addEventListener', 2, (data: TcData, success: boolean) => {
          if (!success) return;
          if (data?.eventStatus === 'tcloaded' || data?.eventStatus === 'useractioncomplete') {
            resolve(data);
          }
        });
      } catch {
        /* ignore — try again */
      }
      if (Date.now() - start < timeoutMs) {
        setTimeout(tick, 200);
      } else {
        resolve(null);
      }
    };
    tick();
  });
}

function renderWinningBid(winner: PbjsBid, pbjs: PbjsApi) {
  const container = document.getElementById(FOOTER_CONTAINER_ID);
  if (!container) return;
  const iframe = document.createElement('iframe');
  iframe.frameBorder = '0';
  iframe.scrolling = 'no';
  iframe.width = String(YIELDLAB_TEST_SLOT.size[0]);
  iframe.height = String(YIELDLAB_TEST_SLOT.size[1]);
  iframe.setAttribute('marginheight', '0');
  iframe.setAttribute('marginwidth', '0');
  iframe.style.border = '0';
  container.innerHTML = '';
  container.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.close();
  pbjs.renderAd(doc, winner.adId);
}
