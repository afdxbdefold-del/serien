'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  useEffect(() => {
    // Track 404 error
    const trackNotFound = async () => {
      try {
        await fetch('/api/track/404', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: window.location.pathname,
            referrer: document.referrer || null,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (e) {
        // Silently fail
      }
    };
    
    trackNotFound();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* 404 Animation */}
        <div className="relative mb-8">
          <div className="text-[150px] font-black text-gray-200 dark:text-gray-800 leading-none select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-6xl animate-bounce">
              📺
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Seite nicht gefunden
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Die gesuchte Seite existiert nicht oder wurde verschoben. 
          Vielleicht findest du hier, was du suchst:
        </p>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors font-medium"
          >
            <Home className="h-4 w-4" />
            Startseite
          </Link>
          
          <Link
            href="/serienfinder"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            <Search className="h-4 w-4" />
            Serien suchen
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </button>
        </div>

        {/* Popular Series */}
        <div className="text-left bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Beliebte Serien
          </h2>
          <div className="flex flex-wrap gap-2">
            {['Stranger Things', 'The Last of Us', 'Wednesday', 'House of the Dragon', 'The Witcher'].map(series => (
              <Link
                key={series}
                href={`/serienfinder?q=${encodeURIComponent(series)}`}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-cyan-100 dark:hover:bg-cyan-900 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
              >
                {series}
              </Link>
            ))}
          </div>
        </div>

        {/* Debug Info (hidden) */}
        <p className="mt-8 text-xs text-gray-400 dark:text-gray-600">
          Fehler-Code: 404 | {new Date().toISOString().split('T')[0]}
        </p>
      </div>
    </main>
  );
}
