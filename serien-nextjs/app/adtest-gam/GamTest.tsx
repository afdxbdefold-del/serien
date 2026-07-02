'use client';

/**
 * Google Ad Manager (GPT.js) + Yieldlab Test-Client.
 *
 * Client-only. Lädt `securepubads.g.doubleclick.net/tag/js/gpt.js`,
 * wartet auf IAB-TCF-Consent (InMobi CMP via app/layout.tsx), definiert
 * EINEN Slot (`/22479145478/yieldlab-test`, 300×250, `div-gpt-ad-...`)
 * und ruft `googletag.display()` auf.
 *
 * KEIN Prebid auf dieser Seite. Yieldlab liefert hier via GAM-Line-Items,
 * nicht via Header-Bidding — der Test verifiziert dass die GAM-Setup und
 * Yieldlab-Traffic-Sourcing korrekt konfiguriert sind (Publisher-ID, Ad-
 * Unit-Pfad, sellers.json, ads.txt).
 *
 * Ablauf:
 *  1. gpt.js laden
 *  2. `waitForTcfConsent()` — kein Bid-Request ohne TCF-String
 *  3. `googletag.cmd.push(() => defineSlot + enableSingleRequest + enableServices)`
 *  4. `googletag.display(slotId)`
 *  5. Slot-Render-Events loggen (`slotRenderEnded`) → Status im UI updaten
 */

import { useEffect, useRef, useState } from 'react';

const GAM_AD_UNIT_PATH = '/22479145478/yieldlab-test';
const GAM_SLOT_DIV_ID = 'div-gpt-ad-1782989965569-0';
const GAM_SLOT_SIZE: [number, number] = [300, 250];

interface GptSlot {
  getSlotElementId: () => string;
  getAdUnitPath: () => string;
}

interface SlotRenderEndedEvent {
  slot: GptSlot;
  isEmpty: boolean;
  size: [number, number] | null;
  advertiserId: number | null;
  campaignId: number | null;
  creativeId: number | null;
  lineItemId: number | null;
  labelIds: number[] | null;
  sourceAgnosticCreativeId: number | null;
  sourceAgnosticLineItemId: number | null;
}

interface GptPubAdsService {
  enableSingleRequest: () => void;
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
    googletag?: GoogleTag;
  }
}

type Status =
  | 'idle'
  | 'loading-gpt'
  | 'waiting-consent'
  | 'consent-ready'
  | 'defining-slot'
  | 'displayed'
  | 'rendered-filled'
  | 'rendered-empty'
  | 'error';

interface TcData {
  gdprApplies?: boolean;
  tcString?: string;
  eventStatus?: string;
  cmpStatus?: string;
}

export default function GamTest() {
  const [status, setStatus] = useState<Status>('idle');
  const [statusDetail, setStatusDetail] = useState<string>('');
  const [renderResult, setRenderResult] = useState<SlotRenderEndedEvent | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    const init = async () => {
      try {
        // 1) gpt.js laden
        setStatus('loading-gpt');
        setStatusDetail('lade https://securepubads.g.doubleclick.net/tag/js/gpt.js …');
        await loadScript(
          'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
          'crossorigin',
          'anonymous',
        );
        if (cancelled) return;
        // gpt.js legt window.googletag mit `.cmd`-Queue auch VOR dem eigenen
        // load an — wir setzen fallback-Stub bevor gpt.js läuft, damit
        // spätere .cmd.push()-Calls in jedem Fall queuen.
        window.googletag = window.googletag || ({ cmd: [] } as unknown as GoogleTag);
        console.log('[gam-test] gpt.js loaded');

        // 2) IAB-TCF-Consent abwarten (InMobi CMP wird über app/layout.tsx
        //    auf /adtest-* Routen forciert). Kein Bid-Request ohne TCString.
        setStatus('waiting-consent');
        setStatusDetail('warte auf IAB-TCF __tcfapi …');
        const tcData = await waitForTcfConsent(8000);
        if (cancelled) return;
        console.log('[gam-test] Consent config loaded', {
          gdprApplies: tcData?.gdprApplies,
          tcStringLen: tcData?.tcString?.length ?? 0,
        });
        setStatus('consent-ready');
        setStatusDetail(
          tcData
            ? `Consent erhalten (gdprApplies=${tcData.gdprApplies}, tcString.len=${tcData.tcString?.length ?? 0})`
            : 'Kein CMP gefunden — GAM wird trotzdem versucht (non-personalized).',
        );

        // 3) Slot definieren + Services aktivieren
        setStatus('defining-slot');
        setStatusDetail(`defineSlot('${GAM_AD_UNIT_PATH}', ${JSON.stringify(GAM_SLOT_SIZE)}, '${GAM_SLOT_DIV_ID}')`);

        const gtag = window.googletag!;
        gtag.cmd.push(() => {
          const slot = gtag
            .defineSlot(GAM_AD_UNIT_PATH, GAM_SLOT_SIZE, GAM_SLOT_DIV_ID)
            ?.addService(gtag.pubads());

          if (!slot) {
            console.error('[gam-test] defineSlot returned null');
            setStatus('error');
            setStatusDetail('defineSlot lieferte null — Ad-Unit-Pfad / Div-ID prüfen.');
            return;
          }

          // Wenn KEIN CMP geliefert hat, non-personalized signalisieren.
          // Verhindert dass GAM personalisierte Werbung ohne Consent lädt.
          if (!tcData || !tcData.tcString) {
            gtag.pubads().setPrivacySettings?.({ nonPersonalizedAds: true, restrictDataProcessing: true });
          }

          gtag.pubads().enableSingleRequest();

          // Render-Event abfangen — wir wollen wissen ob eine Line-Item
          // ausgeliefert wurde oder ob GAM `isEmpty: true` zurückgibt.
          gtag.pubads().addEventListener('slotRenderEnded', (e: SlotRenderEndedEvent) => {
            if (cancelled) return;
            if (e.slot.getSlotElementId() !== GAM_SLOT_DIV_ID) return;
            console.log('[gam-test] slotRenderEnded', e);
            setRenderResult(e);
            if (e.isEmpty) {
              setStatus('rendered-empty');
              setStatusDetail(
                'GAM lieferte KEIN Creative (isEmpty=true). Ursachen: keine Line-Item aktiv, kein Bid von Yieldlab, oder Consent verweigert.',
              );
            } else {
              setStatus('rendered-filled');
              setStatusDetail(
                `Creative ausgeliefert — lineItemId=${e.lineItemId}, campaignId=${e.campaignId}, advertiserId=${e.advertiserId}, size=${JSON.stringify(e.size)}`,
              );
            }
          });

          gtag.enableServices();
          console.log('[gam-test] enableServices done');

          // 4) Display auslösen
          setStatus('displayed');
          setStatusDetail(`googletag.display('${GAM_SLOT_DIV_ID}') — warte auf slotRenderEnded …`);
          gtag.display(GAM_SLOT_DIV_ID);
        });
      } catch (err) {
        console.error('[gam-test] init error', err);
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
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Google Ad Manager + Yieldlab — Test</h1>
      <p style={{ color: '#555', marginBottom: 24, fontSize: 14 }}>
        Isolierter GPT-Slot — KEIN Prebid, KEIN AdSense, KEIN TheMoneytizer, KEIN Auto-Refresh.
        Ad-Unit: <code>{GAM_AD_UNIT_PATH}</code>
      </p>

      {/* Status-Panel */}
      <div
        data-testid="gam-status"
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
          <strong>adUnitPath:</strong> {GAM_AD_UNIT_PATH} ·{' '}
          <strong>divId:</strong> {GAM_SLOT_DIV_ID} ·{' '}
          <strong>size:</strong> {GAM_SLOT_SIZE[0]}×{GAM_SLOT_SIZE[1]}
        </div>
        {renderResult && !renderResult.isEmpty && (
          <div data-testid="gam-rendered-filled" style={{ marginTop: 8, color: '#0a7' }}>
            🏆 Line-Item ausgeliefert — lineItemId={renderResult.lineItemId},
            campaignId={renderResult.campaignId},
            advertiserId={renderResult.advertiserId}
          </div>
        )}
        {renderResult && renderResult.isEmpty && (
          <div data-testid="gam-rendered-empty" style={{ marginTop: 8, color: '#a70' }}>
            ⚠️  isEmpty=true — Kein Fill von GAM/Yieldlab.
          </div>
        )}
      </div>

      {/* /22479145478/yieldlab-test — GAM rendert das Creative in einen
          iframe innerhalb dieses Divs. Inline-Script per useEffect getriggert
          über `googletag.display()`. */}
      <div
        id={GAM_SLOT_DIV_ID}
        data-testid="gam-slot"
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
        GAM Slot · {GAM_SLOT_SIZE[0]}×{GAM_SLOT_SIZE[1]} · wartet auf display …
      </div>

      <details style={{ marginTop: 24, fontSize: 12, color: '#555' }}>
        <summary style={{ cursor: 'pointer' }}>Debug-Tipps</summary>
        <ul style={{ lineHeight: 1.6, paddingLeft: 20 }}>
          <li>
            <code>googletag.pubads().getSlots()</code> — alle registrierten Slots
          </li>
          <li>
            <code>googletag.pubads().getTargetingKeys()</code> — Custom-Targeting
          </li>
          <li>
            Google Publisher Console: URL-Suffix{' '}
            <code>?google_console</code> öffnet das Debug-Overlay (Alt+P falls Popup blockiert).
          </li>
          <li>
            <code>googletag.openConsole()</code> — Publisher-Console programmatisch
          </li>
          <li>
            Line-Item-Konfig in GAM:{' '}
            <a
              href="https://admanager.google.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#06f' }}
            >
              admanager.google.com
            </a>
            {' '}→ Ad-Unit <code>{GAM_AD_UNIT_PATH}</code>
          </li>
        </ul>
      </details>
    </div>
  );
}

// --- Helpers ---------------------------------------------------------------

function loadScript(src: string, extraAttrName?: string, extraAttrVal?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // gpt.js hat kein einheitliches globales Ready-Flag vor dem load-Event,
    // deshalb dedupen wir nur über data-attribute + src.
    const existing = document.querySelector(`script[data-loader-src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      // Wenn bereits geladen: gpt.js legt window.googletag.cmd an, das
      // reicht als Ready-Signal.
      if (window.googletag && Array.isArray(window.googletag.cmd)) {
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
    s.setAttribute('data-loader-src', src);
    if (extraAttrName && extraAttrVal) s.setAttribute(extraAttrName, extraAttrVal);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function waitForTcfConsent(timeoutMs: number): Promise<TcData | null> {
  return new Promise((resolve) => {
    const start = Date.now();

    // Funding Choices installiert `__tcfapi` async nach Script-Load —
    // erst pollen bis's da ist, DANN Consent-Daten holen.
    const waitForApi = () => {
      if (typeof (window as unknown as { __tcfapi?: unknown }).__tcfapi === 'function') {
        startTcDataPoll();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        console.warn('[gam-test] window.__tcfapi never installed within', timeoutMs, 'ms');
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
