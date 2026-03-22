/**
 * Prime Video Serien Hub - Pillar Page for Topical Authority
 * URL: /prime-video-serien
 * 
 * Comprehensive hub for all Amazon Prime Video series including:
 * - Trending series
 * - New releases
 * - Latest news/reviews
 * - All Prime Video series catalog
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
  title: 'Prime Video Serien 2026: Neue Releases, Trends & Reviews | serien.de',
  description: 'Entdecke alle Amazon Prime Video Serien 2026: Neue Releases, Trending Shows, Reviews und News. Dein vollständiger Guide zu den besten Prime Originals.',
  keywords: ['Prime Video Serien', 'Amazon Prime 2026', 'Prime Video Neue Serien', 'Amazon Originals', 'Prime Video Deutschland', 'Streaming Serien'],
  openGraph: {
    title: 'Prime Video Serien 2026: Neue Releases, Trends & Reviews',
    description: 'Dein vollständiger Guide zu allen Amazon Prime Video Serien - Neue Releases, Trends, Reviews und exklusive News.',
    type: 'website',
    url: '/prime-video-serien',
  },
  alternates: {
    canonical: '/prime-video-serien',
  },
};

// Cached data fetching
const getPrimeVideoData = unstable_cache(
  async () => {
    const [
      allPrimeSeries,
      primeArticles,
      trendingArticles,
      recentSeries
    ] = await Promise.all([
      // All Prime Video series
      prisma.series.findMany({
        where: {
          networks: { has: 'Prime Video' }
        },
        orderBy: { popularity: 'desc' },
        take: 50,
        select: {
          tmdbId: true,
          name: true,
          title: true,
          slug: true,
          posterPath: true,
          backdropPath: true,
          firstAirDate: true,
          voteAverage: true,
          status: true,
          overview: true,
          genres: true,
          numberOfSeasons: true,
        }
      }),
      // Prime Video articles/news
      prisma.articles.findMany({
        where: {
          OR: [
            { status: 'published' },
            { status: 'PUBLISHED' }
          ],
          series: {
            networks: { has: 'Prime Video' }
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
      // Trending Prime Video articles
      prisma.articles.findMany({
        where: {
          OR: [
            { status: 'published' },
            { status: 'PUBLISHED' }
          ],
          isTrending: true,
          series: {
            networks: { has: 'Prime Video' }
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
      // Recently added Prime Video series
      prisma.series.findMany({
        where: {
          networks: { has: 'Prime Video' },
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
          firstAirDate: true,
          voteAverage: true,
          overview: true,
        }
      })
    ]);

    return {
      allPrimeSeries,
      primeArticles,
      trendingArticles,
      recentSeries
    };
  },
  ['prime-video-hub-data'],
  { revalidate: 600, tags: ['prime-video-hub'] }
);

// Schema.org structured data
function generatePrimeHubSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Amazon Prime Video Serien 2026',
    description: 'Vollständiger Guide zu allen Prime Video Serien - Neue Releases, Trends und Reviews',
    url: 'https://serien.de/prime-video-serien',
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
          name: 'Prime Video Serien',
          item: 'https://serien.de/prime-video-serien'
        }
      ]
    }
  };
}

export default async function PrimeVideoSerienPage() {
  const { allPrimeSeries, primeArticles, trendingArticles, recentSeries } = await getPrimeVideoData();

  const hubSchema = generatePrimeHubSchema();

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
  const topRatedSeries = [...allPrimeSeries]
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
        {/* Hero Section - Prime Video Blue */}
        <section className="relative bg-gradient-to-br from-cyan-500 via-blue-600 to-blue-900 dark:from-cyan-700 dark:via-blue-800 dark:to-blue-950 overflow-hidden">
          <div className="absolute inset-0 bg-[url('/patterns/grid.svg')] opacity-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-24">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
                <Play className="w-4 h-4 text-cyan-300" fill="currentColor" />
                <span className="text-sm font-medium text-white/90">Streaming Guide</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
                Prime Video Serien
              </h1>
              
              <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-8">
                Dein vollständiger Guide zu allen Amazon Originals und Prime Video Exklusiv-Serien. 
                Entdecke Trends, neue Releases und aktuelle Reviews.
              </p>

              {/* Stats */}
              <div className="flex flex-wrap justify-center gap-8 mt-10">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-white">{allPrimeSeries.length}+</div>
                  <div className="text-sm text-white/60 mt-1">Serien</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-white">{primeArticles.length}</div>
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
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Trending auf Prime Video</h2>
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
                      <div className="absolute top-2 left-2 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-lg">
                        {index + 1}
                      </div>
                      
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white font-semibold text-sm line-clamp-2 group-hover:text-cyan-300 transition-colors">
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
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Neue Prime Video Serien</h2>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                {recentSeries.map((series) => (
                  <Link
                    key={series.tmdbId}
                    href={`/serie/${series.tmdbId}-${series.slug}`}
                    className="group"
                  >
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 shadow-md group-hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1">
                      {series.posterPath ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w342${series.posterPath}`}
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
                      <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
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
                href="/?filter=Prime Video"
                className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                Alle News <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {primeArticles.slice(0, 6).map((article) => {
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
                          <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                            BREAKING
                          </span>
                        )}
                        {article.isTrending && !article.isBreaking && (
                          <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
                            TRENDING
                          </span>
                        )}
                      </div>
                      
                      {/* Prime Badge */}
                      <div className="absolute top-3 right-3 bg-cyan-500 text-white text-xs font-bold px-2 py-1 rounded shadow">
                        Prime
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 dark:text-white line-clamp-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors mb-2">
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
                          <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                            {article.series.name || article.series.title}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            
            {primeArticles.length > 6 && (
              <div className="text-center mt-8">
                <Link
                  href="/?filter=Prime Video"
                  className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                >
                  Alle Prime Video News anzeigen
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
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Top Bewertete Prime Video Serien</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {topRatedSeries.map((series, index) => (
                  <Link
                    key={series.tmdbId}
                    href={`/serie/${series.tmdbId}-${series.slug}`}
                    className="group flex gap-4 bg-white dark:bg-[hsl(230,25%,10%)] rounded-xl p-4 shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-gray-800"
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center font-bold text-white text-sm shadow">
                      {index + 1}
                    </div>
                    
                    {/* Poster */}
                    <div className="flex-shrink-0 relative w-16 h-24 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800">
                      {series.posterPath ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w185${series.posterPath}`}
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
                      <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors line-clamp-1">
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
                <div className="p-2 bg-cyan-100 dark:bg-cyan-500/20 rounded-lg">
                  <Play className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Alle Prime Video Serien</h2>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {allPrimeSeries.length} Serien
              </span>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
              {allPrimeSeries.map((series) => (
                <Link
                  key={series.tmdbId}
                  href={`/serie/${series.tmdbId}-${series.slug}`}
                  className="group"
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 shadow group-hover:shadow-lg transition-all group-hover:-translate-y-1">
                    {series.posterPath ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w185${series.posterPath}`}
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
                  
                  <p className="mt-2 text-xs sm:text-sm font-medium text-gray-900 dark:text-white line-clamp-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                    {series.name || series.title}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* SEO Content Section */}
          <section className="bg-white dark:bg-[hsl(230,25%,10%)] rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-800">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Prime Video Serien: Alles was du wissen musst
            </h2>
            
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>
                Amazon Prime Video hat sich zu einem der wichtigsten Streaming-Dienste weltweit entwickelt. 
                Mit einer beeindruckenden Bibliothek von <strong>Amazon Originals</strong> und exklusiven Lizenzserien 
                bietet die Plattform für jeden Geschmack das passende Format.
              </p>
              
              <h3>Was macht Prime Video Serien besonders?</h3>
              <p>
                Amazon investiert massiv in hochwertige Eigenproduktionen. Von Fantasy-Epen wie 
                <em>Der Herr der Ringe: Die Ringe der Macht</em> über Action-Thriller wie 
                <em>Jack Ryan</em> bis hin zu Kritiker-Lieblingen wie <em>The Marvelous Mrs. Maisel</em> – 
                Prime Video Originals setzen regelmäßig neue Maßstäbe in der Serienlandschaft.
              </p>
              
              <h3>Prime Video in Deutschland</h3>
              <p>
                Der deutsche Markt ist für Amazon Prime Video besonders wichtig. Neben internationalen Produktionen 
                finden sich immer mehr deutsche Eigenproduktionen wie <em>LOL: Last One Laughing</em> und 
                <em>Die Discounter</em> im Programm. Prime-Mitglieder erhalten zudem Zugang zu einer 
                umfangreichen Bibliothek an Filmen und Serien ohne zusätzliche Kosten.
              </p>
              
              <h3>Neue Prime Video Serien 2026</h3>
              <p>
                Auch 2026 erwarten uns zahlreiche neue Prime Video Serien. Von lang erwarteten Fortsetzungen 
                bis hin zu völlig neuen Formaten – auf dieser Seite findest du alle aktuellen News, 
                Release-Termine und Reviews zu den neuesten Amazon Produktionen.
              </p>
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
