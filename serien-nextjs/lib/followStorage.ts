/**
 * LocalStorage-based Follow System
 * Stores followed series IDs in browser's localStorage
 */

const STORAGE_KEY = 'serien_followed';

export interface FollowedSeries {
  tmdbId: number;
  name: string;
  addedAt: string;
}

// Get all followed series
export function getFollowedSeries(): FollowedSeries[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading followed series:', error);
    return [];
  }
}

// Get only the TMDB IDs (for API calls)
export function getFollowedIds(): number[] {
  return getFollowedSeries().map(s => s.tmdbId);
}

// Check if a series is followed
export function isFollowing(tmdbId: number): boolean {
  const followed = getFollowedSeries();
  return followed.some(s => s.tmdbId === tmdbId);
}

// Follow a series
export function followSeries(tmdbId: number, name: string): void {
  if (typeof window === 'undefined') return;
  
  const followed = getFollowedSeries();
  
  // Don't add if already following
  if (followed.some(s => s.tmdbId === tmdbId)) return;
  
  followed.push({
    tmdbId,
    name,
    addedAt: new Date().toISOString(),
  });
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(followed));
  
  // Trigger storage event for other components
  window.dispatchEvent(new Event('followsChanged'));
}

// Unfollow a series
export function unfollowSeries(tmdbId: number): void {
  if (typeof window === 'undefined') return;
  
  const followed = getFollowedSeries();
  const filtered = followed.filter(s => s.tmdbId !== tmdbId);
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  
  // Trigger storage event
  window.dispatchEvent(new Event('followsChanged'));
}

// Toggle follow status
export function toggleFollow(tmdbId: number, name: string): boolean {
  const following = isFollowing(tmdbId);
  
  if (following) {
    unfollowSeries(tmdbId);
    return false;
  } else {
    followSeries(tmdbId, name);
    return true;
  }
}

// Import from share link (format: ?f=123,456,789)
export function importFromShareLink(ids: number[]): void {
  if (typeof window === 'undefined') return;
  
  const followed = getFollowedSeries();
  const existingIds = followed.map(s => s.tmdbId);
  
  // Add only new IDs (we don't have names, so use placeholder)
  ids.forEach(id => {
    if (!existingIds.includes(id)) {
      followed.push({
        tmdbId: id,
        name: `Series ${id}`, // Placeholder - will be updated when series is loaded
        addedAt: new Date().toISOString(),
      });
    }
  });
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(followed));
  window.dispatchEvent(new Event('followsChanged'));
}

// Generate share link
export function generateShareLink(): string {
  const ids = getFollowedIds();
  if (ids.length === 0) return '';
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/?f=${ids.join(',')}`;
}

// Listen for changes (for React components)
export function onFollowsChanged(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  
  window.addEventListener('followsChanged', callback);
  
  // Return cleanup function
  return () => window.removeEventListener('followsChanged', callback);
}

// Clear all follows
export function clearAllFollows(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('followsChanged'));
}
