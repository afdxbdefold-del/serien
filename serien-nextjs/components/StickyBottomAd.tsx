'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

/**
 * Sticky Bottom Ad - Force remount on navigation
 */
export default function StickyBottomAd() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(true);
  const initialPathRef = useRef(pathname);

  // Force complete remount on navigation
  useEffect(() => {
    if (pathname !== initialPathRef.current) {
      setMounted(false);
      initialPathRef.current = pathname;
      
      const timer = setTimeout(() => {
        setMounted(true);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Push ad when mounted
  useEffect(() => {
    if (!mounted) return;
    
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (!isProd) return;

    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        // Silently ignore
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [mounted]);

  if (!mounted) {
    return <div className="fixed bottom-0 left-0 right-0 z-50" style={{ height: 100 }} />;
  }

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      id="sticky-bottom-ad"
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '320px', height: '100px' }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot="3358622315"
      />
    </div>
  );
}
