import { ExternalLink, Tv, ShoppingCart, Film, TvMinimal } from 'lucide-react';
import Image from 'next/image';
import { getTVWatchProviders, getTMDBLogoUrl, getProviderDisplayName, type WatchProvider } from '@/lib/tmdb-watch-providers';
import { getStreamerURL, hasDirectLink } from '@/lib/streamer-urls';

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

  // Render provider card
  const renderProvider = (provider: WatchProvider, type: 'flatrate' | 'buy' | 'rent' | 'ads' | 'free') => {
    const displayName = getProviderDisplayName(provider.provider_name);
    const logoUrl = getTMDBLogoUrl(provider.logo_path, 'w92');
    
    // Get direct streamer URL (with search if possible, otherwise homepage)
    const streamerURL = getStreamerURL(provider.provider_name, seriesName);
    const hasDirectStreamerLink = hasDirectLink(provider.provider_name);
    
    const typeLabels = {
      flatrate: 'Jetzt streamen',
      buy: 'Kaufen',
      rent: 'Leihen',
      ads: 'Mit Werbung',
      free: 'Kostenlos'
    };
    
    return (
      <a
        key={`${type}-${provider.provider_id}`}
        href={streamerURL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all group"
        title={hasDirectStreamerLink ? `${displayName} öffnen` : `${displayName} - Link nicht verfügbar`}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            <Image
              src={logoUrl}
              alt={displayName}
              width={48}
              height={48}
              className="object-cover"
            />
          </div>
          <div>
            <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {displayName}
            </p>
            <p className="text-xs text-gray-500">
              {typeLabels[type]}
            </p>
          </div>
        </div>
        <ExternalLink className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
      </a>
    );
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
        {/* Flatrate (Streaming Subscriptions) */}
        {providers.flatrate && providers.flatrate.map(p => renderProvider(p, 'flatrate'))}
        
        {/* Free with Ads */}
        {providers.ads && providers.ads.map(p => renderProvider(p, 'ads'))}
        
        {/* Free */}
        {providers.free && providers.free.map(p => renderProvider(p, 'free'))}
        
        {/* Buy */}
        {providers.buy && providers.buy.slice(0, 3).map(p => renderProvider(p, 'buy'))}
        
        {/* Rent */}
        {providers.rent && providers.rent.slice(0, 3).map(p => renderProvider(p, 'rent'))}
      </div>

      <div className="mt-4 pt-4 border-t border-blue-100">
        <p className="text-xs text-gray-500 text-center">
          Streaming-Verfügbarkeit für Deutschland • Daten von TMDB
        </p>
      </div>
    </div>
  );
}
