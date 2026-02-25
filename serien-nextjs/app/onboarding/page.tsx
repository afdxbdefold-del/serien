'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Check, Loader2, ChevronRight } from 'lucide-react';
import Image from 'next/image';

const streamingProviders = [
  'Netflix',
  'Amazon Prime Video',
  'Disney Plus',
  'HBO Max',
  'Apple TV Plus',
  'Paramount Plus',
  'Sky',
  'RTL+',
  'Joyn',
  'WOW',
  'Magenta TV+',
  'Crunchyroll'
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Streaming providers
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  
  // Step 2: Series
  const [topSeries, setTopSeries] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [followedSeries, setFollowedSeries] = useState<Set<number>>(new Set());
  const [searching, setSearching] = useState(false);

  // Load top 20 series on mount
  useEffect(() => {
    const loadTopSeries = async () => {
      try {
        const response = await fetch('/api/series');
        const data = await response.json();
        setTopSeries(data.slice(0, 20));
      } catch (err) {
        console.error('Failed to load top series:', err);
      }
    };
    loadTopSeries();
  }, []);

  // Search series
  useEffect(() => {
    const searchSeries = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const response = await fetch(`/api/series?search=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        setSearchResults(data);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(searchSeries, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const toggleProvider = (provider: string) => {
    setSelectedProviders(prev =>
      prev.includes(provider)
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
  };

  const toggleFollow = async (seriesId: number) => {
    setFollowedSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seriesId)) {
        newSet.delete(seriesId);
      } else {
        newSet.add(seriesId);
      }
      return newSet;
    });
  };

  const handleComplete = async () => {
    if (followedSeries.size === 0) {
      alert('Bitte folgen Sie mindestens einer Serie.');
      return;
    }

    setLoading(true);
    try {
      // Save user preferences
      // TODO: Implement API call to save preferences
      router.push('/');
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
    } finally {
      setLoading(false);
    }
  };

  const displayedSeries = searchQuery ? searchResults : topSeries;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Willkommen bei serien.de!</h1>
          <p className="text-gray-600 mt-1">Personalisieren Sie Ihre Erfahrung</p>
          
          {/* Progress */}
          <div className="mt-6 flex items-center gap-2">
            <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-gray-200'}`} />
            <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-200'}`} />
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className={step >= 1 ? 'text-blue-600 font-medium' : 'text-gray-500'}>Streaming-Dienste</span>
            <span className={step >= 2 ? 'text-blue-600 font-medium' : 'text-gray-500'}>Serien folgen</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Step 1: Streaming Providers */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welche Streaming-Dienste nutzen Sie?</h2>
            <p className="text-gray-600 mb-6">Wählen Sie Ihre Streaming-Dienste aus, um relevante News zu erhalten. (Optional)</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {streamingProviders.map(provider => {
                const isSelected = selectedProviders.includes(provider);
                return (
                  <button
                    key={provider}
                    onClick={() => toggleProvider(provider)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{provider}</span>
                      {isSelected && (
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="text-gray-500 hover:text-gray-700"
              >
                Überspringen
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg flex items-center gap-2"
              >
                Weiter
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Follow Series */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Folgen Sie Ihren Lieblingsserien</h2>
            <p className="text-gray-600 mb-6">
              Wählen Sie mindestens eine Serie aus, um personalisierte News zu erhalten.
              <span className="block mt-1 text-blue-600 font-medium">
                {followedSeries.size} Serie{followedSeries.size !== 1 ? 'n' : ''} ausgewählt
                {followedSeries.size === 0 && ' (mindestens 1 erforderlich)'}
              </span>
            </p>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Serien durchsuchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />
              )}
            </div>

            {/* Series Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8 max-h-96 overflow-y-auto">
              {displayedSeries.map((show: any) => {
                const isFollowed = followedSeries.has(show.tmdbId);
                return (
                  <button
                    key={show.tmdbId}
                    onClick={() => toggleFollow(show.tmdbId)}
                    className="relative group"
                  >
                    <div className={`relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition-all ${
                      isFollowed ? 'border-blue-500' : 'border-transparent'
                    }`}>
                      {show.posterLocalUrl ? (
                        <Image
                          src={show.posterLocalUrl}
                          alt={show.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                          Kein Bild
                        </div>
                      )}
                      
                      {isFollowed && (
                        <div className="absolute top-2 right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end p-3">
                        <p className="text-white text-sm font-medium line-clamp-2">{show.title}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={() => setStep(1)}
                className="text-gray-500 hover:text-gray-700 flex items-center gap-2"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
                Zurück
              </button>
              <button
                onClick={handleComplete}
                disabled={loading || followedSeries.size === 0}
                className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Wird gespeichert...
                  </>
                ) : (
                  <>
                    Fertig
                    <Check className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
