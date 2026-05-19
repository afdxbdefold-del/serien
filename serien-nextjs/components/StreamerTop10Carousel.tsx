'use client';

/**
 * STREAMER-TOP10 CAROUSEL
 *
 * Homepage carousel that shows the daily Top-10 per streaming platform
 * in Germany. Tabbed by platform (HBO Max · Netflix · Disney+ · Prime) with
 * a horizontally-scrollable strip of poster cards beneath. Server renders
 * all platforms' data up-front so switching tabs is instantaneous.
 */

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

export interface TopEntry {
  rank: number;
  title: string;
  tmdbId: number | null;
  slug: string | null;
  posterPath: string | null;
  previousRank: number | null;
}

export interface PlatformBlock {
  id: string; // e.g. "hbo-max"
  label: string; // e.g. "HBO Max"
  accent: string; // tailwind color for the tab pill
  items: TopEntry[];
}

interface Props {
  platforms: PlatformBlock[];
}

function posterUrl(p: string | null): string | null {
  if (!p) return null;
  if (p.startsWith('http')) return p;
  return `https://image.tmdb.org/t/p/w342${p.startsWith('/') ? '' : '/'}${p}`;
}

export default function StreamerTop10Carousel({ platforms }: Props) {
  // Default to Netflix when available — it's the dominant DACH streamer and
  // matches user expectation. Falls back to first platform with data.
  const netflix = platforms.find((p) => p.id === 'netflix' && p.items.length > 0);
  const firstWithData = platforms.find((p) => p.items.length > 0);
  const [active, setActive] = useState<string>(
    netflix?.id ?? firstWithData?.id ?? platforms[0]?.id ?? ''
  );
  const scrollRef = useRef<HTMLOListElement | null>(null);

  const current = platforms.find((p) => p.id === active) ?? platforms[0];

  // Reset scroll position when switching platform so the first poster is
  // always visible — otherwise a Netflix→HBO switch can land mid-list
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [active]);

  if (!current || current.items.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('[data-card]')?.clientWidth ?? 180;
    const gap = 16;
    el.scrollBy({ left: dir * (cardWidth + gap) * 3, behavior: 'smooth' });
  };

  return (
    <section
      className="container mx-auto px-6 md:px-12 py-10"
      aria-labelledby="top10-heading"
      data-testid="home-top10-carousel"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header: title + tabs */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 id="top10-heading" className="text-2xl font-bold text-gray-900 dark:text-white">
                Top 10 auf den Streamern
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Tägliches Ranking der meistgesehenen Serien in Deutschland
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Streaming-Plattform auswählen">
            {platforms
              .filter((p) => p.items.length > 0)
              .map((p) => {
                const isActive = p.id === active;
                return (
                  <button
                    key={p.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(p.id)}
                    data-testid={`top10-tab-${p.id}`}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? `${p.accent} text-white shadow-md`
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Carousel */}
        <div className="relative group">
          {/* Left arrow */}
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Zurück"
            data-testid="top10-scroll-left"
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/95 dark:bg-gray-900/95 shadow-lg items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-gray-800 dark:text-white hover:scale-110"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Right arrow */}
          <button
            onClick={() => scrollBy(1)}
            aria-label="Weiter"
            data-testid="top10-scroll-right"
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/95 dark:bg-gray-900/95 shadow-lg items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-gray-800 dark:text-white hover:scale-110"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <ol
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 -mx-2 px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {current.items.map((item) => {
              const img = posterUrl(item.posterPath);
              const delta = item.previousRank != null ? item.previousRank - item.rank : null;
              const href = item.slug ? `/serie/${item.slug}` : undefined;
              const Wrapper: any = href ? Link : 'div';
              return (
                <Wrapper
                  key={item.rank}
                  {...(href ? { href } : {})}
                  data-card
                  data-testid={`top10-${current.id}-rank-${item.rank}`}
                  className="group/card snap-start flex-none w-36 sm:w-40 md:w-44 lg:w-48 relative block overflow-hidden rounded-xl bg-gray-900 aspect-[2/3] shadow-md hover:shadow-xl transition-shadow"
                >
                  {img ? (
                    <Image
                      src={img}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 144px, (max-width: 768px) 160px, 192px"
                      className="object-cover group-hover/card:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900" />
                  )}

                  <div className="absolute top-0 left-0 bg-gradient-to-br from-amber-400 to-amber-600 text-black font-black text-xl leading-none px-2.5 py-1.5 rounded-br-xl shadow-lg">
                    {item.rank}
                  </div>

                  {delta !== null && delta !== 0 && (
                    <div
                      className={`absolute top-1.5 right-1.5 flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        delta > 0 ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
                      }`}
                      title={`Vor 7 Tagen: Platz ${item.previousRank}`}
                    >
                      {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2.5">
                    <div className="text-white text-xs sm:text-sm font-semibold line-clamp-2 leading-tight">
                      {item.title}
                    </div>
                  </div>
                </Wrapper>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
