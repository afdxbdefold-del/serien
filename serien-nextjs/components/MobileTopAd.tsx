'use client';

import { useEffect, useState, useRef } from 'react';

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

export default function MobileTopAd() {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const adRef = useRef<HTMLModElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/ads/slots');
        if (res.ok) {
          const slots = await res.json();
          if (slots['mobile_top']) {
            setConfig(slots['mobile_top']);
          }
        }
      } catch (error) {
        console.error('Failed to load ad config:', error);
      }
    };
    loadConfig();
  }, []);

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

  if (!config) return null;

  return (
    <div className="lg:hidden flex justify-center">
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
