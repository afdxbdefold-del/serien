'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Plus } from 'lucide-react';

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
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const response = await fetch(`/api/follow?seriesId=${tmdbId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          setIsFollowing(false);
        } else if (response.status === 401) {
          alert('Bitte melden Sie sich an, um Serien zu folgen.');
        }
      } else {
        // Follow
        const response = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seriesId: tmdbId }),
        });
        
        if (response.ok) {
          setIsFollowing(true);
        } else if (response.status === 401) {
          alert('Bitte melden Sie sich an, um Serien zu folgen.');
        }
      }
    } catch (err) {
      console.error('Follow toggle failed:', err);
      alert('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
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
          disabled={loading}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-lg ${
            isFollowing
              ? 'bg-green-500 hover:bg-green-600'
              : 'bg-white/90 hover:bg-white'
          } disabled:opacity-50`}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : isFollowing ? (
            <Check className="h-4 w-4 text-white" />
          ) : (
            <Plus className="h-4 w-4 text-gray-700" />
          )}
        </button>

        {/* Overlay with Info */}
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
