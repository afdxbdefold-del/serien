'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface AdUnitProps {
  slot: string;
  width: number;
  height: number;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export default function AdUnit({ slot, width, height, className = '' }: AdUnitProps) {
  const [isProduction, setIsProduction] = useState(false);
  const [adKey, setAdKey] = useState(0);
  const [shouldRenderIns, setShouldRenderIns] = useState(false);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const lastPathRef = useRef(pathname);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    setIsProduction(window.location.hostname !== 'localhost' && !window.location.hostname.includes('preview'));
  }, []);

  // Force re-render on route change
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
    if (!isProduction || hasInitializedRef.current) return;

    hasInitializedRef.current = true;
    setShouldRenderIns(true);

    const timer = setTimeout(() => {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.log('Ad push error:', e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isProduction, adKey]);

  if (!isProduction) {
    return (
      <div className={`ad-container ${className}`}>
        <div className="bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Ad Placeholder</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={adContainerRef} className={`ad-container flex justify-center ${className}`}>
      {shouldRenderIns && (
        <ins
          key={`ad-${slot}-${adKey}`}
          className="adsbygoogle"
          style={{ display: 'inline-block', width: `${width}px`, height: `${height}px` }}
          data-ad-client="ca-pub-8583619451045805"
          data-ad-slot={slot}
        />
      )}
    </div>
  );
}
