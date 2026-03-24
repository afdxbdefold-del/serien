'use client';

import { useEffect, useState } from 'react';

/**
 * Above Footer Ad - Responsive
 * Full-width responsive ad displayed above the footer
 */
export default function AboveFooterAd() {
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
    <div className="w-full py-4 flex justify-center">
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '300px', height: '600px' }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot="1034743707"
      />
    </div>
  );
}
