'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

interface ArticleAdProps {
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

export default function ArticleAd({ slot, width, height, className = '' }: ArticleAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [adKey, setAdKey] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const lastPathRef = useRef(pathname);
  const hasInitializedRef = useRef(false);

  // Detect route changes
  useEffect(() => {
    if (pathname !== lastPathRef.current) {
      lastPathRef.current = pathname;
      hasInitializedRef.current = false;
      setIsVisible(false);
      setAdKey(prev => prev + 1);
    }
  }, [pathname]);

  // Initialize ad with IntersectionObserver
  useEffect(() => {
    const isProd = typeof window !== 'undefined' && 
                   window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (!isProd || !containerRef.current || hasInitializedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            setIsVisible(true);
            
            setTimeout(() => {
              try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
              } catch (e) {
                console.log('Ad init error:', e);
              }
            }, 100);
            
            observer.disconnect();
          }
        });
      },
      { rootMargin: '200px' }
    );
    
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, [adKey]);

  const isProd = typeof window !== 'undefined' && 
                 window.location.hostname !== 'localhost' && 
                 !window.location.hostname.includes('preview');

  if (!isProd) {
    return (
      <div className={`flex justify-center ${className}`}>
        <div 
          className="bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center"
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          <span className="text-gray-400 text-sm">Ad</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`flex justify-center ${className}`}>
      {isVisible && (
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
