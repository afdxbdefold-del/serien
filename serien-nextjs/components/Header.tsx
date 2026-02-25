'use client';

import { User } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-[#00b4d8] text-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-[#00b4d8] font-bold text-lg">S</span>
            </div>
            <span className="font-semibold">serien.de</span>
          </Link>

          {/* User Icon */}
          <button className="p-2 hover:bg-white/10 rounded-full transition">
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
