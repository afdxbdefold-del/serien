'use client';

import Image from 'next/image';
import R2VideoPlayer from '@/components/R2VideoPlayer';

interface MobileHeroWithVideoProps {
  backdropPath: string | null;
  posterPath: string | null;
  seriesName: string;
  trailerKey: string | null;
  localTrailerUrl?: string | null;
  fallbackHeroUrl?: string;
}

export default function MobileHeroWithVideo({
  backdropPath,
  posterPath,
  seriesName,
  trailerKey,
  localTrailerUrl,
  fallbackHeroUrl,
}: MobileHeroWithVideoProps) {
  const posterForVideo = backdropPath ? `/img/tmdb/w780${backdropPath}` : fallbackHeroUrl;
  // Prioritize R2-hosted local trailer over YouTube embed
  if (localTrailerUrl) {
    return (
      <div className="relative w-full aspect-video bg-gray-900">
        <R2VideoPlayer src={localTrailerUrl} poster={posterForVideo} />
      </div>
    );
  }

  // Fallback: YouTube embed if no local trailer. Autoplay deaktiviert,
  // User klickt im YT-Player auf Play.
  if (trailerKey) {
    return (
      <div className="relative w-full aspect-video bg-gray-900">
        <iframe
          src={`https://www.youtube.com/embed/${trailerKey}?rel=0&modestbranding=1&autoplay=0`}
          title={`${seriesName} Trailer`}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  // Fallback: Backdrop-Bild wenn kein Trailer
  const heroSrc = backdropPath ? `/img/tmdb/original${backdropPath}` : fallbackHeroUrl;
  return (
    <div className="relative w-full aspect-[21/9] bg-gray-900">
      {heroSrc && (
        <>
          <Image
            src={heroSrc}
            alt={seriesName}
            fill
            className="object-cover"
            priority
            unoptimized={!backdropPath}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        </>
      )}

      {posterPath && (
        <div className="absolute bottom-4 left-4 z-10">
          <Image
            src={`/img/tmdb/w500${posterPath}`}
            alt={seriesName}
            width={80}
            height={120}
            className="rounded-lg shadow-2xl border-2 border-white/20"
          />
        </div>
      )}
    </div>
  );
}
