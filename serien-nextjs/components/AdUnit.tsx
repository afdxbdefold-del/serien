'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
  const [adKey, setAdKey] = useState(0);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const lastPathRef = useRef(pathname);

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

  // Force re-render and re-initialize ad on route change
  useEffect(() => {
    if (pathname !== lastPathRef.current) {
      lastPathRef.current = pathname;
      // Increment key to force complete re-mount of ad element
      setAdKey(prev => prev + 1);
    }
  }, [pathname]);

  // Initialize ad when component mounts or key changes
  useEffect(() => {
    if (!hasConsent || !isProduction) return;

    // Wait for DOM to be ready
    const timer = setTimeout(() => {
      try {
        // Push new ad request
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.log('Ad push error:', e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [hasConsent, isProduction, adKey]);

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
    <div 
      ref={adContainerRef}
      className={`ad-container flex justify-center ${className}`}
    >
      <ins
        key={`ad-${slot}-${adKey}`}
        className="adsbygoogle"
        style={{ display: 'inline-block', width: `${width}px`, height: `${height}px` }}
        data-ad-client="ca-pub-8583619451045805"
        data-ad-slot={slot}
      />
    </div>
  );
}
