'use client';

import { useEffect, useState } from 'react';

/**
 * Sticky Bottom Ad
 * Fixed at the bottom of the viewport
 */
export default function StickyBottomAd() {
  const [isProduction, setIsProduction] = useState(false);
  const [showAd, setShowAd] = useState(false);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    setIsProduction(isProd);

    // Show ad after slight delay to not block initial render
    if (isProd) {
      setTimeout(() => setShowAd(true), 1000);
      
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error('Ad loading error:', e);
      }
    }
  }, []);

  if (!isProduction || !showAd) {
    return null;
  }

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 shadow-lg border-t border-gray-200 dark:border-gray-700"
      style={{ maxHeight: '100px' }}
    >
      <div className="flex justify-center">
        <ins
          className="adsbygoogle"
          style={{ display: 'block', maxHeight: '90px' }}
          data-ad-client="ca-pub-8583619451045805"
          data-ad-slot="3358622315"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
