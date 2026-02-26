/**
 * SeriesStatusBox Component
 * 
 * Displays current series status
 * Auto-updates from API
 */

'use client';

import { useEffect, useState } from 'react';
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
}

const STATUS_LABELS = {
  RUNNING: 'Läuft',
  RENEWED: 'Verlängert',
  ENDED: 'Beendet',
  ON_HOLD: 'Pause',
  UNCLEAR: 'Status unklar',
};

const STATUS_COLORS = {
  RUNNING: 'bg-green-100 text-green-800 border-green-300',
  RENEWED: 'bg-blue-100 text-blue-800 border-blue-300',
  ENDED: 'bg-gray-100 text-gray-800 border-gray-300',
  ON_HOLD: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  UNCLEAR: 'bg-gray-100 text-gray-600 border-gray-300',
};

export function SeriesStatusBox({ seriesId, seriesName }: SeriesStatusBoxProps) {
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

  const statusLabel = STATUS_LABELS[statusData.status] || 'Status unklar';
  const statusColor = STATUS_COLORS[statusData.status] || STATUS_COLORS.UNCLEAR;

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
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-semibold px-2 py-1 rounded border ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          
          <p className="text-sm text-gray-700 mb-2">
            <span className="font-medium">Letzte Entwicklung:</span>{' '}
            {statusData.description}
          </p>
          
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
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
        </div>

        {/* Follow Button */}
        <div className="flex-shrink-0">
          <FollowButtonLocal 
            tmdbId={seriesId}
            seriesName={seriesName}
            variant="compact"
          />
        </div>
      </div>
    </div>
  );
}
