import prisma from '@/lib/prisma';
import Header from '@/components/Header';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Star, Calendar, Check, Plus } from 'lucide-react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface PageProps {
  params: {
    id: string; // Format: "tmdbId-slug"
  };
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tmdbId = parseInt(params.id.split('-')[0]);
  
  const series = await prisma.series.findUnique({
    where: { tmdbId },
    select: {
      title: true,
      overview: true,
      backdropLocalUrl: true,
      posterLocalUrl: true,
    },
  });

  if (!series) {
    return {
      title: 'Serie nicht gefunden | serien.de',
    };
  }

  return {
    title: `${series.title} – News, Staffeln & Updates | serien.de`,
    description: series.overview || `Alle News, Trailer und Infos zu ${series.title}. Folge der Serie und verpasse keine Updates zu neuen Staffeln und Startterminen.`,
    openGraph: {
      title: `${series.title} – News, Staffeln & Updates | serien.de`,
      description: series.overview || `Alle News, Trailer und Infos zu ${series.title}.`,
      type: 'website',
      url: `https://serien.de/serie/${params.id}/`,
      images: (series.backdropLocalUrl || series.posterLocalUrl) ? [
        {
          url: series.backdropLocalUrl || series.posterLocalUrl || '',
          width: 1200,
          height: 630,
          alt: series.title,
        },
      ] : [],
    },
  };
}

export default async function SeriesPage({ params }: PageProps) {
  const tmdbId = parseInt(params.id.split('-')[0]);

  // Fetch series with related data
  const series = await prisma.series.findUnique({
    where: { tmdbId },
    include: {
      articles: {
        where: { status: 'published' },
        orderBy: { publishedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          heroLocalUrl: true,
          publishedAt: true,
          category: true,
          author: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!series) {
    notFound();
  }

  // Parse streaming providers from JSON
  const providers = series.streamingProviders 
    ? (typeof series.streamingProviders === 'string' 
        ? JSON.parse(series.streamingProviders) 
        : series.streamingProviders)
    : [];

  // Get vote average
  const voteAverage = series.voteAverage || 0;

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <div className="relative h-[280px] overflow-hidden">
        {/* Backdrop Image */}
        <div className="absolute inset-0">
          {series.backdropLocalUrl || series.posterLocalUrl ? (
            <Image
              src={series.backdropLocalUrl || series.posterLocalUrl || ''}
              alt={series.title}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-cyan-500 to-blue-500" />
          )}
          {/* Gradient overlays */}
          <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-gradient-to-t from-white/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative container mx-auto px-5 md:px-12 h-full flex items-end pb-5">
          <div className="flex-1">
            <Link
              href="/"
              className="flex items-center gap-2 text-white mb-3 transition-colors text-sm"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Link>

            <h1 
              className="text-3xl md:text-5xl font-bold mb-3 leading-tight text-white"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.9)' }}
            >
              {series.title}
            </h1>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {voteAverage > 0 && (
                <div className="flex items-center gap-1.5 text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{voteAverage.toFixed(1)}</span>
                </div>
              )}

              {series.firstAirDate && (
                <div className="flex items-center gap-1.5 text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(series.firstAirDate).getFullYear()}</span>
                </div>
              )}

              {series.status && (
                <span 
                  className="text-white font-medium"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
                >
                  {series.status}
                </span>
              )}
            </div>

            {/* Providers */}
            {Array.isArray(providers) && providers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {providers.map((provider: string, index: number) => (
                  <span
                    key={index}
                    className="bg-white text-gray-900 px-3 py-1.5 rounded-full font-medium text-sm shadow"
                  >
                    {provider}
                  </span>
                ))}
              </div>
            )}

            {/* Follow Button (Client component would be needed for this) */}
            <button
              className="flex items-center gap-2 px-5 py-2 rounded-full font-semibold transition-all shadow bg-cyan-500 text-white hover:bg-cyan-600"
            >
              <Plus className="h-4 w-4" />
              Folgen
            </button>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-6 md:px-12 py-10">
        {/* Overview */}
        {series.overview && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Über die Serie</h2>
            <p className="text-gray-700 leading-relaxed text-lg">
              {series.overview}
            </p>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-50 p-6 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">GENRE</h3>
            <p className="text-lg font-medium text-gray-900">
              {series.genres || 'Nicht verfügbar'}
            </p>
          </div>
          
          {series.numberOfSeasons && (
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">STAFFELN</h3>
              <p className="text-lg font-medium text-gray-900">
                {series.numberOfSeasons} {series.numberOfSeasons === 1 ? 'Staffel' : 'Staffeln'}
              </p>
            </div>
          )}
          
          {series.numberOfEpisodes && (
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">EPISODEN</h3>
              <p className="text-lg font-medium text-gray-900">
                {series.numberOfEpisodes}
              </p>
            </div>
          )}
        </div>

        {/* Related News */}
        {series.articles && series.articles.length > 0 && (
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-8">News zur Serie</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {series.articles.map((article) => (
                <Link key={article.id} href={`/${article.slug}`}>
                  <article className="group bg-white rounded-xl border hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer">
                    {article.heroLocalUrl && (
                      <div className="relative aspect-video overflow-hidden">
                        <Image
                          src={article.heroLocalUrl}
                          alt={article.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <h3 className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2 mb-2">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {article.excerpt}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-3">
                        {new Date(article.publishedAt).toLocaleDateString('de-DE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* No news message */}
        {series.articles && series.articles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              Noch keine News zu dieser Serie verfügbar.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t bg-white mt-20">
        <div className="container mx-auto px-6 md:px-12 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-bold mb-4">serien.de</h3>
              <p className="text-sm text-gray-600">
                Deine Quelle für TV-Serien News
              </p>
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
