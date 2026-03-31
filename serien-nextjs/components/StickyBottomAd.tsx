'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export default function StickyBottomAd() {
  const adRef = useRef<HTMLModElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    
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
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center" id="sticky-bottom-ad">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '320px', height: '100px' }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot="3358622315"
      />
    </div>
  );
}
