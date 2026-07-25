/**
 * NewsSidebar — spezielle Sidebar für /news und /news/[filter].
 *
 * Layout (Desktop only, hidden < lg):
 *   1. TheMoneytizer MREC Top     (Format 2, 300×250)
 *   2. Content-Box: Trending      (letzte 7 Tage, `isTrending=true`, Top 5)
 *   3. TheMoneytizer Half Page    (Format 3, 300×600)
 *   4. Content-Box: Streamer-Nav  (kompakte Quicklinks zu /news/{streamer})
 *   5. TheMoneytizer Skyscraper   (Format 4, 300×600 simple)
 *   6. TheMoneytizer MREC Bottom  (Format 19, 300×250)
 *
 * Warum eigene Sidebar? Auf `/news` will der User Direktvermarktung via
 * TheMoneytizer statt Yieldlab/Prebid. Andere Themen-Hubs (Streamer-Landings,
 * Genre, Top-Listen) behalten `ThemePageSidebar` unverändert.
 *
 * Server Component — lädt Trending-Artikel via Prisma. TMN-Slots sind
 * Client-Islands via `TMNSidebarSlot`.
 */
import Link from 'next/link';
import Image from 'next/image';
import { Flame, Clock, Tv } from 'lucide-react';
import prisma from '@/lib/prisma';
import TMNSidebarSlot from './TMNSidebarSlot';
import { STREAMERS } from '@/app/news/_lib';

interface TrendingItem {
  id: string;
  slug: string;
  title: string;
  publishedAt: Date | null;
  cardImageUrl: string | null;
  heroImageUrl: string | null;
}

async function fetchTrending(): Promise<TrendingItem[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const trending = await prisma.articles.findMany({
    where: {
      status: 'published',
      isTrending: true,
      publishedAt: { gte: sevenDaysAgo },
    },
    orderBy: { publishedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      slug: true,
      title: true,
      publishedAt: true,
      cardImageUrl: true,
      heroImageUrl: true,
    },
  });

  if (trending.length >= 5) return trending;

  const seenIds = new Set(trending.map((t) => t.id));
  const filler = await prisma.articles.findMany({
    where: {
      status: 'published',
      publishedAt: { gte: sevenDaysAgo },
      id: { notIn: Array.from(seenIds) },
    },
    orderBy: { publishedAt: 'desc' },
    take: 5 - trending.length,
    select: {
      id: true,
      slug: true,
      title: true,
      publishedAt: true,
      cardImageUrl: true,
      heroImageUrl: true,
    },
  });

  return [...trending, ...filler].slice(0, 5);
}

function formatRelative(d: Date | null): string {
  if (!d) return '';
  const ms = Date.now() - d.getTime();
  const h = Math.round(ms / 3_600_000);
  if (h < 1) return 'gerade eben';
  if (h < 24) return `vor ${h} Std.`;
  const days = Math.round(h / 24);
  return `vor ${days} Tag${days === 1 ? '' : 'en'}`;
}

export default async function NewsSidebar() {
  const trending = await fetchTrending();

  return (
    <aside
      className="hidden lg:block"
      aria-label="News-Sidebar"
      data-context="news-sidebar"
    >
      <div className="sticky top-24 space-y-6">
        {/* 1. TheMoneytizer MREC Top (Format 2, 300×250) */}
        <TMNSidebarSlot formatId={2} label="Werbung MREC Top" />

        {/* 2. Content-Box: Trending News letzte 7 Tage */}
        {trending.length > 0 && (
          <section
            aria-label="Trending diese Woche"
            data-testid="news-sidebar-trending"
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/50 p-4"
          >
            <header className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-orange-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                Trending diese Woche
              </h2>
            </header>
            <ol className="space-y-3">
              {trending.map((a, i) => {
                const img = a.cardImageUrl ?? a.heroImageUrl;
                return (
                  <li key={a.id} className="group">
                    <Link
                      href={`/${a.slug}`}
                      className="flex gap-3 items-start"
                      data-testid={`news-sidebar-trending-item-${i + 1}`}
                    >
                      <span className="flex-shrink-0 text-lg font-bold text-cyan-600 dark:text-cyan-400 leading-none w-5 pt-0.5">
                        {i + 1}
                      </span>
                      {img && (
                        <div className="relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                          <Image
                            src={img}
                            alt=""
                            fill
                            sizes="56px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-3 leading-snug group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors">
                          {a.title}
                        </h3>
                        <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-500 inline-flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatRelative(a.publishedAt)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800">
              <Link
                href="/news"
                className="text-[11px] text-cyan-700 dark:text-cyan-400 hover:underline"
                data-testid="news-sidebar-trending-more"
              >
                Alle News →
              </Link>
            </div>
          </section>
        )}

        {/* 3. TheMoneytizer Half Page (Format 3, 300×600) */}
        <TMNSidebarSlot formatId={3} label="Werbung Half Page" />

        {/* 4. Content-Box: Streamer-Quicklinks */}
        <section
          aria-label="Nach Streamer filtern"
          data-testid="news-sidebar-streamers"
          className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/50 p-4"
        >
          <header className="flex items-center gap-2 mb-3">
            <Tv className="h-4 w-4 text-cyan-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
              News nach Streamer
            </h2>
          </header>
          <ul className="grid grid-cols-2 gap-1.5">
            {STREAMERS.slice(0, 8).map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/news/${s.slug}`}
                  data-testid={`news-sidebar-streamer-${s.slug}`}
                  className="block px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-cyan-400 dark:hover:border-cyan-500 hover:text-cyan-700 dark:hover:text-cyan-400 transition-colors truncate"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Standard-Skyscraper (Format 4) entfernt auf User-Direktive Feb 2026. */}

        {/* 6. TheMoneytizer MREC Bottom (Format 19, 300×250) */}
        <TMNSidebarSlot formatId={19} label="Werbung MREC Bottom" />
      </div>
    </aside>
  );
}
