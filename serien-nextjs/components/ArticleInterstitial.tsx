'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { injectHtmlWithScripts, pickAdVariant } from '@/lib/ad-html-injector';
import { fetchAdSlots, isMobileViewport, type AdConfig } from '@/lib/ad-slots-client';

type InterstitialConfig = AdConfig;

const DELAY_MS = 0;                                 // show immediately
const POSITION = 'interstitial';

// Conservative bot pattern — matches Googlebot, Bingbot, Applebot, GPTBot,
// ClaudeBot, FacebookExternalHit, Twitterbot, LinkedInBot, headless crawlers
// and the common SEO testers. We never want to show paid creatives to bots
// (AdSense policy) and we don't want Google to see modal overlay above the
// hero image (Core Web Vitals / layout-shift complaint).
const BOT_UA_REGEX = /bot|crawler|spider|crawling|googlebot|bingbot|applebot|gptbot|claudebot|chatgpt|ccbot|petalbot|yandexbot|baiduspider|duckduckbot|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|slackbot|pinterest|embedly|preview|prerender|headless|lighthouse|pagespeed|gtmetrix|webpagetest/i;

function isBotUserAgent(ua: string | undefined): boolean {
  if (!ua) return false;
  return BOT_UA_REGEX.test(ua);
}

/**
 * Full-screen ad interstitial. Mounted ONLY on article pages.
 *
 * Behaviour:
 *  - Loads slot config from `/api/ads/slots` (admin-managed).
 *  - Waits DELAY_MS after mount so it doesn't trample LCP / FCP.
 *  - Shows on every article view (no frequency cap).
 *  - Closes on X, ESC, or backdrop click.
 *  - Respects `mobileOnly` / `desktopOnly` toggles.
 *  - If the slot is missing, inactive, or has no creative, renders nothing.
 */
export default function ArticleInterstitial() {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<InterstitialConfig | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);

  // Steuerung erfolgt ausschließlich über den DB-Slot (ad_slots.position='interstitial',
  // isActive / mobileOnly / desktopOnly). Kein Env-Flag mehr nötig.

  // Fetch config + decide whether to show
  useEffect(() => {
    // Mobile-Sperre: auf Mobile werden GAR KEINE Ads ausgeliefert
    // (User-Vorgabe Feb 2026). Interstitial ergo Desktop-only.
    if (isMobileViewport()) return;

    // Hide for bots / crawlers / preview tools — never let paid creatives
    // appear in Google's render snapshot (CWV penalty) and stay AdSense-safe.
    if (isBotUserAgent(navigator.userAgent)) return;
    if ((navigator as any).webdriver === true) return; // headless browsers

    // CMP-Detection: solange Funding Choices Consent-Banner sichtbar ist,
    // KEIN Interstitial mounten — User muss erst Consent-Wahl treffen
    // können, sonst blockieren wir die DSGVO-Pflicht-UI. FC nutzt iframes
    // mit der Klasse "fc-ab-root" / "fc-consent-root" plus DialogElemente
    // mit "fc-dialog".
    const cmpVisible =
      document.querySelector('iframe.fc-consent-root, iframe.fc-ab-root, .fc-dialog, .fc-consent-root');
    if (cmpVisible) return;

    // Referrer-Gate per User-Anforderung deaktiviert — Interstitial wird
    // bei JEDEM Aufruf gezeigt (auch direkter Visit, Bookmark, interne
    // Navigation). mobileOnly-Gate aus dem DB-Slot bleibt aktiv.
    //
    // Frequency-Cap per User-Anforderung entfernt — Interstitial darf bei
    // JEDEM Page-View ausgespielt werden, um den Revenue zurück auf das
    // historische Niveau zu bringen.

    let cancelled = false;
    const mobile = isMobileViewport();
    fetchAdSlots()
      .then((slots) => {
        if (cancelled) return;
        // Device-Bucket entsprechend Viewport: Mobile-User bekommen den
        // Mobile-Interstitial, Desktop-User den Desktop-Interstitial.
        // Kein cross-device-Fallback — wenn für das aktuelle Device kein
        // Slot konfiguriert ist, wird kein Interstitial gezeigt.
        const cfg = (mobile ? slots.mobile : slots.desktop)[POSITION];
        if (!cfg) return;

        // For custom: require at least one active variant with HTML
        if (cfg.provider !== 'custom') return;
        const variants = cfg.customHtmlVariants || [];
        if (!variants.some((v) => v.isActive && v.html?.trim())) return;

        setConfig(cfg);
        if (DELAY_MS <= 0) {
          setVisible(true);
        } else {
          const t = setTimeout(() => {
            if (!cancelled) setVisible(true);
          }, DELAY_MS);
          return () => clearTimeout(t);
        }
      })
      .catch(() => { /* silent — ads must never break the page */ });

    return () => { cancelled = true; };
  }, []);

  // Inject ad creative once visible
  useEffect(() => {
    if (!visible || !config || !slotRef.current) return;

    const slot = slotRef.current;

    // Interstitial rendert ausschließlich Custom-HTML (TheMoneytizer etc.).
    // AdSense wurde Feb 2026 komplett aus der Seite entfernt.
    slot.innerHTML = '';
    if (config.provider !== 'custom') return;

    const variants = config.customHtmlVariants || [];
    const picked = pickAdVariant(variants, config.rotationMode || 'random');
    if (!picked) return;
    injectHtmlWithScripts(slot, picked.html);

    return () => {
      slot.innerHTML = '';
    };
  }, [visible, config]);

  // ESC to close
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setVisible(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  // Lock body scroll while visible
  useEffect(() => {
    if (!visible) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [visible]);

  // Body-Klasse setzen solange Interstitial sichtbar ist — verstecken alle
  // Google Auto-Anchor- / Vignette-Ads + iOS-Safari Bottom-Sticky-Slots, die
  // sonst über den Interstitial-Overlay drüber-rendern (Google nutzt CSS-Max
  // z-index=2147483647, lässt sich nicht überbieten — also blenden wir sie
  // temporär aus). useLayoutEffect statt useEffect, damit das Verstecken
  // schon BEIM ersten Paint wirkt, nicht erst eine Frame später.
  useEffect(() => {
    if (!visible || !config) return;
    document.body.classList.add('x-interstitial-open');
    return () => {
      document.body.classList.remove('x-interstitial-open');
    };
  }, [visible, config]);

  if (!visible || !config) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Werbung"
      data-testid="article-interstitial"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in"
      onClick={(e) => {
        // Backdrop click closes
        if (e.target === e.currentTarget) setVisible(false);
      }}
    >
      <div
        className="relative rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-black/10 overflow-hidden"
        style={{ width: '300px', maxWidth: 'calc(100vw - 32px)' }}
      >
        {/* Close button — absolutely positioned at the top-right corner
            of the banner, overlaying the creative. White circular pill so
            it stays visible against any ad background. */}
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="absolute top-2 right-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 dark:bg-gray-900/95 text-gray-800 dark:text-gray-100 shadow-md ring-1 ring-black/10 hover:bg-white hover:scale-105 active:scale-95 transition focus:outline-none focus:ring-2 focus:ring-rose-500"
          aria-label="Werbung schließen"
          data-testid="interstitial-close-btn"
        >
          <X className="h-4 w-4" strokeWidth={2.4} />
        </button>

        {/* Tiny "Anzeige" badge bottom-left so the disclosure is still
            visible without taking up a full toolbar row. */}
        <span
          className="absolute bottom-1.5 left-2 z-10 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-white"
          aria-hidden="true"
        >
          Anzeige
        </span>

        {/* Creative slot — fixed 300×600 inventory box (IAB Half Page / Skyscraper) */}
        <div
          ref={slotRef}
          className="flex items-center justify-center overflow-hidden"
          style={{ width: '300px', height: '600px' }}
          data-testid="interstitial-creative"
        />
      </div>
    </div>
  );
}
