import './globals.css';
import Header from '@/components/Header';

export const metadata = {
  title: 'Serien-News, Trailer & Updates | serien.de',
  description: 'Serien.de – News, Trailer & Updates zu deinen Lieblingsserien. Folge Serien, entdecke neue Highlights und verpasse keine wichtigen Updates mehr.',
  metadataBase: new URL('https://serien-de.vercel.app'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="bg-background text-foreground">
        <Header />
        <main>{children}</main>
        
        {/* Footer */}
        <footer className="bg-card border-t border-border mt-20 py-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-bold text-foreground mb-4">serien.de</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Deine Quelle für TV-Serien News
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-4">Navigation</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="/" className="hover:text-primary transition">News</a></li>
                  <li><a href="/trending" className="hover:text-primary transition">Trending</a></li>
                  <li><a href="/redaktion" className="hover:text-primary transition">Redaktion</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-4">Rechtliches</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="/impressum" className="hover:text-primary transition">Impressum</a></li>
                  <li><a href="/datenschutz" className="hover:text-primary transition">Datenschutz</a></li>
                  <li><a href="/kontakt" className="hover:text-primary transition">Kontakt</a></li>
                </ul>
              </div>
            </div>
            
            <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
              <p>&copy; {new Date().getFullYear()} serien.de. Alle Rechte vorbehalten.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
