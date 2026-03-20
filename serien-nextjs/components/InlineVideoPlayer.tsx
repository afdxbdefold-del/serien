'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';

interface InlineVideoPlayerProps {
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

export default function InlineVideoPlayer({ heroImageUrl, trailerUrl, title }: InlineVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  // If no trailer, just show the image
  if (!trailerUrl) {
    return (
      <div className="relative aspect-video rounded-2xl overflow-hidden">
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
    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
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
              <Play className="w-10 h-10 text-gray-900 ml-1" fill="currentColor" />
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
            /* Video Player for local/storage videos */
            <video
              className="w-full h-full"
              controls
              playsInline
              muted
              autoPlay
              preload="auto"
              src={videoUrl}
              onError={(e) => {
                console.error('❌ Video error:', e);
                const video = e.currentTarget;
                console.error('Error code:', video.error?.code);
                console.error('Error message:', video.error?.message);
                console.error('Video URL:', videoUrl);
                // Wait a bit before showing error to allow retries
                setTimeout(() => setHasError(true), 2000);
              }}
              onLoadedData={() => console.log('✅ Video loaded')}
            >
              Dein Browser unterstützt HTML5 Video nicht.
            </video>
          )}
        </>
      )}
    </div>
  );
}
