'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Mobile Top Banner Ad
 * Displays only on mobile devices, directly above the header
 * Invisible when no ad is shown
 */
export default function MobileTopAd() {
  const [isProduction, setIsProduction] = useState(false);
  const [hasAd, setHasAd] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if we're in production
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    setIsProduction(isProd);

    if (isProd) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        
        // Check if ad was loaded after a delay
        setTimeout(() => {
          if (containerRef.current) {
            const adElement = containerRef.current.querySelector('ins.adsbygoogle');
            if (adElement) {
              const adStatus = adElement.getAttribute('data-ad-status');
              const hasContent = adElement.clientHeight > 0;
              setHasAd(adStatus === 'filled' || hasContent);
            }
          }
        }, 1500);
      } catch (e) {
        console.error('Ad loading error:', e);
      }
    }
  }, []);

  // Don't render anything in dev mode
  if (!isProduction) {
    return null;
  }

  // Only render on mobile (hidden on lg and up)
  return (
    <div 
      ref={containerRef}
      className={`lg:hidden w-full ${hasAd ? 'block' : ''}`}
      style={{ minHeight: hasAd ? 'auto' : 0 }}
    >
      <div className="flex justify-center">
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%' }}
          data-ad-client="ca-pub-8583619451045805"
          data-ad-slot="MOBILE_TOP_SLOT"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
