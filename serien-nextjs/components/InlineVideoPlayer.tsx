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

  // React has a known bug where the `muted` JSX prop doesn't apply to the DOM.
  // We must set it imperatively via ref to guarantee autoplay works.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;

    // Sync local `isMuted` state with whatever the native player says.
    // The user can unmute via the built-in <video controls> speaker icon,
    // bypassing our cyan button, so we must hide the button in that case too.
    const sync = () => setIsMuted(v.muted || v.volume === 0);
    v.addEventListener('volumechange', sync);
    return () => v.removeEventListener('volumechange', sync);
  }, []);

  // If no trailer, just show the image
  if (!trailerUrl) {
    return (
      <div className="relative aspect-video overflow-hidden">
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

  // R2 Base URL for self-hosted videos
  const R2_BASE_URL = 'https://pub-123f15a3ef8046ef838c6f186d87bffe.r2.dev';

  // Check if it's an MP4 file (R2 video)
  const isMP4 = !isYouTube && (trailerUrl.endsWith('.mp4') || trailerUrl.includes('/trailers/'));
  
  // Build video URL - only R2 supported
  let videoUrl = '';
  if (!isYouTube && isMP4) {
    if (trailerUrl.startsWith('http')) {
      // Full R2 URL - use directly
      videoUrl = trailerUrl;
    } else {
      // Relative path - convert to R2 URL
      const fileName = trailerUrl.split('/').pop();
      videoUrl = `${R2_BASE_URL}/trailers/${fileName}`;
    }
  }

  // Check if it's an R2 video
  const isR2Video = isMP4;

  const handleUnmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  // For R2 videos: Autoplay immediately with muted + unmute button (like R2VideoPlayer)
  if (isR2Video) {
    return (
      <div className={`relative ${fullWidth ? 'aspect-[16/9] md:aspect-[21/9]' : 'aspect-video'} overflow-hidden bg-black`}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          playsInline
          controls
          preload="auto"
          poster={heroImageUrl}
          onError={(e) => {
            console.error('Video error:', e);
            setHasError(true);
          }}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
        
        {/* Cyan Unmute Button - centered */}
        {isMuted && !hasError && (
          <button
            onClick={handleUnmute}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-6 py-3 transition-colors shadow-lg"
          >
            <Volume2 className="w-5 h-5" />
            Ton aktivieren
          </button>
        )}

        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <Image
              src={heroImageUrl}
              alt={title}
              fill
              className="object-cover"
            />
          </div>
        )}
      </div>
    );
  }

  // For YouTube videos: Keep the click-to-play behavior
  return (
    <div className={`relative ${fullWidth ? 'aspect-[16/9] md:aspect-[21/9]' : 'aspect-video'} overflow-hidden bg-black`}>
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
            <div className="flex items-center justify-center h-full bg-gray-900 text-white p-8 text-center">
              <div>
                <p className="text-lg mb-4">⚠️ Video kann nicht geladen werden</p>
                <button 
                  onClick={() => {
                    setHasError(false);
                    setIsPlaying(false);
                  }}
                  className="px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100"
                >
                  Zurück
                </button>
              </div>
            </div>
          ) : (
            /* YouTube Embed */
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </>
      )}
    </div>
  );
}
