'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings as SettingsIcon, Save, Search, Loader2, Check, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

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

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('streaming'); // 'streaming' or 'series'
  
  // Streaming providers
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  
  // Series
  const [followedSeries, setFollowedSeries] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // TODO: Check if user is authenticated
  const isAuthenticated = true; // Placeholder

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // Load followed series
  useEffect(() => {
    const loadFollowedSeries = async () => {
      if (!isAuthenticated) return;
      
      setLoading(true);
      try {
        // TODO: Implement API call to get followed series
        setFollowedSeries([]);
      } catch (err) {
        console.error('Failed to load followed series:', err);
      } finally {
        setLoading(false);
      }
    };
    loadFollowedSeries();
  }, [isAuthenticated]);

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
        // Filter out already followed series
        const filteredData = data.filter(
          (show: any) => !followedSeries.some(followed => followed.tmdbId === show.tmdbId)
        );
        setSearchResults(filteredData);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(searchSeries, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, followedSeries]);

  const toggleProvider = (provider: string) => {
    setSelectedProviders(prev =>
      prev.includes(provider)
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
  };

  const handleFollowSeries = async (series: any) => {
    try {
      // TODO: Implement API call to follow series
      setFollowedSeries(prev => [...prev, series]);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Failed to follow series:', err);
      alert('Fehler beim Folgen der Serie. Bitte versuchen Sie es erneut.');
    }
  };

  const handleUnfollowSeries = async (seriesId: number) => {
    if (!window.confirm('Möchten Sie dieser Serie wirklich nicht mehr folgen?')) {
      return;
    }

    try {
      // TODO: Implement API call to unfollow series
      setFollowedSeries(prev => prev.filter(s => s.tmdbId !== seriesId));
    } catch (err) {
      console.error('Failed to unfollow series:', err);
      alert('Fehler beim Entfolgen der Serie. Bitte versuchen Sie es erneut.');
    }
  };

  const handleSaveProviders = async () => {
    setSaving(true);
    try {
      // TODO: Implement API call to save providers
      alert('Streaming-Dienste wurden gespeichert!');
    } catch (err) {
      console.error('Failed to save providers:', err);
      alert('Fehler beim Speichern. Bitte versuchen Sie es erneut.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="h-8 w-8 text-cyan-500" />
            <h1 className="text-3xl font-bold text-gray-900">Einstellungen</h1>
          </div>
          <p className="text-gray-600">
            Verwalten Sie Ihre Streaming-Dienste und gefolgten Serien
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2 mb-8 border-b">
          <button
            onClick={() => setActiveSection('streaming')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeSection === 'streaming'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Streaming-Dienste
          </button>
          <button
            onClick={() => setActiveSection('series')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeSection === 'series'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Gefolgte Serien ({followedSeries.length})
          </button>
        </div>

        {/* Streaming Providers Section */}
        {activeSection === 'streaming' && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Ihre Streaming-Dienste</h2>
            <p className="text-gray-600 mb-6">
              Wählen Sie die Streaming-Dienste aus, die Sie nutzen, um relevante News zu erhalten.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {streamingProviders.map(provider => {
                const isSelected = selectedProviders.includes(provider);
                return (
                  <button
                    key={provider}
                    onClick={() => toggleProvider(provider)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-cyan-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{provider}</span>
                      {isSelected && (
                        <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleSaveProviders}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Speichern
                </>
              )}
            </button>
          </div>
        )}

        {/* Followed Series Section */}
        {activeSection === 'series' && (
          <div className="space-y-6">
            {/* Add Series */}
            <div className="bg-white rounded-xl shadow-sm p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Neue Serie hinzufügen</h2>
              <p className="text-gray-600 mb-4">
                Suchen Sie nach Serien, um ihnen zu folgen.
              </p>
              
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Serien durchsuchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                {searching && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {searchResults.map((show: any) => (
                    <button
                      key={show.tmdbId}
                      onClick={() => handleFollowSeries(show)}
                      className="text-left group"
                    >
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-transparent hover:border-cyan-500 transition-all">
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
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end p-3">
                          <p className="text-white text-sm font-medium line-clamp-2">{show.title}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Followed Series List */}
            <div className="bg-white rounded-xl shadow-sm p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Ihre gefolgten Serien</h2>
              
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
                </div>
              ) : followedSeries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">Sie folgen noch keiner Serie.</p>
                  <p className="text-sm text-gray-400">Suchen Sie oben nach Serien, um ihnen zu folgen.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {followedSeries.map((show: any) => (
                    <div key={show.tmdbId} className="relative group">
                      <Link href={`/serie/${show.slug}`}>
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden">
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
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end p-3">
                            <p className="text-white text-sm font-medium line-clamp-2">{show.title}</p>
                          </div>
                        </div>
                      </Link>
                      
                      {/* Unfollow Button */}
                      <button
                        onClick={() => handleUnfollowSeries(show.tmdbId)}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
