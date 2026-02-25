'use client';

import { useState } from 'react';
import FeedSwitcher from '@/components/FeedSwitcher';
import NewsCard from '@/components/NewsCard';
import SeriesCard from '@/components/SeriesCard';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('all-news');

  // Mock data - will be replaced with real API calls
  const mockNews = [
    {
      slug: 'stranger-things-staffel-5',
      title: 'Stranger Things Staffel 5: Neue Details zum Finale',
      excerpt: 'Die Duffer Brothers verraten erste Details zur finalen Staffel der Hit-Serie.',
      heroLocalUrl: 'https://images.unsplash.com/photo-1574267432644-f74f8ec93027',
      publishedAt: new Date('2024-02-20'),
      category: 'Netflix',
      authorName: 'Anna Schmidt'
    },
    {
      slug: 'the-last-of-us-staffel-2',
      title: 'The Last of Us: Staffel 2 startet im April',
      excerpt: 'HBO bestätigt den Starttermin für die zweite Staffel der erfolgreichen Videospiel-Adaption.',
      heroLocalUrl: 'https://images.unsplash.com/photo-1560169897-fc0cdbdfa4d5',
      publishedAt: new Date('2024-02-19'),
      category: 'HBO Max',
      authorName: 'Max Müller'
    }
  ];

  const mockSeries = [
    {
      tmdbId: 66732,
      slug: 'stranger-things',
      title: 'Stranger Things',
      posterPath: 'https://images.unsplash.com/photo-1594908900066-3f47337549d8',
      overview: 'Eine Gruppe von Freunden in den 1980er Jahren'
    },
    {
      tmdbId: 100088,
      slug: 'the-last-of-us',
      title: 'The Last of Us',
      posterPath: 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb',
      overview: 'Post-apokalyptische Drama-Serie'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-[50vh] md:h-[60vh] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Folge deinen Lieblingsserien
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8">
            oder entdecke{' '}
            <a href="/trending" className="text-primary underline font-semibold">
              neue Serien
            </a>{' '}
            zum Anschauen.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-primary/90 transition">
              Mit Google anmelden
            </button>
            <button className="bg-secondary text-secondary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-secondary/80 transition">
              Als Gast weitermachen
            </button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 py-12">
        {/* Feed Switcher */}
        <FeedSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

        {/* News Feed */}
        {activeTab === 'all-news' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-6">Aktuelle News</h2>
            {mockNews.map((article) => (
              <NewsCard key={article.slug} {...article} />
            ))}
            
            <div className="text-center py-8">
              <button className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition">
                Mehr laden
              </button>
            </div>
          </div>
        )}

        {/* My Feed */}
        {activeTab === 'my-feed' && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg mb-4">
              Melde dich an, um deinen personalisierten Feed zu sehen
            </p>
            <button className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition">
              Jetzt anmelden
            </button>
          </div>
        )}

        {/* Series Grid */}
        {activeTab === 'series' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Beliebte Serien</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {mockSeries.map((series) => (
                <SeriesCard key={series.tmdbId} {...series} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter FAB */}
      <button className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition flex items-center justify-center z-40">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>
    </div>
  );
}
