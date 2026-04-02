/**
 * Fallback hero images for articles when no TMDB backdrop is available.
 * Uses high-quality Unsplash images (1920x1080) matching each streamer's branding.
 * 
 * Usage: When pipeline can't find a TMDB backdrop, it uses the streamer
 * associated with the series to pick a recognizable fallback image.
 */

interface StreamerFallback {
  keywords: string[];
  imageUrl: string;
}

const STREAMER_FALLBACKS: StreamerFallback[] = [
  {
    keywords: ['netflix'],
    imageUrl: 'https://images.unsplash.com/photo-1611798821136-26bfb61b734f?w=1920&h=1080&fit=crop&q=80',
  },
  {
    keywords: ['amazon', 'prime video', 'prime'],
    imageUrl: 'https://images.unsplash.com/photo-1643208589888-23447d7e747f?w=1920&h=1080&fit=crop&q=80',
  },
  {
    keywords: ['apple tv', 'apple tv+'],
    imageUrl: 'https://images.unsplash.com/photo-1645518557701-406efe2120ce?w=1920&h=1080&fit=crop&q=80',
  },
  {
    keywords: ['disney', 'disney+'],
    imageUrl: 'https://images.unsplash.com/photo-1662466767333-433cc73ebbb7?w=1920&h=1080&fit=crop&q=80',
  },
  {
    keywords: ['paramount', 'paramount+'],
    imageUrl: 'https://images.unsplash.com/photo-1662466767400-27c176fab51b?w=1920&h=1080&fit=crop&q=80',
  },
  {
    keywords: ['hulu'],
    imageUrl: 'https://images.unsplash.com/photo-1662466767400-27c176fab51b?w=1920&h=1080&fit=crop&q=80',
  },
];

// Generic dark cinematic fallback when no streamer match
const GENERIC_FALLBACK = 'https://images.unsplash.com/photo-1662466767400-27c176fab51b?w=1920&h=1080&fit=crop&q=80';

/**
 * Find a fallback hero image based on the streaming platform(s)
 * @param networks - Array of network/platform names from TMDB or facts
 * @returns URL string for the fallback image (1920x1080)
 */
export function getStreamerFallbackImage(networks: string[]): string {
  const searchText = networks.map(n => n.toLowerCase()).join(' ');
  
  for (const fallback of STREAMER_FALLBACKS) {
    if (fallback.keywords.some(kw => searchText.includes(kw))) {
      return fallback.imageUrl;
    }
  }
  
  return GENERIC_FALLBACK;
}
