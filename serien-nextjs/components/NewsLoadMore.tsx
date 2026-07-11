'use client';

import { useState, useTransition, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, Loader2 } from 'lucide-react';
import NewsAdCard from '@/app/news/_ad_card';

interface ApiItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  heroImageUrl: string | null;
  cardImageUrl: string | null;
  publishedAt: string | null;
  seriesName: string | null;
  seriesPosterPath: string | null;
  seriesBackdropPath: string | null;
}

interface Props {
  initialCursor: string;
  filterSlug: string | null;
}

function pickImage(a: ApiItem): string | null {
  if (a.heroImageUrl) return a.heroImageUrl;
  if (a.cardImageUrl) return a.cardImageUrl;
  if (a.seriesBackdropPath) return `/img/tmdb/w780${a.seriesBackdropPath}`;
  if (a.seriesPosterPath) return `/img/tmdb/w500${a.seriesPosterPath}`;
  return null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function NewsLoadMore({ initialCursor, filterSlug }: Props) {
  const [items, setItems] = useState<ApiItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadMore = () => {
    if (!cursor) return;
    setError(null);
    startTransition(async () => {
      try {
        const params = new URLSearchParams({ cursor });
        if (filterSlug) params.set('filter', filterSlug);
        const res = await fetch(`/api/news/list?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { items: ApiItem[]; nextCursor: string | null } = await res.json();
        setItems((prev) => [...prev, ...data.items]);
        setCursor(data.nextCursor);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
        setError(msg);
      }
    });
  };

  return (
    <>
      {items.length > 0 && (
        <div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mt-6">
          {items.map((a, i) => {
            const img = pickImage(a);
            return (
              <Fragment key={a.id}>
                <Link
                  href={`/${a.slug}`}
                  className="group block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                  data-testid={`news-card-${a.slug}`}
                >
                  <div className="relative aspect-[16/9] bg-gray-200 dark:bg-gray-800">
                    {img && (
                      <Image
                        src={img}
                        alt={a.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}
                  </div>
                  <div className="p-4 sm:p-5">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                      {a.title}
                    </h3>
                    {a.excerpt && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-2">{a.excerpt}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(a.publishedAt)}</span>
                      {a.seriesName && (
                        <>
                          <span>•</span>
                          <span className="truncate text-cyan-600 dark:text-cyan-400">{a.seriesName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
                {/* In-Feed Ad alle 6 Load-More-Cards. */}
                {(i + 1) % 6 === 0 && i < items.length - 1 && <NewsAdCard />}
              </Fragment>
            );
          })}
        </div>
      )}

      <div className="flex flex-col items-center mt-8 gap-2">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}. Bitte erneut versuchen.
          </p>
        )}
        {cursor ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            data-testid="news-load-more"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isPending ? 'Lade …' : 'Mehr News laden'}
          </button>
        ) : items.length > 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Du hast das Ende erreicht.</p>
        ) : null}
      </div>
    </>
  );
}
