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
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Autoplay deaktiviert — User muss explizit via <video controls>
    // Play-Button starten. Mute-/Play-State syncen, damit die UI sich
    // korrekt anpasst (z.B. Unmute-Button nur sichtbar wenn Video läuft).
    const sync = () => setIsMuted(v.muted || v.volume === 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    v.addEventListener('volumechange', sync);
    v.addEventListener('play', handlePlay);
    v.addEventListener('pause', handlePause);

    // Pause when the page is hidden (handles bfcache / back-forward).
    const stop = () => {
      try {
        v.pause();
      } catch {}
    };
    window.addEventListener('pagehide', stop);

    return () => {
      v.removeEventListener('volumechange', sync);
      v.removeEventListener('play', handlePlay);
      v.removeEventListener('pause', handlePause);
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
        muted
        playsInline
        preload="metadata"
        poster={poster}
      >
        <source src={src} type="video/mp4" />
      </video>
      
      {isMuted && isPlaying && (
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
