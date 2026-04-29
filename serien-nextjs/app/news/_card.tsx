/**
 * News card used inside the /news hub + sub-routes.
 * Two layouts:
 *  - "feed"  → poster-style image + title + excerpt + date (default)
 *  - "compact" → smaller, used on the article-footer "Mehr aktuelle News" block
 */
import Link from 'next/link';
import Image from 'next/image';
import { Clock } from 'lucide-react';
import type { NewsArticle } from './_data';

interface Props {
  article: NewsArticle;
  variant?: 'feed' | 'compact';
}

function pickImage(a: NewsArticle): string | null {
  if (a.heroImageUrl) return a.heroImageUrl;
  if (a.cardImageUrl) return a.cardImageUrl;
  if (a.series?.backdropPath) return `/img/tmdb/w780${a.series.backdropPath}`;
  if (a.series?.posterPath) return `/img/tmdb/w500${a.series.posterPath}`;
  return null;
}

function formatDate(d: Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function NewsCard({ article, variant = 'feed' }: Props) {
  const img = pickImage(article);

  if (variant === 'compact') {
    return (
      <Link
        href={`/${article.slug}`}
        className="group flex gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
        data-testid={`news-card-compact-${article.slug}`}
      >
        <div className="relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden bg-gray-200 dark:bg-gray-800">
          {img && (
            <Image
              src={img}
              alt={article.title}
              fill
              sizes="80px"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-3 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
            {article.title}
          </h4>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{formatDate(article.publishedAt)}</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/${article.slug}`}
      className="group block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
      data-testid={`news-card-${article.slug}`}
    >
      <div className="relative aspect-[16/9] bg-gray-200 dark:bg-gray-800">
        {img && (
          <Image
            src={img}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-2">
            {article.excerpt}
          </p>
        )}
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="w-3 h-3" />
          <span>{formatDate(article.publishedAt)}</span>
          {article.series?.name && (
            <>
              <span>•</span>
              <span className="truncate text-cyan-600 dark:text-cyan-400">{article.series.name}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
