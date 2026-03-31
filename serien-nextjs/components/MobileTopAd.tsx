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
 * Mobile Top Banner Ad - Force remount on navigation
 */
export default function MobileTopAd() {
  const [config, setConfig] = useState<AdConfig | null>(null);
  const [isProduction, setIsProduction] = useState(false);
  const [mounted, setMounted] = useState(true);
  const pathname = usePathname();
  const initialPathRef = useRef(pathname);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    setIsProduction(isProd);

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

  // Force complete remount on navigation
  useEffect(() => {
    if (pathname !== initialPathRef.current) {
      setMounted(false);
      initialPathRef.current = pathname;
      
      const timer = setTimeout(() => {
        setMounted(true);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Push ad when mounted
  useEffect(() => {
    if (!mounted || !config || !isProduction) return;
    
    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        // Silently ignore
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [mounted, config, isProduction]);

  if (!isProduction || !config) {
    return null;
  }

  if (!mounted) {
    return <div className="lg:hidden" style={{ height: config.height }} />;
  }

  return (
    <div className="lg:hidden flex justify-center" data-ad-position="mobile_top">
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: `${config.width}px`, height: `${config.height}px` }}
        data-ad-client={config.adClient}
        data-ad-slot={config.adSlot}
      />
    </div>
  );
}
