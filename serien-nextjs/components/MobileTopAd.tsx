'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Mobile Top Banner Ad
 * Displays only on mobile devices, directly above the header
 * Invisible when no ad is shown
 * STRICTLY limited to 100px height
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
  // STRICT 100px limit with overflow hidden
  return (
    <div 
      ref={containerRef}
      className="lg:hidden w-full"
      style={{ 
        maxHeight: '100px', 
        height: '100px',
        overflow: 'hidden',
        display: hasAd ? 'block' : 'none'
      }}
    >
      <ins
        className="adsbygoogle"
        style={{ 
          display: 'block', 
          width: '100%', 
          height: '100px',
          maxHeight: '100px'
        }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot="MOBILE_TOP_SLOT"
        data-ad-format="horizontal"
        data-full-width-responsive="false"
      />
    </div>
  );
}
