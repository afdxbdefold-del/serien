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
            muted
            playsInline
            preload="metadata"
            src={`/trailer/${trailerUrl}?v=${Date.now()}`}
            key={Date.now()}
            onError={(e) => {
              console.error('❌ Video error:', e);
              const video = e.currentTarget;
              console.error('Error code:', video.error?.code);
              console.error('Error message:', video.error?.message);
              console.error('Video src:', video.src);
              console.error('Network state:', video.networkState);
              console.error('Ready state:', video.readyState);
            }}
            onLoadStart={() => console.log('📡 Video load started')}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              console.log('✅ Video metadata loaded:', {
                duration: video.duration,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight
              });
            }}
            onLoadedData={() => console.log('✅ Video data loaded')}
            onCanPlay={() => console.log('✅ Video can play')}
            onCanPlayThrough={() => console.log('✅ Video can play through')}
            onPlaying={() => console.log('▶️ Video is playing')}
            onWaiting={() => console.log('⏳ Video waiting for data')}
            onStalled={() => console.log('⚠️ Video stalled')}
          >
            Ihr Browser unterstützt das Video-Tag nicht.
          </video>
        </>
      )}
    </div>
  );
}
