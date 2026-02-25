'use client';

import { useState } from 'react';
import { Newspaper, Sparkles, Tv, SlidersHorizontal } from 'lucide-react';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('news');

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-700 text-white pt-20 pb-32 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Folge deinen Lieblingsserien
          </h1>
          
          <p className="text-xl mb-12">
            oder entdecke{' '}
            <a href="/trending" className="underline font-medium">
              neue Serien
            </a>{' '}
            zum Anschauen.
          </p>

          {/* Google Button */}
          <button className="w-full max-w-md mx-auto bg-white text-gray-800 py-3.5 px-6 rounded-xl font-medium flex items-center justify-center gap-3 shadow-lg hover:bg-gray-50 transition mb-6">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Mit Google fortfahren
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6 max-w-md mx-auto">
            <div className="flex-1 h-px bg-white/30"></div>
            <span className="text-white/80 text-sm">oder</span>
            <div className="flex-1 h-px bg-white/30"></div>
          </div>

          {/* Email Button */}
          <button className="w-full max-w-md mx-auto bg-transparent text-white py-3.5 px-6 rounded-xl font-medium border-2 border-white/40 hover:bg-white/10 transition">
            Anmelden per E-Mail
          </button>
        </div>
      </section>

      {/* Tab Buttons */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={() => setActiveTab('news')}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg transition ${
                activeTab === 'news'
                  ? 'bg-gray-100'
                  : 'hover:bg-gray-50'
              }`}
            >
              <Newspaper className="w-5 h-5" />
              <span className="font-medium">News</span>
            </button>

            <button
              onClick={() => setActiveTab('feed')}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg transition ${
                activeTab === 'feed'
                  ? 'bg-gray-100'
                  : 'hover:bg-gray-50'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">Mein Feed</span>
            </button>

            <button
              onClick={() => setActiveTab('serien')}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg transition ${
                activeTab === 'serien'
                  ? 'bg-gray-100'
                  : 'hover:bg-gray-50'
              }`}
            >
              <Tv className="w-5 h-5" />
              <span className="font-medium">Serien</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {activeTab === 'news' && (
          <div className="text-center text-gray-500">
            <p>Keine News gefunden.</p>
            <p className="text-sm mt-2">Melde dich an, um personalisierte Inhalte zu sehen.</p>
          </div>
        )}

        {activeTab === 'feed' && (
          <div className="text-center text-gray-500">
            <p>Dein Feed ist leer.</p>
            <p className="text-sm mt-2">Folge Serien, um Updates zu erhalten.</p>
          </div>
        )}

        {activeTab === 'serien' && (
          <div className="text-center text-gray-500">
            <p>Keine Serien gefunden.</p>
          </div>
        )}
      </div>

      {/* Filter FAB */}
      <button className="fixed bottom-6 right-6 bg-[#00b4d8] text-white py-3 px-6 rounded-full shadow-xl hover:bg-[#0096b8] transition flex items-center gap-2 z-50">
        <SlidersHorizontal className="w-5 h-5" />
        <span className="font-medium">Filter</span>
      </button>
    </div>
  );
}
