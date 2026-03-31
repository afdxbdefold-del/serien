'use client';

import { useEffect, useRef, useState } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [adKey, setAdKey] = useState(0);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (!isProd) return;

    // Increment key to force re-render of ins element
    setAdKey(prev => prev + 1);
  }, [pathname]);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (!isProd || !containerRef.current) return;

    // Wait for the new ins element to be in DOM
    const timer = setTimeout(() => {
      try {
        const ins = containerRef.current?.querySelector('ins.adsbygoogle');
        if (ins && !ins.hasAttribute('data-adsbygoogle-status')) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      } catch (e) {
        // Silently ignore
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [adKey]);

  // Show placeholder in development/preview
  if (typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname.includes('preview'))) {
    return (
      <div className={`ad-container ${className}`}>
        <div className="bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
            Werbeanzeige
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`ad-container ${className}`}>
      <ins
        key={`${slot}-${adKey}`}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: `${width}px`, height: `${height}px` }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot={slot}
      />
    </div>
  );
}
