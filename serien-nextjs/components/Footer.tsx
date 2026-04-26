'use client';

import Link from 'next/link';
import { Tv, Mail, ChevronRight } from 'lucide-react';

// Social Media Links
const socialLinks = [
  { name: 'Twitter', href: 'https://x.com/serien_de', icon: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  )},
  { name: 'Instagram', href: 'https://www.instagram.com/serien_de', icon: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
  )},
  { name: 'TikTok', href: 'https://www.tiktok.com/@serien_de', icon: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.45a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.36z"/></svg>
  )},
  { name: 'Facebook', href: 'https://www.facebook.com/serien.de', icon: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  )},
  { name: 'YouTube', href: 'https://www.youtube.com/@serien189', icon: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
  )},
  { name: 'Discord', href: 'https://discord.gg/4f6pdexwpY', icon: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
  )},
];

// Podcast Links
const podcastLinks = [
  { name: 'Spotify', href: 'https://open.spotify.com/show/31qSuSLYbArv4q4bCzaCVR' },
  { name: 'Apple', href: 'https://podcasts.apple.com/us/podcast/serien-de-podcast/id1579184715' },
  { name: 'Amazon', href: 'https://music.amazon.de/podcasts/98e4c1c9-15a2-41e8-aa77-2c94b8d59345/SERIENDE-PODCAST' },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Main Footer */}
      <footer className="relative bg-gray-100 dark:bg-gradient-to-b dark:from-[hsl(230,25%,6%)] dark:to-[hsl(230,25%,4%)] text-gray-600 dark:text-gray-400 overflow-hidden border-t border-gray-200 dark:border-transparent">
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
                <span className="text-xl font-bold text-gray-900 dark:text-white">serien.de</span>
              </Link>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Deine Quelle für die neuesten Serien-News, Trailer und Streaming-Tipps.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <p className="text-gray-900 dark:text-white font-semibold mb-4 text-sm uppercase tracking-wider">Navigation</p>
              <ul className="space-y-2">
                {[
                  { href: '/', label: 'News' },
                  { href: '/top-100-serien', label: 'Top 100 Serien' },
                  { href: '/serienfinder', label: 'Serienfinder' },
                  { href: '/personen', label: 'Personen' },
                  { href: '/figuren', label: 'Figuren' },
                  { href: '/kalender', label: 'Kalender' },
                ].map((link) => (
                  <li key={link.href}>
                    <Link 
                      href={link.href}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors flex items-center gap-1 group"
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
              <p className="text-gray-900 dark:text-white font-semibold mb-4 text-sm uppercase tracking-wider">Streaming</p>
              <div className="flex flex-wrap gap-2">
                {['Netflix', 'Prime', 'Disney+', 'Apple TV+', 'Max'].map((provider) => (
                  <span 
                    key={provider}
                    className="px-3 py-1 text-xs rounded-full bg-gray-200 dark:bg-[hsl(230,25%,12%)] text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-gray-300 dark:hover:bg-[hsl(230,25%,18%)] transition-colors cursor-default"
                  >
                    {provider}
                  </span>
                ))}
              </div>
            </div>

            {/* Contact & Social */}
            <div>
              <p className="text-gray-900 dark:text-white font-semibold mb-4 text-sm uppercase tracking-wider">Folge uns</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {socialLinks.map((social) => (
                  <a 
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-gray-200 dark:bg-[hsl(230,25%,12%)] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-white hover:bg-cyan-500 transition-all"
                    aria-label={social.name}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
              
              <p className="text-gray-900 dark:text-white font-semibold mb-3 text-sm uppercase tracking-wider">Podcast</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {podcastLinks.map((podcast) => (
                  <a 
                    key={podcast.name}
                    href={podcast.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 text-xs rounded-full bg-gray-200 dark:bg-[hsl(230,25%,12%)] text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-gray-300 dark:hover:bg-[hsl(230,25%,18%)] transition-colors"
                  >
                    {podcast.name}
                  </a>
                ))}
              </div>
              
              <a 
                href="mailto:mail@serien.de"
                className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors"
              >
                <Mail className="w-4 h-4" />
                mail@serien.de
              </a>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-[hsl(230,25%,15%)] to-transparent mb-6" />

          {/* Bottom Section */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-500">
              © {currentYear} serien.de — Mit Leidenschaft für Serien
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link href="/about" className="text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
                Über uns
              </Link>
              <Link href="/impressum" className="text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
                Impressum
              </Link>
              <Link href="/datenschutz" className="text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
                Datenschutz
              </Link>
              <Link href="/nutzungsbedingungen" className="text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
                Nutzungsbedingungen
              </Link>
              <Link href="/redaktionelle-richtlinien" className="text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
                Redaktionelle Richtlinien
              </Link>
              <Link href="/autoren" className="text-gray-500 dark:text-gray-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors">
                Autoren
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
