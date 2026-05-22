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

const DELAY_MS = 3500;                              // wait before showing
const SESSION_KEY = 'serien_interstitial_shown_v1'; // 1x per browser-tab session
const POSITION = 'interstitial';

/**
 * Full-screen ad interstitial. Mounted ONLY on article pages.
 *
 * Behaviour:
 *  - Loads slot config from `/api/ads/slots` (admin-managed).
 *  - Waits DELAY_MS after mount so it doesn't trample LCP / FCP.
 *  - Shows once per browser-tab session (sessionStorage flag).
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
    // Already shown in this session — skip immediately
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    } catch { /* sessionStorage blocked → behave as if first view */ }

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
        const t = setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, DELAY_MS);
        return () => clearTimeout(t);
      })
      .catch(() => { /* silent — ads must never break the page */ });

    return () => { cancelled = true; };
  }, []);

  // Inject ad creative once visible
  useEffect(() => {
    if (!visible || !config || !slotRef.current) return;
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }

    if (config.provider === 'custom') {
      const variant = pickAdVariant(config.customHtmlVariants || [], config.rotationMode || 'random');
      if (variant) injectHtmlWithScripts(slotRef.current, variant.html);
      return;
    }

    // AdSense path: build a fresh <ins> element on every show (raw DOM,
    // never trust React to leave AdSense attributes alone).
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', config.adClient);
    ins.setAttribute('data-ad-slot', config.adSlot);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    slotRef.current.appendChild(ins);
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch { /* AdSense will retry on its own */ }
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
        className="relative w-full max-w-[420px] rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-black/10"
        style={{ maxHeight: '90vh' }}
      >
        {/* Top bar: "Anzeige" + close */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Anzeige
          </span>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="-mr-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            aria-label="Werbung schließen"
            data-testid="interstitial-close-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Creative slot */}
        <div
          ref={slotRef}
          className="px-4 pb-5 flex items-center justify-center overflow-y-auto"
          style={{
            minHeight: Math.min(config.height, 560),
            maxHeight: '78vh',
          }}
          data-testid="interstitial-creative"
        />
      </div>
    </div>
  );
}
