'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Play, AlertCircle, Loader2 } from 'lucide-react';

interface DirectVideoPlayerProps {
  heroImageUrl: string;
  trailerUrl: string | null;
  title: string;
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

export default function DirectVideoPlayer({ heroImageUrl, trailerUrl, title }: DirectVideoPlayerProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (!trailerUrl) {
    return (
      <div className="relative aspect-video rounded-2xl overflow-hidden">
        <Image src={heroImageUrl} alt={title} fill className="object-cover" priority />
      </div>
    );
  }

  // Check if it's a YouTube URL
  const youtubeId = getYouTubeVideoId(trailerUrl);
  const isYouTube = !!youtubeId;

  // Build video URL for non-YouTube videos
  const videoSrc = !isYouTube && trailerUrl.startsWith('http') 
    ? trailerUrl 
    : `/api/trailer/${trailerUrl}`;

  const handlePlayClick = async () => {
    if (isYouTube) {
      setShowVideo(true);
      return;
    }

    // For local videos, fetch as blob first
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
      
      // Auto-play after loading
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (err: any) {
      console.error('Video fetch error:', err);
      setError(err.message || 'Video konnte nicht geladen werden');
      setLoading(false);
    }
  };

  return (
    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
      {!showVideo ? (
        <>
          <Image src={heroImageUrl} alt={title} fill className="object-cover" priority />
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
            onClick={handlePlayClick}
          >
            <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center hover:scale-110 transition-transform shadow-2xl">
              <Play className="w-10 h-10 ml-1" fill="#111827" stroke="#111827" />
            </div>
          </div>
        </>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <p className="text-sm">Trailer wird geladen...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-full p-8 text-white text-center">
          <AlertCircle className="w-16 h-16 mb-4 text-red-400" />
          <h3 className="text-xl font-semibold mb-2">Trailer nicht verfügbar</h3>
          <p className="text-sm text-gray-400 mb-4">Das Video konnte nicht geladen werden.</p>
          <button 
            onClick={() => {
              setError(null);
              setShowVideo(false);
              setBlobUrl(null);
            }}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
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
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          playsInline
          src={blobUrl || undefined}
          onError={(e) => {
            const video = e.currentTarget;
            console.error('Video playback error:', {
              code: video.error?.code,
              message: video.error?.message
            });
            setError('Video konnte nicht abgespielt werden');
          }}
        />
      )}
    </div>
  );
}
