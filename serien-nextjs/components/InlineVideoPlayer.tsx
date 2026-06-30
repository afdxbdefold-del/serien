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
  // We must set it imperatively via ref to guarantee the video stays muted
  // when controls are first used (and so the volumechange-sync below works).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;

    // Sync local `isMuted` state with whatever the native player says.
    // The user can unmute via the built-in <video controls> speaker icon,
    // bypassing our cyan button, so we must hide the button in that case too.
    const sync = () => setIsMuted(v.muted || v.volume === 0);
    // Track play/pause so we only show „Ton aktivieren" while the video
    // is actually running — kein verwirrender Unmute-Button auf einem
    // pausierten Poster.
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    v.addEventListener('volumechange', sync);
    v.addEventListener('play', handlePlay);
    v.addEventListener('pause', handlePause);

    // Stop the video on tab/page hide as well (covers bfcache / back-forward navigation).
    const stop = () => {
      try {
        v.pause();
      } catch {}
    };
    window.addEventListener('pagehide', stop);

    return () => {
      v.removeEventListener('volumechange', sync);
      v.removeEventListener('play', handlePlay);
      v.removeEventListener('pause', handlePause);
      window.removeEventListener('pagehide', stop);
      // Hard-stop on unmount — Next.js client-side route changes unmount this
      // component, but Chrome occasionally keeps the audio track alive otherwise.
      try {
        v.pause();
        v.removeAttribute('src');
        // Detach <source> children too, then trigger the browser to release the file.
        while (v.firstChild) v.removeChild(v.firstChild);
        v.load();
      } catch {}
    };
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
          fetchPriority="high"
          sizes="(max-width: 1024px) 100vw, 1024px"
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

  // For R2 videos: Klick-to-Play (Autoplay deaktiviert). User startet via
  // <video controls> Play-Button. Bleibt initial muted; nach Play-Click
  // erscheint die „Ton aktivieren"-Schaltfläche zum Unmute.
  if (isR2Video) {
    return (
      <div className={`relative ${fullWidth ? 'aspect-[16/9] md:aspect-[21/9]' : 'aspect-video'} overflow-hidden bg-black`}>
        {/* Static <img> rendered IN ADDITION to the <video poster> so that
            Googlebot / Chromium can pick this up as the LCP element. The
            poster attribute alone is not always treated as LCP-eligible and
            never gets fetchpriority. The <img> is positioned identically and
            fades out once the video starts playing — visually identical to
            the previous behaviour. */}
        <Image
          src={heroImageUrl}
          alt={title}
          fill
          className="absolute inset-0 object-cover"
          priority
          fetchPriority="high"
          sizes="(max-width: 1024px) 100vw, 1024px"
        />
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          controls
          preload="metadata"
          poster={heroImageUrl}
          onError={(e) => {
            console.error('Video error:', e);
            setHasError(true);
          }}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
        
        {/* Cyan Unmute Button - nur sichtbar während die Video läuft */}
        {isMuted && isPlaying && !hasError && (
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
            fetchPriority="high"
            sizes="(max-width: 1024px) 100vw, 1024px"
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
            /* YouTube Embed — Autoplay deaktiviert. User klickt nochmal
               im YT-Player auf Play. Konsistent mit der globalen Regel
               „kein Auto-Start". */
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0`}
              title={title}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </>
      )}
    </div>
  );
}
