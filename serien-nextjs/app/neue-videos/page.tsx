import { Metadata } from 'next';
import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import Image from 'next/image';
import { Play, Youtube, Clock, ExternalLink, Tv, Film } from 'lucide-react';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export const metadata: Metadata = {
  title: 'Neue Videos | Serien-Trailer & Ankündigungen | serien.de',
  description: 'Die neuesten Trailer, Teaser und Ankündigungen von Netflix, Prime Video, Disney+ und mehr. Automatisch aktualisiert.',
};

// Get new videos data - no caching, always fresh
async function getNewVideosData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get recent YouTube videos with their articles
  const videos = await prisma.youtube_videos.findMany({
    where: {
      publishedAt: { gte: thirtyDaysAgo },
    },
    orderBy: { publishedAt: 'desc' },
    take: 30,
    include: {
      channel: {
        select: {
            name: true,
            thumbnailUrl: true,
          },
        },
      },
    });

    // Get article IDs for processed videos
    const articleIds = videos
      .filter(v => v.articleId)
      .map(v => v.articleId as string);

    // Fetch articles
    const articles = articleIds.length > 0
      ? await prisma.articles.findMany({
          where: {
            id: { in: articleIds },
            status: { in: ['published', 'PUBLISHED'] },
          },
          include: {
            users: {
              select: { name: true },
            },
          },
        })
      : [];

    // Create article map
    const articleMap = new Map(articles.map(a => [a.id, a]));

    // Enrich videos with articles
    const enrichedVideos = videos.map(video => ({
      ...video,
      article: video.articleId ? articleMap.get(video.articleId) : null,
    }));

    // Get all tracked channels
    const channels = await prisma.youtube_channels.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    // Stats
    const totalVideos = await prisma.youtube_videos.count();
    const processedVideos = await prisma.youtube_videos.count({
      where: { processed: true },
    });

    return {
      videos: enrichedVideos,
      channels,
      stats: {
        totalVideos,
        processedVideos,
        articlesGenerated: processedVideos,
      },
    };
}

// Format date - ensure date is a Date object
function formatDate(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  
  if (isNaN(date.getTime())) {
    return 'Unbekannt';
  }
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (hours < 1) return 'Gerade eben';
  if (hours < 24) return `vor ${hours} Stunde${hours > 1 ? 'n' : ''}`;
  if (days < 7) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

// Channel logo colors
const channelColors: Record<string, string> = {
  'Netflix DACH': 'bg-red-600',
  'Netflix': 'bg-red-600',
  'Prime Video DE': 'bg-blue-500',
  'Disney+ DE': 'bg-blue-700',
  'Max': 'bg-purple-600',
  'Apple TV+': 'bg-gray-800',
};

export default async function NeueVideosPage() {
  const { videos, channels, stats } = await getNewVideosData();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 via-purple-900/20 to-blue-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,0,0,0.15),transparent_50%)]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-full mb-6">
              <Youtube className="w-5 h-5 text-red-400" />
              <span className="text-sm font-medium text-red-300">Automatisch aktualisiert</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
              Neue <span className="text-red-500">Videos</span>
            </h1>
            
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
              Die neuesten Trailer, Teaser und Ankündigungen von deinen Lieblings-Streamingdiensten.
              Wir generieren automatisch Artikel zu jedem neuen Video.
            </p>
            
            {/* Stats */}
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{stats.totalVideos}</div>
                <div className="text-sm text-gray-500">Videos</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">{stats.articlesGenerated}</div>
                <div className="text-sm text-gray-500">Artikel</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">{channels.length}</div>
                <div className="text-sm text-gray-500">Kanäle</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tracked Channels */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Tv className="w-5 h-5 text-gray-400" />
          Verfolgte Kanäle
        </h2>
        <div className="flex flex-wrap gap-3">
          {channels.map((channel) => (
            <a
              key={channel.channelId}
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium transition-transform hover:scale-105 ${channelColors[channel.name] || 'bg-gray-700'}`}
            >
              {channel.name}
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          ))}
        </div>
      </section>

      {/* Videos Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <Film className="w-5 h-5 text-gray-400" />
          Neueste Videos
        </h2>

        {videos.length === 0 ? (
          <div className="text-center py-16">
            <Youtube className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Noch keine Videos</h3>
            <p className="text-gray-400">
              Die Pipeline wird bald die ersten Videos von den Streaming-Kanälen sammeln.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <article
                key={video.videoId}
                className="group bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all duration-300"
              >
                {/* Thumbnail with Play Button */}
                <div className="relative aspect-video">
                  <Image
                    src={video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`}
                    alt={video.title}
                    fill
                    className="object-cover"
                  />
                  <a
                    href={`https://www.youtube.com/watch?v=${video.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                  </a>
                  
                  {/* Channel Badge */}
                  <div className={`absolute top-3 left-3 px-2 py-1 rounded text-xs font-semibold text-white ${channelColors[video.channel.name] || 'bg-gray-700'}`}>
                    {video.channel.name}
                  </div>
                  
                  {/* Status Badge */}
                  {video.processed && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-green-600/90 rounded text-xs font-semibold text-white">
                      Artikel verfügbar
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-white line-clamp-2 mb-2 group-hover:text-red-400 transition-colors">
                    {video.title}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                    <Clock className="w-4 h-4" />
                    {formatDate(video.publishedAt)}
                  </div>
                  
                  {video.description && (
                    <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                      {video.description}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {video.article ? (
                      <Link
                        href={`/${video.article.slug}`}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Artikel lesen
                      </Link>
                    ) : (
                      <span className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed">
                        Artikel wird generiert...
                      </span>
                    )}
                    <a
                      href={`https://www.youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
                      title="Auf YouTube ansehen"
                    >
                      <Youtube className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            So funktioniert's
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Youtube className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">1. Kanäle überwachen</h3>
              <p className="text-sm text-gray-400">
                Wir verfolgen die offiziellen Kanäle von Netflix, Prime, Disney+ und mehr.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Play className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">2. Neue Videos erkennen</h3>
              <p className="text-sm text-gray-400">
                Automatische Erkennung neuer Trailer und Ankündigungen via RSS.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Film className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">3. Artikel generieren</h3>
              <p className="text-sm text-gray-400">
                KI-gestützte Artikel mit eingebettetem Video und TMDB-Verknüpfung.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
