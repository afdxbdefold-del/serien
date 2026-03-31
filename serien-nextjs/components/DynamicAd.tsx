'use client';

import { useEffect, useRef, useState } from 'react';

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

let adSlotsCache: Record<string, AdConfig> | null = null;

async function getAdSlots(): Promise<Record<string, AdConfig>> {
  if (adSlotsCache) return adSlotsCache;
  
  try {
    const res = await fetch('/api/ads/slots');
    if (res.ok) {
      adSlotsCache = await res.json();
      return adSlotsCache || {};
    }
  } catch (e) {
    console.error('Failed to load ad slots:', e);
  }
  return {};
}

export default function DynamicAd({ position, className = '' }: DynamicAdProps) {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const adRef = useRef<HTMLModElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    const loadConfig = async () => {
      const slots = await getAdSlots();
      const slotConfig = slots[position];
      
      if (slotConfig) {
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

  useEffect(() => {
    if (isInitialized.current || !config) return;
    
    const isProd = typeof window !== 'undefined' && 
                   window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (isProd && adRef.current) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isInitialized.current = true;
      } catch (e) {
        // Ignore
      }
    }
  }, [config]);

  if (!isVisible || !config) return null;

  return (
    <div className={`flex justify-center ${className}`} data-ad-position={position}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: `${config.width}px`, height: `${config.height}px` }}
        data-ad-client={config.adClient}
        data-ad-slot={config.adSlot}
      />
    </div>
  );
}

export async function getInContentAdConfig(): Promise<AdConfig | null> {
  const slots = await getAdSlots();
  return slots['in_content'] || null;
}
