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
 * Article Ad Unit - Force remount on navigation for AdSense compatibility
 */
export default function ArticleAd({ slot, width, height, className = '' }: ArticleAdProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(true);
  const initialPathRef = useRef(pathname);
  const hasIntersected = useRef(false);

  // Force complete remount on navigation
  useEffect(() => {
    if (pathname !== initialPathRef.current) {
      setMounted(false);
      hasIntersected.current = false;
      initialPathRef.current = pathname;
      
      const timer = setTimeout(() => {
        setMounted(true);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Push ad when mounted and visible
  useEffect(() => {
    if (!mounted) return;
    
    const isProd = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('preview');
    
    if (!isProd) return;

    const container = document.getElementById(`article-ad-${slot}`);
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasIntersected.current) {
            hasIntersected.current = true;
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
    
    observer.observe(container);
    
    return () => observer.disconnect();
  }, [mounted, slot]);

  if (!mounted) {
    return <div className={`flex justify-center ${className}`} style={{ width, height }} />;
  }

  return (
    <div id={`article-ad-${slot}`} className={`flex justify-center ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: `${width}px`, height: `${height}px` }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot={slot}
      />
    </div>
  );
}
