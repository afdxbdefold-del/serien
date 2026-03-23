'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Mobile Top Banner Ad - 320x100 FIXED
 * Hidden when no ad is displayed
 */
export default function MobileTopAd() {
  const [isProduction, setIsProduction] = useState(false);
  const [hideAd, setHideAd] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    setIsProduction(isProd);

    if (isProd) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        
        setTimeout(() => {
          if (containerRef.current) {
            const ins = containerRef.current.querySelector('ins.adsbygoogle');
            if (ins) {
              const status = ins.getAttribute('data-ad-status');
              if (status === 'unfilled') {
                setHideAd(true);
              }
            }
          }
        }, 3000);
      } catch (e) {
        console.error('Ad loading error:', e);
      }
    }
  }, []);

  if (!isProduction || hideAd) {
    return null;
  }

  return (
    <div ref={containerRef} className="lg:hidden flex justify-center">
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '320px', height: '100px' }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot="4650555080"
      />
    </div>
  );
}
