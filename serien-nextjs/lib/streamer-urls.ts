/**
 * Streaming Provider URL Mapper
 * Maps TMDB provider names to direct streaming URLs
 */

export interface StreamerURLs {
  homepage: string;
  search?: string; // URL template for search, use {title} placeholder
}

/**
 * Direct URLs to streaming services (German market)
 */
export const STREAMER_URLS: Record<string, StreamerURLs> = {
  // Major Streaming Services
  'Netflix': {
    homepage: 'https://www.netflix.com/de/',
    search: 'https://www.netflix.com/de/search?q={title}',
  },
  'Amazon Prime Video': {
    homepage: 'https://www.primevideo.com/',
    search: 'https://www.primevideo.com/search?phrase={title}',
  },
  'Disney Plus': {
    homepage: 'https://www.disneyplus.com/de-de',
    search: 'https://www.disneyplus.com/de-de/search?q={title}',
  },
  'Apple TV Plus': {
    homepage: 'https://tv.apple.com/de',
  },
  'Apple TV': {
    homepage: 'https://tv.apple.com/de',
  },
  'Paramount Plus': {
    homepage: 'https://www.paramountplus.com/de/',
  },
  'WOW': {
    homepage: 'https://www.wowtv.de/',
    search: 'https://www.wowtv.de/suche?q={title}',
  },
  'Sky Go': {
    homepage: 'https://www.skygo.sky.de/',
  },
  'Sky': {
    homepage: 'https://www.sky.de/',
  },
  'RTL+': {
    homepage: 'https://www.rtlplus.com/',
    search: 'https://www.rtlplus.com/suche?q={title}',
  },
  'Joyn': {
    homepage: 'https://www.joyn.de/',
    search: 'https://www.joyn.de/suche?q={title}',
  },
  'Joyn Plus': {
    homepage: 'https://www.joyn.de/',
  },
  'MagentaTV': {
    homepage: 'https://www.magentatv.de/',
  },
  'ARD Mediathek': {
    homepage: 'https://www.ardmediathek.de/',
    search: 'https://www.ardmediathek.de/suche/{title}',
  },
  'ZDF': {
    homepage: 'https://www.zdf.de/',
  },
  'Arte': {
    homepage: 'https://www.arte.tv/de/',
  },
  'Crunchyroll': {
    homepage: 'https://www.crunchyroll.com/de/',
    search: 'https://www.crunchyroll.com/de/search?q={title}',
  },
  'Max': {
    homepage: 'https://www.max.com/',
  },
  'HBO Max': {
    homepage: 'https://www.max.com/',
  },
  'Peacock': {
    homepage: 'https://www.peacocktv.com/',
  },
  'Hulu': {
    homepage: 'https://www.hulu.com/',
  },
  'Amazon Video': {
    homepage: 'https://www.primevideo.com/',
    search: 'https://www.primevideo.com/search?phrase={title}',
  },
  'Google Play Movies': {
    homepage: 'https://play.google.com/store/movies',
  },
  'YouTube': {
    homepage: 'https://www.youtube.com/',
    search: 'https://www.youtube.com/results?search_query={title}',
  },
  'Apple iTunes': {
    homepage: 'https://tv.apple.com/de',
  },
  'Microsoft Store': {
    homepage: 'https://www.microsoft.com/de-de/store/movies-and-tv',
  },
  'Rakuten TV': {
    homepage: 'https://rakuten.tv/de/',
  },
  'Videoload': {
    homepage: 'https://www.videoload.de/',
  },
  'Freenet Video': {
    homepage: 'https://www.freenet-video.de/',
  },
};

/**
 * Get direct URL for a streaming provider
 * Returns homepage or search URL if available
 */
export function getStreamerURL(providerName: string, seriesName?: string): string {
  const streamer = STREAMER_URLS[providerName];
  
  if (!streamer) {
    // Fallback: return homepage with best guess
    return '#';
  }
  
  // If series name provided and search URL available, use search
  if (seriesName && streamer.search) {
    const encodedTitle = encodeURIComponent(seriesName);
    return streamer.search.replace('{title}', encodedTitle);
  }
  
  // Otherwise return homepage
  return streamer.homepage;
}

/**
 * Check if direct link is available for provider
 */
export function hasDirectLink(providerName: string): boolean {
  return providerName in STREAMER_URLS;
}
