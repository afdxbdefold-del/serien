import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import { TrendingUp } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trending Serien | serien.de',
  description: 'Die beliebtesten und angesagtesten Serien im Trend - entdecke was gerade alle schauen.',
};

export const revalidate = 3600; // Revalidate every hour

export default async function TrendingPage() {
  // Fetch all series, ordered by popularity (using createdAt as fallback)
  const series = await prisma.series.findMany({
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 100,
  });

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-6 md:px-12 py-12">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="h-8 w-8 text-cyan-500" />
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                Trending Serien
              </h1>
            </div>
            <p className="text-lg text-gray-600">
              Die beliebtesten Serien nach Aufrufen sortiert
            </p>
          </div>

          {/* Series Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {series.map((show, index) => (
              <div key={show.tmdbId} className="relative">
                {/* Ranking Badge */}
                <div className="absolute -top-2 -left-2 z-10 w-10 h-10 bg-cyan-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                  #{index + 1}
                </div>
                
                {/* Series Card */}
                <Link href={`/serie/${show.tmdbId}-${show.slug}`}>
                  <article className="group relative bg-white rounded-xl border hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer">
                    {/* Poster Image */}
                    <div className="aspect-[2/3] overflow-hidden bg-gray-200">
                      {show.posterLocalUrl ? (
                        <Image
                          src={show.posterLocalUrl}
                          alt={show.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          Kein Bild
                        </div>
                      )}
                    </div>

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <h3 className="text-lg font-bold text-white mb-2">
                        {show.title}
                      </h3>
                      
                      {show.status && (
                        <span className="text-xs text-white/80">{show.status}</span>
                      )}
                    </div>
                  </article>
                </Link>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-12 text-center text-sm text-gray-500">
            {series.length} Serien insgesamt angezeigt
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-20">
        <div className="container mx-auto px-6 md:px-12 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-bold mb-4">serien.de</h3>
              <p className="text-sm text-gray-600">Deine Quelle für TV-Serien News</p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Navigation</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/" className="hover:text-gray-900 transition-colors">News</Link></li>
                <li><Link href="/trending" className="hover:text-gray-900 transition-colors">Trending</Link></li>
                <li><Link href="/about" className="hover:text-gray-900 transition-colors">Über uns</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Rechtliches</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/impressum" className="hover:text-gray-900 transition-colors">Impressum</Link></li>
                <li><a href="/" className="hover:text-gray-900 transition-colors">Datenschutz</a></li>
                <li><a href="mailto:mail@serien.de" className="hover:text-gray-900 transition-colors">Kontakt</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t text-center text-sm text-gray-600">
            <p>© 2024 serien.de. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
