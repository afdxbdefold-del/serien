'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Plus } from 'lucide-react';

interface SeriesCardProps {
  tmdbId: number;
  slug: string;
  title: string;
  posterPath?: string;
  overview?: string;
  status?: string;
}

export default function SeriesCard({
  tmdbId,
  slug,
  title,
  posterPath,
  overview,
  status
}: SeriesCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const handleFollowClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFollowing(!isFollowing);
  };

  return (
    <Link href={`/serie/${tmdbId}-${slug}`}>
      <article 
        className="group relative bg-white rounded-xl border hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Poster Image */}
        <div className="aspect-[2/3] overflow-hidden bg-gray-200">
          {posterPath ? (
            <Image
              src={posterPath}
              alt={title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Kein Bild
            </div>
          )}
        </div>

        {/* Overlay (visible on hover) */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end p-4 transition-opacity duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <h3 className="text-lg font-bold text-white mb-2">
            {title}
          </h3>
          
          {status && (
            <span className="text-xs text-white/80">{status}</span>
          )}
        </div>

        {/* Follow Button */}
        <button
          onClick={handleFollowClick}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-lg backdrop-blur-sm ${
            isFollowing
              ? 'bg-purple-600 text-white'
              : 'bg-white/90 text-gray-900 hover:bg-white'
          }`}
        >
          {isFollowing ? <Check className="h-4 w-4" /> : <Plus className="h-5 w-5" />}
        </button>
        
        {/* Following Badge */}
        {isFollowing && (
          <div className="absolute top-3 left-3">
            <span className="px-3 py-1.5 bg-purple-600/90 backdrop-blur-sm text-white text-xs font-semibold rounded-full">
              folgst du
            </span>
          </div>
        )}
      </article>
    </Link>
  );
}