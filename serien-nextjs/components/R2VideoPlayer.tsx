'use client';

import { useRef, useState, useEffect } from 'react';
import { Volume2 } from 'lucide-react';

interface R2VideoPlayerProps {
  src: string;
  poster?: string;
}

export default function R2VideoPlayer({ src, poster }: R2VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});

    // Sync local mute state with native player (e.g. when the user toggles the speaker
    // icon from the built-in <video controls> bar).
    const sync = () => setIsMuted(v.muted || v.volume === 0);
    v.addEventListener('volumechange', sync);

    // Pause when the page is hidden (handles bfcache / back-forward).
    const stop = () => {
      try {
        v.pause();
      } catch {}
    };
    window.addEventListener('pagehide', stop);

    return () => {
      v.removeEventListener('volumechange', sync);
      window.removeEventListener('pagehide', stop);
      // Hard-stop on unmount — Chrome occasionally keeps the audio track alive
      // across SPA navigations otherwise.
      try {
        v.pause();
        v.removeAttribute('src');
        while (v.firstChild) v.removeChild(v.firstChild);
        v.load();
      } catch {}
    };
  }, []);

  const handleUnmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        controls
        autoPlay
        muted
        playsInline
        preload="auto"
        poster={poster}
      >
        <source src={src} type="video/mp4" />
      </video>
      
      {isMuted && (
        <button
          onClick={handleUnmute}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-6 py-3 transition-colors shadow-lg"
        >
          <Volume2 className="w-5 h-5" />
          Ton aktivieren
        </button>
      )}
    </>
  );
}
