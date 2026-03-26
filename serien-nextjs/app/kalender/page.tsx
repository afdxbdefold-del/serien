import prisma from '@/lib/prisma';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, Tv, ChevronLeft, ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Serien-Kalender – Neue Folgen & Staffeln | serien.de',
  description: 'Übersicht aller neuen Serien-Folgen auf Netflix, Prime Video, Disney+ und mehr. Verpasse keine neue Staffel deiner Lieblingsserie!',
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
  },
  alternates: {
    canonical: 'https://serien.de/kalender',
  },
  openGraph: {
    title: 'Serien-Kalender – Neue Folgen & Staffeln',
    description: 'Übersicht aller neuen Serien-Folgen auf Netflix, Prime Video, Disney+ und mehr.',
  }
};

// Network colors/badges
const NETWORK_STYLES: Record<string, { bg: string; text: string }> = {
  'Netflix': { bg: 'bg-red-600', text: 'text-white' },
  'Prime Video': { bg: 'bg-blue-500', text: 'text-white' },
  'Amazon Prime Video': { bg: 'bg-blue-500', text: 'text-white' },
  'Disney+': { bg: 'bg-blue-700', text: 'text-white' },
  'Apple TV+': { bg: 'bg-gray-800', text: 'text-white' },
  'Paramount+': { bg: 'bg-blue-600', text: 'text-white' },
  'HBO Max': { bg: 'bg-purple-700', text: 'text-white' },
  'Max': { bg: 'bg-purple-700', text: 'text-white' },
  'WOW': { bg: 'bg-purple-600', text: 'text-white' },
  'Sky': { bg: 'bg-blue-900', text: 'text-white' },
  'Crunchyroll': { bg: 'bg-orange-500', text: 'text-white' },
};

function getNetworkStyle(network: string | null) {
  if (!network) return { bg: 'bg-gray-600', text: 'text-white' };
  
  for (const [key, style] of Object.entries(NETWORK_STYLES)) {
    if (network.toLowerCase().includes(key.toLowerCase())) {
      return style;
    }
  }
  return { bg: 'bg-gray-600', text: 'text-white' };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit'
  });
}

function getWeekDates(offset: number = 0) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1 + (offset * 7)); // Monday
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  return { start: startOfWeek, end: endOfWeek };
}

export default async function KalenderPage({
  searchParams
}: {
  searchParams: Promise<{ week?: string; network?: string }>
}) {
  const params = await searchParams;
  const weekOffset = parseInt(params.week || '0');
  const networkFilter = params.network;
  
  const { start, end } = getWeekDates(weekOffset);
  
  // Fetch upcoming episodes
  const whereClause: any = {
    airDate: {
      gte: start,
      lte: end
    }
  };
  
  if (networkFilter) {
    whereClause.network = { contains: networkFilter, mode: 'insensitive' };
  }
  
  const episodes = await prisma.upcoming_episodes.findMany({
    where: whereClause,
    orderBy: [
      { airDate: 'asc' },
      { seriesName: 'asc' }
    ],
    include: {
      series: {
        select: {
          posterPath: true,
          slug: true
        }
      }
    }
  });
  
  // Group by date
  const episodesByDate: Record<string, typeof episodes> = {};
  
  for (const ep of episodes) {
    const dateKey = ep.airDate.toISOString().split('T')[0];
    if (!episodesByDate[dateKey]) {
      episodesByDate[dateKey] = [];
    }
    episodesByDate[dateKey].push(ep);
  }
  
  // Get all dates in the week
  const weekDates: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    weekDates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  // Get unique networks for filter
  const allNetworks = await prisma.upcoming_episodes.groupBy({
    by: ['network'],
    where: {
      network: { not: null }
    }
  });
  
  const networks = allNetworks
    .map(n => n.network)
    .filter((n): n is string => n !== null)
    .sort();
  
  // Week navigation
  const prevWeek = weekOffset - 1;
  const nextWeek = weekOffset + 1;
  const isCurrentWeek = weekOffset === 0;
  
  const weekLabel = isCurrentWeek 
    ? 'Diese Woche' 
    : weekOffset > 0 
      ? `In ${weekOffset} Woche${weekOffset > 1 ? 'n' : ''}`
      : `Vor ${Math.abs(weekOffset)} Woche${Math.abs(weekOffset) > 1 ? 'n' : ''}`;

  return (
    <main className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <CalendarDays className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">Serien-Kalender</h1>
          </div>
          <p className="text-gray-400 max-w-2xl">
            Alle neuen Folgen von Netflix, Prime Video, Disney+ und weiteren Streaming-Diensten. 
            Weltweit gleichzeitige Veröffentlichung garantiert!
          </p>
        </div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6 bg-gray-900 rounded-lg p-4">
          <Link 
            href={`/kalender?week=${prevWeek}${networkFilter ? `&network=${networkFilter}` : ''}`}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Vorherige Woche</span>
          </Link>
          
          <div className="text-center">
            <div className="text-lg font-semibold text-white">{weekLabel}</div>
            <div className="text-sm text-gray-400">
              {formatDate(start)} – {formatDate(end)}
            </div>
          </div>
          
          <Link 
            href={`/kalender?week=${nextWeek}${networkFilter ? `&network=${networkFilter}` : ''}`}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <span className="hidden sm:inline">Nächste Woche</span>
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
        
        {/* Network Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href={`/kalender?week=${weekOffset}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !networkFilter 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Alle
          </Link>
          {networks.map(network => {
            const style = getNetworkStyle(network);
            const isActive = networkFilter === network;
            return (
              <Link
                key={network}
                href={`/kalender?week=${weekOffset}&network=${encodeURIComponent(network)}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive 
                    ? `${style.bg} ${style.text}` 
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {network}
              </Link>
            );
          })}
        </div>
        
        {/* Calendar Grid */}
        <div className="space-y-4">
          {weekDates.map(date => {
            const dateKey = date.toISOString().split('T')[0];
            const dayEpisodes = episodesByDate[dateKey] || [];
            const isToday = new Date().toDateString() === date.toDateString();
            const isPast = date < new Date() && !isToday;
            
            return (
              <div 
                key={dateKey} 
                className={`rounded-lg border ${
                  isToday 
                    ? 'border-blue-500 bg-blue-500/10' 
                    : isPast 
                      ? 'border-gray-800 bg-gray-900/50 opacity-60' 
                      : 'border-gray-800 bg-gray-900'
                }`}
              >
                {/* Day Header */}
                <div className={`px-4 py-3 border-b ${
                  isToday ? 'border-blue-500/30' : 'border-gray-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl font-bold ${
                        isToday ? 'text-blue-400' : 'text-white'
                      }`}>
                        {date.getDate()}
                      </span>
                      <div>
                        <div className={`font-medium ${
                          isToday ? 'text-blue-300' : 'text-gray-300'
                        }`}>
                          {date.toLocaleDateString('de-DE', { weekday: 'long' })}
                          {isToday && <span className="ml-2 text-blue-400 text-sm">(Heute)</span>}
                        </div>
                        <div className="text-sm text-gray-500">
                          {date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                    {dayEpisodes.length > 0 && (
                      <span className="text-sm text-gray-400">
                        {dayEpisodes.length} {dayEpisodes.length === 1 ? 'Episode' : 'Episoden'}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Episodes */}
                <div className="divide-y divide-gray-800">
                  {dayEpisodes.length > 0 ? (
                    dayEpisodes.map(ep => {
                      const networkStyle = getNetworkStyle(ep.network);
                      return (
                        <div key={ep.id} className="p-4 flex gap-4 hover:bg-gray-800/50 transition-colors">
                          {/* Poster */}
                          <Link href={`/serie/${ep.seriesSlug}`} className="shrink-0">
                            {ep.series?.posterPath ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w92${ep.series.posterPath}`}
                                alt={ep.seriesName}
                                width={60}
                                height={90}
                                className="rounded-md"
                              />
                            ) : (
                              <div className="w-[60px] h-[90px] bg-gray-800 rounded-md flex items-center justify-center">
                                <Tv className="w-6 h-6 text-gray-600" />
                              </div>
                            )}
                          </Link>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <Link 
                                href={`/serie/${ep.seriesSlug}`}
                                className="font-semibold text-white hover:text-blue-400 transition-colors truncate"
                              >
                                {ep.seriesName}
                              </Link>
                              {ep.network && (
                                <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${networkStyle.bg} ${networkStyle.text}`}>
                                  {ep.network}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                              Staffel {ep.seasonNumber}, Folge {ep.episodeNumber}
                              {ep.episodeName && `: "${ep.episodeName}"`}
                            </div>
                            {ep.overview && (
                              <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                                {ep.overview}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-gray-500">
                      Keine neuen Episoden an diesem Tag
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Empty State */}
        {episodes.length === 0 && (
          <div className="text-center py-12">
            <CalendarDays className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-400 mb-2">
              Keine Episoden in dieser Woche
            </h2>
            <p className="text-gray-500 mb-4">
              {networkFilter 
                ? `Keine neuen Folgen von ${networkFilter} in diesem Zeitraum.`
                : 'Versuche eine andere Woche oder aktualisiere die Daten.'}
            </p>
            <Link 
              href="/kalender?week=1"
              className="text-blue-500 hover:underline"
            >
              Nächste Woche anzeigen →
            </Link>
          </div>
        )}
        
        {/* Info Box */}
        <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-800">
          <h3 className="font-semibold text-white mb-2">ℹ️ Hinweis</h3>
          <p className="text-sm text-gray-400">
            Der Kalender zeigt nur Streaming-Originals von Netflix, Prime Video, Disney+ und anderen 
            Plattformen, die weltweit gleichzeitig veröffentlicht werden. Termine für klassische 
            TV-Sender können abweichen.
          </p>
        </div>
      </div>
    </main>
  );
}
