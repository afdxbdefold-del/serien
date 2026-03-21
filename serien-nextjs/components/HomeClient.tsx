'use client';

import React, { useState } from 'react';
import { SlidersHorizontal, X, Check, Loader2 } from 'lucide-react';
import NewsCard from './NewsCard';
import CurrentlyStreaming from './CurrentlyStreaming';
import NewsHighlightCarousel from './NewsHighlightCarousel';

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
  
  // Data states
  const [news, setNews] = useState(initialNews);
  
  // Pagination states
  const [newsPage, setNewsPage] = useState(0);
  const [hasMoreNews, setHasMoreNews] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const NEWS_PER_PAGE = 20;
  const HIGHLIGHT_COUNT = 5;

  // Split news: First 5 for carousel, rest for grid
  const highlightNews = news.slice(0, HIGHLIGHT_COUNT);
  const gridNews = news.slice(HIGHLIGHT_COUNT);

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

      {/* Aktuell im Stream - Hero Section */}
      {!isAuthenticated && streamingSeries.length > 0 && (
        <section className="py-8 md:py-10" aria-labelledby="hero-heading">
          <div className="container mx-auto px-6 md:px-12">
            <CurrentlyStreaming series={streamingSeries} />
          </div>
        </section>
      )}

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
          {/* Section Header */}
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Serien News
            </h2>
            <div className="h-1 w-24 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full hidden sm:block" />
          </div>

          {/* Tip Box */}
          <div className="mb-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              💡 <strong>Tipp:</strong> Nutze den Newsfilter, um News nur von bestimmten Streamern anzuzeigen!
            </p>
          </div>

          {/* News Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGridNews.map((item: any) => (
                  <NewsCard 
                    key={item.id}
                    slug={item.slug}
                    title={item.title}
                    excerpt={item.excerpt}
                    heroLocalUrl={item.heroLocalUrl}
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
              
              {/* Load More Button */}
              {hasMoreNews && filteredGridNews.length > 0 && (
                <div className="mt-12 flex justify-center">
                  <button
                    onClick={loadMoreNews}
                    disabled={loadingMore}
                    className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

      {/* Floating Newsfilter Button - Bottom Right */}
      <button
        onClick={() => setShowFilterModal(true)}
        className="fixed bottom-8 right-8 flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full shadow-2xl hover:shadow-3xl hover:from-cyan-600 hover:to-blue-600 transition-all z-40"
      >
        <SlidersHorizontal className="h-5 w-5" />
        <span className="font-semibold">Newsfilter</span>
        {selectedStreamers.length > 0 && (
          <span className="ml-1 px-2.5 py-0.5 bg-white text-cyan-600 text-sm font-bold rounded-full">
            {selectedStreamers.length}
          </span>
        )}
      </button>

      {/* Newsfilter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowFilterModal(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold">Newsfilter nach Streamer</h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {ALL_STREAMERS.map((streamer) => {
                  const isSelected = selectedStreamers.includes(streamer.id);
                  return (
                    <button
                      key={streamer.id}
                      onClick={() => toggleStreamer(streamer.id)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 ${streamer.color} rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0 text-sm`}
                        >
                          {streamer.label.substring(0, 1)}
                        </div>
                        <span className="font-medium text-left">{streamer.label}</span>
                        {isSelected && (
                          <Check className="h-5 w-5 text-cyan-600 ml-auto" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex gap-4">
                <button
                  onClick={clearFilters}
                  className="flex-1 px-6 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Zurücksetzen
                </button>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-colors"
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
