import { ExternalLink, Tv, ShoppingCart, Film, TvMinimal } from 'lucide-react';
import Image from 'next/image';
import { getTVWatchProviders, getTMDBLogoUrl, getProviderDisplayName, type WatchProvider } from '@/lib/tmdb-watch-providers';

interface WhereToStreamBoxProps {
  seriesId: number;
  seriesName: string;
  networks?: string[];
  slug?: string;
}

export default async function WhereToStreamBox({ seriesId, seriesName, networks, slug }: WhereToStreamBoxProps) {
  // Fetch watch providers from TMDB
  const providers = await getTVWatchProviders(seriesId);
  
  // If no providers available, don't show the box
  if (!providers || (!providers.flatrate && !providers.buy && !providers.rent && !providers.ads && !providers.free)) {
    return null;
  }

  // Map network names to their URLs (if available)
  const getNetworkUrl = (network: string): string | null => {
    const networkLower = network.toLowerCase();
    
    if (networkLower.includes('netflix')) {
      return `https://www.netflix.com/search?q=${encodeURIComponent(seriesName)}`;
    }
    if (networkLower.includes('disney')) {
      return `https://www.disneyplus.com/search?q=${encodeURIComponent(seriesName)}`;
    }
    if (networkLower.includes('amazon') || networkLower.includes('prime')) {
      return `https://www.primevideo.com/search?phrase=${encodeURIComponent(seriesName)}`;
    }
    if (networkLower.includes('apple')) {
      return `https://tv.apple.com/search?term=${encodeURIComponent(seriesName)}`;
    }
    if (networkLower.includes('hbo') || networkLower.includes('max')) {
      return `https://www.max.com/search?q=${encodeURIComponent(seriesName)}`;
    }
    if (networkLower.includes('paramount')) {
      return `https://www.paramountplus.com/search/?query=${encodeURIComponent(seriesName)}`;
    }
    if (networkLower.includes('hulu')) {
      return `https://www.hulu.com/search?q=${encodeURIComponent(seriesName)}`;
    }
    
    // Default: link to TMDB (has "Watch Now" info)
    return `https://www.themoviedb.org/tv/${seriesId}`;
  };

  // Display name mapping (for better readability)
  const getDisplayName = (network: string): string => {
    const networkLower = network.toLowerCase();
    
    if (networkLower.includes('hulu')) {
      return 'Hulu bei Disney';
    }
    
    return network;
  };

  return (
    <div className="border-2 border-blue-100 rounded-xl p-6 mb-8 bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-blue-500 rounded-lg">
          <Tv className="h-5 w-5 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mt-1">
          Wo wird die Serie gestreamt?
        </h3>
      </div>

      <div className="space-y-3">
        {networks.map((network, index) => {
          const url = getNetworkUrl(network);
          const displayName = getDisplayName(network);
          
          return (
            <a
              key={index}
              href={url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {displayName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {displayName}
                  </p>
                  <p className="text-xs text-gray-500">
                    Jetzt ansehen
                  </p>
                </div>
              </div>
              <ExternalLink className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </a>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-blue-100">
        <p className="text-xs text-gray-500 text-center">
          Die Verfügbarkeit kann je nach Region variieren. Bitte überprüfe die Verfügbarkeit direkt beim Anbieter.
        </p>
      </div>
    </div>
  );
}
