'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { injectHtmlWithScripts, pickAdVariant, AdVariant } from '@/lib/ad-html-injector';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface InterstitialConfig {
  provider: 'adsense' | 'custom';
  adClient: string;
  adSlot: string;
  customHtmlVariants?: AdVariant[];
  rotationMode?: 'random' | 'weighted' | 'first';
  width: number;
  height: number;
  mobileOnly: boolean;
  desktopOnly: boolean;
}

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

  // Fetch config + decide whether to show
  useEffect(() => {
    // Hide for bots / crawlers / preview tools — never let paid creatives
    // appear in Google's render snapshot (CWV penalty) and stay AdSense-safe.
    if (isBotUserAgent(navigator.userAgent)) return;
    if ((navigator as any).webdriver === true) return; // headless browsers

    // No session cap — show on every page view (per user request).

    let cancelled = false;
    fetch('/api/ads/slots')
      .then((r) => (r.ok ? r.json() : {}))
      .then((slots: Record<string, InterstitialConfig>) => {
        if (cancelled) return;
        const cfg = slots?.[POSITION];
        if (!cfg) return;
        // Respect device gates
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (cfg.mobileOnly && !isMobile) return;
        if (cfg.desktopOnly && isMobile) return;

        // For custom: require at least one active variant with HTML
        if (cfg.provider === 'custom') {
          const variants = cfg.customHtmlVariants || [];
          if (!variants.some((v) => v.isActive && v.html?.trim())) return;
        } else {
          // AdSense: require both client + slot id
          if (!cfg.adClient || !cfg.adSlot) return;
        }

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
    // (No session-cap write — unlimited displays per user request.)

    const slot = slotRef.current;

    if (config.provider === 'custom') {
      const variant = pickAdVariant(config.customHtmlVariants || [], config.rotationMode || 'random');
      if (variant) injectHtmlWithScripts(slot, variant.html);
      return;
    }

    // AdSense path.
    // ──────────────────────────────────────────────────────────────────
    // 1. Localhost / Preview-host: AdSense returns nothing because the
    //    domain isn't whitelisted in the Ad Manager. Render a visible
    //    placeholder so the editor knows the slot is configured. This is
    //    the same pattern the existing AdUnit component uses.
    // 2. Production: build a fixed-size <ins> for the 300×600 inventory.
    //    `data-ad-format="rectangle"` keeps AdSense from auto-resizing
    //    into a half-banner; explicit width/height pixel hints are
    //    required for fixed slots, otherwise the iframe stays 0×0.
    // 3. Push 250ms after appendChild — AdSense needs the iframe to be
    //    in the DOM with measurable layout before push() succeeds.
    // ──────────────────────────────────────────────────────────────────
    const host = window.location.hostname;
    const isProd =
      host !== 'localhost' &&
      !host.includes('127.0.0.1') &&
      !host.includes('preview') &&
      !host.includes('emergentagent');

    slot.innerHTML = '';

    if (!isProd) {
      const placeholder = document.createElement('div');
      placeholder.style.cssText =
        'width:300px;height:600px;display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 10px,#e5e7eb 10px,#e5e7eb 20px);border:2px dashed #9ca3af;border-radius:10px;color:#374151;font-family:system-ui,sans-serif;font-size:13px;text-align:center;padding:16px;';
      placeholder.textContent = `AdSense-Slot ${config.adSlot} · 300×600 (nur in Production aktiv)`;
      slot.appendChild(placeholder);
      return;
    }

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    // Strict 300×600 inventory ("Half Page" / Skyscraper):
    // - explicit pixel-size on style (NOT width/height attrs, AdSense
    //   strips them)
    // - NO data-ad-format attribute. Setting "rectangle" forces the IAB
    //   Rectangle group (300×250 / 336×280). Setting "auto" lets AdSense
    //   pick anything that fits. The only way to lock 300×600 is to leave
    //   data-ad-format unset and have the slot in Ad Manager configured
    //   for the 300×600 size.
    ins.style.display = 'inline-block';
    ins.style.width = '300px';
    ins.style.height = '600px';
    ins.setAttribute('data-ad-client', config.adClient);
    ins.setAttribute('data-ad-slot', config.adSlot);
    slot.appendChild(ins);

    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch { /* AdSense retries internally */ }
    }, 250);

    return () => {
      clearTimeout(timer);
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

  if (!visible || !config) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Werbung"
      data-testid="article-interstitial"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in"
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
