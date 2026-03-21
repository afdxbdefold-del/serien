'use client';

import { useState, useEffect } from 'react';
import { Heart, Check, Plus, Loader2 } from 'lucide-react';

interface FollowButtonProps {
  tmdbId: number;
  seriesName: string;
  variant?: 'default' | 'compact';
}

export default function FollowButton({ tmdbId, seriesName, variant = 'default' }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem('followed-series');
    if (stored) {
      try {
        const followed = JSON.parse(stored);
        setIsFollowing(followed.includes(String(tmdbId)));
      } catch (e) {
        console.error('Error loading followed series:', e);
      }
    }
    setIsLoading(false);
  }, [tmdbId]);

  const toggleFollow = () => {
    const stored = localStorage.getItem('followed-series');
    let followed: string[] = [];
    
    if (stored) {
      try {
        followed = JSON.parse(stored);
      } catch (e) {
        followed = [];
      }
    }

    const idStr = String(tmdbId);
    
    if (followed.includes(idStr)) {
      followed = followed.filter(id => id !== idStr);
      setIsFollowing(false);
    } else {
      followed.push(idStr);
      setIsFollowing(true);
    }

    localStorage.setItem('followed-series', JSON.stringify(followed));
    
    // Dispatch storage event for other components to react
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'followed-series',
      newValue: JSON.stringify(followed)
    }));
  };

  if (isLoading) {
    return (
      <button
        disabled
        className={`flex items-center gap-2 font-semibold bg-gray-200 dark:bg-gray-700 text-gray-400 ${
          variant === 'compact' 
            ? 'px-4 py-2 rounded-lg text-sm' 
            : 'px-6 py-3 rounded-xl'
        }`}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        Laden...
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleFollow}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
          isFollowing
            ? 'bg-cyan-500 text-white hover:bg-cyan-600'
            : 'bg-gray-100 dark:bg-[hsl(230,25%,15%)] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[hsl(230,25%,20%)]'
        }`}
        aria-pressed={isFollowing}
        aria-label={isFollowing ? `${seriesName} nicht mehr folgen` : `${seriesName} folgen`}
      >
        <Heart className={`w-4 h-4 ${isFollowing ? 'fill-current' : ''}`} />
        <span>{isFollowing ? 'Folge ich' : 'Folgen'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleFollow}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
        isFollowing
          ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-white border-2 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow'
          : 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-white hover:from-cyan-400 hover:to-cyan-300 shadow-md hover:shadow-lg hover:shadow-cyan-500/25'
      }`}
      aria-pressed={isFollowing}
      aria-label={isFollowing ? `${seriesName} nicht mehr folgen` : `${seriesName} folgen`}
    >
      {isFollowing ? (
        <Check className="h-5 w-5" />
      ) : (
        <Plus className="h-5 w-5" />
      )}
      {isFollowing ? 'Folge ich' : 'Folgen'}
    </button>
  );
}
