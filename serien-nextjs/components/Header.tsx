'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, X, Menu, Loader2 } from 'lucide-react';
import Logo from './Logo';

export default function Header() {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Realtime search with debounce
  useEffect(() => {
    const performRealtimeSearch = async () => {
      // Only search if query is at least 2 characters
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

    // Debounce: wait 300ms after user stops typing
    const debounceTimer = setTimeout(() => {
      performRealtimeSearch();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    // Search is now handled by realtime effect via useEffect
  };

  const closeSearch = () => {
    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <>
      {/* Header - Brand Blue Background */}
      <header className="sticky top-0 z-50 bg-[#00b4d8] border-b border-white/10">
        {/* Top Bar */}
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Left - Logo & Nav */}
            <div className="flex items-center gap-8">
              {/* Logo */}
              <Link href="/" className="flex-shrink-0">
                <Logo className="h-8" />
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/" className="text-white text-sm font-semibold hover:text-white/80 transition-colors">
                  NEWS
                </Link>
                <Link href="/trending" className="text-white/80 text-sm font-semibold hover:text-white transition-colors">
                  TRENDING
                </Link>
                <Link href="/redaktion" className="text-white/80 text-sm font-semibold hover:text-white transition-colors">
                  REDAKTION
                </Link>
              </nav>
            </div>

            {/* Right - Search Icon & Mobile Menu */}
            <div className="flex items-center gap-3">
              {/* Search Icon - All devices */}
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
                className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
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

      {/* Search Bar - Full Width, Clean Design */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <form onSubmit={handleSearch} className="w-full">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Serien durchsuchen..."
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            {searchLoading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-600 animate-spin" />
            )}
          </div>
        </form>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="relative max-w-2xl mx-auto px-4 pb-2">
            <div className="absolute top-0 left-4 right-4 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
              <div className="p-2">
                {searchResults.map((series: any) => (
                  <Link
                    key={series.tmdbId}
                    href={`/serie/${series.tmdbId}-${series.slug}`}
                    onClick={closeSearch}
                    className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors"
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
                      <div className="font-semibold text-gray-900">{series.name}</div>
                      {series.firstAirDate && (
                        <div className="text-sm text-gray-500">
                          {new Date(series.firstAirDate).getFullYear()}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              <button
                onClick={closeSearch}
                className="w-full p-3 text-center text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-200"
              >
                Schließen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-[100]" onClick={() => setShowMobileMenu(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div 
            className="absolute right-0 top-0 h-full w-72 bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Menü</h2>
              <button 
                onClick={() => setShowMobileMenu(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <nav className="p-4 space-y-2">
              <Link 
                href="/" 
                className="block px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                NEWS
              </Link>
              <Link 
                href="/trending" 
                className="block px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                TRENDING
              </Link>
              <Link 
                href="/redaktion" 
                className="block px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                onClick={() => setShowMobileMenu(false)}
              >
                REDAKTION
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
