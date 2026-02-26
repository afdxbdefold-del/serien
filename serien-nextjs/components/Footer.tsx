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
    <footer className="bg-gray-900 text-gray-400 py-8 mt-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Left: Copyright */}
          <div className="text-sm">
            © {new Date().getFullYear()} serien.de
          </div>

          {/* Center: Links */}
          <div className="flex gap-6 text-sm">
            <button
              onClick={handleReset}
              className={`hover:text-white transition-colors ${
                showConfirm ? 'text-red-400 font-medium' : ''
              }`}
            >
              {showConfirm ? '⚠️ Jetzt zurücksetzen?' : 'Personalisierung zurücksetzen'}
            </button>
          </div>

          {/* Right: Info */}
          <div className="text-xs text-gray-500">
            Deine Daten werden nur lokal gespeichert
          </div>
        </div>

        {/* Confirmation message */}
        {showConfirm && (
          <div className="mt-4 text-center text-sm text-yellow-400">
            Klicke erneut, um alle gespeicherten Serien zu löschen
          </div>
        )}
      </div>
    </footer>
  );
}
