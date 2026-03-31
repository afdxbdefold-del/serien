'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface AdConfig {
  adClient: string;
  adSlot: string;
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
 * AdSlotInner: Mounts fresh <ins> and pushes ad on every mount.
 * Because the parent uses key={pathname}, this fully remounts on SPA navigation.
 */
function AdSlotInner({ config }: { config: AdConfig }) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!adRef.current) return;

    const isProd = window.location.hostname !== 'localhost' &&
                   !window.location.hostname.includes('preview');
    if (!isProd) return;

    // Retry mechanism: wait for adsbygoogle to be available (script might still be loading)
    let attempts = 0;
    const maxAttempts = 20;
    const tryPush = () => {
      attempts++;
      if (typeof window.adsbygoogle !== 'undefined') {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          // AdSense errors are expected in some cases
        }
      } else if (attempts < maxAttempts) {
        // Script not loaded yet, retry after delay
        retryTimer = setTimeout(tryPush, 200);
      }
    };

    let retryTimer: ReturnType<typeof setTimeout>;
    // Initial delay to ensure DOM is settled
    retryTimer = setTimeout(tryPush, 150);

    return () => clearTimeout(retryTimer);
  }, []);

  return (
    <ins
      ref={adRef}
      className="adsbygoogle"
      style={{ display: 'inline-block', width: config.width, height: config.height }}
      data-ad-client={config.adClient}
      data-ad-slot={config.adSlot}
    />
  );
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
