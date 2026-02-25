'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Search, User, Menu, X } from 'lucide-react';

export default function Header() {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-brand text-white border-b border-white/10">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-brand font-bold text-xl">S</span>
            </div>
            <span className="text-xl font-bold">serien.de</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="hover:text-white/80 transition">NEWS</Link>
            <Link href="/trending" className="hover:text-white/80 transition">TRENDING</Link>
            <Link href="/redaktion" className="hover:text-white/80 transition">REDAKTION</Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Search Button */}
            <button 
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Notifications */}
            <button className="p-2 hover:bg-white/10 rounded-lg transition relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User */}
            <button className="p-2 hover:bg-white/10 rounded-lg transition">
              <User className="w-5 h-5" />
            </button>

            {/* Mobile Menu */}
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 hover:bg-white/10 rounded-lg transition"
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="py-3 border-t border-white/10">
            <input
              type="text"
              placeholder="Serien durchsuchen..."
              className="w-full py-2 px-4 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/70 focus:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="md:hidden border-t border-white/10 bg-brand">
          <nav className="flex flex-col p-4 gap-2">
            <Link href="/" className="py-2 hover:text-white/80 transition">NEWS</Link>
            <Link href="/trending" className="py-2 hover:text-white/80 transition">TRENDING</Link>
            <Link href="/redaktion" className="py-2 hover:text-white/80 transition">REDAKTION</Link>
          </nav>
        </div>
      )}
    </header>
  );
}