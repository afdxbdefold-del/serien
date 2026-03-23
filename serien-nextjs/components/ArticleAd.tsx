'use client';

import { useEffect, useRef } from 'react';

// Global counter to stagger ad loading
let adCounter = 0;

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
  const adPushed = useRef(false);
  const adIndex = useRef(adCounter++);

  useEffect(() => {
    if (adPushed.current) return;
    
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (isProd) {
      adPushed.current = true;
      // Stagger ads: 500ms base + 300ms per ad index
      const delay = 500 + (adIndex.current * 300);
      setTimeout(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          console.error('ArticleAd error:', e);
        }
      }, delay);
    }
  }, []);

  return (
    <div className={`flex justify-center ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: `${width}px`, height: `${height}px` }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot={slot}
      />
    </div>
  );
}
