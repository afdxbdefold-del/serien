'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface ArticleAdProps {
  slot: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * Article Ad Unit - Client Component
 * Google CMP handles consent automatically
 */
export default function ArticleAd({ slot, width, height, className = '' }: ArticleAdProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (isProd && adRef.current) {
      // Use IntersectionObserver to load ads when they come into view
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setTimeout(() => {
                try {
                  (window.adsbygoogle = window.adsbygoogle || []).push({});
                } catch (e) {
                  // Silently ignore
                }
              }, 200);
              observer.disconnect();
            }
          });
        },
        { rootMargin: '200px' }
      );
      
      observer.observe(adRef.current);
      
      return () => observer.disconnect();
    }
  }, [pathname]);

  return (
    <div className={`flex justify-center ${className}`}>
      <ins
        key={`${slot}-${pathname}`}
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: `${width}px`, height: `${height}px` }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot={slot}
      />
    </div>
  );
}
