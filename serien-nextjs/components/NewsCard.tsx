import Link from 'next/link';
import Image from 'next/image';

// Streamer brand colors
const streamerStyles: Record<string, { bg: string; text: string; label: string }> = {
  'Netflix': { bg: 'bg-red-600', text: 'text-white', label: 'Netflix' },
  'HBO Max': { bg: 'bg-purple-700', text: 'text-white', label: 'HBO Max' },
  'HBO': { bg: 'bg-black', text: 'text-white', label: 'HBO' },
  'Amazon Prime': { bg: 'bg-blue-500', text: 'text-white', label: 'Prime' },
  'Prime Video': { bg: 'bg-blue-500', text: 'text-white', label: 'Prime' },
  'Disney+': { bg: 'bg-blue-900', text: 'text-white', label: 'Disney+' },
  'Apple TV+': { bg: 'bg-gray-900', text: 'text-white', label: 'Apple TV+' },
  'Paramount+': { bg: 'bg-blue-600', text: 'text-white', label: 'Paramount+' },
  'Sky': { bg: 'bg-slate-800', text: 'text-white', label: 'Sky' },
  'RTL+': { bg: 'bg-red-500', text: 'text-white', label: 'RTL+' },
};

interface NewsCardProps {
  slug: string;
  title: string;
  excerpt?: string;
  heroLocalUrl?: string;
  cardImageUrl?: string;
  tmdbId?: number;
  tmdbType?: string;
  publishedAt: Date;
  category?: string;
  authorName?: string;
  networks?: string[]; // Add networks from series
}

export default function NewsCard({
  slug,
  title,
  excerpt,
  heroLocalUrl,
  cardImageUrl,
  tmdbId,
  tmdbType,
  publishedAt,
  category,
  authorName,
  networks = [],
}: NewsCardProps) {
  const getRelativeTime = () => {
    const now = new Date();
    const date = new Date(publishedAt);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Gerade eben';
    if (diffHours < 24) return `Vor ${diffHours} ${diffHours === 1 ? 'Stunde' : 'Stunden'}`;
    return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Use category first, fallback to first network
  const streamerName = category || (networks.length > 0 ? networks[0] : null);
  const streamerStyle = streamerName ? streamerStyles[streamerName] : null;

  return (
    <Link href={`/${slug}`}>
      {/* GLOW EFFECT: Remove 'dark:hover:shadow-cyan-500/20 dark:hover:border-cyan-500/30' to revert */}
      <article className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-lg dark:hover:shadow-cyan-500/20 dark:hover:border-cyan-500/30 transition-all duration-300 overflow-hidden cursor-pointer">
        {/* Image - Using hero/backdrop images (16:9) instead of card/poster */}
        <div className="relative aspect-video overflow-hidden">
          {(cardImageUrl || heroLocalUrl || (tmdbId && tmdbType)) ? (
            <Image
              src={cardImageUrl || (tmdbId && tmdbType ? `/img/hero/${tmdbType}/${tmdbId}` : heroLocalUrl!)}
              alt={title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
              <span className="text-gray-400 dark:text-gray-600">Kein Bild</span>
            </div>
          )}
          
          {/* Streamer Badge */}
          {streamerName && streamerStyle && (
            <div className="absolute top-3 right-3">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg ${streamerStyle.bg} ${streamerStyle.text}`}>
                {streamerStyle.label}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-lg font-bold text-gray-900 dark:text-white leading-snug mb-3 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {title}
          </p>

          {excerpt && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
              {excerpt}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-500">
            <span>{getRelativeTime()}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}