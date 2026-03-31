'use client';

import { useEffect, useRef, useId, useState } from 'react';
import { usePathname } from 'next/navigation';

interface ArticleAdProps {
  slot: string;
  width: number;
  height: number;
  className?: string;
}

/**
 * Article Ad Unit - Client Component
 * Handles its own adsbygoogle.push() call with staggered timing
 * Respects cookie consent (GDPR compliance)
 */
export default function ArticleAd({ slot, width, height, className = '' }: ArticleAdProps) {
  const adRef = useRef<HTMLModElement>(null);
  const uniqueId = useId();
  const pathname = usePathname();
  const [hasConsent, setHasConsent] = useState(false);

  // Check for cookie consent
  useEffect(() => {
    const consent = localStorage.getItem('ads-consent');
    if (consent === 'true') {
      setHasConsent(true);
    }

    // Listen for consent changes
    const handleStorage = () => {
      const newConsent = localStorage.getItem('ads-consent');
      setHasConsent(newConsent === 'true');
    };

    window.addEventListener('storage', handleStorage);
    
    // Check periodically for same-tab consent
    const interval = setInterval(() => {
      const newConsent = localStorage.getItem('ads-consent');
      if (newConsent === 'true') {
        setHasConsent(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // Don't load ads without consent
    if (!hasConsent) return;

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
        { rootMargin: '200px' } // Load 200px before visible
      );
      
      observer.observe(adRef.current);
      
      return () => observer.disconnect();
    }
  }, [pathname, hasConsent]); // Re-run on pathname change or consent change

  // Don't render anything if no consent
  if (!hasConsent) {
    return null;
  }

  return (
    <div className={`flex justify-center ${className}`}>
      <ins
        key={`${slot}-${pathname}`} // Force re-render on navigation
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: `${width}px`, height: `${height}px` }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot={slot}
      />
    </div>
  );
}
