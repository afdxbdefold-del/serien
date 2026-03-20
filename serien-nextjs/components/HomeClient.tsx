'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Loader2, SlidersHorizontal, X, Check, Sparkles } from 'lucide-react';
import FeedSwitcher from './FeedSwitcher';
import NewsCard from './NewsCard';
import SeriesCard from './SeriesCard';
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
}

export default function HomeClient({ initialNews, initialSeries, stats, isAuthenticated }: HomeClientProps) {
  const [activeTab, setActiveTab] = useState('all-news');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedStreamers, setSelectedStreamers] = useState<string[]>([]);
  
  // Hero background images - random selection on page load
  const heroBackgrounds = [
    'https://customer-assets.emergentagent.com/job_serien-next/artifacts/u0qp8011_47372.jpg',
    'https://customer-assets.emergentagent.com/job_serien-next/artifacts/4os8uxy9_47373.jpg'
  ];
  const [currentBg] = useState(() => heroBackgrounds[Math.floor(Math.random() * heroBackgrounds.length)]);
  
  // Data states
  const [news, setNews] = useState(initialNews);
  const [myNews, setMyNews] = useState<any[]>([]);
  const [series, setSeries] = useState(initialSeries);
  const [loadingMyFeed, setLoadingMyFeed] = useState(false);
  
  // Pagination states
  const [newsPage, setNewsPage] = useState(0);
  const [hasMoreNews, setHasMoreNews] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [seriesPage, setSeriesPage] = useState(0);
  const [hasMoreSeries, setHasMoreSeries] = useState(true);
  const [loadingMoreSeries, setLoadingMoreSeries] = useState(false);

  const NEWS_PER_PAGE = 20;
  const SERIES_PER_PAGE = 20;

  // Load My Feed from LocalStorage followed series
  useEffect(() => {
    const loadMyFeed = async () => {
      const followedIds = getFollowedIds();
      
      if (activeTab === 'my-news' && followedIds.length > 0 && myNews.length === 0) {
        setLoadingMyFeed(true);
        try {
          const response = await fetch('/api/articles/by-followed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tmdbIds: followedIds }),
          });
          
          if (response.ok) {
            const data = await response.json();
            setMyNews(data.articles || []);
          }
        } catch (error) {
          console.error('Failed to load my feed:', error);
        } finally {
          setLoadingMyFeed(false);
        }
      }
      
      // If no followed series, clear feed
      if (followedIds.length === 0) {
        setMyNews([]);
      }
    };
    
    loadMyFeed();
    
    // Listen for follow changes
    const unsubscribe = onFollowsChanged(() => {
      setMyNews([]); // Clear cache when follows change
      loadMyFeed();
    });
    
    return unsubscribe;
  }, [activeTab, myNews.length]);

  // Remove old Google Login function (not needed without auth)
  // const loginWithGoogle = () => { ... };

  // Filter series by search
  const filteredSeries = searchQuery
    ? series.filter(show => 
        show.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : series;

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

  const filteredNews = filterByStreamers(news, true);
  const filteredMyNews = filterByStreamers(myNews, true);
  const filteredSeriesByStreamer = filterByStreamers(filteredSeries, false);

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

  const loadMoreSeries = async () => {
    if (loadingMoreSeries || !hasMoreSeries) return;
    
    setLoadingMoreSeries(true);
    try {
      const nextPage = seriesPage + 1;
      const response = await fetch(`/api/series?page=${nextPage}&limit=${SERIES_PER_PAGE}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.series && data.series.length > 0) {
          setSeries(prev => [...prev, ...data.series]);
          setSeriesPage(nextPage);
          setHasMoreSeries(data.series.length === SERIES_PER_PAGE);
        } else {
          setHasMoreSeries(false);
        }
      }
    } catch (error) {
      console.error('Error loading more series:', error);
    } finally {
      setLoadingMoreSeries(false);
    }
  };

  const handleFollowToggle = async (seriesId: string, isCurrentlyFollowing: boolean) => {
    // TODO: Implement follow/unfollow API call
  };

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero Section - Clean style like Feed buttons */}
      {!isAuthenticated && (
        <section className="py-10 md:py-14" aria-labelledby="hero-heading">
          <div className="container mx-auto px-6 md:px-12">
            <div className="max-w-3xl mx-auto text-center bg-gray-50 dark:bg-gray-900 rounded-3xl p-8 md:p-12">
              <h1 id="hero-heading" className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-3">
                Folge deinen Lieblingsserien
              </h1>
              <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-6">
                um personalisierte News und Updates zu erhalten.
              </p>

              {/* Serien entdecken Button */}
              <Link 
                href="/serienfinder"
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl"
              >
                <Sparkles className="h-5 w-5" />
                Serienfinder
              </Link>
            </div>
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
      <div className="container mx-auto px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Feed Switcher */}
          <FeedSwitcher 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            isAuthenticated={isAuthenticated}
          />

          {/* Tip Box for All News Tab */}
          {activeTab === 'all-news' && (
            <div className="mb-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                💡 <strong>Tipp:</strong> Nutze den Newsfilter, um News nur von bestimmten Streamern anzuzeigen!
              </p>
            </div>
          )}

          {/* Content based on active tab */}
          {activeTab === 'all-news' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredNews.map((item: any) => (
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
              {hasMoreNews && filteredNews.length > 0 && (
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
            </>
          )}

          {activeTab === 'my-news' && (
            <>
              {loadingMyFeed ? (
                <div className="flex justify-center py-24">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Lade deine personalisierten News...</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMyNews.length > 0 ? (
                    filteredMyNews.map((item: any) => (
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
                    ))
                  ) : (
                    <div className="col-span-full text-center py-16">
                      <div className="max-w-md mx-auto">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Sparkles className="h-10 w-10 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">
                          Noch keine personalisierten News
                        </h3>
                        <p className="text-gray-600">
                          Folge deinen Lieblingsserien, um personalisierte News und Updates zu erhalten.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Newsfilter Button - Bottom Right */}
      {(activeTab === 'all-news' || activeTab === 'my-news') && (
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
      )}

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
