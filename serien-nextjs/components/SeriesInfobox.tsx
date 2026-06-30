/**
 * Series Infobox - Discover Optimized
 * 
 * PURPOSE: Navigation/transition element from article → series hub
 * NOT an information dump, NOT a content block
 * 
 * GOAL: Increase internal clicks, dwell time, topical authority signals
 * 
 * PLACEMENT: AFTER final paragraph, BEFORE Q&A and related news
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface SeriesInfoboxData {
  status: string;
  numberOfSeasons: number;
  genre: string;
  platform: string;
  posterPath: string | null;
}

interface SeriesInfoboxProps {
  seriesId: number;
  seriesName: string;
  seriesSlug: string;
  /** Layout-Variante. `default` = breite Anzeige unter dem Artikel (Cover
   *  links neben den Infos ab md:). `sidebar` = Sidebar/300-px-Spalte, Cover
   *  oben über den Infos, vollflächig, keine flex-row. */
  variant?: 'default' | 'sidebar';
}

export function SeriesInfobox({ seriesId, seriesName, seriesSlug, variant = 'default' }: SeriesInfoboxProps) {
  const [data, setData] = useState<SeriesInfoboxData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/series/${seriesId}/infobox-data`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch series infobox data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [seriesId]);

  // FAILSAFE: If no series data → do NOT render
  if (loading || !data) {
    return null;
  }

  const posterImage = data.posterPath 
    ? `/img/tmdb/w500${data.posterPath}`
    : null;

  const isSidebar = variant === 'sidebar';

  return (
    <div
      className={
        isSidebar
          ? 'rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-4 shadow-sm'
          : 'my-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-6 shadow-sm'
      }
    >
      {/* H3 TITLE (FIXED FORMAT) */}
      <h3
        className={
          isSidebar
            ? 'text-base font-bold text-gray-900 dark:text-white mb-3 leading-snug'
            : 'text-xl font-bold text-gray-900 dark:text-white mb-4'
        }
      >
        Mehr zur Serie „{seriesName}“
      </h3>

      <div className={isSidebar ? 'flex flex-col gap-4' : 'flex flex-col md:flex-row gap-6'}>
        {/* VISUAL: Series Poster. Sidebar = volle Spaltenbreite oben.
            Default = 128px-Kachel links neben den Infos. */}
        {posterImage && (
          <div className={isSidebar ? 'w-full' : 'flex-shrink-0'}>
            <div
              className={
                isSidebar
                  ? 'relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-md bg-gray-100 dark:bg-gray-700'
                  : 'relative w-32 h-48 rounded-lg overflow-hidden shadow-md bg-gray-100 dark:bg-gray-700'
              }
            >
              <Image
                src={posterImage}
                alt={seriesName}
                fill
                className="object-cover"
                sizes={isSidebar ? '(max-width: 1024px) 0px, 300px' : '128px'}
              />
            </div>
          </div>
        )}

        <div className={isSidebar ? 'flex flex-col gap-3' : 'flex-1 flex flex-col justify-between'}>
          {/* META ROW: Scannable, no sentences */}
          <div className={isSidebar ? 'space-y-1.5' : 'space-y-2 mb-4'}>
            {/* Line 1: Status · Seasons */}
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {data.status && (
                <>
                  <span className="font-medium">Status:</span> {data.status}
                </>
              )}
              {data.numberOfSeasons > 0 && (
                <>
                  {data.status && ' · '}
                  {data.numberOfSeasons} Staffel{data.numberOfSeasons !== 1 ? 'n' : ''}
                </>
              )}
            </div>

            {/* Line 2: Genre · Platform */}
            {(data.genre || data.platform) && (
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {data.genre && (
                  <>
                    <span className="font-medium">Genre:</span> {data.genre}
                  </>
                )}
                {data.platform && (
                  <>
                    {data.genre && ' · '}
                    {data.platform}
                  </>
                )}
              </div>
            )}
          </div>

          {/* MINI-HOOK: Im Sidebar-Layout kürzer, kompakter. */}
          <p className={isSidebar ? 'text-xs text-gray-600 dark:text-gray-400' : 'text-sm text-gray-600 dark:text-gray-400 mb-4'}>
            {isSidebar
              ? 'Alle Infos zur Serie auf einen Blick.'
              : 'Auf der Serienseite findest du Hintergründe, Besetzung und alle aktuellen Infos auf einen Blick.'}
          </p>

          {/* CTA: Single, prominent button */}
          <div>
            <Link
              href={`/serie/${seriesSlug}`}
              className={
                isSidebar
                  ? 'inline-flex items-center w-full justify-center px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg'
                  : 'inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg'
              }
            >
              Zur Serien-Übersicht
              <svg 
                className="ml-2 w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
