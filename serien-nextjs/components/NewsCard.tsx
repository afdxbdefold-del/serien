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
  authorName
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

  const streamerStyle = category ? streamerStyles[category] : null;

  return (
    <Link href={`/${slug}`}>
      <article className="group bg-white rounded-xl border hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer">
        {/* Image */}
        <div className="relative aspect-video overflow-hidden">
          {(cardImageUrl || heroLocalUrl || (tmdbId && tmdbType)) ? (
            <Image
              src={cardImageUrl || (tmdbId && tmdbType ? `/img/card/${tmdbType}/${tmdbId}` : heroLocalUrl!)}
              alt={title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-400">Kein Bild</span>
            </div>
          )}
          
          {/* Streamer Badge */}
          {category && streamerStyle && (
            <div className="absolute top-3 right-3">
              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg ${streamerStyle.bg} ${streamerStyle.text}`}>
                {streamerStyle.label}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="text-lg font-bold text-gray-900 leading-snug mb-3 group-hover:text-purple-600 transition-colors">
            {title}
          </h3>

          {excerpt && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-4">
              {excerpt}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{getRelativeTime()}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}