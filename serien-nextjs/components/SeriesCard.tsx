'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Plus } from 'lucide-react';
import { isFollowing, toggleFollow, onFollowsChanged } from '@/lib/followStorage';

interface SeriesCardProps {
  tmdbId: number;
  slug: string;
  title: string;
  posterPath?: string | null;
  overview?: string | null;
  status?: string | null;
  initialFollowing?: boolean;
}

export default function SeriesCard({
  tmdbId,
  slug,
  title,
  posterPath,
  overview,
  status,
  initialFollowing = false
}: SeriesCardProps) {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    // Check LocalStorage status
    setFollowing(isFollowing(tmdbId));

    // Listen for changes from other components
    const unsubscribe = onFollowsChanged(() => {
      setFollowing(isFollowing(tmdbId));
    });

    return unsubscribe;
  }, [tmdbId]);

  const handleFollowToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newStatus = toggleFollow(tmdbId, title);
    setFollowing(newStatus);
  };

  return (
    <Link href={`/serie/${tmdbId}-${slug}`}>
      <article className="group relative bg-white rounded-xl border hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer">
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

        {/* Follow Button */}
        <button
          onClick={handleFollowToggle}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-lg ${
            following
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-white/90 hover:bg-white'
          }`}
        >
          {following ? (
            <Check className="h-5 w-5 text-white" />
          ) : (
            <Plus className="h-5 w-5 text-gray-700" />
          )}
        </button>

        {/* Title and Status Overlay */}
        <div className="p-4">
          <h3 className="font-bold text-gray-900 line-clamp-2 mb-1">
            {title}
          </h3>
          {status && (
            <span className="text-gray-500 text-sm">{status}</span>
          )}
        </div>

        {/* Hover Overlay with Info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <h3 className="text-white font-bold text-lg mb-1 line-clamp-2">
            {title}
          </h3>
          {status && (
            <span className="text-white/80 text-xs">{status}</span>
          )}
        </div>
      </article>
    </Link>
  );
}
