'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      // Show banner after short delay
      setTimeout(() => setShowBanner(true), 1000);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem('cookie-consent', 'all');
    localStorage.setItem('ads-consent', 'true');
    setShowBanner(false);
    // Enable Google Ads if script exists
    window.dispatchEvent(new Event('ads-consent-granted'));
  };

  const acceptEssential = () => {
    localStorage.setItem('cookie-consent', 'essential');
    localStorage.setItem('ads-consent', 'false');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-[hsl(230,25%,8%)] border-t border-gray-200 dark:border-[hsl(230,25%,15%)] shadow-[0_-4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
      <div className="container mx-auto max-w-4xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Wir verwenden Cookies für Werbung und zur Verbesserung deiner Erfahrung. 
              <Link href="/datenschutz" className="text-cyan-600 dark:text-cyan-400 hover:underline ml-1">
                Mehr erfahren
              </Link>
            </p>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={acceptEssential}
              className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[hsl(230,25%,15%)] hover:bg-gray-200 dark:hover:bg-[hsl(230,25%,20%)] rounded-lg transition-colors"
            >
              Nur Essenzielle
            </button>
            <button
              onClick={acceptAll}
              className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-white bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors"
            >
              Alle akzeptieren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
