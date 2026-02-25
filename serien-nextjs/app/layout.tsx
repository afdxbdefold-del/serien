import './globals.css';

export const metadata = {
  title: { default: 'serien.de | Deine Serien-Plattform', template: '%s | serien.de' },
  description: 'Folge deinen Lieblingsserien oder entdecke neue Serien zum Anschauen',
  metadataBase: new URL('https://serien-de.vercel.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-gray-50">
        {/* Top Header */}
        <header className="bg-blue-600 text-white sticky top-0 z-50 shadow-md">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <a href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-xl">S</span>
                </div>
                <span className="text-xl font-bold">serien.de</span>
              </a>

              {/* Right Actions */}
              <div className="flex items-center gap-4">
                {/* Search Button */}
                <button className="p-2 hover:bg-blue-700 rounded-lg transition">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>

                {/* Menu Button */}
                <button className="p-2 hover:bg-blue-700 rounded-lg transition">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-gray-100 border-t border-blue-700">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Suche"
                  className="w-full py-2 px-4 pl-10 rounded-lg border-0 text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                />
                <svg 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}
