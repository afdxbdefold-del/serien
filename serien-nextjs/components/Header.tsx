'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Search, User, LogOut, Settings, X, Menu } from 'lucide-react';
import Logo from './Logo';
import AuthModal from './AuthModal';

export default function Header() {
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Auth state
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth immediately (no delay needed with router.replace)
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include', // Important: Send cookies with request
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include' // Important: Send cookies
      });
      setUser(null);
      setShowUserMenu(false);
      window.location.href = '/'; // Force full reload to clear all state
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    try {
      const response = await fetch(`/api/series/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const closeSearch = () => {
    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';

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
                {isAdmin && (
                  <Link href="/admin" className="text-yellow-300 text-sm font-semibold hover:text-yellow-200 transition-colors">
                    ADMIN
                  </Link>
                )}
              </nav>
            </div>

            {/* Right - Search & User */}
            <div className="flex items-center gap-3">
              {/* Mobile Menu Toggle */}
              <button 
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors order-last"
                aria-label="Toggle menu"
              >
                {showMobileMenu ? (
                  <X className="h-6 w-6 text-white" />
                ) : (
                  <Menu className="h-6 w-6 text-white" />
                )}
              </button>

              {/* Search Bar - Desktop */}
              <form onSubmit={handleSearch} className="hidden md:block">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Serien durchsuchen..."
                    className="w-64 px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/60 focus:outline-none focus:border-white/40 focus:bg-white/15 transition-colors"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                </div>
              </form>

              {loading ? (
                <div className="w-8 h-8 rounded-full bg-white/20 animate-pulse" />
              ) : isAuthenticated ? (
                <>
                  {/* User Menu */}
                  <div className="relative user-menu-container">
                    <button 
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover border-2 border-white/20 shadow-lg"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/50 to-cyan-500/50 flex items-center justify-center border-2 border-white/15 shadow-lg backdrop-blur-sm">
                          <User className="h-4 w-4 text-white/90" />
                        </div>
                      )}
                    </button>

                    {/* User Menu Dropdown */}
                    {showUserMenu && (
                      <>
                        <div 
                          className="fixed inset-0 z-40"
                          onClick={() => setShowUserMenu(false)}
                        />
                        <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-2xl z-50">
                          <div className="p-4 border-b border-gray-200">
                            <div className="font-semibold text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                          <div className="p-2">
                            <Link
                              href="/einstellungen"
                              onClick={() => setShowUserMenu(false)}
                              className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Settings className="h-4 w-4" />
                              <span>Einstellungen</span>
                            </Link>
                            <button
                              onClick={handleLogout}
                              className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                              <LogOut className="h-4 w-4" />
                              <span>Abmelden</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 bg-white text-cyan-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Anmelden</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Search Bar - Below Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-4">
          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Serien durchsuchen..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {searchLoading && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-600 animate-spin" />
              )}
            </div>
          </form>

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="relative max-w-2xl mx-auto mt-2">
              <div className="absolute top-0 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
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
              {isAdmin && (
                <Link 
                  href="/admin" 
                  className="block px-4 py-3 text-yellow-600 hover:bg-gray-50 rounded-lg transition-colors font-medium"
                  onClick={() => setShowMobileMenu(false)}
                >
                  ADMIN
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => {
          setShowAuthModal(false);
          checkAuth(); // Refresh auth state after login
        }} 
      />
    </>
  );
}
