'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface NewsHighlight {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  heroLocalUrl?: string;
  tmdbId?: number;
  tmdbType?: string;
  publishedAt: string;
  category?: string;
}

interface NewsHighlightCarouselProps {
  news: NewsHighlight[];
}

export default function NewsHighlightCarousel({ news }: NewsHighlightCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % news.length);
  }, [news.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + news.length) % news.length);
  }, [news.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // Touch handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrev();
    }
  };

  // Auto-advance every 6 seconds
  useEffect(() => {
    if (news.length <= 1) return;
    
    const interval = setInterval(goToNext, 6000);
    return () => clearInterval(interval);
  }, [goToNext, news.length]);

  if (!news || news.length === 0) return null;

  const currentNews = news[currentIndex];
  const imageUrl = currentNews.heroLocalUrl || 
    (currentNews.tmdbId && currentNews.tmdbType 
      ? `/img/hero/${currentNews.tmdbType}/${currentNews.tmdbId}` 
      : '/placeholders/hero.jpg');

  // Relative time format like NewsCard
  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Gerade eben';
    if (diffHours < 24) return `Vor ${diffHours} ${diffHours === 1 ? 'Stunde' : 'Stunden'}`;
    return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <section 
      ref={containerRef}
      className="relative w-full bg-gray-900 dark:bg-[hsl(230,25%,5%)]"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      data-testid="news-highlight-carousel"
    >
      {/* Main Image Area */}
      <Link href={`/${currentNews.slug}`} className="block group" data-testid="carousel-main-link">
        <div className="relative aspect-[16/9] md:aspect-[21/9] overflow-hidden">
          {/* Background Images - All preloaded for smooth transitions */}
          {news.map((item, index) => {
            const imgUrl = item.heroLocalUrl || 
              (item.tmdbId && item.tmdbType 
                ? `/img/hero/${item.tmdbType}/${item.tmdbId}` 
                : '/placeholders/hero.jpg');
            
            return (
              <div
                key={item.id}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  index === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <Image
                  src={imgUrl}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-[8000ms] ease-out group-hover:scale-105"
                  priority={index === 0}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  sizes="100vw"
                />
                {/* Gradient Scrim - Only in Dark Mode */}
                <div className="absolute inset-0 hidden dark:block bg-gradient-to-t from-[hsl(230,25%,5%)] via-[hsl(230,25%,5%)]/30 to-transparent" />
              </div>
            );
          })}
        </div>
      </Link>

      {/* Content Box */}
      <div className="bg-gray-900 dark:bg-[hsl(230,25%,5%)] px-4 py-5 sm:px-6 sm:py-6">
        <Link href={`/${currentNews.slug}`} data-testid="carousel-title-link">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 hover:text-cyan-400 transition-colors duration-300 line-clamp-3 tracking-tight">
            {currentNews.title}
          </h2>
        </Link>
        
        {/* Date */}
        <p className="text-gray-400 dark:text-[hsl(215,20%,55%)] text-sm">
          {getRelativeTime(currentNews.publishedAt)}
        </p>
      </div>

      {/* Navigation Dots */}
      <div className="bg-gray-900 dark:bg-[hsl(230,25%,5%)] pb-6 flex justify-center gap-2">
        {news.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentIndex 
                ? 'w-6 bg-cyan-500 dark:shadow-[0_0_10px_rgba(6,182,212,0.6)]' 
                : 'w-2 bg-gray-600 dark:bg-[hsl(230,25%,20%)] hover:bg-gray-500 dark:hover:bg-[hsl(230,25%,30%)]'
            }`}
            aria-label={`Slide ${index + 1}`}
            data-testid={`carousel-dot-${index}`}
          />
        ))}
      </div>
    </section>
  );
}
