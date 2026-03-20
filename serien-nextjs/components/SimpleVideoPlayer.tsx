'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';

interface SimpleVideoPlayerProps {
  heroImageUrl: string;
  trailerUrl: string | null;
  title: string;
}

export default function SimpleVideoPlayer({ heroImageUrl, trailerUrl, title }: SimpleVideoPlayerProps) {
  const [showVideo, setShowVideo] = useState(false);

  if (!trailerUrl) {
    return (
      <div className="relative aspect-video rounded-2xl overflow-hidden">
        <Image src={heroImageUrl} alt={title} fill className="object-cover" priority />
      </div>
    );
  }

  // Check if it's a YouTube URL
  const isYouTube = trailerUrl.includes('youtube.com') || trailerUrl.includes('youtu.be');
  const youtubeId = isYouTube 
    ? trailerUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]
    : null;

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
              <Play className="w-10 h-10 ml-1" fill="#111827" stroke="#111827" />
            </div>
          </div>
        </>
      ) : youtubeId ? (
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1`}
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
          src={trailerUrl.startsWith('http') ? trailerUrl : `/api/trailer/${trailerUrl}`}
        >
          Dein Browser unterstützt HTML5 Video nicht.
        </video>
      )}
    </div>
  );
}
