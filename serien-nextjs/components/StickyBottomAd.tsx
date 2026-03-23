'use client';

import { useEffect, useRef } from 'react';

/**
 * Sticky Bottom Ad
 * Fixed at the bottom of the viewport
 */
export default function StickyBottomAd() {
  const adPushed = useRef(false);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (isProd && !adPushed.current) {
      adPushed.current = true;
      setTimeout(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          console.error('Sticky ad error:', e);
        }
      }, 1000);
    }
  }, []);

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50"
      id="sticky-bottom-ad"
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot="3358622315"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
