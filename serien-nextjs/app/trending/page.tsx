import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { TrendingUp, Flame, Clock, ExternalLink, Sparkles } from 'lucide-react';
import { unstable_cache } from 'next/cache';
import { generateSeriesSlug } from '@/lib/slug-utils';

export const revalidate = 3600; // Revalidate every hour

export const metadata: Metadata = {
  title: 'Trending Serien | Was Deutschland gerade schaut | serien.de',
  description: 'Entdecke die aktuell angesagtesten TV-Serien in Deutschland. Basierend auf echten Suchanfragen - diese Serien sind gerade im Trend!',
  openGraph: {
    title: 'Trending Serien | serien.de',
    description: 'Die heißesten Serien, die Deutschland gerade schaut',
    type: 'website',
  },
};

// Get trending data
const getTrendingData = unstable_cache(
  async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get trending topics
    const trends = await prisma.trending_topics.findMany({
      where: {
        date: { gte: sevenDaysAgo },
        category: 'series',
      },
      orderBy: { date: 'desc' },
      take: 20,
    });

    // Get articles that match trending topics
    const trendingArticles = await prisma.articles.findMany({
      where: {
        publishedAt: { gte: sevenDaysAgo },
        status: { in: ['published', 'PUBLISHED'] },
      },
      include: {
        series: {
          select: {
            title: true,
            slug: true,
            tmdbId: true,
            posterPath: true,
            networks: true,
          },
        },
        users: {
          select: { name: true },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 30,
    });

    // Get top streaming releases as fallback/addition
    const topReleases = await prisma.streaming_releases.findMany({
      where: {
        date: { gte: sevenDaysAgo },
      },
      orderBy: [
        { voteAverage: 'desc' },
      ],
      take: 12,
      distinct: ['tmdbId'],
    });

    return { trends, trendingArticles, topReleases };
  },
  ['trending-hub-data'],
  { revalidate: 3600, tags: ['trending'] }
);

export default async function TrendingHubPage() {
  const { trends, trendingArticles, topReleases } = await getTrendingData();

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0a0f] dark:to-[#0f0f18]">
      {/* Hero Section */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-red-500/10 to-pink-500/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl">
              <Flame className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
                Trending Serien
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Was Deutschland gerade schaut
              </p>
            </div>
          </div>
          
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl mt-6">
            Entdecke die Serien, die aktuell alle suchen. Basierend auf echten Suchanfragen 
            und Streaming-Daten – hier findest du, was gerade wirklich angesagt ist.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-16">
        {/* Trending Topics Pills */}
        {trends.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              Aktuelle Suchanfragen
            </h2>
            <div className="flex flex-wrap gap-2">
              {trends.map((trend) => (
                <Link
                  key={trend.id}
                  href={`/suche?q=${encodeURIComponent(trend.query)}`}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 hover:from-orange-500/20 hover:to-red-500/20 border border-orange-500/20 rounded-full text-sm font-medium text-gray-800 dark:text-gray-200 transition-all hover:scale-105"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-orange-500" />
                    {trend.title}
                    {trend.growth && trend.growth !== 'trending' && (
                      <span className="text-xs text-orange-600 dark:text-orange-400 font-bold">
                        {trend.growth}
                      </span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Hot Right Now - Streaming */}
        {topReleases.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Flame className="w-6 h-6 text-red-500" />
                Hot Right Now
              </h2>
              <Link 
                href="/neue-serien"
                className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                Alle anzeigen <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {topReleases.map((release, index) => (
                <Link
                  key={`${release.tmdbId}-${index}`}
                  href={`/serie/${generateSeriesSlug(release.name, release.tmdbId)}`}
                  className="group"
                >
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 shadow-lg group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-2">
                    {release.posterPath ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w342${release.posterPath}`}
                        alt={release.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900 text-white text-center p-2 text-sm">
                        {release.name}
                      </div>
                    )}
                    
                    {/* Rank Badge */}
                    <div className="absolute top-2 left-2 w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      {index + 1}
                    </div>
                    
                    {/* Provider Badge */}
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded">
                      {release.provider}
                    </div>
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <div>
                        <p className="text-white font-semibold text-sm">{release.name}</p>
                        {release.voteAverage && (
                          <p className="text-yellow-400 text-xs">⭐ {release.voteAverage.toFixed(1)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Latest Trending Articles */}
        {trendingArticles.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-cyan-500" />
              Aktuelle Artikel zu Trending-Serien
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingArticles.slice(0, 12).map((article) => (
                <Link
                  key={article.id}
                  href={`/${article.slug}`}
                  className="group bg-white dark:bg-gray-800/50 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700"
                >
                  <div className="relative aspect-video">
                    {article.heroImageUrl ? (
                      <Image
                        src={article.heroImageUrl}
                        alt={article.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-600" />
                    )}
                    
                    {article.series && (
                      <div className="absolute top-2 left-2 bg-cyan-500 text-white text-xs font-bold px-2 py-1 rounded">
                        {article.series.title}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                      {article.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{article.users?.name || 'Redaktion'}</span>
                      <span>•</span>
                      <span>
                        {article.publishedAt 
                          ? new Date(article.publishedAt).toLocaleDateString('de-DE', { 
                              day: 'numeric', 
                              month: 'short' 
                            })
                          : 'Neu'
                        }
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {trends.length === 0 && topReleases.length === 0 && trendingArticles.length === 0 && (
          <div className="text-center py-16">
            <Flame className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Noch keine Trending-Daten
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Schau bald wieder vorbei – wir sammeln gerade die heißesten Trends!
            </p>
          </div>
        )}

        {/* Trending Search Terms Box - Above Footer */}
        {trends.length > 0 && (
          <section className="mt-16 mb-8">
            <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 rounded-2xl p-8 border border-orange-200 dark:border-orange-800/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Trending Suchbegriffe in Deutschland
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Das suchen die Deutschen gerade bei Google
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {trends.map((trend, index) => (
                  <Link
                    key={trend.id}
                    href={`/suche?q=${encodeURIComponent(trend.query)}`}
                    className="group flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 border border-gray-100 dark:border-gray-700"
                  >
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-500 text-white text-xs font-bold rounded-md">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      {trend.title}
                    </span>
                  </Link>
                ))}
              </div>
              
              <p className="mt-6 text-xs text-gray-500 dark:text-gray-400 text-center">
                Datenquelle: Google Trends Deutschland • Aktualisiert alle 8 Stunden
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
