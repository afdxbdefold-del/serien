import './globals.css';

export const metadata = {
  title: 'Serien-News, Trailer & Updates | serien.de',
  description: 'Serien.de – News, Trailer & Updates zu deinen Lieblingsserien. Folge Serien, entdecke neue Highlights und verpasse keine wichtigen Updates mehr.',
  metadataBase: new URL('https://serien-de.vercel.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-gray-50">
        {/* Top Navigation Bar */}
        <header className="bg-[#00b4d8] text-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-14">
              {/* Logo */}
              <a href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <span className="text-[#00b4d8] font-bold text-lg">S</span>
                </div>
                <span className="font-semibold">serien.de</span>
              </a>

              {/* Center Navigation */}
              <nav className="hidden md:flex items-center gap-6">
                <a href="/news" className="text-sm font-medium hover:text-white/80 transition">
                  NEWS
                </a>
                <a href="/trending" className="text-sm font-medium hover:text-white/80 transition">
                  TRENDING
                </a>
                <a href="/redaktion" className="text-sm font-medium hover:text-white/80 transition">
                  REDAKTION
                </a>
              </nav>

              {/* Right Side */}
              <div className="flex items-center gap-3">
                {/* Search Field */}
                <div className="hidden md:block relative">
                  <input
                    type="text"
                    placeholder="Serien durchsuchen..."
                    className="w-48 lg:w-64 py-2 px-4 pl-10 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/70 focus:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                  <svg 
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* User Icon */}
                <button className="p-2 hover:bg-white/10 rounded-lg transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main>{children}</main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-20 py-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Column 1 */}
              <div>
                <h3 className="font-bold text-gray-900 mb-4">serien.de</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Deine Quelle für TV-Serien News
                </p>
                <p className="text-sm text-gray-500">📺 ... Serien</p>
                <p className="text-sm text-gray-500">🎬 ... Artikel</p>
              </div>

              {/* Column 2 - Navigation */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Navigation</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><a href="/news" className="hover:text-blue-600 transition">News</a></li>
                  <li><a href="/trending" className="hover:text-blue-600 transition">Trending</a></li>
                  <li><a href="/redaktion" className="hover:text-blue-600 transition">Redaktion</a></li>
                </ul>
              </div>

              {/* Column 3 - Legal */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Rechtliches</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><a href="/impressum" className="hover:text-blue-600 transition">Impressum</a></li>
                  <li><a href="/datenschutz" className="hover:text-blue-600 transition">Datenschutz</a></li>
                  <li><a href="/kontakt" className="hover:text-blue-600 transition">Kontakt</a></li>
                </ul>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
