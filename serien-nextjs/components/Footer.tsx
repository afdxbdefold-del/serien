'use client';

import { useState } from 'react';

export default function Footer() {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = () => {
    if (showConfirm) {
      // Clear all localStorage data
      localStorage.clear();
      
      // Reload page to reflect changes
      window.location.reload();
    } else {
      setShowConfirm(true);
      
      // Auto-hide confirmation after 5 seconds
      setTimeout(() => setShowConfirm(false), 5000);
    }
  };

  return (
    <>
      {/* Personalization Navigation Bar (above footer) */}
      <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              💾 Deine Daten werden nur lokal gespeichert
            </div>
            
            <button
              onClick={handleReset}
              className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${
                showConfirm 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {showConfirm ? '⚠️ Jetzt zurücksetzen?' : '🔄 Personalisierung zurücksetzen'}
            </button>
          </div>

          {/* Confirmation message */}
          {showConfirm && (
            <div className="mt-3 text-center text-sm text-orange-600 dark:text-orange-400 font-medium">
              ⚠️ Klicke erneut, um alle gespeicherten Serien zu löschen
            </div>
          )}
        </div>
      </div>

      {/* Main Footer */}
      <footer className="bg-gray-900 dark:bg-gray-950 text-gray-400 py-8 border-t border-gray-800">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Left: Copyright */}
            <div className="text-sm">
              © {new Date().getFullYear()} serien.de
            </div>

            {/* Center: Links */}
            <div className="flex gap-6 text-sm">
              <a href="/impressum" className="hover:text-white transition-colors">
                Impressum
              </a>
              <a href="/datenschutz" className="hover:text-white transition-colors">
                Datenschutz
              </a>
              <a href="mailto:mail@serien.de" className="hover:text-white transition-colors">
                Kontakt
              </a>
            </div>

            {/* Right: Info */}
            <div className="text-xs text-gray-500">
              Deine Quelle für Serien-News
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
