'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';

const STREAMERS = [
  { id: 'netflix', name: 'Netflix', color: 'bg-red-600' },
  { id: 'disney', name: 'Disney+', color: 'bg-blue-600' },
  { id: 'amazon', name: 'Amazon Prime', color: 'bg-cyan-500' },
  { id: 'apple', name: 'Apple TV+', color: 'bg-gray-800' },
  { id: 'sky', name: 'Sky', color: 'bg-blue-500' },
  { id: 'rtl', name: 'RTL+', color: 'bg-orange-500' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedStreamers, setSelectedStreamers] = useState<string[]>([]);
  const [popularSeries, setPopularSeries] = useState<any[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(true);

  // Fetch popular series
  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const response = await fetch('/api/series/popular?limit=12');
        if (response.ok) {
          const data = await response.json();
          setPopularSeries(data);
        }
      } catch (error) {
        console.error('Failed to load series:', error);
      } finally {
        setLoadingSeries(false);
      }
    };
    fetchSeries();
  }, []);

  const toggleStreamer = (streamerId: string) => {
    setSelectedStreamers(prev =>
      prev.includes(streamerId)
        ? prev.filter(id => id !== streamerId)
        : [...prev, streamerId]
    );
  };

  const toggleSeries = (seriesId: number) => {
    setSelectedSeries(prev =>
      prev.includes(seriesId)
        ? prev.filter(id => id !== seriesId)
        : [...prev, seriesId]
    );
  };

  const handleNext = () => {
    if (step === 1 && selectedStreamers.length === 0) {
      alert('Bitte wählen Sie mindestens einen Streaming-Dienst');
      return;
    }
    setStep(2);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Save streamer preferences
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamers: selectedStreamers,
          seriesIds: selectedSeries,
        }),
        credentials: 'include',
      });

      // Redirect to homepage
      window.location.href = '/';
    } catch (error) {
      console.error('Onboarding failed:', error);
      alert('Fehler beim Speichern Ihrer Einstellungen');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Willkommen bei serien.de! 🎬
          </h1>
          <p className="text-lg text-gray-600">
            Personalisieren Sie Ihre Erfahrung in wenigen Schritten
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center space-x-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              1
            </div>
            <div className={`w-24 h-1 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </div>
          </div>
        </div>

        {/* Step 1: Streamers */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welche Streaming-Dienste nutzen Sie?
            </h2>
            <p className="text-gray-600 mb-8">
              Wählen Sie Ihre bevorzugten Dienste aus
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {STREAMERS.map((streamer) => (
                <button
                  key={streamer.id}
                  onClick={() => toggleStreamer(streamer.id)}
                  className={`relative p-6 rounded-xl border-2 transition-all ${
                    selectedStreamers.includes(streamer.id)
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-lg ${streamer.color} mb-3 mx-auto`} />
                  <p className="font-semibold text-gray-900">{streamer.name}</p>
                  {selectedStreamers.includes(streamer.id) && (
                    <div className="absolute top-3 right-3">
                      <Check className="w-6 h-6 text-blue-600" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-between">
              <button
                onClick={handleSkip}
                className="px-6 py-3 text-gray-600 hover:text-gray-900 font-semibold"
              >
                Überspringen
              </button>
              <button
                onClick={handleNext}
                disabled={selectedStreamers.length === 0}
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Weiter
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Series */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welche Serien interessieren Sie?
            </h2>
            <p className="text-gray-600 mb-8">
              Wählen Sie Serien aus, um personalisierte News zu erhalten
            </p>

            {loadingSeries ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                  {popularSeries.map((series) => (
                    <button
                      key={series.tmdbId}
                      onClick={() => toggleSeries(series.tmdbId)}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                        selectedSeries.includes(series.tmdbId)
                          ? 'border-blue-600 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <img
                        src={series.posterLocalUrl || `https://image.tmdb.org/t/p/w300${series.posterPath}`}
                        alt={series.name}
                        className="w-full aspect-[2/3] object-cover"
                      />
                      {selectedSeries.includes(series.tmdbId) && (
                        <div className="absolute top-2 right-2 bg-blue-600 rounded-full p-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-3 text-gray-600 hover:text-gray-900 font-semibold"
                  >
                    Zurück
                  </button>
                  <div className="space-x-3">
                    <button
                      onClick={handleSkip}
                      className="px-6 py-3 text-gray-600 hover:text-gray-900 font-semibold"
                    >
                      Überspringen
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={loading}
                      className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Speichern...
                        </>
                      ) : (
                        'Fertig'
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
