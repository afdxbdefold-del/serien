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
      const itemStreamers = isNews 
        ? [item.streamer, ...(item.providers || [])]
        : (item.providers || []);
      return itemStreamers.some((s: string) => selectedStreamers.includes(s));
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

  // Load more functions would need API implementation
  const loadMoreNews = async () => {
    // TODO: Implement pagination API call
  };

  const loadMoreSeries = async () => {
    // TODO: Implement pagination API call
  };

  const handleFollowToggle = async (seriesId: string, isCurrentlyFollowing: boolean) => {
    // TODO: Implement follow/unfollow API call
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Clean style like Feed buttons */}
      {!isAuthenticated && (
        <div className="py-10 md:py-14">
          <div className="container mx-auto px-6 md:px-12">
            <div className="max-w-3xl mx-auto text-center bg-gray-50 rounded-3xl p-8 md:p-12">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
                Folge deinen Lieblingsserien
              </h1>
              <p className="text-lg md:text-xl text-gray-700 mb-6">
                um personalisierte News und Updates zu erhalten.
              </p>

              {/* Serien entdecken Button */}
              <Link 
                href="/serienfinder"
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                Serien entdecken
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Feed Switcher */}
          <FeedSwitcher 
            activeTab={activeTab} 
            onTabChange={setActiveTab}
            isAuthenticated={isAuthenticated}
          />

          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            {/* Search */}
            {activeTab === 'follow-shows' && (
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Serien durchsuchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>
            )}
          </div>

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

          {activeTab === 'follow-shows' && (
            <>
              {filteredSeriesByStreamer.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {filteredSeriesByStreamer.map((show: any) => (
                      <SeriesCard 
                        key={show.tmdbId}
                        tmdbId={show.tmdbId}
                        slug={show.slug}
                        title={show.title}
                        posterPath={show.posterLocalUrl}
                        overview={show.overview}
                        status={show.status}
                      />
                    ))}
                  </div>
                  
                  {/* Load More Button */}
                  {hasMoreSeries && filteredSeriesByStreamer.length > 0 && (
                    <div className="mt-12 flex justify-center">
                      <button
                        onClick={loadMoreSeries}
                        disabled={loadingMoreSeries}
                        className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {loadingMoreSeries ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Wird geladen...</span>
                          </>
                        ) : (
                          <span>Mehr Serien anzeigen</span>
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-2">Keine Serien gefunden.</p>
                  {selectedStreamers.length > 0 && (
                    <p className="text-sm text-gray-400">
                      Versuchen Sie, die Filter zurückzusetzen.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Floating Filter Button - Bottom Right */}
      <button
        onClick={() => setShowFilterModal(true)}
        className="fixed bottom-8 right-8 flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full shadow-2xl hover:shadow-3xl hover:from-cyan-600 hover:to-blue-600 transition-all z-40"
      >
        <SlidersHorizontal className="h-5 w-5" />
        <span className="font-semibold">Filter</span>
        {selectedStreamers.length > 0 && (
          <span className="ml-1 px-2.5 py-0.5 bg-white text-cyan-600 text-sm font-bold rounded-full">
            {selectedStreamers.length}
          </span>
        )}
      </button>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold">Filter nach Streamer</h2>
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
                          ? 'border-brand bg-brand/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 ${streamer.color} rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0`}
                        >
                          {streamer.label.substring(0, 1)}
                        </div>
                        <span className="font-medium text-left">{streamer.label}</span>
                        {isSelected && (
                          <Check className="h-5 w-5 text-brand ml-auto" />
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
                  className="flex-1 px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors"
                >
                  Anwenden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t bg-white mt-20">
        <div className="container mx-auto px-6 md:px-12 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-bold mb-4">
                serien.de
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Deine Quelle für TV-Serien News
              </p>
              {/* Statistics */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="font-semibold">📺 {stats.series_total > 0 ? stats.series_total.toLocaleString('de-DE') : '...'}</span>
                  <span className="text-gray-500">Serien</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="font-semibold">📰 {stats.news_total > 0 ? stats.news_total.toLocaleString('de-DE') : '...'}</span>
                  <span className="text-gray-500">News-Artikel</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Navigation</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/" className="hover:text-gray-900 transition-colors">News</Link></li>
                <li><Link href="/trending" className="hover:text-gray-900 transition-colors">Trending</Link></li>
                <li><Link href="/redaktion" className="hover:text-gray-900 transition-colors">Redaktion</Link></li>
                <li><Link href="/about" className="hover:text-gray-900 transition-colors">Über uns</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Rechtliches</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/impressum" className="hover:text-gray-900 transition-colors">Impressum</Link></li>
                <li><a href="/" className="hover:text-gray-900 transition-colors">Datenschutz</a></li>
                <li><a href="mailto:mail@serien.de" className="hover:text-gray-900 transition-colors">Kontakt</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t text-center text-sm text-gray-600">
            <p>© 2024 serien.de. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
