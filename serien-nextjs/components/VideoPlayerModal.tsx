'use client';

import { useState } from 'react';
import { X, Play } from 'lucide-react';

interface VideoPlayerModalProps {
  trailerUrl: string;
  seriesTitle: string;
}

export default function VideoPlayerModal({ trailerUrl, seriesTitle }: VideoPlayerModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!trailerUrl) {
    return null;
  }

  // Convert storage path to proxy API URL
  // trailerUrl format: "serien-nextjs/trailers/filename.mp4"
  // Convert to: "/trailer/serien-nextjs/trailers/filename.mp4"
  const videoProxyUrl = trailerUrl.startsWith('/') 
    ? trailerUrl 
    : `/trailer/${trailerUrl}`;

  return (
    <>
      {/* Play Button Overlay on Hero Image */}
      <button
        onClick={() => setIsOpen(true)}
        className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity duration-300 group cursor-pointer z-10"
        aria-label="Trailer abspielen"
      >
        <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
          <Play className="w-10 h-10 ml-1" fill="#111827" stroke="#111827" />
        </div>
      </button>

      {/* Video Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative w-full max-w-5xl bg-black rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 z-50 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              aria-label="Schließen"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Video Player — Autoplay deaktiviert, User startet via Controls */}
            <div className="relative aspect-video">
              <video
                src={videoProxyUrl}
                controls
                className="w-full h-full"
                preload="metadata"
              >
                <source src={videoProxyUrl} type="video/mp4" />
                Dein Browser unterstützt das Video-Tag nicht.
              </video>
            </div>

            {/* Title */}
            <div className="p-4 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white font-semibold text-lg">
                {seriesTitle} - Trailer
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
