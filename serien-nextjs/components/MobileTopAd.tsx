'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Mobile Top Banner Ad - 320x100 FIXED
 * Hidden when no ad is displayed
 */
export default function MobileTopAd() {
  const [isProduction, setIsProduction] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    setIsProduction(isProd);

    if (isProd) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        
        // Check if ad loaded after delay
        const checkAd = setInterval(() => {
          if (containerRef.current) {
            const ins = containerRef.current.querySelector('ins.adsbygoogle');
            if (ins) {
              const status = ins.getAttribute('data-ad-status');
              const hasHeight = ins.clientHeight > 0;
              
              if (status === 'filled' || hasHeight) {
                setAdLoaded(true);
                clearInterval(checkAd);
              } else if (status === 'unfilled') {
                setAdLoaded(false);
                clearInterval(checkAd);
              }
            }
          }
        }, 500);
        
        // Stop checking after 5 seconds
        setTimeout(() => clearInterval(checkAd), 5000);
      } catch (e) {
        console.error('Ad loading error:', e);
      }
    }
  }, []);

  if (!isProduction) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className="lg:hidden w-full flex justify-center bg-white dark:bg-gray-900"
      style={{ display: adLoaded ? 'flex' : 'none' }}
    >
      <div 
        style={{ 
          width: '320px', 
          height: '100px', 
          overflow: 'hidden'
        }}
      >
        <ins
          className="adsbygoogle"
          style={{ 
            display: 'inline-block', 
            width: '320px', 
            height: '100px' 
          }}
          data-ad-client="ca-pub-8583619451045805"
          data-ad-slot="4650555080"
        />
      </div>
    </div>
  );
}
