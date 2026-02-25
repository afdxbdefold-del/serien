'use client';

import { useState, useEffect } from 'react';
import { Check, Plus, Loader2 } from 'lucide-react';

interface FollowButtonProps {
  tmdbId: number;
  seriesName: string;
}

export default function FollowButton({ tmdbId, seriesName }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check follow status on mount
  useEffect(() => {
    checkFollowStatus();
  }, [tmdbId]);

  const checkFollowStatus = async () => {
    try {
      const res = await fetch(`/api/series/${tmdbId}/follow`);
      const data = await res.json();
      setIsFollowing(data.following);
    } catch (error) {
      console.error('Failed to check follow status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/series/${tmdbId}/follow`, {
        method: 'POST',
      });
      
      if (res.status === 401) {
        // User not logged in - redirect to login
        alert('Bitte melde dich an, um Serien zu folgen');
        return;
      }

      const data = await res.json();
      setIsFollowing(data.following);
    } catch (error) {
      console.error('Failed to toggle follow:', error);
      alert('Fehler beim Folgen/Entfolgen');
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold bg-gray-200 text-gray-400"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        Laden...
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all shadow-lg hover:shadow-xl ${
        isFollowing
          ? 'bg-white text-gray-900 hover:bg-gray-100'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isFollowing ? (
        <Check className="h-5 w-5" />
      ) : (
        <Plus className="h-5 w-5" />
      )}
      {loading ? 'Laden...' : isFollowing ? 'Folge ich' : 'Folgen'}
    </button>
  );
}
