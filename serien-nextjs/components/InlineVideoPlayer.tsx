'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Play, Volume2 } from 'lucide-react';

interface InlineVideoPlayerProps {
  heroImageUrl: string;
  trailerUrl?: string | null;
  title: string;
  fullWidth?: boolean;
}

// Extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function InlineVideoPlayer({ heroImageUrl, trailerUrl, title, fullWidth }: InlineVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle autoplay when video starts playing
  useEffect(() => {
    if (isPlaying && videoRef.current) {
      videoRef.current.play().catch(err => {
        console.log('Autoplay blocked:', err);
      });
    }
  }, [isPlaying]);

  const handleUnmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  // No trailer - just show image
  if (!trailerUrl) {
    return (
      <div className="relative aspect-video overflow-hidden bg-black">
        <Image
          src={heroImageUrl}
          alt={title}
          fill
          className="object-cover"
          priority
        />
      </div>
    );
  }

  // Check if it's a YouTube URL
  const youtubeId = getYouTubeVideoId(trailerUrl);
  const isYouTube = !!youtubeId;

  // Build video URL for non-YouTube videos
  const videoUrl = !isYouTube && trailerUrl.startsWith('http') 
    ? trailerUrl 
    : `/api/trailer/${trailerUrl}?v=3`;

  // With trailer: Show image with play button, then video
  return (
    <div className="relative aspect-video overflow-hidden bg-black">
      {!isPlaying ? (
        <>
          {/* Hero Image */}
          <Image
            src={heroImageUrl}
            alt={title}
            fill
            className="object-cover transition-opacity duration-300"
            priority
          />
          
          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group cursor-pointer"
               onClick={() => setIsPlaying(true)}>
            <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xl">
              <Play className="w-10 h-10 ml-1" fill="#111827" stroke="#111827" />
            </div>
          </div>
        </>
      ) : (
        <>
          {hasError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white">
              <p className="text-lg mb-4">Video kann nicht geladen werden</p>
              <button
                onClick={() => {
                  setHasError(false);
                  setIsPlaying(false);
                }}
                className="px-4 py-2 bg-white text-gray-900 hover:bg-gray-100"
              >
                Zurück
              </button>
            </div>
          ) : isYouTube ? (
            /* YouTube Embed */
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
              {/* Video Player for R2/storage videos */}
              <video
                ref={videoRef}
                className="w-full h-full"
                controls
                playsInline
                autoPlay
                muted
                preload="auto"
                onError={(e) => {
                  console.error('Video error:', e);
                  setTimeout(() => setHasError(true), 2000);
                }}
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
              
              {/* Ton aktivieren Button */}
              {isMuted && (
                <button
                  onClick={handleUnmute}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-3 transition-colors shadow-lg"
                >
                  <Volume2 className="w-5 h-5" />
                  Ton aktivieren
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
