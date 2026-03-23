'use client';

import { useEffect, useRef } from 'react';

interface ArticleAdProps {
  slot: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * Article Ad Unit - Client Component
 * Handles its own adsbygoogle.push() call
 */
export default function ArticleAd({ slot, width, height, className = '' }: ArticleAdProps) {
  const adPushed = useRef(false);

  useEffect(() => {
    if (adPushed.current) return;
    
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (isProd) {
      adPushed.current = true;
      setTimeout(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          console.error('ArticleAd error:', e);
        }
      }, 100);
    }
  }, []);

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: `${width}px`, height: `${height}px` }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot={slot}
      />
    </div>
  );
}
