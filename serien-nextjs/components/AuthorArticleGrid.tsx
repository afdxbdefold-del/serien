'use client';

/**
 * AuthorArticleGrid — client-side "Mehr anzeigen" pagination for the author
 * page. All articles are rendered in the initial HTML (good for SEO crawler
 * link-discovery) but only the first PAGE_SIZE are visible; subsequent
 * batches reveal with one click. The Show-More button is intentionally a
 * <button>, not a link, so it doesn't pollute the URL bar.
 */
import { useState, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import InfeedAdCard from './InfeedAdCard';

interface ArticleCard {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  heroLocalUrl: string | null;
  heroImagePath: string | null;
  ogImageUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  category: string | null;
  readingTime: number | null;
  tmdbId: number | null;
  tmdbType: string | null;
}

interface Props {
  articles: ArticleCard[];
  authorName: string;
}

const PAGE_SIZE = 12;

export default function AuthorArticleGrid({ articles, authorName }: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const total = articles.length;
  const shown = articles.slice(0, visible);
  const remaining = Math.max(0, total - visible);

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="author-article-grid">
        {shown.map((article, i) => {
          const imageUrl =
            article.heroImagePath ||
            article.ogImageUrl ||
            (article.tmdbId && article.tmdbType ? `/img/card/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl) ||
            '/og-image.png';
          const publishedDate = new Date(article.publishedAt || article.createdAt);
          const formattedDate = publishedDate.toLocaleDateString('de-DE', {
            timeZone: 'Europe/Berlin',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          return (
            <Fragment key={article.id}>
              <Link
                href={`/${article.slug}`}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow group"
              >
                <div className="relative w-full aspect-[16/9] bg-gray-200 overflow-hidden">
                  <Image
                    src={imageUrl}
                    alt={article.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {article.category && (
                    <span className="absolute top-3 left-3 bg-cyan-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      {article.category}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-cyan-600 transition-colors">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{article.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formattedDate}</span>
                    {article.readingTime && <span>{article.readingTime} Min. Lesezeit</span>}
                  </div>
                </div>
              </Link>
              {/* In-Feed Ad alle 6 Cards. */}
              {(i + 1) % 6 === 0 && i < shown.length - 1 && <InfeedAdCard />}
            </Fragment>
          );
        })}
      </div>

      {remaining > 0 && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="px-6 py-3 rounded-full bg-cyan-600 text-white font-medium text-sm hover:bg-cyan-700 transition-colors shadow-sm"
            data-testid="author-show-more"
            aria-label={`Mehr Artikel von ${authorName} anzeigen`}
          >
            Mehr anzeigen ({remaining} weitere)
          </button>
        </div>
      )}

      {visible >= total && total > PAGE_SIZE && (
        <p className="mt-8 text-center text-sm text-gray-500" data-testid="author-list-end">
          Alle {total} Artikel von {authorName} geladen.
        </p>
      )}
    </>
  );
}
