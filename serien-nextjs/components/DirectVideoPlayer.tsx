'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';

interface DirectVideoPlayerProps {
  heroImageUrl: string;
  trailerUrl: string | null;
  title: string;
}

export default function DirectVideoPlayer({ heroImageUrl, trailerUrl, title }: DirectVideoPlayerProps) {
  const [showVideo, setShowVideo] = useState(false);

  if (!trailerUrl) {
    return (
      <div className="relative aspect-video rounded-2xl overflow-hidden">
        <Image src={heroImageUrl} alt={title} fill className="object-cover" priority />
      </div>
    );
  }

  const videoSrc = trailerUrl.startsWith('http') 
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
      ) : (
        <video
          className="w-full h-full"
          controls
          autoPlay
          muted
          playsInline
          preload="auto"
        >
          <source src={videoSrc} type="video/mp4" />
          Dein Browser unterstützt HTML5 Video nicht.
        </video>
      )}
    </div>
  );
}
