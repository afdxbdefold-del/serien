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

/**
 * Article Ad Unit - Client Component
 * Google CMP handles consent automatically
 */
export default function ArticleAd({ slot, width, height, className = '' }: ArticleAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [adKey, setAdKey] = useState(0);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (!isProd) return;

    // Increment key to force re-render
    setAdKey(prev => prev + 1);
  }, [pathname]);

  useEffect(() => {
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (!isProd || !containerRef.current) return;

    // Use IntersectionObserver to load ads when they come into view
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const ins = containerRef.current?.querySelector('ins.adsbygoogle');
            if (ins && !ins.hasAttribute('data-adsbygoogle-status')) {
              setTimeout(() => {
                try {
                  (window.adsbygoogle = window.adsbygoogle || []).push({});
                } catch (e) {
                  // Silently ignore
                }
              }, 200);
            }
            observer.disconnect();
          }
        });
      },
      { rootMargin: '200px' }
    );
    
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, [adKey]);

  return (
    <div ref={containerRef} className={`flex justify-center ${className}`}>
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
