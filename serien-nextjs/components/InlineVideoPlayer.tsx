'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';

interface InlineVideoPlayerProps {
  heroImageUrl: string;
  trailerUrl: string | null;
  title: string;
}

export default function InlineVideoPlayer({ heroImageUrl, trailerUrl, title }: InlineVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

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
          {/* Video Player */}
          <video
            className="w-full h-full"
            controls
            autoPlay
            playsInline
            preload="auto"
            src={`/trailer/${trailerUrl}`}
            onError={(e) => {
              console.error('Video error:', e);
              const video = e.currentTarget;
              console.error('Error code:', video.error?.code, 'Message:', video.error?.message);
            }}
            onLoadedMetadata={() => console.log('Video metadata loaded')}
            onCanPlay={() => console.log('Video can play')}
          >
            Ihr Browser unterstützt das Video-Tag nicht.
          </video>
        </>
      )}
    </div>
  );
}
