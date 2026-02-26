'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';

interface MobileHeroWithVideoProps {
  backdropPath: string | null;
  posterPath: string | null;
  seriesName: string;
  trailerKey: string | null;
}

export default function MobileHeroWithVideo({
  backdropPath,
  posterPath,
  seriesName,
  trailerKey,
}: MobileHeroWithVideoProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="relative w-full aspect-[21/9] bg-gray-900">
      {!isPlaying ? (
        <>
          {/* Hero Background Image */}
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

          {/* Poster INSIDE Hero (left side) */}
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

          {/* Play Button Overlay (only if trailer exists) */}
          {trailerKey && (
            <button
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 flex items-center justify-center group z-20"
              aria-label="Trailer abspielen"
            >
              <div className="bg-white/90 backdrop-blur-sm rounded-full p-4 shadow-2xl transition-all group-hover:scale-110 group-hover:bg-white">
                <Play className="h-8 w-8 text-cyan-600 fill-cyan-600" />
              </div>
            </button>
          )}
        </>
      ) : (
        <>
          {/* YouTube Video Player */}
          {trailerKey && (
            <iframe
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
              title="Series Trailer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          )}
        </>
      )}
    </div>
  );
}
