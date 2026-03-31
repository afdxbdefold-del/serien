'use client';

import { useEffect, useState, useRef } from 'react';
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

/**
 * Mobile Top Banner Ad - Lädt Konfiguration aus DB
 * Google CMP handles consent automatically
 */
export default function MobileTopAd() {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [isProduction, setIsProduction] = useState(false);
  const [hideAd, setHideAd] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    setIsProduction(isProd);

    // Fetch ad config
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/ads/slots');
        if (res.ok) {
          const slots = await res.json();
          const mobileTopConfig = slots['mobile_top'];
          if (mobileTopConfig) {
            setConfig(mobileTopConfig);
          }
        }
      } catch (error) {
        console.error('Failed to load mobile top ad config:', error);
      }
    };
    
    loadConfig();
  }, []);

  // Re-initialize ad on route change
  useEffect(() => {
    if (!config || !isProduction) return;
    
    setHideAd(false);
    
    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        // Silently ignore
      }
    }, 100);
    
    const checkTimer = setTimeout(() => {
      if (containerRef.current) {
        const ins = containerRef.current.querySelector('ins.adsbygoogle');
        if (ins) {
          const status = ins.getAttribute('data-ad-status');
          if (status === 'unfilled') {
            setHideAd(true);
          }
        }
      }
    }, 4000);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(checkTimer);
    };
  }, [config, isProduction, pathname]);

  if (!isProduction || hideAd || !config) {
    return null;
  }

  return (
    <div ref={containerRef} className="lg:hidden flex justify-center" data-ad-position="mobile_top">
      <ins
        key={pathname}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: `${config.width}px`, height: `${config.height}px` }}
        data-ad-client={config.adClient}
        data-ad-slot={config.adSlot}
      />
    </div>
  );
}
