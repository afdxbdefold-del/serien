'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Sticky Bottom Ad
 * Google CMP handles consent automatically
 */
export default function StickyBottomAd() {
  const pathname = usePathname();

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (isProd) {
      const timer = setTimeout(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          // Silently ignore
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      id="sticky-bottom-ad"
    >
      <ins
        key={pathname}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '320px', height: '100px' }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot="3358622315"
      />
    </div>
  );
}
