'use client';

import { useEffect, useRef, useId } from 'react';

interface ArticleAdProps {
  slot: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * Article Ad Unit - Client Component
 * Handles its own adsbygoogle.push() call with staggered timing
 */
export default function ArticleAd({ slot, width, height, className = '' }: ArticleAdProps) {
  const adRef = useRef<HTMLModElement>(null);
  const adPushed = useRef(false);
  const uniqueId = useId();

  useEffect(() => {
    if (adPushed.current) return;
    
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (isProd && adRef.current) {
      adPushed.current = true;
      
      // Use IntersectionObserver to load ads when they come into view
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setTimeout(() => {
                try {
                  (window.adsbygoogle = window.adsbygoogle || []).push({});
                } catch (e) {
                  console.error('ArticleAd error:', e);
                }
              }, 200);
              observer.disconnect();
            }
          });
        },
        { rootMargin: '200px' } // Load 200px before visible
      );
      
      observer.observe(adRef.current);
      
      return () => observer.disconnect();
    }
  }, []);

  return (
    <div className={`flex justify-center ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: `${width}px`, height: `${height}px` }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot={slot}
      />
    </div>
  );
}
