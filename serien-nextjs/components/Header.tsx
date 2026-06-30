'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, Menu, Loader2 } from 'lucide-react';
import Logo from './Logo';

// Streaming providers data
const STREAMING_PROVIDERS = [
  { name: 'Netflix', href: '/netflix-serien' },
  { name: 'Prime Video', href: '/prime-video-serien' },
  { name: 'Disney+', href: '/disney-plus-serien' },
  { name: 'HBO Max', href: '/hbo-serien' },
  { name: 'Apple TV+', href: '/apple-tv-serien' },
  { name: 'WOW', href: '/wow-serien' },
  { name: 'RTL+', href: '/rtl-plus-serien' },
  { name: 'Paramount+', href: '/paramount-plus-serien' },
  { name: 'Joyn', href: '/joyn-serien' },
  { name: 'MagentaTV', href: '/magenta-tv-serien' },
  { name: 'Discovery+', href: '/discovery-plus-serien' },
  { name: 'Crunchyroll', href: '/crunchyroll-serien' },
  { name: 'ARD', href: '/ard-mediathek-serien' },
  { name: 'ZDF', href: '/zdf-mediathek-serien' },
  { name: 'CHILI', href: '/chili-serien' },
  { name: 'Rakuten TV', href: '/rakuten-tv-serien' },
  { name: 'freenet Video', href: '/freenet-video-serien' },
  { name: 'maxdome', href: '/maxdome-serien' },
];

// More menu items — Icon-/Badge-Spalte entfernt (User-Wunsch: keine Icons im
// Header-Menü, keine Grossschrift). Nur Label + Beschreibung.
const MORE_ITEMS = [
  { name: 'Top 100 Serien', href: '/top-100-serien', description: 'Täglich aktualisiertes Ranking' },
  { name: 'Top 100 Netflix', href: '/top-100-netflix', description: 'Die besten Netflix-Serien' },
  { name: 'Top 100 Prime Video', href: '/top-100-amazon-prime', description: 'Die besten Prime-Serien' },
  { name: 'Top 100 Disney+', href: '/top-100-disney-plus', description: 'Die besten Disney+ Serien' },
  { name: 'Beste Crime-Serien', href: '/beste-crime-serien', description: 'Krimis & Thriller' },
  { name: 'Beste Comedy-Serien', href: '/beste-comedy-serien', description: 'Sitcoms & Comedy' },
  { name: 'Beste Drama-Serien', href: '/beste-drama-serien', description: 'Prestige & Family Drama' },
  { name: 'Beste Mystery-Serien', href: '/beste-mystery-serien', description: 'Rätsel & Twists' },
  { name: 'Beste Sci-Fi-Serien', href: '/beste-sci-fi-serien', description: 'Sci-Fi & Fantasy' },
  { name: 'Trending', href: '/trending', description: 'Was Deutschland gerade schaut' },
  { name: 'Serienfinder', href: '/serienfinder', description: 'Finde deine nächste Serie' },
  { name: '90 Day Fiancé', href: '/in-90-tagen-zum-altar', description: 'Franchise Hub' },
  { name: 'Walking Dead', href: '/the-walking-dead', description: 'Franchise Hub' },
  { name: 'Personen', href: '/personen', description: 'Schauspieler & Crew' },
  { name: 'Figuren', href: '/figuren', description: 'Beliebte Seriencharaktere' },
  { name: 'Autoren', href: '/autoren', description: 'Unsere Redaktion' },
];

export default function Header() {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'streaming' | 'more' | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Realtime search with debounce
  useEffect(() => {
    const performRealtimeSearch = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      setSearchLoading(true);
      
      try {
        const response = await fetch(`/api/series/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
          setShowSearchResults(data.length > 0);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      performRealtimeSearch();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
  };

  const closeSearch = () => {
    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#00b4d8]">
        <div className="container mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between h-16">
            {/* Left - Logo & Nav */}
            <div className="flex items-center gap-6" ref={dropdownRef}>
              {/* Logo */}
              <Link href="/" className="flex-shrink-0">
                <Logo className="h-8" />
              </Link>

              {/* Desktop Navigation — keine Icons, keine Uppercase, keine
                  farbigen Badges (User-Wunsch: schlichte Textlinks). */}
              <nav className="hidden lg:flex items-center gap-1">
                <Link
                  href="/news"
                  className="text-white text-sm font-medium hover:bg-white/10 px-3 py-2 rounded-lg transition-colors"
                  data-testid="nav-news-link"
                >
                  News
                </Link>

                <Link
                  href="/serien"
                  className="text-white text-sm font-medium hover:bg-white/10 px-3 py-2 rounded-lg transition-colors"
                  data-testid="nav-serien-az-link"
                >
                  Alle Serien A–Z
                </Link>

                <Link
                  href="/top-10"
                  className="text-white text-sm font-medium hover:bg-white/10 px-3 py-2 rounded-lg transition-colors"
                  data-testid="nav-top10-link"
                >
                  Top 10 heute
                </Link>

                <Link
                  href="/neue-serien"
                  className="text-white text-sm font-medium hover:bg-white/10 px-3 py-2 rounded-lg transition-colors"
                >
                  Neu heute
                </Link>

                {/* Streaming Dropdown — kein Icon vor dem Label, kein
                    Chevron-Indikator. Klick auf Label öffnet/schließt. */}
                <div className="relative">
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === 'streaming' ? null : 'streaming')}
                    className={`text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                      activeDropdown === 'streaming' ? 'bg-white/20' : 'hover:bg-white/10'
                    }`}
                  >
                    Streaming
                  </button>

                  {/* Mega Menu */}
                  {activeDropdown === 'streaming' && (
                    <div className="absolute top-full left-0 mt-2 w-[600px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                          Streaming-Dienste
                        </h3>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {STREAMING_PROVIDERS.map((provider) => (
                          <Link
                            key={provider.href}
                            href={provider.href}
                            onClick={() => setActiveDropdown(null)}
                            className="block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                          >
                            {provider.name}
                          </Link>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                        <Link
                          href="/top-10"
                          onClick={() => setActiveDropdown(null)}
                          className="block text-sm text-amber-600 dark:text-amber-400 font-medium hover:underline"
                          data-testid="megamenu-top10-link"
                        >
                          Die Top 10 auf allen Streamern →
                        </Link>
                        <Link
                          href="/neue-serien"
                          onClick={() => setActiveDropdown(null)}
                          className="block text-sm text-cyan-600 dark:text-cyan-400 font-medium hover:underline"
                        >
                          Alle Neuheiten heute ansehen →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mehr Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === 'more' ? null : 'more')}
                    className={`text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                      activeDropdown === 'more' ? 'bg-white/20' : 'hover:bg-white/10'
                    }`}
                  >
                    Mehr
                  </button>

                  {/* More Dropdown */}
                  {activeDropdown === 'more' && (
                    <div className="absolute top-full left-0 mt-2 w-[280px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      {MORE_ITEMS.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setActiveDropdown(null)}
                          className="block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                        >
                          <div className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                            {item.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.description}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </nav>
            </div>

            {/* Right - Search Icon & Mobile Menu */}
            <div className="flex items-center gap-2">
              {/* Search Icon */}
              <button 
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Toggle search"
              >
                {showSearch ? (
                  <X className="h-6 w-6 text-white" />
                ) : (
                  <Search className="h-6 w-6 text-white" />
                )}
              </button>

              {/* Mobile Menu Toggle */}
              <button 
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Toggle menu"
              >
                {showMobileMenu ? (
                  <X className="h-6 w-6 text-white" />
                ) : (
                  <Menu className="h-6 w-6 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      {showSearch && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg">
          <form onSubmit={handleSearch} className="w-full">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Serien durchsuchen..."
                autoFocus
                className="w-full pl-12 pr-4 py-4 bg-transparent border-0 focus:outline-none text-lg text-gray-900 dark:text-white"
              />
              {searchLoading && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-600 animate-spin" />
              )}
            </div>
          </form>

          {/* Search Results */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="max-w-4xl mx-auto px-4 pb-4">
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-96 overflow-y-auto">
                <div className="p-2">
                  {searchResults.map((series: any) => (
                    <Link
                      key={series.tmdbId}
                      href={`/serie/${series.slug}`}
                      onClick={() => {
                        closeSearch();
                        setShowSearch(false);
                      }}
                      className="flex items-center gap-4 p-3 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {series.posterLocalUrl && (
                        <div className="relative w-12 h-16 rounded overflow-hidden flex-shrink-0">
                          <Image
                            src={series.posterLocalUrl}
                            alt={series.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 dark:text-white">{series.name}</div>
                        {series.firstAirDate && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(series.firstAirDate).getFullYear()}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-[100]" onClick={() => setShowMobileMenu(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div 
            className="absolute right-0 top-0 h-full w-80 bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Mobile Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Menü</h2>
              <button 
                onClick={() => setShowMobileMenu(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <nav className="p-4">
              {/* Main Links — Plain Text, keine Icons, keine Badges, kein
                  Uppercase. */}
              <div className="space-y-1 mb-6">
                <Link
                  href="/news"
                  className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg font-medium"
                  onClick={() => setShowMobileMenu(false)}
                >
                  News
                </Link>
                <Link
                  href="/serien"
                  className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg font-medium"
                  onClick={() => setShowMobileMenu(false)}
                  data-testid="mobile-menu-serien-az-link"
                >
                  Alle Serien A–Z
                </Link>
                <Link
                  href="/top-10"
                  className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg font-medium"
                  onClick={() => setShowMobileMenu(false)}
                  data-testid="mobile-menu-top10-link"
                >
                  Top 10 heute
                </Link>
                <Link
                  href="/neue-serien"
                  className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg font-medium"
                  onClick={() => setShowMobileMenu(false)}
                >
                  Heute neu
                </Link>
                <Link
                  href="/serienfinder"
                  className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg font-medium"
                  onClick={() => setShowMobileMenu(false)}
                >
                  Serienfinder
                </Link>
              </div>

              {/* Streaming Section — kein Badge, kein Uppercase. */}
              <div className="mb-6">
                <h3 className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Streaming-Dienste
                </h3>
                <div className="grid grid-cols-2 gap-1">
                  {STREAMING_PROVIDERS.map((provider) => (
                    <Link
                      key={provider.href}
                      href={provider.href}
                      onClick={() => setShowMobileMenu(false)}
                      className="block px-3 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-sm truncate"
                    >
                      {provider.name}
                    </Link>
                  ))}
                </div>
              </div>

              {/* More Section — kein Icon, kein Uppercase. */}
              <div className="mb-6">
                <h3 className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  Mehr entdecken
                </h3>
                <div className="space-y-1">
                  {MORE_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMobileMenu(false)}
                      className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg font-medium"
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
