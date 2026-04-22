'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Streamer brand colors
const streamerStyles: Record<string, { bg: string; text: string; label: string }> = {
  'Netflix': { bg: 'bg-red-600', text: 'text-white', label: 'Netflix' },
  'HBO Max': { bg: 'bg-purple-700', text: 'text-white', label: 'HBO Max' },
  'HBO': { bg: 'bg-black', text: 'text-white', label: 'HBO' },
  'Amazon Prime': { bg: 'bg-blue-500', text: 'text-white', label: 'Prime' },
  'Prime Video': { bg: 'bg-blue-500', text: 'text-white', label: 'Prime' },
  'Disney+': { bg: 'bg-blue-900', text: 'text-white', label: 'Disney+' },
  'Apple TV+': { bg: 'bg-gray-900', text: 'text-white', label: 'Apple TV+' },
  'Paramount+': { bg: 'bg-blue-600', text: 'text-white', label: 'Paramount+' },
  'Sky': { bg: 'bg-slate-800', text: 'text-white', label: 'Sky' },
  'RTL+': { bg: 'bg-red-500', text: 'text-white', label: 'RTL+' },
};

interface NewsCardProps {
  slug: string;
  title: string;
  excerpt?: string;
  heroLocalUrl?: string;
  heroImageUrl?: string;
  cardImageUrl?: string;
  tmdbId?: number;
  tmdbType?: string;
  publishedAt: Date;
  updatedAt?: Date;
  category?: string;
  authorName?: string;
  networks?: string[];
  isTrending?: boolean;
  isBreaking?: boolean;
  priority?: boolean;
}

export default function NewsCard({
  slug,
  title,
  excerpt,
  heroLocalUrl,
  heroImageUrl,
  cardImageUrl,
  tmdbId,
  tmdbType,
  publishedAt,
  updatedAt,
  category,
  authorName,
  networks = [],
  isTrending = false,
  isBreaking = false,
  priority = false,
}: NewsCardProps) {
  const [mounted, setMounted] = useState(false);

  // Fix Hydration: Only show dynamic time after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Static date format for SSR
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Dynamic relative time - only after mount to avoid hydration mismatch
  const getRelativeTime = () => {
    if (!mounted) return formatDate(publishedAt);
    
    const now = new Date();
    const date = new Date(publishedAt);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Gerade eben';
    if (diffHours < 24) return `Vor ${diffHours} ${diffHours === 1 ? 'Stunde' : 'Stunden'}`;
    return formatDate(publishedAt);
  };

  // Check if article is new (< 24h) - static check based on publishedAt
  const isNew = () => {
    const now = new Date();
    const date = new Date(publishedAt);
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    return diffHours < 24;
  };

  const isUpdated = () => {
    if (!updatedAt) return false;
    const published = new Date(publishedAt);
    const updated = new Date(updatedAt);
    // Consider updated if more than 1 hour difference
    return (updated.getTime() - published.getTime()) > (1000 * 60 * 60);
  };

  // Use category first, fallback to first network
  const streamerName = category || (networks.length > 0 ? networks[0] : null);
  const streamerStyle = streamerName ? streamerStyles[streamerName] : null;

  return (
    <Link href={`/${slug}`} data-testid="news-card-link">
      <article className="group bg-white dark:bg-[hsl(230,25%,9%)] rounded-xl border border-gray-200 dark:border-[hsl(230,25%,15%)] hover:shadow-lg dark:hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] dark:hover:border-cyan-500/40 transition-all duration-500 overflow-hidden cursor-pointer card-lift">
        {/* Image - Using hero/backdrop images (16:9) */}
        <div className="relative aspect-video overflow-hidden bg-gray-100 dark:bg-[hsl(230,25%,12%)]">
          {(heroImageUrl || cardImageUrl || heroLocalUrl || (tmdbId && tmdbType)) ? (
            <Image
              src={heroImageUrl || cardImageUrl || (tmdbId && tmdbType ? `/img/hero/${tmdbType}/${tmdbId}` : heroLocalUrl!)}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              loading={priority ? 'eager' : 'lazy'}
              priority={priority}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-gray-400 dark:text-gray-600">Kein Bild</span>
            </div>
          )}
          
          {/* Streamer Badge */}
          {streamerName && streamerStyle && (
            <div className="absolute top-3 right-3">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg ${streamerStyle.bg} ${streamerStyle.text}`}>
                {streamerStyle.label}
              </span>
            </div>
          )}

          {/* Status Badges - NEU / AKTUALISIERT / TRENDING / BREAKING */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {isBreaking && (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-red-600 text-white shadow-lg animate-pulse">
                ⚡ BREAKING
              </span>
            )}
            {isTrending && !isBreaking && (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-orange-500 text-white shadow-lg">
                🔥 TRENDING
              </span>
            )}
            {isNew() && !isBreaking && !isTrending && (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-cyan-500 text-white shadow-lg">
                NEU
              </span>
            )}
            {isUpdated() && !isNew() && !isBreaking && !isTrending && (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500 text-white shadow-lg">
                AKTUALISIERT
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-lg font-bold text-gray-900 dark:text-white leading-snug mb-3 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors duration-300">
            {title}
          </p>

          {excerpt && (
            <p className="text-sm text-gray-600 dark:text-[hsl(215,20%,65%)] line-clamp-2 mb-4">
              {excerpt}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-[hsl(215,20%,55%)]">
            <span>{getRelativeTime()}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}