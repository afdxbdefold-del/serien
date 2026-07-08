import { Metadata } from 'next';
import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Star, Tv, Users, Skull, Film, Globe, Clapperboard } from 'lucide-react';

const prisma = new PrismaClient();

// Franchise TMDB IDs mit Kategorien
const FRANCHISE_CONFIG = {
  main: {
    title: 'Die Hauptserie',
    icon: '🧟',
    tmdbIds: [1402],
    description: '11 Staffeln apokalyptisches Drama - wo alles begann'
  },
  'spinoff-main': {
    title: 'Spin-off Serien',
    icon: '⚔️',
    tmdbIds: [62286, 211684, 194583, 206586],
    description: 'Die Geschichten der Hauptcharaktere gehen weiter'
  },
  limited: {
    title: 'Limited Series',
    icon: '🎯',
    tmdbIds: [94305],
    description: 'Abgeschlossene Miniserien im TWD-Universum'
  },
  anthology: {
    title: 'Anthologie',
    icon: '📖',
    tmdbIds: [136248],
    description: 'Eigenständige Geschichten aus der Zombieapokalypse'
  },
  specials: {
    title: 'Dokumentationen & Specials',
    icon: '🎬',
    tmdbIds: [129035],
    description: 'Hinter den Kulissen und Charakterprofile'
  },
  web: {
    title: 'Webserien & Kurzfilme',
    icon: '📱',
    tmdbIds: [235900, 233436, 234950, 274853, 272594, 275503, 226340],
    description: 'Exklusive digitale Kurzgeschichten'
  },
};

export const metadata: Metadata = {
  title: 'The Walking Dead Universe - Alle Serien & Spin-offs | serien.de',
  description: 'Der komplette Guide zum Walking Dead Universum! Alle Serien, Spin-offs, News und Infos zur Zombie-Apokalypse von AMC - von der Hauptserie bis Daryl Dixon.',
  openGraph: {
    title: 'The Walking Dead Universe - Franchise Hub',
    description: 'Der komplette Guide zu allen Walking Dead Serien auf Deutsch',
    type: 'website',
  },
};

async function getFranchiseData() {
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
  
  const statusColor = series.status === 'Ended' 
    ? 'bg-red-500/30 text-red-200' 
    : series.status === 'Returning Series'
      ? 'bg-green-500/30 text-green-200'
      : 'bg-gray-500/30 text-gray-200';
    
  return (
    <Link 
      href={`/serie/${series.slug}`}
      className="group block bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-800 hover:border-red-500/50 transition-all duration-300 hover:scale-[1.02]"
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
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-medium text-white">{series.voteAverage.toFixed(1)}</span>
          </div>
        )}
        
        <div className="absolute top-2 left-2">
          <span className={`text-xs px-2 py-0.5 rounded ${statusColor}`}>
            {series.status === 'Ended' ? 'Beendet' : series.status === 'Returning Series' ? 'Laufend' : series.status}
          </span>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2">
            {series.title}
          </h3>
          {series.numberOfSeasons && (
            <p className="text-xs text-zinc-400 mt-1">
              {series.numberOfSeasons} Staffel{series.numberOfSeasons !== 1 ? 'n' : ''} · {series.numberOfEpisodes} Episoden
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
        <h3 className="font-medium text-white text-sm line-clamp-2 group-hover:text-red-400 transition-colors">
          {article.title}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          {article.series && (
            <span className="text-xs text-red-500">{article.series.title}</span>
          )}
          {article.publishedAt && (
            <span className="text-xs text-zinc-500">
              {new Date(article.publishedAt).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}
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

export default async function WalkingDeadFranchiseHub() {
  const { series, news } = await getFranchiseData();
  
  const mainSeries = series.find(s => s.tmdbId === 1402);
  const backdropUrl = mainSeries?.backdropPath 
    ? `https://image.tmdb.org/t/p/original${mainSeries.backdropPath}`
    : '/placeholders/backdrop.jpg';
  
  const totalSeasons = series.reduce((sum, s) => sum + (s.numberOfSeasons || 0), 0);
  const totalEpisodes = series.reduce((sum, s) => sum + (s.numberOfEpisodes || 0), 0);
  
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero Section */}
      <div className="relative h-[50vh] min-h-[400px]">
        <Image
          src={backdropUrl}
          alt="The Walking Dead Universe"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-transparent to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="max-w-[1000px] mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                FRANCHISE HUB
              </span>
              <span className="text-zinc-400 text-sm">AMC / AMC+</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
              The Walking Dead
              <span className="block text-2xl md:text-3xl text-red-500 font-normal mt-2">Universe</span>
            </h1>
            
            <p className="text-lg text-zinc-300 max-w-2xl mb-6">
              Das größte Zombie-Franchise der TV-Geschichte. Von der Hauptserie bis zu den 
              neuesten Spin-offs – alle Geschichten aus der Apokalypse an einem Ort.
            </p>
            
            {/* Stats */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-red-500" />
                <span className="text-white font-semibold">{series.length}</span>
                <span className="text-zinc-400">Serien</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-red-500" />
                <span className="text-white font-semibold">{totalSeasons}</span>
                <span className="text-zinc-400">Staffeln</span>
              </div>
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-red-500" />
                <span className="text-white font-semibold">{totalEpisodes}+</span>
                <span className="text-zinc-400">Episoden</span>
              </div>
              <div className="flex items-center gap-2">
                <Skull className="w-5 h-5 text-red-500" />
                <span className="text-white font-semibold">2010</span>
                <span className="text-zinc-400">bis heute</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-[1000px] mx-auto px-4 py-12">
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
                  <span className="text-red-500">🧟</span> Aktuelle News
                </h2>
                
                {news.length > 0 ? (
                  <div className="space-y-4">
                    {news.map(article => (
                      <NewsCard key={article.slug} article={article} />
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm">
                    Noch keine News. Die Pipeline sammelt bald Artikel zu TWD!
                  </p>
                )}
              </div>
              
              {/* Quick Facts */}
              <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 mt-6">
                <h2 className="text-lg font-bold text-white mb-4">📊 Quick Facts</h2>
                <ul className="space-y-3 text-sm">
                  <li className="flex justify-between">
                    <span className="text-zinc-400">Erstausstrahlung</span>
                    <span className="text-white">31. Oktober 2010</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-400">Sender</span>
                    <span className="text-white">AMC</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-400">Streaming DE</span>
                    <span className="text-white">Disney+ / MagentaTV</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-400">Showrunner</span>
                    <span className="text-white">Scott M. Gimple</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-zinc-400">Basiert auf</span>
                    <span className="text-white">Comic von Robert Kirkman</span>
                  </li>
                </ul>
              </div>
              
              {/* Timeline */}
              <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 mt-6">
                <h2 className="text-lg font-bold text-white mb-4">📅 Franchise Timeline</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <span className="text-red-500 font-mono">2010</span>
                    <span className="text-zinc-300">The Walking Dead startet</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-red-500 font-mono">2015</span>
                    <span className="text-zinc-300">Fear the Walking Dead</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-red-500 font-mono">2020</span>
                    <span className="text-zinc-300">World Beyond (Limited)</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-red-500 font-mono">2022</span>
                    <span className="text-zinc-300">Hauptserie endet (S11)</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-red-500 font-mono">2023</span>
                    <span className="text-zinc-300">Dead City & Daryl Dixon</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-red-500 font-mono">2024</span>
                    <span className="text-zinc-300">The Ones Who Live (Rick & Michonne)</span>
                  </div>
                </div>
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
            name: 'The Walking Dead Universe - Franchise Hub',
            description: 'Kompletter Guide zu allen Walking Dead Serien',
            url: 'https://serien.de/the-walking-dead',
            mainEntity: {
              '@type': 'TVSeries',
              name: 'The Walking Dead',
              numberOfSeasons: mainSeries?.numberOfSeasons,
              numberOfEpisodes: mainSeries?.numberOfEpisodes,
            }
          })
        }}
      />
    </div>
  );
}
