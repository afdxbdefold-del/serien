/**
 * Rakuten TV Serien Hub - Pillar Page for Topical Authority
 * URL: /rakuten-tv-serien
 * 
 * Comprehensive hub for all Rakuten TV series including:
 * - Trending series
 * - New releases
 * - Latest news/reviews
 * - All Rakuten TV series catalog
 */

import { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { unstable_cache } from 'next/cache';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, TrendingUp, Star, Play, ChevronRight, Flame, Sparkles } from 'lucide-react';

// ISR - Revalidate every 10 minutes
export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Rakuten TV Serien 2026: Neue Releases, Trends & Reviews | serien.de',
  description: 'Entdecke alle Rakuten TV Serien 2026: Neue Releases, Trending Shows, Reviews und News. Dein vollständiger Guide zu den besten Rakuten TV Originals und Exklusiv-Serien.',
  keywords: ['Rakuten TV Serien', 'Rakuten TV 2026', 'Rakuten TV Neue Serien', 'Rakuten TV Originals', 'Rakuten TV Deutschland', 'Streaming Serien'],
  openGraph: {
    title: 'Rakuten TV Serien 2026: Neue Releases, Trends & Reviews',
    description: 'Dein vollständiger Guide zu allen Rakuten TV Serien - Neue Releases, Trends, Reviews und exklusive News.',
    type: 'website',
    url: '/rakuten-tv-serien',
  },
  alternates: {
    canonical: 'https://serien.de/rakuten-tv-serien',
  },
};

// Cached data fetching
const getRakutenTVData = unstable_cache(
  async () => {
    const [
      allRakutenTVSeries,
      rakutenTVArticles,
      trendingArticles,
      recentSeries
    ] = await Promise.all([
      // All Rakuten TV series
      prisma.series.findMany({
        where: {
          networks: { hasSome: ['Rakuten TV', 'Rakuten', 'Rakuten Viki'] }
        },
        orderBy: { popularity: 'desc' },
        take: 50,
        select: {
          tmdbId: true,
          name: true,
          title: true,
          slug: true,
          posterPath: true,
          posterLocalUrl: true,
          backdropPath: true,
          firstAirDate: true,
          voteAverage: true,
          status: true,
          overview: true,
          genres: true,
          numberOfSeasons: true,
        }
      }),
      // Rakuten TV articles/news
      prisma.articles.findMany({
        where: {
          OR: [
            { status: 'published' },
            { status: 'PUBLISHED' }
          ],
          series: {
            networks: { hasSome: ['Rakuten TV', 'Rakuten', 'Rakuten Viki'] }
          }
        },
        orderBy: { publishedAt: 'desc' },
        take: 12,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          heroLocalUrl: true,
          cardImageUrl: true,
          tmdbId: true,
          tmdbType: true,
          publishedAt: true,
          isTrending: true,
          isBreaking: true,
          series: {
            select: {
              name: true,
              title: true,
            }
          }
        }
      }),
      // Trending Rakuten TV articles
      prisma.articles.findMany({
        where: {
          OR: [
            { status: 'published' },
            { status: 'PUBLISHED' }
          ],
          isTrending: true,
          series: {
            networks: { hasSome: ['Rakuten TV', 'Rakuten', 'Rakuten Viki'] }
          }
        },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          slug: true,
          title: true,
          heroLocalUrl: true,
          tmdbId: true,
          tmdbType: true,
        }
      }),
      // Recently added Rakuten TV series
      prisma.series.findMany({
        where: {
          networks: { hasSome: ['Rakuten TV', 'Rakuten', 'Rakuten Viki'] },
          firstAirDate: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
          }
        },
        orderBy: { firstAirDate: 'desc' },
        take: 8,
        select: {
          tmdbId: true,
          name: true,
          title: true,
          slug: true,
          posterPath: true,
          posterLocalUrl: true,
          firstAirDate: true,
          voteAverage: true,
          overview: true,
        }
      })
    ]);

    return {
      allRakutenTVSeries,
      rakutenTVArticles,
      trendingArticles,
      recentSeries
    };
  },
  ['rakuten-tv-hub-data'],
  { revalidate: 600, tags: ['rakuten-tv-hub'] }
);

// Schema.org structured data
function generateRakutenTVHubSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Rakuten TV Serien 2026',
    description: 'Vollständiger Guide zu allen Rakuten TV Serien - Neue Releases, Trends und Reviews',
    url: 'https://serien.de/rakuten-tv-serien',
    publisher: {
      '@type': 'Organization',
      name: 'serien.de',
      url: 'https://serien.de'
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://serien.de'
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Rakuten TV Serien',
          item: 'https://serien.de/rakuten-tv-serien'
        }
      ]
    }
  };
}

export default async function RakutenTVSerienPage() {
  const { allRakutenTVSeries, rakutenTVArticles, trendingArticles, recentSeries } = await getRakutenTVData();

  const hubSchema = generateRakutenTVHubSchema();

  // Format date helper
  const formatDate = (date: Date | null) => {
    if (!date) return 'TBA';
    return new Date(date).toLocaleDateString('de-DE', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  // Get top series by rating
  const topRatedSeries = [...allRakutenTVSeries]
    .filter(s => s.voteAverage && s.voteAverage > 0)
    .sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0))
    .slice(0, 10);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(hubSchema) }}
      />

      <main className="min-h-screen bg-gray-50 dark:bg-[hsl(230,25%,7%)]">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-purple-600 via-violet-700 to-violet-950 dark:from-red-900 dark:via-red-950 dark:to-black overflow-hidden">
          <div className="absolute inset-0 bg-[url('/patterns/grid.svg')] opacity-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-24">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
                <Play className="w-4 h-4 text-violet-400" fill="currentColor" />
                <span className="text-sm font-medium text-white/90">Streaming Guide</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
                Rakuten TV Serien
              </h1>
              
              <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-8">
                Dein vollständiger Guide zu allen Rakuten TV Originals und Exklusiv-Serien. 
                Entdecke Trends, neue Releases und aktuelle Reviews.
              </p>

              {/* Stats */}
              <div className="flex flex-wrap justify-center gap-8 mt-10">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-white">{allRakutenTVSeries.length}+</div>
                  <div className="text-sm text-white/60 mt-1">Serien</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-white">{rakutenTVArticles.length}</div>
                  <div className="text-sm text-white/60 mt-1">News & Reviews</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-white">{recentSeries.length}</div>
                  <div className="text-sm text-white/60 mt-1">Neue Releases</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-12 space-y-16">
          
          {/* Trending Section */}
          {trendingArticles.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-orange-100 dark:bg-orange-500/20 rounded-lg">
                  <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Trending auf Rakuten TV</h2>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {trendingArticles.map((article, index) => {
                  const imageUrl = article.heroLocalUrl || 
                    (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : '/placeholders/hero.jpg');
                  
                  return (
                    <Link
                      key={article.id}
                      href={`/${article.slug}`}
                      className="group relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                    >
                      <Image
                        src={imageUrl}
                        alt={article.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 20vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                      
                      {/* Rank Badge */}
                      <div className="absolute top-2 left-2 w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-lg">
                        {index + 1}
                      </div>
                      
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white font-semibold text-sm line-clamp-2 group-hover:text-violet-400 transition-colors">
                          {article.title}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* New Releases Section */}
          {recentSeries.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-lg">
                    <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Neue Rakuten TV Serien</h2>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                {recentSeries.map((series) => (
                  <Link
                    key={series.tmdbId}
                    href={`/serie/${series.slug}`}
                    className="group"
                  >
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 shadow-md group-hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1">
                      {series.posterPath ? (
                        <Image
                          src={series.posterLocalUrl || `https://image.tmdb.org/t/p/w342${series.posterPath}`}
                          alt={series.name || series.title || ''}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Play className="w-12 h-12" />
                        </div>
                      )}
                      
                      {/* NEW Badge */}
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow">
                        NEU
                      </div>
                      
                      {/* Rating */}
                      {series.voteAverage && series.voteAverage > 0 && (
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1">
                          <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
                          <span className="text-xs text-white font-medium">{series.voteAverage.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                        {series.name || series.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(series.firstAirDate)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Latest News & Reviews */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">News & Reviews</h2>
              </div>
              <Link 
                href="/?filter=Rakuten TV"
                className="text-sm text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
              >
                Alle News <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rakutenTVArticles.slice(0, 6).map((article) => {
                const imageUrl = article.cardImageUrl || article.heroLocalUrl || 
                  (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : '/placeholders/hero.jpg');
                
                return (
                  <Link
                    key={article.id}
                    href={`/${article.slug}`}
                    className="group bg-white dark:bg-[hsl(230,25%,10%)] rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-800"
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <Image
                        src={imageUrl}
                        alt={article.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                      
                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex gap-2">
                        {article.isBreaking && (
                          <span className="bg-violet-600 text-white text-xs font-bold px-2 py-1 rounded">
                            BREAKING
                          </span>
                        )}
                        {article.isTrending && !article.isBreaking && (
                          <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
                            TRENDING
                          </span>
                        )}
                      </div>
                      
                      {/* Rakuten TV Badge */}
                      <div className="absolute top-3 right-3 bg-violet-600 text-white text-xs font-bold px-2 py-1 rounded shadow">
                        Rakuten TV
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 dark:text-white line-clamp-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors mb-2">
                        {article.title}
                      </h3>
                      
                      {article.excerpt && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                          {article.excerpt}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-500">
                        <span>{formatDate(article.publishedAt)}</span>
                        {article.series && (
                          <span className="text-violet-600 dark:text-violet-400 font-medium">
                            {article.series.name || article.series.title}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            
            {rakutenTVArticles.length > 6 && (
              <div className="text-center mt-8">
                <Link
                  href="/?filter=Rakuten TV"
                  className="inline-flex items-center gap-2 bg-violet-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                >
                  Alle Rakuten TV News anzeigen
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </section>

          {/* Top Rated Section */}
          {topRatedSeries.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-500/20 rounded-lg">
                  <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Top Bewertete Rakuten TV Serien</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {topRatedSeries.map((series, index) => (
                  <Link
                    key={series.tmdbId}
                    href={`/serie/${series.slug}`}
                    className="group flex gap-4 bg-white dark:bg-[hsl(230,25%,10%)] rounded-xl p-4 shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-800"
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center font-bold text-white text-sm shadow">
                      {index + 1}
                    </div>
                    
                    {/* Poster */}
                    <div className="flex-shrink-0 relative w-16 h-24 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800">
                      {series.posterPath ? (
                        <Image
                          src={series.posterLocalUrl || `https://image.tmdb.org/t/p/w185${series.posterPath}`}
                          alt={series.name || series.title || ''}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Play className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors line-clamp-1">
                        {series.name || series.title}
                      </h3>
                      
                      <div className="flex items-center gap-3 mt-1 text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {series.voteAverage?.toFixed(1)}
                          </span>
                        </div>
                        
                        {series.numberOfSeasons && (
                          <span className="text-gray-500 dark:text-gray-400">
                            {series.numberOfSeasons} {series.numberOfSeasons === 1 ? 'Staffel' : 'Staffeln'}
                          </span>
                        )}
                      </div>
                      
                      {series.genres && series.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {series.genres.slice(0, 3).map((genre) => (
                            <span
                              key={genre}
                              className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* All Series Catalog */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-violet-500/20 rounded-lg">
                  <Play className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Alle Rakuten TV Serien</h2>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {allRakutenTVSeries.length} Serien
              </span>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
              {allRakutenTVSeries.map((series) => (
                <Link
                  key={series.tmdbId}
                  href={`/serie/${series.slug}`}
                  className="group"
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 shadow group-hover:shadow-lg transition-all group-hover:-translate-y-1">
                    {series.posterPath ? (
                      <Image
                        src={series.posterLocalUrl || `https://image.tmdb.org/t/p/w185${series.posterPath}`}
                        alt={series.name || series.title || ''}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 12.5vw"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Play className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  
                  <p className="mt-2 text-xs sm:text-sm font-medium text-gray-900 dark:text-white line-clamp-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {series.name || series.title}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* SEO Content Section */}
          <section className="bg-white dark:bg-[hsl(230,25%,10%)] rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-800">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Rakuten TV Serien: Alles was du wissen musst
            </h2>
            
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>
                Rakuten TV hat sich seit seiner Gründung zu einem der führenden Streaming-Dienste weltweit entwickelt. 
                Mit einer beeindruckenden Bibliothek von <strong>Rakuten TV Originals</strong> und exklusiven Lizenzserien 
                bietet die Plattform für jeden Geschmack das passende Format.
              </p>
              
              <h3>Was macht Rakuten TV Serien besonders?</h3>
              <p>
                Rakuten TV investiert jährlich Milliarden in die Produktion eigener Inhalte. Von preisgekrönten Dramen 
                wie <em>Stranger Things</em> und <em>The Crown</em> bis hin zu internationalen Hits wie 
                <em>Squid Game</em> und <em>Dark</em> – Rakuten TV Originals setzen regelmäßig neue Maßstäbe 
                in der Serienlandschaft.
              </p>
              
              <h3>Rakuten TV in Deutschland</h3>
              <p>
                Der deutsche Markt ist für Rakuten TV besonders wichtig. Neben internationalen Produktionen 
                finden sich immer mehr deutsche Rakuten TV Originals wie <em>Dark</em>, <em>How to Sell Drugs Online (Fast)</em> 
                und <em>Barbaren</em> im Programm. Diese Serien haben nicht nur in Deutschland, 
                sondern weltweit Erfolge gefeiert.
              </p>
              
              <h3>Neue Rakuten TV Serien 2026</h3>
              <p>
                Auch 2026 erwarten uns zahlreiche neue Rakuten TV Serien. Von lang erwarteten Fortsetzungen 
                bis hin zu völlig neuen Formaten – auf dieser Seite findest du alle aktuellen News, 
                Release-Termine und Reviews zu den neuesten Rakuten TV Produktionen.
              </p>
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
