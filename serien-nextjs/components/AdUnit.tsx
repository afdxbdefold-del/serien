'use client';

import { useEffect, useState, useRef } from 'react';
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
  const [hasConsent, setHasConsent] = useState(false);
  const [isProduction, setIsProduction] = useState(false);
  const adRef = useRef<HTMLModElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Check if we're in production
    setIsProduction(window.location.hostname !== 'localhost' && !window.location.hostname.includes('preview'));
    
    // Check for cookie consent
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

  // Re-initialize ad on route change
  useEffect(() => {
    if (hasConsent && isProduction && adRef.current) {
      // Small delay for DOM to be ready
      const timer = setTimeout(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          // Silently ignore
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [hasConsent, isProduction, pathname]);

  // Don't render anything if no consent
  if (!hasConsent) {
    return null;
  }

  // Show placeholder in development/preview
  if (!isProduction) {
    return (
      <div className={`ad-container ${className}`}>
        <div className="bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
            Werbeanzeige
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
            (Wird in Produktion angezeigt)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`ad-container ${className}`}>
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
