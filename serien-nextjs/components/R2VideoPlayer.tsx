'use client';

import { useRef, useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';

interface R2VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

export default function R2VideoPlayer({ src, poster, className = '' }: R2VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(err => {
        console.log('Autoplay blocked:', err);
      });
    }
  }, []);

  const handleUnmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover ${className}`}
        controls
        autoPlay
        muted
        playsInline
        preload="auto"
        poster={poster}
      >
        <source src={src} type="video/mp4" />
      </video>
      
      {/* Ton aktivieren Button */}
      {isMuted && (
        <button
          onClick={handleUnmute}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-6 py-3 transition-colors shadow-lg"
        >
          <Volume2 className="w-5 h-5" />
          Ton aktivieren
        </button>
      )}
    </div>
  );
}
