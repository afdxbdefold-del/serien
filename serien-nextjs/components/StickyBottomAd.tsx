'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Sticky Bottom Ad
 * Fixed at the bottom of the viewport
 */
export default function StickyBottomAd() {
  const [isProduction, setIsProduction] = useState(false);
  const adPushed = useRef(false);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    setIsProduction(isProd);
  }, []);

  useEffect(() => {
    // Push ad only once after component is mounted and in production
    if (isProduction && !adPushed.current) {
      adPushed.current = true;
      setTimeout(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          console.error('Ad loading error:', e);
        }
      }, 500);
    }
  }, [isProduction]);

  if (!isProduction) {
    return null;
  }

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 shadow-lg border-t border-gray-200 dark:border-gray-700"
    >
      <div className="flex justify-center py-1">
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client="ca-pub-8583619451045805"
          data-ad-slot="3358622315"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
