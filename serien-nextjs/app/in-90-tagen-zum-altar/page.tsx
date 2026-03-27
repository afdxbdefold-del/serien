import { Metadata } from 'next';
import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Star, Tv, Users, Heart, MessageCircle, Globe, FlaskConical, UserCircle, Gift } from 'lucide-react';

const prisma = new PrismaClient();

// Franchise TMDB IDs mit Kategorien
const FRANCHISE_CONFIG = {
  main: {
    title: 'Hauptserie',
    icon: '💍',
    tmdbIds: [61575],
    description: 'Die Original-Serie, die alles startete'
  },
  relationships: {
    title: 'Beziehungen & Fortsetzungen',
    icon: '💑',
    tmdbIds: [67757, 74920, 101451, 154591],
    description: 'Was passiert nach dem Ja-Wort?'
  },
  visa: {
    title: 'Vor & nach dem K-1 Visum',
    icon: '🌍',
    tmdbIds: [73319, 90046],
    description: 'Der Weg zum Visum und Auswandern'
  },
  dating: {
    title: 'Dating & Drama',
    icon: '💔',
    tmdbIds: [118422, 128495],
    description: 'Single-Leben und neue Chancen'
  },
  reactions: {
    title: 'Reaktionen & Kommentare',
    icon: '🎥',
    tmdbIds: [94009, 115029],
    description: 'Die Stars schauen zu und kommentieren'
  },
  international: {
    title: 'Internationale Versionen',
    icon: '🇬🇧',
    tmdbIds: [205154],
    description: 'Das Konzept erobert die Welt'
  },
  experimental: {
    title: 'Neue Formate',
    icon: '🧪',
    tmdbIds: [230272, 114659],
    description: 'Experimente und frische Ideen'
  },
  spinoffs: {
    title: 'Paar-Spin-offs',
    icon: '👨‍👩‍👧',
    tmdbIds: [107128, 91169, 157719, 218742],
    description: 'Eigene Serien für beliebte Paare'
  },
  specials: {
    title: 'Specials',
    icon: '⚡',
    tmdbIds: [96613, 124081],
    description: 'Besondere Episoden und Formate'
  },
};

export const metadata: Metadata = {
  title: 'In 90 Tagen zum Altar - Der komplette Franchise-Guide | serien.de',
  description: 'Dein deutscher Hub für 90 Day Fiancé! Alle Serien, Spin-offs, News und Infos zur Reality-TV-Franchise rund um internationale Liebe und das K-1 Visum.',
  openGraph: {
    title: 'In 90 Tagen zum Altar - Franchise Hub',
    description: 'Der komplette Guide zu allen 90 Day Fiancé Serien auf Deutsch',
    type: 'website',
  },
};

async function getFranchiseData() {
  // Hole alle Franchise-Serien
  const allTmdbIds = Object.values(FRANCHISE_CONFIG).flatMap(c => c.tmdbIds);
  
  const series = await prisma.series.findMany({
    where: { tmdbId: { in: allTmdbIds } },
    select: {
      tmdbId: true,
      title: true,
      slug: true,
      overview: true,
      posterPath: true,
      backdropPath: true,
      firstAirDate: true,
      numberOfSeasons: true,
      numberOfEpisodes: true,
      voteAverage: true,
      status: true,
      networks: true,
    }
  });
  
  // Hole aktuelle News zu allen Franchise-Serien
  const news = await prisma.articles.findMany({
    where: {
      primarySeriesId: { in: allTmdbIds },
      status: 'published',
    },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      heroImageUrl: true,
      publishedAt: true,
      series: {
        select: { title: true, slug: true }
      }
    },
    orderBy: { publishedAt: 'desc' },
    take: 12,
  });
  
  return { series, news };
}

function SeriesCard({ series }: { series: any }) {
  const posterUrl = series.posterPath 
    ? `https://image.tmdb.org/t/p/w342${series.posterPath}`
    : '/placeholders/poster.jpg';
    
  return (
    <Link 
      href={`/serie/${series.slug}`}
      className="group block bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-800 hover:border-amber-500/50 transition-all duration-300 hover:scale-[1.02]"
    >
      <div className="aspect-[2/3] relative overflow-hidden">
        <Image
          src={posterUrl}
          alt={series.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        
        {series.voteAverage > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded-lg flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-xs font-medium text-white">{series.voteAverage.toFixed(1)}</span>
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2">
            {series.title}
          </h3>
          {series.numberOfSeasons && (
            <p className="text-xs text-zinc-400 mt-1">
              {series.numberOfSeasons} Staffel{series.numberOfSeasons !== 1 ? 'n' : ''}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function NewsCard({ article }: { article: any }) {
  const imageUrl = article.heroImageUrl || '/placeholders/news.jpg';
  
  return (
    <Link 
      href={`/${article.slug}`}
      className="group flex gap-4 bg-zinc-900/30 rounded-lg p-3 hover:bg-zinc-800/50 transition-colors"
    >
      <div className="w-24 h-16 relative flex-shrink-0 rounded-md overflow-hidden">
        <Image
          src={imageUrl}
          alt={article.title}
          fill
          className="object-cover"
          sizes="96px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-white text-sm line-clamp-2 group-hover:text-amber-400 transition-colors">
          {article.title}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          {article.series && (
            <span className="text-xs text-amber-500">{article.series.title}</span>
          )}
          {article.publishedAt && (
            <span className="text-xs text-zinc-500">
              {new Date(article.publishedAt).toLocaleDateString('de-DE')}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function CategorySection({ 
  config, 
  series 
}: { 
  config: typeof FRANCHISE_CONFIG[keyof typeof FRANCHISE_CONFIG];
  series: any[];
}) {
  const categorySeries = series.filter(s => config.tmdbIds.includes(s.tmdbId));
  
  if (categorySeries.length === 0) return null;
  
  return (
    <section className="mb-12">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{config.icon}</span>
        <div>
          <h2 className="text-xl font-bold text-white">{config.title}</h2>
          <p className="text-sm text-zinc-400">{config.description}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {categorySeries.map(s => (
          <SeriesCard key={s.tmdbId} series={s} />
        ))}
      </div>
    </section>
  );
}

export default async function NinetyDayFranchiseHub() {
  const { series, news } = await getFranchiseData();
  
  // Hauptserie für Hero
  const mainSeries = series.find(s => s.tmdbId === 61575);
  const backdropUrl = mainSeries?.backdropPath 
    ? `https://image.tmdb.org/t/p/original${mainSeries.backdropPath}`
    : '/placeholders/backdrop.jpg';
  
  // Statistiken
  const totalSeasons = series.reduce((sum, s) => sum + (s.numberOfSeasons || 0), 0);
  const totalEpisodes = series.reduce((sum, s) => sum + (s.numberOfEpisodes || 0), 0);
  
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero Section */}
      <div className="relative h-[50vh] min-h-[400px]">
        <Image
          src={backdropUrl}
          alt="90 Day Fiancé Franchise"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-transparent to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-amber-500 text-black text-xs font-bold px-2 py-1 rounded">
                FRANCHISE HUB
              </span>
              <span className="text-zinc-400 text-sm">TLC / Discovery+</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
              In 90 Tagen zum Altar
            </h1>
            
            <p className="text-lg text-zinc-300 max-w-2xl mb-6">
              Dein deutscher Hub für die größte Reality-TV-Franchise über internationale Liebe, 
              das K-1 Visum und den verrückten Weg zum Traualtar.
            </p>
            
            {/* Stats */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-amber-500" />
                <span className="text-white font-semibold">{series.length}</span>
                <span className="text-zinc-400">Serien</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                <span className="text-white font-semibold">{totalSeasons}</span>
                <span className="text-zinc-400">Staffeln</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                <span className="text-white font-semibold">{totalEpisodes}+</span>
                <span className="text-zinc-400">Episoden</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Serien nach Kategorien */}
          <div className="lg:col-span-2">
            {Object.entries(FRANCHISE_CONFIG).map(([key, config]) => (
              <CategorySection key={key} config={config} series={series} />
            ))}
          </div>
          
          {/* Sidebar: News */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-amber-500">📰</span> Aktuelle News
                </h2>
                
                {news.length > 0 ? (
                  <div className="space-y-4">
                    {news.map(article => (
                      <NewsCard key={article.slug} article={article} />
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm">
                    Noch keine News. Nutze die Pipeline, um Artikel zu generieren!
                  </p>
                )}
                
                {news.length > 0 && (
                  <Link 
                    href="/neue-serien?franchise=90-day"
                    className="block mt-6 text-center text-amber-500 hover:text-amber-400 text-sm font-medium"
                  >
                    Alle News anzeigen →
                  </Link>
                )}
              </div>
              
              {/* Quick Facts */}
              <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 mt-6">
                <h2 className="text-lg font-bold text-white mb-4">📊 Quick Facts</h2>
                <ul className="space-y-3 text-sm">
                  <li className="flex justify-between">
                    <span className="text-zinc-400">Erstausstrahlung</span>
                    <span className="text-white">12. Januar 2014</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-400">Sender</span>
                    <span className="text-white">TLC</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-400">Streaming DE</span>
                    <span className="text-white">Discovery+</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-400">Franchise-Start</span>
                    <span className="text-white">2014</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-400">Spin-offs</span>
                    <span className="text-white">{series.length - 1}+</span>
                  </li>
                </ul>
              </div>
              
              {/* Über die Franchise */}
              <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 mt-6">
                <h2 className="text-lg font-bold text-white mb-4">ℹ️ Über die Franchise</h2>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  „90 Day Fiancé" folgt Paaren, bei denen ein Partner ein K-1 Visum beantragt hat, 
                  um in die USA zu kommen. Nach der Ankunft haben sie nur 90 Tage Zeit zu heiraten – 
                  oder der ausländische Partner muss das Land verlassen. Die Serie zeigt die 
                  kulturellen Unterschiede, Familiendramen und emotionalen Höhen und Tiefen auf 
                  dem Weg zum Traualtar.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
      
      {/* Schema.org */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'In 90 Tagen zum Altar - Franchise Hub',
            description: 'Kompletter Guide zu allen 90 Day Fiancé Serien',
            url: 'https://serien.de/in-90-tagen-zum-altar',
            mainEntity: {
              '@type': 'TVSeries',
              name: '90 Day Fiancé',
              alternateName: 'In 90 Tagen zum Altar',
              numberOfSeasons: mainSeries?.numberOfSeasons,
              numberOfEpisodes: mainSeries?.numberOfEpisodes,
            }
          })
        }}
      />
    </div>
  );
}
