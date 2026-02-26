'use client';

import { useState, useEffect } from 'react';
import { Check, Plus } from 'lucide-react';
import { isFollowing, toggleFollow, onFollowsChanged } from '@/lib/followStorage';

interface FollowButtonLocalProps {
  tmdbId: number;
  seriesName: string;
  variant?: 'default' | 'compact' | 'navbar';
}

export default function FollowButtonLocal({ tmdbId, seriesName, variant = 'default' }: FollowButtonLocalProps) {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    // Check initial status
    setFollowing(isFollowing(tmdbId));

    // Listen for changes from other components
    const unsubscribe = onFollowsChanged(() => {
      setFollowing(isFollowing(tmdbId));
    });

    return unsubscribe;
  }, [tmdbId]);

  const handleClick = () => {
    const newStatus = toggleFollow(tmdbId, seriesName);
    setFollowing(newStatus);
  };

  // Navbar style (like NEWS, TRENDING buttons)
  if (variant === 'navbar') {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-1 text-sm font-semibold uppercase transition-colors ${
          following
            ? 'text-gray-900 hover:text-gray-700'
            : 'text-gray-700 hover:text-gray-900'
        }`}
      >
        {following ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Folge ich
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" />
            Folgen
          </>
        )}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          following
            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        {following ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {following ? 'Folge ich' : 'Folgen'}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
        following
          ? 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 shadow-sm hover:shadow'
          : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-md hover:shadow-lg'
      }`}
    >
      {following ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      {following ? 'Folge ich' : 'Folgen'}
    </button>
  );
}
