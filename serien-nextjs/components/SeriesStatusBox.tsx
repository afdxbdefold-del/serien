/**
 * SeriesStatusBox Component
 * 
 * Displays current series status
 * Auto-updates from API
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FollowButtonLocal from './FollowButtonLocal';

interface SeriesStatusData {
  status: 'RUNNING' | 'RENEWED' | 'ENDED' | 'ON_HOLD' | 'UNCLEAR';
  description: string;
  lastUpdate: string | null;
  lastSeason: number | null;
  lastNewsDate: string | null;
}

interface SeriesStatusBoxProps {
  seriesId: number;
  seriesName: string;
  seriesSlug?: string;
  posterUrl?: string | null;
}

export function SeriesStatusBox({ seriesId, seriesName, seriesSlug, posterUrl }: SeriesStatusBoxProps) {
  const [statusData, setStatusData] = useState<SeriesStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch(`/api/series/${seriesId}/status`);
        if (response.ok) {
          const data = await response.json();
          setStatusData(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch series status:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, [seriesId]);

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 mb-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (!statusData) {
    return null;
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'unbekannt';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-white">
      <div className="flex items-start gap-4">
        {/* Series Poster with Link */}
        {seriesSlug && (
          <Link 
            href={`/serie/${seriesId}-${seriesSlug}`}
            className="flex-shrink-0 group"
          >
            <div className="relative w-20 h-28 rounded-lg overflow-hidden shadow-md transition-transform group-hover:scale-105 bg-gradient-to-br from-gray-100 to-gray-200">
              {posterUrl ? (
                <Image
                  src={posterUrl}
                  alt={seriesName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center p-2">
                  {seriesName}
                </div>
              )}
            </div>
          </Link>
        )}

        <div className="flex-1 min-w-0">
          {/* Series Title with Link */}
          {seriesSlug ? (
            <Link 
              href={`/serie/${seriesId}-${seriesSlug}`}
              className="block mb-3"
            >
              <h3 className="text-base font-bold text-gray-900 hover:text-blue-600 transition-colors">
                {seriesName}
              </h3>
            </Link>
          ) : (
            <h3 className="text-base font-bold text-gray-900 mb-3">
              {seriesName}
            </h3>
          )}
          
          <p className="text-sm text-gray-700 mb-2">
            <span className="font-medium">Letzte Entwicklung:</span>{' '}
            {statusData.description}
          </p>
          
          <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-3">
            {statusData.lastNewsDate && (
              <span>
                Letzte News: {formatDate(statusData.lastNewsDate)}
              </span>
            )}
            
            {statusData.lastSeason && (
              <span>
                Letzte Staffel: Staffel {statusData.lastSeason}
              </span>
            )}
          </div>

          {/* Follow Button below metadata */}
          <div className="mb-2">
            <FollowButtonLocal 
              tmdbId={seriesId}
              seriesName={seriesName}
              variant="compact"
            />
          </div>

          {/* Series Link */}
          {seriesSlug && (
            <Link 
              href={`/serie/${seriesId}-${seriesSlug}`}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              Zur Serie →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
