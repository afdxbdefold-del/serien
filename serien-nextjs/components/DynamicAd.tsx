'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

interface DynamicAdProps {
  position: string;
  className?: string;
}

interface AdConfig {
  adClient: string;
  adSlot: string;
  width: number;
  height: number;
  mobileOnly: boolean;
  desktopOnly: boolean;
}

// Cache für Ad-Konfigurationen
let adSlotsCache: Record<string, AdConfig> | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 Minuten

async function getAdSlots(): Promise<Record<string, AdConfig>> {
  const now = Date.now();
  
  // Return cached if still valid
  if (adSlotsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return adSlotsCache;
  }
  
  try {
    const res = await fetch('/api/ads/slots');
    if (res.ok) {
      adSlotsCache = await res.json();
      cacheTimestamp = now;
      return adSlotsCache || {};
    }
  } catch (error) {
    console.error('Failed to fetch ad slots:', error);
  }
  
  return adSlotsCache || {};
}

/**
 * DynamicAd - Lädt Ad-Konfiguration aus der Datenbank
 * 
 * Positionen:
 * - mobile_top
 * - above_intro
 * - below_intro
 * - in_content (spezielle Behandlung in ContentWithAds)
 * - below_author
 * - below_series_info
 * - above_similar_news
 * - above_footer
 */
export default function DynamicAd({ position, className = '' }: DynamicAdProps) {
  const adRef = useRef<HTMLModElement>(null);
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const loadConfig = async () => {
      const slots = await getAdSlots();
      const slotConfig = slots[position];
      
      if (slotConfig) {
        // Check device restrictions
        const isMobile = window.innerWidth < 1024;
        
        if (slotConfig.mobileOnly && !isMobile) {
          setIsVisible(false);
          return;
        }
        if (slotConfig.desktopOnly && isMobile) {
          setIsVisible(false);
          return;
        }
        
        setConfig(slotConfig);
      } else {
        setIsVisible(false);
      }
    };
    
    loadConfig();
  }, [position]);

  // Re-initialize ad on route change
  useEffect(() => {
    if (!config || !adRef.current) return;
    
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (isProd) {
      const timer = setTimeout(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          // Silently ignore
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [config, pathname]);

  if (!isVisible || !config) {
    return null;
  }

  return (
    <div className={`flex justify-center ${className}`} data-ad-position={position}>
      <ins
        key={`${position}-${pathname}`}
        ref={adRef}
        className="adsbygoogle"
        style={{ 
          display: 'inline-block', 
          width: `${config.width}px`, 
          height: `${config.height}px` 
        }}
        data-ad-client={config.adClient}
        data-ad-slot={config.adSlot}
      />
    </div>
  );
}

// Export für ContentWithAds
export async function getInContentAdConfig(): Promise<AdConfig | null> {
  const slots = await getAdSlots();
  return slots['in_content'] || null;
}
