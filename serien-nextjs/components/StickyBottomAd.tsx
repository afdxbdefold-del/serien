'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

/**
 * Sticky Bottom Ad
 * Google CMP handles consent automatically
 */
export default function StickyBottomAd() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const [adKey, setAdKey] = useState(0);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (isProd) {
      setAdKey(prev => prev + 1);
    }
  }, [pathname]);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (!isProd || !containerRef.current) return;

    const timer = setTimeout(() => {
      try {
        const ins = containerRef.current?.querySelector('ins.adsbygoogle');
        if (ins && !ins.hasAttribute('data-adsbygoogle-status')) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      } catch (e) {
        // Silently ignore
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [adKey]);

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      id="sticky-bottom-ad"
    >
      <ins
        key={`sticky-${adKey}`}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '320px', height: '100px' }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot="3358622315"
      />
    </div>
  );
}
