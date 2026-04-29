'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, Menu, Loader2, ChevronDown, Tv, Users, PenLine, Compass, Play, Flame } from 'lucide-react';
import Logo from './Logo';
import { ThemeToggle } from './ThemeToggle';

// Streaming providers data
const STREAMING_PROVIDERS = [
  { name: 'Netflix', href: '/netflix-serien', badge: 'N', bg: 'bg-red-600' },
  { name: 'Prime Video', href: '/prime-video-serien', badge: 'P', bg: 'bg-cyan-500' },
  { name: 'Disney+', href: '/disney-plus-serien', badge: 'D', bg: 'bg-blue-600' },
  { name: 'HBO Max', href: '/hbo-serien', badge: 'H', bg: 'bg-purple-600' },
  { name: 'Apple TV+', href: '/apple-tv-serien', badge: 'A', bg: 'bg-gray-800' },
  { name: 'WOW', href: '/wow-serien', badge: 'W', bg: 'bg-sky-500' },
  { name: 'RTL+', href: '/rtl-plus-serien', badge: 'R', bg: 'bg-orange-500' },
  { name: 'Paramount+', href: '/paramount-plus-serien', badge: 'P+', bg: 'bg-blue-700' },
  { name: 'Joyn', href: '/joyn-serien', badge: 'J', bg: 'bg-pink-500' },
  { name: 'MagentaTV', href: '/magenta-tv-serien', badge: 'M', bg: 'bg-fuchsia-600' },
  { name: 'Discovery+', href: '/discovery-plus-serien', badge: 'D+', bg: 'bg-blue-600' },
  { name: 'Crunchyroll', href: '/crunchyroll-serien', badge: 'CR', bg: 'bg-orange-500' },
  { name: 'ARD', href: '/ard-mediathek-serien', badge: 'ARD', bg: 'bg-blue-700' },
  { name: 'ZDF', href: '/zdf-mediathek-serien', badge: 'ZDF', bg: 'bg-orange-500' },
  { name: 'CHILI', href: '/chili-serien', badge: 'C', bg: 'bg-red-600' },
  { name: 'Rakuten TV', href: '/rakuten-tv-serien', badge: 'R', bg: 'bg-violet-600' },
  { name: 'freenet Video', href: '/freenet-video-serien', badge: 'fn', bg: 'bg-green-600' },
  { name: 'maxdome', href: '/maxdome-serien', badge: 'md', bg: 'bg-teal-600' },
];

// More menu items
const MORE_ITEMS = [
  { name: 'Top 100 Serien', href: '/top-100-serien', icon: Flame, description: 'Täglich aktualisiertes Ranking' },
  { name: 'Top 100 Netflix', href: '/top-100-netflix', icon: Flame, description: 'Die besten Netflix-Serien' },
  { name: 'Top 100 Prime Video', href: '/top-100-amazon-prime', icon: Flame, description: 'Die besten Prime-Serien' },
  { name: 'Top 100 Disney+', href: '/top-100-disney-plus', icon: Flame, description: 'Die besten Disney+ Serien' },
  { name: 'Beste Crime-Serien', href: '/beste-crime-serien', icon: Flame, description: 'Krimis & Thriller' },
  { name: 'Beste Comedy-Serien', href: '/beste-comedy-serien', icon: Flame, description: 'Sitcoms & Comedy' },
  { name: 'Beste Drama-Serien', href: '/beste-drama-serien', icon: Flame, description: 'Prestige & Family Drama' },
  { name: 'Beste Mystery-Serien', href: '/beste-mystery-serien', icon: Flame, description: 'Rätsel & Twists' },
  { name: 'Beste Sci-Fi-Serien', href: '/beste-sci-fi-serien', icon: Flame, description: 'Sci-Fi & Fantasy' },
  { name: 'Trending', href: '/trending', icon: Flame, description: 'Was Deutschland gerade schaut' },
  { name: 'Serienfinder', href: '/serienfinder', icon: Compass, description: 'Finde deine nächste Serie' },
  { name: '90 Day Fiancé', href: '/in-90-tagen-zum-altar', icon: Tv, description: 'Franchise Hub' },
  { name: 'Walking Dead', href: '/the-walking-dead', icon: Tv, description: 'Franchise Hub' },
  { name: 'Personen', href: '/personen', icon: Users, description: 'Schauspieler & Crew' },
  { name: 'Figuren', href: '/figuren', icon: Tv, description: 'Beliebte Seriencharaktere' },
  { name: 'Autoren', href: '/autoren', icon: PenLine, description: 'Unsere Redaktion' },
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

              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-1">
                {/* NEWS */}
                <Link 
                  href="/news" 
                  className="text-white text-sm font-semibold hover:bg-white/10 px-3 py-2 rounded-lg transition-colors"
                  data-testid="nav-news-link"
                >
                  NEWS
                </Link>
                
                {/* ALLE SERIEN A–Z */}
                <Link
                  href="/serien"
                  className="text-white text-sm font-semibold hover:bg-white/10 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                  data-testid="nav-serien-az-link"
                >
                  <Tv className="w-4 h-4" />
                  ALLE SERIEN A–Z
                </Link>

                {/* TOP 10 */}
                <Link 
                  href="/top-10" 
                  className="text-white text-sm font-semibold hover:bg-white/10 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                  data-testid="nav-top10-link"
                >
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">TOP 10</span>
                  HEUTE
                </Link>

                {/* NEU HEUTE */}
                <Link 
                  href="/neue-serien" 
                  className="text-white text-sm font-semibold hover:bg-white/10 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse">NEU</span>
                  HEUTE
                </Link>

                {/* STREAMING Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === 'streaming' ? null : 'streaming')}
                    className={`text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                      activeDropdown === 'streaming' ? 'bg-white/20' : 'hover:bg-white/10'
                    }`}
                  >
                    <Play className="w-4 h-4" fill="currentColor" />
                    STREAMING
                    <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'streaming' ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Mega Menu */}
                  {activeDropdown === 'streaming' && (
                    <div className="absolute top-full left-0 mt-2 w-[600px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Streaming-Dienste
                        </h3>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {STREAMING_PROVIDERS.map((provider) => (
                          <Link
                            key={provider.href}
                            href={provider.href}
                            onClick={() => setActiveDropdown(null)}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                          >
                            <span className={`${provider.bg} text-white text-[10px] font-bold px-2 py-1 rounded min-w-[28px] text-center`}>
                              {provider.badge}
                            </span>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                              {provider.name}
                            </span>
                          </Link>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
                        <Link
                          href="/top-10"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 font-medium hover:underline"
                          data-testid="megamenu-top10-link"
                        >
                          <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">TOP 10</span>
                          Die Top 10 auf allen Streamern →
                        </Link>
                        <Link
                          href="/neue-serien"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-center gap-2 text-sm text-cyan-600 dark:text-cyan-400 font-medium hover:underline"
                        >
                          <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">NEU</span>
                          Alle Neuheiten heute ansehen →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* MEHR Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === 'more' ? null : 'more')}
                    className={`text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                      activeDropdown === 'more' ? 'bg-white/20' : 'hover:bg-white/10'
                    }`}
                  >
                    MEHR
                    <ChevronDown className={`w-4 h-4 transition-transform ${activeDropdown === 'more' ? 'rotate-180' : ''}`} />
                  </button>

                  {/* More Dropdown */}
                  {activeDropdown === 'more' && (
                    <div className="absolute top-full left-0 mt-2 w-[280px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      {MORE_ITEMS.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                            <item.icon className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                              {item.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.description}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </nav>
            </div>

            {/* Right - Theme Toggle, Search Icon & Mobile Menu */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle - Desktop */}
              <div className="hidden md:block">
                <ThemeToggle variant="icon" />
              </div>
              
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
              {/* Main Links */}
              <div className="space-y-1 mb-6">
                <Link 
                  href="/news" 
                  className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg font-medium"
                  onClick={() => setShowMobileMenu(false)}
                >
                  NEWS
                </Link>
                <Link 
                  href="/top-10" 
                  className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg font-medium"
                  onClick={() => setShowMobileMenu(false)}
                  data-testid="mobile-menu-top10-link"
                >
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">TOP 10</span>
                  TOP 10 HEUTE
                </Link>
                <Link 
                  href="/neue-serien" 
                  className="flex items-center gap-2 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg font-medium"
                  onClick={() => setShowMobileMenu(false)}
                >
                  <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse">NEU</span>
                  HEUTE NEU
                </Link>
                <Link 
                  href="/serienfinder" 
                  className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg font-medium"
                  onClick={() => setShowMobileMenu(false)}
                >
                  SERIENFINDER
                </Link>
              </div>

              {/* Streaming Section */}
              <div className="mb-6">
                <h3 className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Streaming-Dienste
                </h3>
                <div className="grid grid-cols-2 gap-1">
                  {STREAMING_PROVIDERS.map((provider) => (
                    <Link
                      key={provider.href}
                      href={provider.href}
                      onClick={() => setShowMobileMenu(false)}
                      className="flex items-center gap-2 px-3 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-sm"
                    >
                      <span className={`${provider.bg} text-white text-[9px] font-bold px-1.5 py-0.5 rounded min-w-[24px] text-center`}>
                        {provider.badge}
                      </span>
                      <span className="truncate">{provider.name}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* More Section */}
              <div className="mb-6">
                <h3 className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Mehr entdecken
                </h3>
                <div className="space-y-1">
                  {MORE_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMobileMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                    >
                      <item.icon className="w-5 h-5 text-gray-400" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Theme Toggle */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <ThemeToggle variant="menu" />
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
