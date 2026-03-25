'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play, ChevronRight, ChevronLeft } from 'lucide-react';

// Client-side slug generation (matches slug-utils.ts logic)
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

interface StreamingSeries {
  tmdbId: number;
  title: string;
  slug?: string;
  posterPath?: string;
  network?: string;
  trailerUrl?: string;
}

interface CurrentlyStreamingProps {
  series: StreamingSeries[];
}

// Streaming provider logos
const STREAMING_PROVIDERS = [
  { id: 'netflix', name: 'Netflix', color: '#E50914' },
  { id: 'amazon', name: 'Prime Video', color: '#00A8E1' },
  { id: 'disney', name: 'Disney+', color: '#113CCF' },
  { id: 'apple', name: 'Apple TV', color: '#000000' },
  { id: 'paramount', name: 'Paramount+', color: '#0064FF' },
  { id: 'hbo', name: 'Max', color: '#5822B4' },
  { id: 'hulu', name: 'Hulu', color: '#1CE783' },
  { id: 'rtl', name: 'RTL+', color: '#E4003A' },
];

export default function CurrentlyStreaming({ series }: CurrentlyStreamingProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (!series || series.length === 0) {
    return null;
  }

  return (
    <section className="mb-12" data-testid="currently-streaming">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Aktuell im Stream
          </h2>
          <div className="h-1 w-24 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full hidden sm:block dark:shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
        </div>
        <Link 
          href="/serienfinder"
          className="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-[hsl(215,20%,65%)] hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors duration-300"
          data-testid="view-all-series"
        >
          Alle anzeigen
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Scrollable Series Row */}
      <div className="relative group">
        {/* Left Scroll Button - Glassmorphism */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/60 dark:bg-black/70 dark:backdrop-blur-xl dark:border dark:border-white/10 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-1/2"
          aria-label="Scroll left"
          data-testid="scroll-left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Series Cards */}
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-2 px-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {series.map((item) => (
            <Link
              key={item.tmdbId}
              href={`/serie/${item.slug || generateSlug(item.title)}`}
              className="group/card flex-shrink-0 w-[160px] sm:w-[180px] relative"
              data-testid={`series-card-${item.tmdbId}`}
            >
              {/* Poster Image */}
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-[hsl(230,25%,12%)] shadow-lg dark:hover:shadow-[0_0_25px_rgba(6,182,212,0.25)] transition-shadow duration-500">
                <Image
                  src={item.posterPath || `/img/card/tv/${item.tmdbId}`}
                  alt={item.title}
                  fill
                  sizes="180px"
                  loading="lazy"
                  className="object-cover transition-transform duration-700 ease-out group-hover/card:scale-105"
                />
                
                {/* Play Button Overlay */}
                {item.trailerUrl && (
                  <div className="absolute top-3 right-3">
                    <div className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 ml-0.5" fill="#111827" stroke="#111827" />
                    </div>
                  </div>
                )}

                {/* Network Badge */}
                {item.network && (
                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-black/70 text-white rounded">
                      {item.network}
                    </span>
                  </div>
                )}

                {/* Gradient Overlay for Title */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                
                {/* Title */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2">
                    {item.title}
                  </h3>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Right Scroll Button - Glassmorphism */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/60 dark:bg-black/70 dark:backdrop-blur-xl dark:border dark:border-white/10 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-x-1/2"
          aria-label="Scroll right"
          data-testid="scroll-right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Streaming Providers - Glassmorphism Style */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-[hsl(215,20%,75%)] mb-4">
          Im Stream bei:
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {STREAMING_PROVIDERS.map((provider) => (
            <Link
              key={provider.id}
              href={`/serienfinder?network=${encodeURIComponent(provider.name)}`}
              className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-105 dark:hover:shadow-[0_0_25px_rgba(6,182,212,0.3)] dark:border dark:border-white/10 dark:backdrop-blur-sm"
              style={{ backgroundColor: provider.color }}
              title={provider.name}
              data-testid={`provider-${provider.id}`}
            >
              <span className="text-white font-bold text-sm text-center px-2">
                {provider.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
