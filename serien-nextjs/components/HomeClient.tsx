'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SlidersHorizontal, X, Check, Loader2 } from 'lucide-react';
import NewsCard from './NewsCard';
import CurrentlyStreaming from './CurrentlyStreaming';
import NewsHighlightCarousel from './NewsHighlightCarousel';
import AdUnit from './AdUnit';
import { getFollowedIds, onFollowsChanged } from '@/lib/followStorage';

// All available streamers
const ALL_STREAMERS = [
  { id: 'Netflix', label: 'Netflix', color: 'bg-red-600' },
  { id: 'HBO Max', label: 'HBO Max', color: 'bg-purple-700' },
  { id: 'Amazon Prime', label: 'Prime Video', color: 'bg-brand' },
  { id: 'Disney+', label: 'Disney+', color: 'bg-blue-900' },
  { id: 'Apple TV+', label: 'Apple TV+', color: 'bg-gray-900' },
  { id: 'Paramount+', label: 'Paramount+', color: 'bg-brand' },
  { id: 'Sky', label: 'Sky', color: 'bg-slate-800' },
  { id: 'WOW', label: 'WOW', color: 'bg-purple-600' },
  { id: 'RTL+', label: 'RTL+', color: 'bg-red-500' },
  { id: 'Joyn', label: 'Joyn', color: 'bg-pink-500' },
  { id: 'MagentaTV', label: 'MagentaTV', color: 'bg-pink-600' },
];

interface HomeClientProps {
  initialNews: any[];
  initialSeries: any[];
  stats: { series_total: number; news_total: number; series_german: number };
  isAuthenticated: boolean;
  streamingSeries?: any[];
}

export default function HomeClient({ initialNews, initialSeries, stats, isAuthenticated, streamingSeries = [] }: HomeClientProps) {
  const [showFilterModal, setShowFilterModal] = useState(false);
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
  const HIGHLIGHT_COUNT = 5;

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

  // Filter by selected streamers
  const filterByStreamers = (items: any[], isNews = false) => {
    if (selectedStreamers.length === 0) return items;
    return items.filter(item => {
      // For news articles, check primarySeries.networks
      if (isNews && item.primarySeries?.networks) {
        return item.primarySeries.networks.some((network: string) => 
          selectedStreamers.includes(network)
        );
      }
      // For series, check networks or providers
      const itemNetworks = item.networks || item.providers || [];
      return itemNetworks.some((network: string) => selectedStreamers.includes(network));
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

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      {/* News Highlight Carousel - Directly under header */}
      {highlightNews.length > 0 && (
        <NewsHighlightCarousel news={highlightNews} />
      )}

      {/* Aktuell im Stream - Removed */}

      {/* Authenticated: Show H1 at top */}
      {isAuthenticated && (
        <section className="py-6 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-800" aria-labelledby="main-heading">
          <div className="container mx-auto px-6 md:px-12">
            <h1 id="main-heading" className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Serien-News
            </h1>
          </div>
        </section>
      )}

      {/* News Feed Section */}
      <div className="container mx-auto px-6 md:px-12 pt-1 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header with Tabs */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Serien News
              </h2>
              <div className="h-1 w-24 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full hidden sm:block dark:shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
            </div>
          </div>

          {/* Tabs - Stylische Pill-Buttons */}
          <div className="inline-flex p-1 bg-gray-100 dark:bg-[hsl(230,25%,10%)] rounded-full mb-6" role="tablist" aria-label="News Kategorien">
            <button
              onClick={() => setActiveTab('all')}
              role="tab"
              aria-selected={activeTab === 'all'}
              aria-controls="tab-panel-all"
              className={`relative px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                activeTab === 'all'
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-white shadow-lg dark:shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              data-testid="tab-all-news"
            >
              Alle News
            </button>
            <button
              onClick={() => setActiveTab('feed')}
              role="tab"
              aria-selected={activeTab === 'feed'}
              aria-controls="tab-panel-feed"
              className={`relative px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                activeTab === 'feed'
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-white shadow-lg dark:shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              data-testid="tab-my-feed"
            >
              Mein Feed
              {followedSeriesIds.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-white/20 dark:bg-white/10 rounded-full">
                  {followedSeriesIds.length}
                </span>
              )}
            </button>
          </div>

          {/* Tip Box - Glassmorphism in Dark Mode */}
          <div className="mb-6 bg-gray-50 dark:bg-[hsl(230,25%,9%)] border border-gray-200 dark:border-[hsl(230,25%,15%)] rounded-lg p-3" role="note">
            <p className="text-xs text-gray-600 dark:text-[hsl(215,20%,65%)]">
              💡 <strong>Tipp:</strong> Nutze den Newsfilter, um News nur von bestimmten Streamern anzuzeigen!
            </p>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'all' ? (
            <div id="tab-panel-all" role="tabpanel" aria-labelledby="tab-all-news">
              {/* News Grid */}
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

              {/* Ad Unit after first 6 cards */}
              {filteredGridNews.length > 6 && (
                <div className="my-8">
                  <AdUnit slot="1234567890" format="horizontal" className="max-w-4xl mx-auto" />
                </div>
              )}

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
          ) : (
            /* Mein Feed Tab Content */
            <div id="tab-panel-feed" role="tabpanel" aria-labelledby="tab-my-feed">
              {followedSeriesIds.length > 0 && feedNews.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {feedNews.map((item: any) => (
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
                      category={item.category}
                      authorName={item.author?.name}
                      networks={item.primarySeries?.networks || []}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-[hsl(230,25%,12%)] rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {followedSeriesIds.length === 0 ? 'Noch keine Serien gefolgt' : 'Keine News zu deinen Serien'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                      Gehe zu einer Serien-Seite und klicke auf "Folgen", um News zu dieser Serie hier zu sehen.
                    </p>
                    <a 
                      href="/serienfinder"
                      className="inline-block mt-4 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors"
                    >
                      Serien entdecken
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Newsfilter Button - Glassmorphism */}
      <button
        onClick={() => setShowFilterModal(true)}
        className="fixed bottom-8 right-8 flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-cyan-400 dark:from-cyan-500/90 dark:to-cyan-400/90 text-white rounded-full shadow-2xl dark:shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_40px_rgba(6,182,212,0.6)] dark:backdrop-blur-sm transition-all duration-300 z-40 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2"
        data-testid="newsfilter-button"
        aria-label={`Newsfilter öffnen${selectedStreamers.length > 0 ? `, ${selectedStreamers.length} Filter aktiv` : ''}`}
      >
        <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
        <span className="font-semibold">Newsfilter</span>
        {selectedStreamers.length > 0 && (
          <span className="ml-1 px-2.5 py-0.5 bg-white text-cyan-600 text-sm font-bold rounded-full" aria-hidden="true">
            {selectedStreamers.length}
          </span>
        )}
      </button>

      {/* Newsfilter Modal - Glassmorphism in Dark Mode */}
      {showFilterModal && (
        <div 
          className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
          onClick={() => setShowFilterModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-modal-title"
        >
          <div className="bg-white dark:bg-[hsl(230,25%,9%)] dark:border dark:border-[hsl(230,25%,15%)] rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-[hsl(230,25%,15%)] flex items-center justify-between sticky top-0 bg-white dark:bg-[hsl(230,25%,9%)]">
              <h2 id="filter-modal-title" className="text-2xl font-bold dark:text-white tracking-tight">Newsfilter nach Streamer</h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-[hsl(230,25%,15%)] rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                data-testid="close-filter-modal"
                aria-label="Filter schließen"
              >
                <X className="h-6 w-6 dark:text-white" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6">
              <fieldset>
                <legend className="sr-only">Streaming-Dienste auswählen</legend>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {ALL_STREAMERS.map((streamer) => {
                  const isSelected = selectedStreamers.includes(streamer.id);
                  return (
                    <button
                      key={streamer.id}
                      onClick={() => toggleStreamer(streamer.id)}
                      className={`p-4 rounded-xl border-2 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 dark:border-cyan-500'
                          : 'border-gray-200 dark:border-[hsl(230,25%,20%)] hover:border-gray-300 dark:hover:border-[hsl(230,25%,30%)] dark:bg-[hsl(230,25%,12%)]'
                      }`}
                      data-testid={`filter-${streamer.id}`}
                      aria-pressed={isSelected}
                      aria-label={`${streamer.label} ${isSelected ? 'ausgewählt' : 'auswählen'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 ${streamer.color} rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0 text-sm`}
                          aria-hidden="true"
                        >
                          {streamer.label.substring(0, 1)}
                        </div>
                        <span className="font-medium text-left dark:text-white">{streamer.label}</span>
                        {isSelected && (
                          <Check className="h-5 w-5 text-cyan-600 dark:text-cyan-400 ml-auto" aria-hidden="true" />
                        )}
                      </div>
                    </button>
                  );
                })}
                </div>
              </fieldset>

              <div className="mt-6 flex gap-4">
                <button
                  onClick={clearFilters}
                  className="flex-1 px-6 py-3 border border-gray-200 dark:border-[hsl(230,25%,20%)] rounded-lg hover:bg-gray-50 dark:hover:bg-[hsl(230,25%,15%)] dark:text-white transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  data-testid="reset-filters"
                >
                  Zurücksetzen
                </button>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 text-white rounded-lg hover:from-cyan-400 hover:to-cyan-300 transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  data-testid="apply-filters"
                >
                  Anwenden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
