import './globals.css';

export const metadata = {
  title: { 
    default: 'serien.de | Deine Serien-News Plattform', 
    template: '%s | serien.de' 
  },
  description: 'Aktuelle News, Updates und Informationen zu deinen Lieblingsserien',
  metadataBase: new URL('https://serien-de.vercel.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <a href="/" className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-blue-600">serien.de</span>
              </a>
              
              <nav className="hidden md:flex items-center space-x-8">
                <a href="/" className="text-gray-700 hover:text-blue-600 transition">
                  Home
                </a>
                <a href="/news" className="text-gray-700 hover:text-blue-600 transition">
                  News
                </a>
                <a href="/serien" className="text-gray-700 hover:text-blue-600 transition">
                  Serien
                </a>
              </nav>

              <div className="flex items-center space-x-4">
                <button className="md:hidden p-2 rounded-lg hover:bg-gray-100">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-screen">
          {children}
        </main>

        <footer className="bg-gray-900 text-gray-300 py-12 mt-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <h3 className="text-white font-bold text-lg mb-4">serien.de</h3>
                <p className="text-sm text-gray-400">
                  Deine Quelle für aktuelle Serien-News und Updates
                </p>
              </div>
              
              <div>
                <h4 className="text-white font-semibold mb-4">Navigation</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="/" className="hover:text-white transition">Home</a></li>
                  <li><a href="/news" className="hover:text-white transition">News</a></li>
                  <li><a href="/serien" className="hover:text-white transition">Serien</a></li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-white font-semibold mb-4">Rechtliches</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="/impressum" className="hover:text-white transition">Impressum</a></li>
                  <li><a href="/datenschutz" className="hover:text-white transition">Datenschutz</a></li>
                  <li><a href="/kontakt" className="hover:text-white transition">Kontakt</a></li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-white font-semibold mb-4">Social Media</h4>
                <div className="flex space-x-4">
                  <a href="#" className="hover:text-white transition">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                  <a href="#" className="hover:text-white transition">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                    </svg>
                  </a>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
              <p>&copy; {new Date().getFullYear()} serien.de. Alle Rechte vorbehalten.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
