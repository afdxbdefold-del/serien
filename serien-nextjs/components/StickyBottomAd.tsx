'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

/**
 * Sticky Bottom Ad
 * Fixed at the bottom of the viewport
 * Properly reinitializes on client-side navigation
 */
export default function StickyBottomAd() {
  const pathname = usePathname();
  const [adKey, setAdKey] = useState(0);
  const [shouldRenderIns, setShouldRenderIns] = useState(false);
  const lastPathRef = useRef(pathname);
  const hasInitializedRef = useRef(false);

  // Detect route changes and force re-render
  useEffect(() => {
    if (pathname !== lastPathRef.current) {
      lastPathRef.current = pathname;
      hasInitializedRef.current = false;
      setShouldRenderIns(false);
      setAdKey(prev => prev + 1);
    }
  }, [pathname]);

  // Initialize ad
  useEffect(() => {
    const isProd = typeof window !== 'undefined' &&
                   window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (!isProd || hasInitializedRef.current) return;

    hasInitializedRef.current = true;
    setShouldRenderIns(true);

    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.log('Sticky ad push error:', e);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [adKey]);

  const isProd = typeof window !== 'undefined' &&
                 window.location.hostname !== 'localhost' && 
                 !window.location.hostname.includes('preview');

  if (!isProd) return null;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      id="sticky-bottom-ad"
    >
      {shouldRenderIns && (
        <ins
          key={`sticky-${adKey}`}
          className="adsbygoogle"
          style={{ display: 'inline-block', width: '320px', height: '100px' }}
          data-ad-client="ca-pub-8583619451045805"
          data-ad-slot="3358622315"
        />
      )}
    </div>
  );
}
