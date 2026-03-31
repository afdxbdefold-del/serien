'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Sticky Bottom Ad
 * Fixed at the bottom of the viewport
 */
export default function StickyBottomAd() {
  const pathname = usePathname();
  const [hasConsent, setHasConsent] = useState(false);
  const [isProduction, setIsProduction] = useState(false);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    setIsProduction(isProd);

    // Check consent
    const consent = localStorage.getItem('ads-consent');
    if (consent === 'true') {
      setHasConsent(true);
    }

    const interval = setInterval(() => {
      const newConsent = localStorage.getItem('ads-consent');
      if (newConsent === 'true') {
        setHasConsent(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isProduction && hasConsent) {
      const timer = setTimeout(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          // Silently ignore
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [pathname, isProduction, hasConsent]);

  if (!hasConsent || !isProduction) {
    return null;
  }

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
