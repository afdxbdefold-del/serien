'use client';

import { useEffect, useState } from 'react';

/**
 * Mobile Top Banner Ad
 * Displays only on mobile devices, directly above the header
 */
export default function MobileTopAd() {
  const [isProduction, setIsProduction] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
    // Check if we're in production
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    setIsProduction(isProd);

    if (isProd) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        setAdLoaded(true);
      } catch (e) {
        console.error('Ad loading error:', e);
      }
    }
  }, []);

  // Only render on mobile (hidden on lg and up)
  return (
    <div className="lg:hidden w-full bg-gray-100 dark:bg-gray-900">
      <div className="flex justify-center py-1">
        {isProduction ? (
          <ins
            className="adsbygoogle"
            style={{ display: 'block', width: '320px', height: '50px' }}
            data-ad-client="ca-pub-8583619451045805"
            data-ad-slot="MOBILE_TOP_SLOT"
            data-ad-format="horizontal"
            data-full-width-responsive="false"
          />
        ) : (
          <div 
            className="bg-gray-200 dark:bg-gray-800 border-2 border-dashed border-gray-400 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs font-medium"
            style={{ width: '320px', height: '50px' }}
          >
            Mobile Ad (320x50)
          </div>
        )}
      </div>
    </div>
  );
}
