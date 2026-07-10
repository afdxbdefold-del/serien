/**
 * Shared hub renderer used by /news + /news/[filter].
 *
 * Server component: fetches the first PAGE_SIZE articles, renders filter pills,
 * H1, intro, JSON-LD CollectionPage, and a client island for "Mehr laden".
 */
import Link from 'next/link';
import { fetchNewsArticles } from './_data';
import { buildFilterPills, PAGE_SIZE, SITE_BASE } from './_lib';
import NewsCard from './_card';
import NewsLoadMore from '@/components/NewsLoadMore';
import ThemePageSidebar from '@/components/ThemePageSidebar';

interface Props {
  h1: string;
  intro: string;
  canonicalPath: string;             // e.g. "/news" or "/news/netflix"
  filterSlug: string | null;         // null on /news root
}

export default async function NewsHub({ h1, intro, canonicalPath, filterSlug }: Props) {
  const articles = await fetchNewsArticles({ filterSlug, limit: PAGE_SIZE });

  const pills = buildFilterPills(filterSlug);

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: h1,
    url: `${SITE_BASE}${canonicalPath}`,
    isPartOf: { '@type': 'WebSite', name: 'serien.de', url: SITE_BASE },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: articles.length,
      itemListElement: articles.slice(0, 20).map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_BASE}/${a.slug}`,
        name: a.title,
      })),
    },
  };

  // For "Mehr laden" cursor we hand the publishedAt of the last loaded article
  const cursor = articles.length === PAGE_SIZE && articles[articles.length - 1].publishedAt
    ? new Date(articles[articles.length - 1].publishedAt as Date).toISOString()
    : null;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      {/* Header */}
      <section className="bg-gradient-to-b from-cyan-600 to-cyan-800 text-white py-10 sm:py-14">
        <div className="max-w-[1000px] mx-auto px-4">
          <nav className="text-xs sm:text-sm text-cyan-100/90 mb-3 flex items-center gap-2">
            <Link href="/" className="hover:underline">Home</Link>
            <span>/</span>
            <Link href="/news" className="hover:underline">News</Link>
            {filterSlug && (
              <>
                <span>/</span>
                <span className="opacity-90">{filterSlug}</span>
              </>
            )}
          </nav>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">{h1}</h1>
          <p className="mt-4 text-base sm:text-lg text-cyan-50/95 max-w-3xl leading-relaxed">{intro}</p>
        </div>
      </section>

      {/* Filter pills */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-[64px] z-30 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-gray-900/80">
        <div className="max-w-[1000px] mx-auto px-4 py-3">
          <div
            className="flex gap-2 overflow-x-auto no-scrollbar"
            data-testid="news-filter-bar"
          >
            {pills.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className={
                  'flex-shrink-0 px-3.5 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ' +
                  (p.active
                    ? 'bg-cyan-600 text-white border-cyan-600'
                    : 'bg-transparent text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800')
                }
                data-testid={`news-filter-${p.href.split('/').pop() || 'all'}`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Article grid + Sidebar (analog Startseite / Artikelseite):
          Grid ist genau 1000 px breit, viewport-zentriert.
          Content-Column links (~676 px), Sidebar-Column rechts (300 px).
          Cards deshalb max. 2-spaltig, nicht 3, damit sie in ~676 px passen. */}
      <section className="max-w-[1000px] mx-auto px-4 py-8 sm:py-12 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
        <div className="min-w-0">
          {articles.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-600 dark:text-gray-400">Keine News in diesem Filter.</p>
              <Link
                href="/news"
                className="inline-block mt-4 text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Zu allen aktuellen Serien-News →
              </Link>
            </div>
          ) : (
            <>
              <div
                className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2"
                data-testid="news-list"
              >
                {articles.map((a) => (
                  <NewsCard key={a.id} article={a} />
                ))}
              </div>

              {cursor && (
                <NewsLoadMore initialCursor={cursor} filterSlug={filterSlug} />
              )}
            </>
          )}
        </div>
        <ThemePageSidebar />
      </section>
    </main>
  );
}
