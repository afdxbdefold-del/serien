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
 * Hidden when no ad is displayed or not configured
 */
export default function MobileTopAd() {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [isProduction, setIsProduction] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [hideAd, setHideAd] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    setIsProduction(isProd);

    // Check consent
    const consent = localStorage.getItem('ads-consent');
    if (consent === 'true') {
      setHasConsent(true);
    }

    // Listen for consent changes
    const interval = setInterval(() => {
      const newConsent = localStorage.getItem('ads-consent');
      if (newConsent === 'true') {
        setHasConsent(true);
        clearInterval(interval);
      }
    }, 1000);

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

    return () => clearInterval(interval);
  }, []);

  // Re-initialize ad on route change
  useEffect(() => {
    if (!config || !isProduction || !hasConsent) return;
    
    // Reset hide state on navigation
    setHideAd(false);
    
    // Small delay to ensure DOM is ready after navigation
    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        // Silently ignore - ad might already be pushed
      }
    }, 100);
    
    // Check if ad was filled after 4 seconds
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
  }, [config, isProduction, hasConsent, pathname]);

  if (!hasConsent || !isProduction || hideAd || !config) {
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
