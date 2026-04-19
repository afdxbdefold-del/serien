import Link from 'next/link';
import Image from 'next/image';
import { getAuthorUrl } from '@/lib/author-utils';

/**
 * Top author for a given series — E-E-A-T signal on /serie/[slug] pages.
 *
 * Shows the editor with the most published articles about this series, plus
 * their expertise tags and a teaser from their fullBio. Strengthens internal
 * author linking and signals domain expertise to Google.
 */
type Props = {
  author: {
    name: string;
    image: string | null;
    fullBio: string | null;
    expertise: string[];
    articleCount: number;
  };
  seriesName: string;
};

function firstSentence(fullBio: string | null): string {
  if (!fullBio) return '';
  const plain = fullBio.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const slice = plain.substring(0, 260);
  const idx = slice.search(/[.!?]\s/);
  if (idx > 40 && idx < 240) return slice.substring(0, idx + 1).trim();
  return plain.length > 200 ? plain.substring(0, 197).trim() + '…' : plain;
}

export default function SeriesAuthorBox({ author, seriesName }: Props) {
  const teaser = firstSentence(author.fullBio);
  const href = getAuthorUrl(author.name);

  return (
    <aside
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 md:p-6 mb-6"
      data-testid="series-author-box"
      aria-label={`Zuständige Redakteurin für ${seriesName}`}
    >
      <div className="flex items-start gap-4">
        {author.image ? (
          <Link href={href} className="flex-shrink-0">
            <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden ring-2 ring-white dark:ring-gray-700 shadow-sm">
              <Image src={author.image} alt={author.name} fill sizes="64px" className="object-cover" />
            </div>
          </Link>
        ) : (
          <Link href={href} className="flex-shrink-0">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl ring-2 ring-white dark:ring-gray-700 shadow-sm">
              {author.name.charAt(0).toUpperCase()}
            </div>
          </Link>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Zuständige Redakteurin
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              · {author.articleCount} {author.articleCount === 1 ? 'Artikel' : 'Artikel'} zu {seriesName}
            </span>
          </div>

          <Link
            href={href}
            className="font-bold text-lg text-gray-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            data-testid="series-author-box-name"
          >
            {author.name}
          </Link>

          {teaser && (
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mt-2 line-clamp-2">
              {teaser}
            </p>
          )}

          {author.expertise && author.expertise.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {author.expertise.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-medium rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 mt-3 group"
            data-testid="series-author-box-cta"
          >
            Alle Artikel von {author.name.split(' ')[0]} ansehen
            <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </aside>
  );
}
