'use client';

import { useState, useEffect } from 'react';
import { Check, Plus, Loader2 } from 'lucide-react';

interface FollowButtonProps {
  tmdbId: number;
  seriesName: string;
  onAuthRequired?: () => void; // Callback to open login modal
}

export default function FollowButton({ tmdbId, seriesName, onAuthRequired }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [requiresAuth, setRequiresAuth] = useState(false);

  // Check follow status on mount
  useEffect(() => {
    checkFollowStatus();
  }, [tmdbId]);

  const checkFollowStatus = async () => {
    try {
      const res = await fetch(`/api/series/${tmdbId}/follow`, {
        credentials: 'include',
      });
      const data = await res.json();
      setIsFollowing(data.following);
      setRequiresAuth(data.requiresAuth || false);
    } catch (error) {
      console.error('Failed to check follow status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleToggle = async () => {
    // If user is not authenticated, trigger auth modal
    if (requiresAuth && onAuthRequired) {
      onAuthRequired();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/series/${tmdbId}/follow`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (res.status === 401) {
        // User not authenticated
        if (onAuthRequired) {
          onAuthRequired();
        }
        return;
      }

      const data = await res.json();
      setIsFollowing(data.following);
      setRequiresAuth(false);
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
      {loading ? 'Laden...' : isFollowing ? 'Folge ich' : requiresAuth ? 'Jetzt folgen' : 'Folgen'}
    </button>
  );
}
