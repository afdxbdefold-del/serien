'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { injectHtmlWithScripts, pickAdVariant, renderAdInIframe, AdVariant } from '@/lib/ad-html-injector';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdConfig {
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

// Module-level cache for ad slot configs
let adSlotsCache: Record<string, AdConfig> | null = null;
let adSlotsFetchPromise: Promise<Record<string, AdConfig>> | null = null;

function fetchAdSlots(): Promise<Record<string, AdConfig>> {
  if (adSlotsCache) return Promise.resolve(adSlotsCache);
  if (adSlotsFetchPromise) return adSlotsFetchPromise;

  adSlotsFetchPromise = fetch('/api/ads/slots')
    .then(res => res.ok ? res.json() : {})
    .then(data => {
      adSlotsCache = data;
      adSlotsFetchPromise = null;
      return data;
    })
    .catch(() => {
      adSlotsFetchPromise = null;
      return {};
    });

  return adSlotsFetchPromise;
}

interface ClientAdSlotProps {
  position: string;
  className?: string;
}

/**
 * AdSlotInner: Creates fresh <ins> via raw DOM on every mount.
 * Because the parent uses key={pathname}, this fully remounts on SPA navigation.
 * Raw DOM ensures AdSense sees a truly new element without React attributes.
 */
function AdSlotInner({ config }: { config: AdConfig }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isProd = window.location.hostname !== 'localhost' &&
                   !window.location.hostname.includes('preview');
    if (!isProd) return;

    // Custom HTML provider (Plista, Outbrain, AWIN, Belboon, direct deal,
    // anything else): 3rd-party-Snippets nutzen oft document.write() in
    // externen Scripts, was post-load nicht mehr funktioniert. Wenn ein
    // externes <script src=...> erkannt wird, rendern wir im sandboxed
    // iframe (eigener Document-Kontext → document.write() works).
    // Reine HTML/CSS-Banner injizieren wir direkt.
    if (config.provider === 'custom') {
      const variants = config.customHtmlVariants || [];
      const picked = pickAdVariant(variants, config.rotationMode || 'random');
      if (picked) {
        const hasExternalScript = /<script[^>]+src=/i.test(picked.html);
        if (hasExternalScript) {
          renderAdInIframe(container, picked.html, config.width, config.height);
        } else {
          injectHtmlWithScripts(container, picked.html);
        }
      }
      return () => {
        container.innerHTML = '';
      };
    }

    // AdSense provider: create fresh <ins> via raw DOM (not React JSX) so
    // adsbygoogle.push() always sees a clean, never-seen-before element.
    //
    // Minimal, AdSense-empfohlenes Pattern für Fixed-Size-Slots:
    //   - `<ins class="adsbygoogle" style="display:inline-block;width:Xpx;height:Ypx" data-ad-client data-ad-slot>`
    //   - KEIN `data-ad-format`-Attribut (weder leer noch gesetzt)
    //   - KEIN `data-full-width-responsive`-Attribut
    //   - KEIN forced Container-Layout
    // Diese Variante hat sich gegenüber jedem Hardening-Versuch als robuster
    // erwiesen — andere Slots laufen damit problemlos. AdSense entscheidet
    // basierend auf der Console-Slot-Konfiguration; Slot-Größen-Anomalien
    // (300×250 statt 300×600) müssen in der AdSense Console für die jeweilige
    // Slot-ID korrigiert werden, nicht im Code.
    container.innerHTML = '';

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'inline-block';
    ins.style.width = `${config.width}px`;
    ins.style.height = `${config.height}px`;
    ins.setAttribute('data-ad-client', config.adClient);
    ins.setAttribute('data-ad-slot', config.adSlot);
    container.appendChild(ins);

    // Retry mechanism: wait for adsbygoogle to be available
    let attempts = 0;
    const maxAttempts = 20;
    let retryTimer: ReturnType<typeof setTimeout>;
    const tryPush = () => {
      attempts++;
      if (typeof window.adsbygoogle !== 'undefined') {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
          // AdSense errors are expected in some cases
        }
      } else if (attempts < maxAttempts) {
        retryTimer = setTimeout(tryPush, 200);
      }
    };

    retryTimer = setTimeout(tryPush, 250);

    return () => {
      clearTimeout(retryTimer);
      container.innerHTML = '';
    };
  }, [config]);

  return <div ref={containerRef} />;
}

/**
 * ClientAdSlot: Route-aware ad component that properly reloads ads on SPA navigation.
 * Uses key={pathname} on AdSlotInner to force complete unmount/remount on route change,
 * ensuring a fresh <ins> element and a fresh adsbygoogle.push() call.
 */
export default function ClientAdSlot({ position, className = '' }: ClientAdSlotProps) {
  const pathname = usePathname();
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 1024);
    fetchAdSlots().then(slots => {
      setConfig(slots[position] || null);
    });
  }, [position]);

  if (!config) return null;

  // Device restrictions
  if (config.mobileOnly && !isMobile) return null;
  if (config.desktopOnly && isMobile) return null;

  // Dev mode placeholder
  if (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname.includes('preview'))) {
    return (
      <div className={`ad-container flex justify-center ${className}`} data-ad-position={position} data-testid={`ad-slot-${position}`}>
        <div className="bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Werbeanzeige ({config.width}x{config.height}) - {position}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`ad-container flex justify-center ${className}`} data-ad-position={position} data-testid={`ad-slot-${position}`}>
      <AdSlotInner key={`${pathname}-${position}`} config={config} />
    </div>
  );
}
