'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Play, AlertCircle, Volume2 } from 'lucide-react';

interface DirectVideoPlayerProps {
  heroImageUrl: string;
  trailerUrl: string | null;
  title: string;
  fullWidth?: boolean;
  autoPlay?: boolean;
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

export default function DirectVideoPlayer({ heroImageUrl, trailerUrl, title, fullWidth = false, autoPlay = true }: DirectVideoPlayerProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      // Only revoke blob URLs, not external URLs
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Auto-load video on mount if autoPlay is enabled
  useEffect(() => {
    if (autoPlay && trailerUrl && !getYouTubeVideoId(trailerUrl)) {
      loadVideo();
    }
  }, [autoPlay, trailerUrl]);

  const loadVideo = async () => {
    if (!trailerUrl) return;
    
    const youtubeId = getYouTubeVideoId(trailerUrl);
    if (youtubeId) {
      setShowVideo(true);
      return;
    }

    // For external URLs (R2, etc.), use direct video src instead of blob
    if (trailerUrl.startsWith('http')) {
      setLoading(false);
      setShowVideo(true);
      setVideoReady(true);
      setBlobUrl(trailerUrl); // Use URL directly
      return;
    }

    // For local trailer IDs, fetch via API
    const videoSrc = `/api/trailer/${trailerUrl}`;

    setLoading(true);
    setShowVideo(true);
    
    try {
      const response = await fetch(videoSrc);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      setLoading(false);
      setVideoReady(true);
    } catch (err: any) {
      console.error('Video fetch error:', err);
      setError(err.message || 'Video konnte nicht geladen werden');
      setLoading(false);
    }
  };

  // Start playing when video is ready
  useEffect(() => {
    if (videoReady && videoRef.current && blobUrl) {
      videoRef.current.muted = true;
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(console.error);
    }
  }, [videoReady, blobUrl]);

  // Check if it's a YouTube URL
  const youtubeId = trailerUrl ? getYouTubeVideoId(trailerUrl) : null;
  const isYouTube = !!youtubeId;

  // Build video URL for non-YouTube videos
  const videoSrc = trailerUrl && !isYouTube && trailerUrl.startsWith('http') 
    ? trailerUrl 
    : trailerUrl ? `/api/trailer/${trailerUrl}` : '';

  const containerClass = fullWidth 
    ? "relative w-full aspect-[16/9] md:aspect-[21/9] overflow-hidden bg-black"
    : "relative aspect-video rounded-2xl overflow-hidden bg-black";

  if (!trailerUrl) {
    return (
      <div className={containerClass}>
        <Image src={heroImageUrl} alt={title} fill className="object-cover" priority />
      </div>
    );
  }

  // Handle unmute/play click
  const handleUnmuteClick = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
      if (!isPlaying) {
        videoRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(console.error);
      }
    }
  };

  // Manual play for non-autoplay or YouTube
  const handlePlayClick = async () => {
    if (isYouTube) {
      setShowVideo(true);
      setIsMuted(false);
      return;
    }

    if (!videoReady) {
      await loadVideo();
    } else {
      handleUnmuteClick();
    }
  };

  return (
    <div className={containerClass}>
      {/* Hero Image - Always show as background, video overlays when ready */}
      <Image src={heroImageUrl} alt={title} fill className="object-cover" priority />

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-white text-center z-10 bg-black/80">
          <AlertCircle className="w-16 h-16 mb-4 text-red-400" />
          <h3 className="text-xl font-semibold mb-2">Trailer nicht verfügbar</h3>
          <p className="text-sm text-gray-400 mb-4">Das Video konnte nicht geladen werden.</p>
          <button 
            onClick={() => {
              setError(null);
              setShowVideo(false);
              setBlobUrl(null);
              setVideoReady(false);
            }}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            Zurück
          </button>
        </div>
      )}

      {/* YouTube Embed */}
      {isYouTube && showVideo && (
        <iframe
          className="absolute inset-0 w-full h-full z-10"
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}

      {/* Local Video - Overlay on top of hero image when ready */}
      {!isYouTube && blobUrl && !error && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover z-10"
          playsInline
          loop
          muted={isMuted}
          src={blobUrl}
          onError={(e) => {
            const video = e.currentTarget;
            console.error('Video playback error:', {
              code: video.error?.code,
              message: video.error?.message
            });
            setError('Video konnte nicht abgespielt werden');
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}

      {/* Play/Unmute Button Overlay */}
      {!error && (
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-colors cursor-pointer z-20 ${
            isMuted || !isPlaying || (isYouTube && !showVideo) 
              ? 'bg-black/30 hover:bg-black/40' 
              : 'bg-transparent pointer-events-none'
          }`}
          onClick={handlePlayClick}
        >
          {(isMuted || !isPlaying || (isYouTube && !showVideo)) && (
            <button className="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105">
              <Play className="w-5 h-5" fill="white" stroke="white" />
              <span>{isPlaying && isMuted ? 'Ton aktivieren' : 'Video ansehen'}</span>
            </button>
          )}
        </div>
      )}

      {/* Mute indicator when playing with sound */}
      {isPlaying && !isMuted && !isYouTube && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
            }
          }}
          className="absolute bottom-4 right-4 z-30 p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          aria-label="Stummschalten"
        >
          <Volume2 className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  );
}
