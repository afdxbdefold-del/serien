import { Metadata } from 'next';
import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import Image from 'next/image';
import { Flame, TrendingUp, Sparkles, Clock, ExternalLink, Search, Newspaper } from 'lucide-react';
import { generateSeriesSlug } from '@/lib/slug-utils';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export const metadata: Metadata = {
  title: 'Trending Serien | serien.de',
  description: 'Entdecke die Serien, die Deutschland gerade sucht. Aktuelle Trends und News basierend auf echten Google-Suchanfragen.',
  other: { 'googlebot-news': 'noindex' },
  alternates: {
    canonical: 'https://serien.de/trending',
  },
};

// Get trending data with articles - no caching
async function getTrendingData() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get trending topics WITH their articles
  const trends = await prisma.trending_topics.findMany({
    where: {
      date: { gte: sevenDaysAgo },
      category: 'series',
    },
    orderBy: { date: 'desc' },
    take: 20,
  });

  // Get article IDs from trends
  const articleIds = trends
    .filter(t => t.articleId)
    .map(t => t.articleId as string);

  // Fetch full article data for trends that have articles
  const trendArticles = articleIds.length > 0 
    ? await prisma.articles.findMany({
        where: { 
            id: { in: articleIds },
            status: { in: ['published', 'PUBLISHED'] }
          },
          include: {
            series: {
              select: {
                title: true,
                slug: true,
                tmdbId: true,
                posterPath: true,
              },
            },
            users: {
              select: { name: true },
            },
          },
        })
      : [];

    // Create a map for quick lookup
    const articleMap = new Map(trendArticles.map(a => [a.id, a]));

    // Enrich trends with their articles
    const enrichedTrends = trends.map(trend => ({
      ...trend,
      article: trend.articleId ? articleMap.get(trend.articleId) : null
    }));

    // Get recent trending articles (fallback)
    const recentTrendingArticles = await prisma.articles.findMany({
      where: {
        publishedAt: { gte: sevenDaysAgo },
        status: { in: ['published', 'PUBLISHED'] },
        category: 'trending',
      },
      include: {
        series: {
          select: {
            title: true,
            slug: true,
            tmdbId: true,
            posterPath: true,
          },
        },
        users: {
          select: { name: true },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 12,
    });

    // Get top streaming releases
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

    // Get slugs from series table for releases
    const tmdbIds = topReleases.map(r => r.tmdbId);
    const seriesSlugs = await prisma.series.findMany({
      where: { tmdbId: { in: tmdbIds } },
      select: { tmdbId: true, slug: true },
    });
    const slugMap = new Map(seriesSlugs.map(s => [s.tmdbId, s.slug]));
    
    const enrichedReleases = topReleases.map(release => ({
      ...release,
      slug: slugMap.get(release.tmdbId) || generateSeriesSlug(release.name, release.tmdbId),
    }));

    return { trends: enrichedTrends, recentTrendingArticles, topReleases: enrichedReleases };
}

// Article Card Component
function TrendArticleCard({ article }: { article: any }) {
  const heroImage = article.heroImage || 
    (article.series?.posterPath ? `/img/tmdb/w500${article.series.posterPath}` : null);
  
  return (
    <Link
      href={`/${article.slug}`}
      className="group block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
      data-testid={`trend-article-${article.slug}`}
    >
      <div className="flex gap-4 p-4">
        {/* Image */}
        <div className="flex-shrink-0 w-24 h-24 relative rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800">
          {heroImage ? (
            <Image
              src={heroImage}
              alt={article.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Newspaper className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
            {article.title}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
            {article.excerpt}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span>
              {new Date(article.publishedAt).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric',
                month: 'short', })}
            </span>
            {article.series && (
              <>
                <span>•</span>
                <span className="text-cyan-600 dark:text-cyan-400">{article.series.title}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function TrendingHubPage() {
  const { trends, recentTrendingArticles, topReleases } = await getTrendingData();

  // Separate trends with and without articles
  const trendsWithArticles = trends.filter(t => t.article);
  const trendsWithoutArticles = trends.filter(t => !t.article);

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
                Was Deutschland gerade sucht
              </p>
            </div>
          </div>
          
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl mt-6">
            Entdecke die Serien, die aktuell alle suchen. Basierend auf echten Google-Suchanfragen 
            – hier findest du, was gerade wirklich angesagt ist.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-16">
        
        {/* HAUPTBEREICH: Trends mit Artikeln */}
        {trendsWithArticles.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-orange-500" />
              Aktuelle Suchanfragen
            </h2>
            
            <div className="space-y-8">
              {trendsWithArticles.map((trend) => (
                <div 
                  key={trend.id} 
                  className="bg-gradient-to-r from-orange-500/5 to-red-500/5 rounded-2xl p-6 border border-orange-500/10"
                  data-testid={`trend-${trend.id}`}
                >
                  {/* Suchbegriff Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                      <Search className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        "{trend.title}"
                        {trend.growth && trend.growth !== 'trending' && (
                          <span className="text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                            {trend.growth}
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Trending am {new Date(trend.date).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', 
                          month: 'long' })}
                      </p>
                    </div>
                    <Sparkles className="w-5 h-5 text-orange-500 animate-pulse" />
                  </div>
                  
                  {/* Artikel unter dem Suchbegriff */}
                  {trend.article && (
                    <TrendArticleCard article={trend.article} />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Weitere Suchbegriffe (ohne Artikel) */}
        {trendsWithoutArticles.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              Weitere Trends
              <span className="text-sm font-normal text-gray-500">(Artikel in Bearbeitung)</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {trendsWithoutArticles.map((trend) => (
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

        {/* Fallback: Recent Trending Articles */}
        {trendsWithArticles.length === 0 && recentTrendingArticles.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-cyan-500" />
              Aktuelle Trend-Artikel
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentTrendingArticles.map((article) => (
                <TrendArticleCard key={article.id} article={article} />
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
                  href={`/serie/${release.slug}`}
                  className="group"
                >
                  <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 shadow-lg group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-2">
                    {release.posterPath ? (
                      <Image
                        src={`/img/tmdb/w342${release.posterPath}`}
                        alt={release.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Flame className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Ranking Badge */}
                    <div className="absolute top-2 left-2 bg-gradient-to-br from-orange-500 to-red-600 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-lg">
                      {index + 1}
                    </div>
                    
                    {/* Provider Badge */}
                    {release.provider && (
                      <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                        {release.provider}
                      </div>
                    )}
                  </div>
                  
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white line-clamp-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                    {release.name}
                  </h3>
                  
                  {release.voteAverage > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-yellow-500">★</span>
                      <span className="text-xs text-gray-500">{release.voteAverage.toFixed(1)}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {trends.length === 0 && topReleases.length === 0 && (
          <div className="text-center py-20">
            <Flame className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Keine Trends verfügbar
            </h3>
            <p className="text-gray-500 dark:text-gray-500">
              Schau später wieder vorbei für aktuelle Serien-Trends.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
