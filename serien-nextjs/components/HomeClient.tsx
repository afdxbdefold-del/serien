'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, X, Check, Loader2 } from 'lucide-react';
import NewsCard from './NewsCard';
import CurrentlyStreaming from './CurrentlyStreaming';
import NewsHighlightCarousel from './NewsHighlightCarousel';
import StreamerTop10Carousel, { type PlatformBlock } from './StreamerTop10Carousel';
import { getFollowedIds, onFollowsChanged } from '@/lib/followStorage';

// All available streamers
const ALL_STREAMERS = [
  { id: 'Netflix', label: 'Netflix', color: 'bg-red-600', aliases: ['Netflix'] },
  { id: 'Prime Video', label: 'Prime Video', color: 'bg-brand', aliases: ['Prime Video', 'Amazon Prime', 'Amazon Prime Video'] },
  { id: 'Disney+', label: 'Disney+', color: 'bg-blue-900', aliases: ['Disney+', 'Disney Plus'] },
  { id: 'Apple TV+', label: 'Apple TV+', color: 'bg-gray-900', aliases: ['Apple TV+', 'Apple TV'] },
  { id: 'HBO Max', label: 'HBO Max', color: 'bg-purple-700', aliases: ['HBO Max', 'HBO', 'Max'] },
  { id: 'Paramount+', label: 'Paramount+', color: 'bg-brand', aliases: ['Paramount+', 'Paramount+ with Showtime', 'Showtime'] },
  { id: 'Sky', label: 'Sky', color: 'bg-slate-800', aliases: ['Sky', 'Sky Atlantic', 'Sky One'] },
  { id: 'WOW', label: 'WOW', color: 'bg-purple-600', aliases: ['WOW'] },
  { id: 'RTL+', label: 'RTL+', color: 'bg-red-500', aliases: ['RTL+', 'RTL'] },
  { id: 'Joyn', label: 'Joyn', color: 'bg-pink-500', aliases: ['Joyn'] },
  { id: 'MagentaTV', label: 'MagentaTV', color: 'bg-pink-600', aliases: ['MagentaTV'] },
];

interface HomeClientProps {
  initialNews: any[];
  initialSeries: any[];
  stats: { series_total: number; news_total: number; series_german: number };
  isAuthenticated: boolean;
  streamingSeries?: any[];
  top10Blocks?: PlatformBlock[];
}

export default function HomeClient({ initialNews, initialSeries, stats, isAuthenticated, streamingSeries = [], top10Blocks = [] }: HomeClientProps) {
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedStreamers, setSelectedStreamers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'feed'>('all');
  const [followedSeriesIds, setFollowedSeriesIds] = useState<number[]>([]);
  
  // Data states
  const [news, setNews] = useState(initialNews);
  
  // Pagination states
  const [newsPage, setNewsPage] = useState(0);
  const [hasMoreNews, setHasMoreNews] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const NEWS_PER_PAGE = 20;
  const HIGHLIGHT_COUNT = 1;

  // Load followed series from localStorage on mount
  useEffect(() => {
    setFollowedSeriesIds(getFollowedIds());
    
    // Listen for changes
    const unsubscribe = onFollowsChanged(() => {
      setFollowedSeriesIds(getFollowedIds());
    });
    
    return unsubscribe;
  }, []);

  // Split news: First 5 for carousel, rest for grid
  const highlightNews = news.slice(0, HIGHLIGHT_COUNT);
  const gridNews = news.slice(HIGHLIGHT_COUNT);

  // Filter news by followed series for "Mein Feed"
  const feedNews = useMemo(() => {
    if (followedSeriesIds.length === 0) return [];
    return news.filter(item => {
      const seriesId = item.primarySeries?.tmdbId || item.tmdbId;
      return seriesId && followedSeriesIds.includes(Number(seriesId));
    });
  }, [news, followedSeriesIds]);

  // Filter by selected streamers (with alias matching)
  const filterByStreamers = (items: any[], isNews = false) => {
    if (selectedStreamers.length === 0) return items;
    // Build expanded alias set based on selection
    const expanded = new Set<string>();
    for (const id of selectedStreamers) {
      const s = ALL_STREAMERS.find(x => x.id === id);
      (s?.aliases || [id]).forEach(a => expanded.add(a.toLowerCase()));
    }
    return items.filter(item => {
      if (isNews) {
        const networks = item.series?.networks || item.primarySeries?.networks || [];
        if (networks.length === 0) return false;
        return networks.some((n: string) => expanded.has(n.toLowerCase()));
      }
      const itemNetworks = item.networks || item.providers || [];
      return itemNetworks.some((n: string) => expanded.has(n.toLowerCase()));
    });
  };

  const filteredGridNews = filterByStreamers(gridNews, true);

  const toggleStreamer = (streamerId: string) => {
    setSelectedStreamers(prev => 
      prev.includes(streamerId)
        ? prev.filter(s => s !== streamerId)
        : [...prev, streamerId]
    );
  };

  const clearFilters = () => {
    setSelectedStreamers([]);
  };

  // Load more functions
  const loadMoreNews = async () => {
    if (loadingMore || !hasMoreNews) return;
    
    setLoadingMore(true);
    try {
      const nextPage = newsPage + 1;
      const response = await fetch(`/api/news?page=${nextPage}&limit=${NEWS_PER_PAGE}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.articles && data.articles.length > 0) {
          setNews(prev => [...prev, ...data.articles]);
          setNewsPage(nextPage);
          setHasMoreNews(data.articles.length === NEWS_PER_PAGE);
        } else {
          setHasMoreNews(false);
        }
      }
    } catch (error) {
      console.error('Error loading more news:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Auto-load more news when filter is active and filtered results are below threshold
  const MIN_AFTER_FILTER = 10;
  const MAX_AUTO_FETCHES = 5;
  const autoFetchCountRef = useRef(0);

  useEffect(() => {
    autoFetchCountRef.current = 0;
  }, [selectedStreamers]);

  useEffect(() => {
    if (selectedStreamers.length === 0) return;
    if (!hasMoreNews || loadingMore) return;
    if (filteredGridNews.length >= MIN_AFTER_FILTER) return;
    if (autoFetchCountRef.current >= MAX_AUTO_FETCHES) return;
    autoFetchCountRef.current += 1;
    loadMoreNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStreamers, filteredGridNews.length, hasMoreNews, loadingMore]);

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      {/* News Highlight Carousel - Directly under header */}
      {highlightNews.length > 0 && (
        <NewsHighlightCarousel news={highlightNews} />
      )}

      {/* H1 for all users */}
      <section className="py-6 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800" aria-labelledby="main-heading">
        <div className="container mx-auto px-6 md:px-12">
          <h1 id="main-heading" className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Serien News, Trailer & Streaming-Starts
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Top Serien-News heute:</span>
            <Link
              href="/news"
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold transition-colors"
              data-testid="home-news-hub-link"
            >
              Alle News
            </Link>
            <Link href="/news/netflix" className="inline-flex items-center px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Netflix
            </Link>
            <Link href="/news/prime-video" className="inline-flex items-center px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Prime Video
            </Link>
            <Link href="/news/disney-plus" className="inline-flex items-center px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Disney+
            </Link>
            <Link href="/news/apple-tv" className="inline-flex items-center px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Apple TV+
            </Link>
          </div>
        </div>
      </section>

      {/* News Feed Section */}
      <div className="container mx-auto px-6 md:px-12 pt-6 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Tabs */}
          <div className="inline-flex p-1 bg-gray-100 dark:bg-[hsl(230,25%,10%)] rounded-full mb-6" role="tablist" aria-label="News Optionen">
            <button
              onClick={() => setShowFilterPanel(false)}
              className={`relative px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                !showFilterPanel
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-white shadow-lg dark:shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              data-testid="tab-all-news"
            >
              Alle News
              {selectedStreamers.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 dark:bg-white/10 rounded-full">
                  {selectedStreamers.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowFilterPanel(true)}
              className={`relative px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 inline-flex items-center gap-2 ${
                showFilterPanel
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-white shadow-lg dark:shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              data-testid="tab-newsfilter"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Newsfilter
            </button>
          </div>

          {/* Inline Filter Panel */}
          {showFilterPanel && (
            <div className="mb-6 bg-white dark:bg-[hsl(230,25%,9%)] border border-gray-200 dark:border-[hsl(230,25%,15%)] rounded-xl p-6">
              <h3 className="text-lg font-bold dark:text-white mb-4 tracking-tight">Streaming-Dienste auswählen</h3>
              <fieldset>
                <legend className="sr-only">Streaming-Dienste auswählen</legend>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {ALL_STREAMERS.map((streamer) => {
                    const isSelected = selectedStreamers.includes(streamer.id);
                    return (
                      <button
                        key={streamer.id}
                        onClick={() => toggleStreamer(streamer.id)}
                        className={`p-3 rounded-lg border-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 dark:border-cyan-500'
                            : 'border-gray-200 dark:border-[hsl(230,25%,20%)] hover:border-gray-300 dark:hover:border-[hsl(230,25%,30%)] dark:bg-[hsl(230,25%,12%)]'
                        }`}
                        data-testid={`filter-${streamer.id}`}
                        aria-pressed={isSelected}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 ${streamer.color} rounded flex items-center justify-center text-white font-bold flex-shrink-0 text-xs`}
                            aria-hidden="true"
                          >
                            {streamer.label.substring(0, 1)}
                          </div>
                          <span className="font-medium text-left dark:text-white text-sm">{streamer.label}</span>
                          {isSelected && (
                            <Check className="h-4 w-4 text-cyan-600 dark:text-cyan-400 ml-auto" aria-hidden="true" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {selectedStreamers.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm border border-gray-200 dark:border-[hsl(230,25%,20%)] rounded-lg hover:bg-gray-50 dark:hover:bg-[hsl(230,25%,15%)] dark:text-white transition-colors"
                    data-testid="reset-filters"
                  >
                    Filter zurücksetzen ({selectedStreamers.length})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tip Box - Glassmorphism in Dark Mode */}
          <div className="mb-6 bg-gray-50 dark:bg-[hsl(230,25%,9%)] border border-gray-200 dark:border-[hsl(230,25%,15%)] rounded-lg p-3" role="note">
            <p className="text-xs text-gray-600 dark:text-[hsl(215,20%,65%)]">
              💡 <strong>Tipp:</strong> Nutze den Newsfilter, um News nur von bestimmten Streamern anzuzeigen!
            </p>
          </div>

          {/* Content: All News (no tabs) */}
          <div id="news-feed">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGridNews.slice(0, 6).map((item: any, index: number) => (
                  <NewsCard 
                    key={item.id}
                    slug={item.slug}
                    title={item.title}
                    excerpt={item.excerpt}
                    heroLocalUrl={item.heroLocalUrl}
                    heroImageUrl={item.heroImageUrl}
                    cardImageUrl={item.cardImageUrl}
                    tmdbId={item.tmdbId}
                    tmdbType={item.tmdbType}
                    publishedAt={item.publishedAt}
                    updatedAt={item.updatedAt}
                    category={item.category}
                    authorName={item.author?.name}
                    networks={item.primarySeries?.networks || []}
                    isTrending={item.isTrending}
                    isBreaking={item.isBreaking}
                    priority={index < 2}
                  />
                ))}
              </div>

              {/* Ads are restricted to article pages — no AdUnit on the homepage */}

              {/* Remaining News Cards */}
              {filteredGridNews.length > 6 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredGridNews.slice(6).map((item: any) => (
                    <NewsCard 
                      key={item.id}
                      slug={item.slug}
                      title={item.title}
                      excerpt={item.excerpt}
                      heroLocalUrl={item.heroLocalUrl}
                      heroImageUrl={item.heroImageUrl}
                      cardImageUrl={item.cardImageUrl}
                      tmdbId={item.tmdbId}
                      tmdbType={item.tmdbType}
                      publishedAt={item.publishedAt}
                      updatedAt={item.updatedAt}
                      category={item.category}
                      authorName={item.author?.name}
                      networks={item.primarySeries?.networks || []}
                      isTrending={item.isTrending}
                      isBreaking={item.isBreaking}
                    />
                  ))}
                </div>
              )}
              
              {/* Load More Button - with Glow */}
              {hasMoreNews && filteredGridNews.length > 0 && (
                <div className="mt-12 flex justify-center">
                  <button
                    onClick={loadMoreNews}
                    disabled={loadingMore}
                    className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 text-white font-semibold rounded-lg hover:from-cyan-400 hover:to-cyan-300 transition-all duration-300 shadow-lg hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    data-testid="load-more-news"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Wird geladen...</span>
                      </>
                    ) : (
                      <span>Mehr News anzeigen</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Top-10 Streamer Carousel — directly after news feed */}
      {top10Blocks.length > 0 && <StreamerTop10Carousel platforms={top10Blocks} />}

    </main>
  );
}
