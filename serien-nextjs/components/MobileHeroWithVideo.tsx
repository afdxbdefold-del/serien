'use client';

import Image from 'next/image';
import R2VideoPlayer from '@/components/R2VideoPlayer';

interface MobileHeroWithVideoProps {
  backdropPath: string | null;
  posterPath: string | null;
  seriesName: string;
  trailerKey: string | null;
  localTrailerUrl?: string | null;
}

export default function MobileHeroWithVideo({
  backdropPath,
  posterPath,
  seriesName,
  trailerKey,
  localTrailerUrl,
}: MobileHeroWithVideoProps) {
  // Prioritize R2-hosted local trailer over YouTube embed
  if (localTrailerUrl) {
    return (
      <div className="relative w-full aspect-video bg-gray-900">
        <R2VideoPlayer
          src={localTrailerUrl}
          poster={backdropPath ? `https://image.tmdb.org/t/p/w780${backdropPath}` : undefined}
        />
      </div>
    );
  }

  // Fallback: YouTube embed if no local trailer
  if (trailerKey) {
    return (
      <div className="relative w-full aspect-video bg-gray-900">
        <iframe
          src={`https://www.youtube.com/embed/${trailerKey}?rel=0&modestbranding=1`}
          title={`${seriesName} Trailer`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  // Fallback: Backdrop-Bild wenn kein Trailer
  return (
    <div className="relative w-full aspect-[21/9] bg-gray-900">
      {backdropPath && (
        <>
          <Image
            src={`https://image.tmdb.org/t/p/original${backdropPath}`}
            alt={seriesName}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        </>
      )}

      {posterPath && (
        <div className="absolute bottom-4 left-4 z-10">
          <Image
            src={`https://image.tmdb.org/t/p/w500${posterPath}`}
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
