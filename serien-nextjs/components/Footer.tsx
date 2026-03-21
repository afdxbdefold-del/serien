'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tv, Mail, RefreshCw, Database, ChevronRight, Github, Twitter } from 'lucide-react';

export default function Footer() {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = () => {
    if (showConfirm) {
      localStorage.clear();
      window.location.reload();
    } else {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 5000);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Personalization Bar */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-[hsl(230,25%,8%)] dark:to-[hsl(230,25%,10%)] border-t border-gray-200 dark:border-[hsl(230,25%,15%)]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Database className="w-4 h-4 text-cyan-500" />
              <span>Deine Daten werden nur lokal gespeichert</span>
            </div>
            
            <button
              onClick={handleReset}
              className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full transition-all ${
                showConfirm 
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/25' 
                  : 'bg-gray-200 dark:bg-[hsl(230,25%,15%)] text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[hsl(230,25%,20%)]'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${showConfirm ? 'animate-spin' : ''}`} />
              <span>{showConfirm ? 'Jetzt zurücksetzen?' : 'Personalisierung zurücksetzen'}</span>
            </button>
          </div>

          {showConfirm && (
            <div className="mt-3 text-center text-sm text-orange-500 dark:text-orange-400 font-medium animate-pulse">
              Klicke erneut, um alle gespeicherten Serien zu löschen
            </div>
          )}
        </div>
      </div>

      {/* Main Footer */}
      <footer className="relative bg-gradient-to-b from-gray-900 to-gray-950 dark:from-[hsl(230,25%,6%)] dark:to-[hsl(230,25%,4%)] text-gray-400 overflow-hidden">
        {/* Decorative gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
        
        {/* Subtle glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-cyan-500/5 blur-3xl pointer-events-none" />

        <div className="container mx-auto px-6 py-12 relative z-10">
          {/* Top Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="md:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/25 group-hover:shadow-cyan-500/40 transition-shadow">
                  <Tv className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">serien.de</span>
              </Link>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Deine Quelle für die neuesten Serien-News, Trailer und Streaming-Tipps.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Navigation</h4>
              <ul className="space-y-2">
                {[
                  { href: '/', label: 'News' },
                  { href: '/serienfinder', label: 'Serienfinder' },
                  { href: '/personen', label: 'Personen' },
                  { href: '/figuren', label: 'Figuren' },
                  { href: '/kalender', label: 'Kalender' },
                ].map((link) => (
                  <li key={link.href}>
                    <Link 
                      href={link.href}
                      className="text-sm text-gray-400 hover:text-cyan-400 transition-colors flex items-center gap-1 group"
                    >
                      <ChevronRight className="w-3 h-3 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Streaming */}
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Streaming</h4>
              <div className="flex flex-wrap gap-2">
                {['Netflix', 'Prime', 'Disney+', 'Apple TV+', 'Max'].map((provider) => (
                  <span 
                    key={provider}
                    className="px-3 py-1 text-xs rounded-full bg-gray-800 dark:bg-[hsl(230,25%,12%)] text-gray-400 hover:text-cyan-400 hover:bg-gray-700 dark:hover:bg-[hsl(230,25%,18%)] transition-colors cursor-default"
                  >
                    {provider}
                  </span>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Kontakt</h4>
              <a 
                href="mailto:mail@serien.de"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-cyan-400 transition-colors mb-4"
              >
                <Mail className="w-4 h-4" />
                mail@serien.de
              </a>
              <div className="flex gap-3">
                <a 
                  href="#" 
                  className="w-9 h-9 rounded-full bg-gray-800 dark:bg-[hsl(230,25%,12%)] flex items-center justify-center text-gray-400 hover:text-white hover:bg-cyan-500 transition-all"
                  aria-label="Twitter"
                >
                  <Twitter className="w-4 h-4" />
                </a>
                <a 
                  href="#" 
                  className="w-9 h-9 rounded-full bg-gray-800 dark:bg-[hsl(230,25%,12%)] flex items-center justify-center text-gray-400 hover:text-white hover:bg-cyan-500 transition-all"
                  aria-label="GitHub"
                >
                  <Github className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-700 dark:via-[hsl(230,25%,15%)] to-transparent mb-6" />

          {/* Bottom Section */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-500">
              © {currentYear} serien.de — Mit Leidenschaft für Serien
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link href="/impressum" className="text-gray-400 hover:text-cyan-400 transition-colors">
                Impressum
              </Link>
              <Link href="/datenschutz" className="text-gray-400 hover:text-cyan-400 transition-colors">
                Datenschutz
              </Link>
              <Link href="/autoren" className="text-gray-400 hover:text-cyan-400 transition-colors">
                Autoren
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
