'use client';

import { useEffect, useState } from 'react';

/**
 * Mobile Top Banner Ad - 320x100 fixed size
 * Displays only on mobile devices, directly above the header
 */
export default function MobileTopAd() {
  const [isProduction, setIsProduction] = useState(false);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    setIsProduction(isProd);

    if (isProd) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error('Ad loading error:', e);
      }
    }
  }, []);

  if (!isProduction) {
    return null;
  }

  return (
    <div className="lg:hidden w-full flex justify-center py-1 bg-gray-100 dark:bg-gray-900">
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '320px', height: '100px' }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot="4650555080"
      />
    </div>
  );
}
