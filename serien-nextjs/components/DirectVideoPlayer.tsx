'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play, AlertCircle } from 'lucide-react';

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

  return (
    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
      {!showVideo ? (
        <>
          <Image src={heroImageUrl} alt={title} fill className="object-cover" priority />
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors cursor-pointer"
            onClick={() => setShowVideo(true)}
          >
            <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center hover:scale-110 transition-transform shadow-2xl">
              <Play className="w-10 h-10 text-gray-900 ml-1" fill="currentColor" />
            </div>
          </div>
        </>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-full p-8 text-white text-center">
          <AlertCircle className="w-16 h-16 mb-4 text-red-400" />
          <h3 className="text-xl font-semibold mb-2">Trailer nicht verfügbar</h3>
          <p className="text-sm text-gray-400 mb-4">Das Video konnte nicht geladen werden.</p>
          <button 
            onClick={() => {
              setError(null);
              setShowVideo(false);
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
          className="w-full h-full"
          controls
          autoPlay
          muted
          playsInline
          preload="auto"
          onError={(e) => {
            console.error('Video error:', e);
            setError('Video konnte nicht geladen werden');
          }}
          onLoadedData={() => console.log('Video loaded successfully')}
        >
          <source src={videoSrc} type="video/mp4" />
          Dein Browser unterstützt HTML5 Video nicht.
        </video>
      )}
    </div>
  );
}
