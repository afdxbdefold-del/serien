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
  const [mounted, setMounted] = useState(true);
  const initialPathRef = useRef(pathname);

  // Force complete remount on navigation
  useEffect(() => {
    if (pathname !== initialPathRef.current) {
      setMounted(false);
      initialPathRef.current = pathname;
      
      // Remount after a short delay
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
    }, 200);
    
    return () => clearTimeout(timer);
  }, [mounted]);

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

  if (!mounted) {
    return <div className={`ad-container ${className}`} style={{ width, height }} />;
  }

  return (
    <div ref={containerRef} className={`ad-container ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: `${width}px`, height: `${height}px` }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot={slot}
      />
    </div>
  );
}
