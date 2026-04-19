/**
 * TOP 100 SERIEN — Daily-Refreshed Pillar Page
 *
 * SEO-Ziel: Ranking-Hub für generische „Beste Serien / Top Serien" Queries,
 * interne Link-Equity an alle Serien-Detailseiten verteilen, tägliche
 * Aktualität für Google-Discover-Signale.
 *
 * Ranking-Algorithmus (Hybrid-Score):
 *   pageviews_14d  × 0.60  (echtes Publikumsinteresse)
 *   popularity     × 0.30  (TMDB-Trend)
 *   recent_articles× 0.10  (redaktionelle Relevanz)
 *
 * Revalidate: 86400 s (24h) via Next.js ISR — Page wird einmal pro Tag
 * statisch neu gebaut, darauf schnell ausgeliefert.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import prisma from '@/lib/prisma';

export const revalidate = 86400; // 24h
export const dynamic = 'force-static';

// ══════════════════════════════════════════════════════════════════════
// META
// ══════════════════════════════════════════════════════════════════════
const PILLAR_URL = 'https://serien.de/top-100-serien';
const PILLAR_TITLE = 'Top 100 Serien 2026 — täglich aktualisiertes Serien-Ranking';
const PILLAR_DESC =
  'Die 100 beliebtesten Serien in Deutschland – täglich aktualisiert. Bewertet nach Klicks, TMDB-Popularität und Redaktionsrelevanz. Mit Filter für Netflix, Prime, Disney+, Apple TV+.';

export const metadata: Metadata = {
  title: PILLAR_TITLE,
  description: PILLAR_DESC,
  alternates: { canonical: PILLAR_URL },
  openGraph: {
    title: PILLAR_TITLE,
    description: PILLAR_DESC,
    url: PILLAR_URL,
    type: 'website',
    locale: 'de_DE',
    siteName: 'serien.de',
  },
  twitter: {
    card: 'summary_large_image',
    title: PILLAR_TITLE,
    description: PILLAR_DESC,
  },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

// ══════════════════════════════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════════════════════════════
interface RankedSeries {
  rank: number;
  tmdbId: number;
  slug: string;
  title: string;
  overview: string | null;
  posterPath: string | null;
  posterLocalUrl: string | null;
  genres: string[];
  networks: string[];
  voteAverage: number | null;
  firstAirDate: Date | null;
  views14d: number;
  articles30d: number;
  popularity: number;
  hybridScore: number;
  platformTag: string; // primary streamer for quick-filter
}

function primaryPlatform(networks: string[]): string {
  const priority = ['Netflix', 'Amazon Prime Video', 'Prime Video', 'Apple TV+', 'Disney+', 'Disney Plus', 'Hulu', 'HBO', 'Max', 'HBO Max', 'Paramount+', 'Peacock', 'ARD', 'ZDF', 'Sky'];
  for (const p of priority) if (networks.some((n) => n.toLowerCase() === p.toLowerCase())) return p;
  return networks[0] || 'TV';
}

async function loadTop100(): Promise<RankedSeries[]> {
  const since14d = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  // 1) Candidate pool: all series that have either (a) been viewed in 14d
  //    (b) have ≥ 5 popularity, or (c) have articles in last 30d.
  //    This keeps the query bounded — full table scan would be 500+ series.
  const candidates = await prisma.series.findMany({
    where: {
      OR: [
        { popularity: { gte: 5 } },
        { article_series: { some: { articles: { publishedAt: { gte: since30d }, status: 'published' } } } },
      ],
    },
    select: {
      tmdbId: true, slug: true, title: true, name: true, overview: true,
      posterPath: true, posterLocalUrl: true, genres: true, networks: true,
      popularity: true, voteAverage: true, firstAirDate: true,
      article_series: {
        where: { articles: { publishedAt: { gte: since30d }, status: 'published' } },
        select: { articleId: true },
      },
    },
  });

  if (candidates.length === 0) return [];

  const tmdbIds = candidates.map((s) => s.tmdbId);

  // 2) Pageviews per series in last 14d — join via article_series → analytics_events
  const articleIds = (
    await prisma.article_series.findMany({
      where: { seriesId: { in: tmdbIds } },
      select: { articleId: true, seriesId: true },
    })
  );
  const articleToSeries = new Map<string, number[]>();
  for (const r of articleIds) {
    if (!articleToSeries.has(r.articleId)) articleToSeries.set(r.articleId, []);
    articleToSeries.get(r.articleId)!.push(r.seriesId);
  }

  const views = articleIds.length
    ? await prisma.analytics_events.groupBy({
        by: ['articleId'],
        where: {
          articleId: { in: articleIds.map((a) => a.articleId) },
          event: 'pageview',
          createdAt: { gte: since14d },
        },
        _count: { _all: true },
      })
    : [];

  const seriesViews = new Map<number, number>();
  for (const v of views) {
    const seriesIds = articleToSeries.get(v.articleId || '') || [];
    // Split evenly if article mentions multiple series
    const share = seriesIds.length > 0 ? v._count._all / seriesIds.length : 0;
    for (const sid of seriesIds) seriesViews.set(sid, (seriesViews.get(sid) || 0) + share);
  }

  // 3) Compute hybrid score
  const maxViews      = Math.max(1, ...Array.from(seriesViews.values()));
  const maxPopularity = Math.max(1, ...candidates.map((s) => s.popularity || 0));
  const maxArticles   = Math.max(1, ...candidates.map((s) => s.article_series.length));

  const scored = candidates.map((s) => {
    const v = seriesViews.get(s.tmdbId) || 0;
    const p = s.popularity || 0;
    const a = s.article_series.length;
    const hybrid =
      (v / maxViews) * 60 +
      (p / maxPopularity) * 30 +
      (a / maxArticles) * 10;
    return {
      tmdbId: s.tmdbId,
      slug: s.slug,
      title: s.title || s.name || 'Unbekannt',
      overview: s.overview,
      posterPath: s.posterPath,
      posterLocalUrl: s.posterLocalUrl,
      genres: (s.genres || []).slice(0, 3),
      networks: s.networks || [],
      voteAverage: s.voteAverage,
      firstAirDate: s.firstAirDate,
      views14d: Math.round(v),
      articles30d: a,
      popularity: p,
      hybridScore: Number(hybrid.toFixed(2)),
      platformTag: primaryPlatform(s.networks || []),
    };
  });

  scored.sort((a, b) => b.hybridScore - a.hybridScore);
  const top100 = scored.slice(0, 100).map((s, i) => ({ ...s, rank: i + 1 }));
  return top100;
}

// ══════════════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════════════
export default async function Top100SerienPage() {
  const items = await loadTop100();
  const updatedAt = new Date();
  const platformCounts: Record<string, number> = {};
  for (const it of items) platformCounts[it.platformTag] = (platformCounts[it.platformTag] || 0) + 1;
  const platforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const hero = items.slice(0, 10);
  const grid = items.slice(10, 30);
  const list = items.slice(30);

  // Schema.org ItemList for rich SERPs
  const schemaItemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    name: 'Top 100 Serien 2026',
    description: PILLAR_DESC,
    numberOfItems: items.length,
    dateModified: updatedAt.toISOString(),
    itemListElement: items.slice(0, 50).map((it) => ({
      '@type': 'ListItem',
      position: it.rank,
      url: `https://serien.de/serie/${it.slug}`,
      name: it.title,
      ...(it.posterPath ? { image: `https://image.tmdb.org/t/p/w500${it.posterPath}` } : {}),
    })),
  };

  const schemaFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Wie wird das Top-100-Serien-Ranking berechnet?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Das Ranking basiert auf einem Hybrid-Score: 60% Leser-Klicks auf serien.de in den letzten 14 Tagen, 30% aktuelle TMDB-Popularität und 10% redaktionelle Relevanz (Artikel-Frequenz in den letzten 30 Tagen).',
        },
      },
      {
        '@type': 'Question',
        name: 'Wie oft wird das Ranking aktualisiert?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Die Top 100 werden täglich neu berechnet und automatisch veröffentlicht. Die letzte Aktualisierung findest du oben auf der Seite.',
        },
      },
      {
        '@type': 'Question',
        name: 'Welche Streamer werden berücksichtigt?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Alle relevanten Streaming-Anbieter in Deutschland: Netflix, Prime Video, Disney+, Apple TV+, Paramount+, Sky/WOW, Joyn, ARD-Mediathek, ZDF-Mediathek und mehr.',
        },
      },
      {
        '@type': 'Question',
        name: 'Warum steht Serie X nicht im Ranking?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Serien benötigen entweder hohe TMDB-Popularität oder kürzliche Artikel auf serien.de, um in den Kandidatenpool aufgenommen zu werden. Sehr alte oder Nischen-Serien ohne aktuelle Berichterstattung können fehlen.',
        },
      },
    ],
  };

  return (
    <main className="min-h-screen bg-slate-50" data-testid="top-100-pillar">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaItemList) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFaq) }}
      />

      {/* HERO */}
      <header className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <nav className="text-xs text-slate-400 mb-6">
            <Link href="/" className="hover:text-slate-200">Startseite</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-200">Top 100 Serien</span>
          </nav>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            Top 100 Serien 2026
          </h1>
          <p className="text-lg text-slate-300 max-w-3xl">
            Die 100 beliebtesten Serien in Deutschland — <strong className="text-white">täglich aktualisiert</strong>.
            Bewertet nach echten Leser-Klicks, TMDB-Popularität und redaktioneller Relevanz.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="rounded-full bg-slate-800 px-3 py-1">
              🕒 Zuletzt aktualisiert: {updatedAt.toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' })}
            </span>
            <span className="rounded-full bg-slate-800 px-3 py-1">📺 {items.length} Serien</span>
            <span className="rounded-full bg-slate-800 px-3 py-1">⚡ Hybrid-Score: 60/30/10</span>
          </div>
        </div>
      </header>

      {/* PLATFORM QUICK-NAV */}
      {platforms.length > 0 && (
        <section className="bg-white border-b border-slate-200 sticky top-0 z-10 backdrop-blur" data-testid="platform-nav">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Streamer:</span>
            {platforms.map(([p, n]) => (
              <a
                key={p}
                href={`#platform-${p.toLowerCase().replace(/\W+/g, '-')}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                data-testid={`platform-chip-${p.toLowerCase().replace(/\W+/g, '-')}`}
              >
                {p} <span className="text-slate-400">({n})</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-16">
        {/* TOP 10 HERO GRID */}
        <section aria-labelledby="heading-top10" data-testid="top10-section">
          <h2 id="heading-top10" className="text-2xl font-bold text-slate-900 mb-6">
            Die Top 10 — Was Deutschland gerade schaut
          </h2>
          <ol className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {hero.map((it) => (
              <HeroCard key={it.tmdbId} item={it} />
            ))}
          </ol>
        </section>

        {/* PLATZ 11–30 GRID */}
        {grid.length > 0 && (
          <section aria-labelledby="heading-11-30" data-testid="ranks-11-30-section">
            <h2 id="heading-11-30" className="text-xl font-bold text-slate-900 mb-6">
              Platz 11 – 30
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {grid.map((it) => (
                <CompactCard key={it.tmdbId} item={it} />
              ))}
            </ul>
          </section>
        )}

        {/* PLATZ 31–100 LIST */}
        {list.length > 0 && (
          <section aria-labelledby="heading-31-100" data-testid="ranks-31-100-section">
            <h2 id="heading-31-100" className="text-xl font-bold text-slate-900 mb-6">
              Platz 31 – 100
            </h2>
            <ol className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden">
              {list.map((it) => (
                <RowItem key={it.tmdbId} item={it} />
              ))}
            </ol>
          </section>
        )}

        {/* FAQ */}
        <section className="rounded-2xl border border-slate-200 bg-white p-8" data-testid="faq-section">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Häufige Fragen</h2>
          <dl className="space-y-6">
            {schemaFaq.mainEntity.map((q) => (
              <div key={q.name}>
                <dt className="font-semibold text-slate-900 mb-1">{q.name}</dt>
                <dd className="text-slate-700 leading-relaxed">{q.acceptedAnswer.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Legacy & credits */}
        <footer className="text-center text-xs text-slate-500">
          Ranking-Daten basieren auf serien.de Nutzungsdaten und{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="nofollow noopener" className="underline">TMDB</a>.
          Nächste Aktualisierung: morgen früh. Kein Warten auf Wochen-Charts.
        </footer>
      </div>
    </main>
  );
}

// ══════════════════════════════════════════════════════════════════════
// CARD COMPONENTS
// ══════════════════════════════════════════════════════════════════════
function posterSrc(it: RankedSeries): string | null {
  if (it.posterLocalUrl) return it.posterLocalUrl;
  if (it.posterPath) return `/img/tmdb/w342${it.posterPath}`;
  return null;
}

function HeroCard({ item }: { item: RankedSeries }) {
  const src = posterSrc(item);
  return (
    <li className="group relative" data-testid={`hero-card-rank-${item.rank}`}>
      <Link
        href={`/serie/${item.slug}`}
        className="block rounded-xl overflow-hidden bg-slate-200 shadow-sm hover:shadow-lg transition-shadow relative aspect-[2/3]"
      >
        {src ? (
          <Image src={src} alt={item.title} fill sizes="(min-width: 1024px) 200px, 50vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Kein Bild</div>
        )}
        <span className="absolute top-2 left-2 rounded-full bg-amber-500 text-white text-xs font-bold px-2 py-0.5 shadow">
          #{item.rank}
        </span>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 text-white">
          <h3 className="text-sm font-semibold line-clamp-1">{item.title}</h3>
          <p className="text-[11px] text-slate-300 line-clamp-1">{item.platformTag}{item.firstAirDate ? ` · ${item.firstAirDate.getFullYear()}` : ''}</p>
        </div>
      </Link>
    </li>
  );
}

function CompactCard({ item }: { item: RankedSeries }) {
  const src = posterSrc(item);
  return (
    <li className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:shadow transition-shadow" data-testid={`compact-card-rank-${item.rank}`}>
      <Link href={`/serie/${item.slug}`} className="relative w-20 aspect-[2/3] flex-none rounded-md overflow-hidden bg-slate-200">
        {src ? (
          <Image src={src} alt={item.title} fill sizes="80px" className="object-cover" />
        ) : null}
      </Link>
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs text-amber-600">#{item.rank}</span>
          <Link href={`/serie/${item.slug}`} className="text-sm font-semibold text-slate-900 hover:underline line-clamp-1">
            {item.title}
          </Link>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {item.platformTag}{item.firstAirDate ? ` · ${item.firstAirDate.getFullYear()}` : ''}
        </p>
        {item.genres.length > 0 && (
          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{item.genres.join(' · ')}</p>
        )}
      </div>
    </li>
  );
}

function RowItem({ item }: { item: RankedSeries }) {
  return (
    <li className="flex items-baseline gap-4 px-4 py-3 hover:bg-slate-50" data-testid={`row-rank-${item.rank}`}>
      <span className="font-mono text-sm text-slate-400 w-10 flex-none">#{item.rank}</span>
      <div className="flex-1 min-w-0">
        <Link href={`/serie/${item.slug}`} className="text-sm font-medium text-slate-900 hover:underline">
          {item.title}
        </Link>
        <span className="ml-2 text-xs text-slate-500">
          {item.platformTag}{item.firstAirDate ? ` · ${item.firstAirDate.getFullYear()}` : ''}
        </span>
      </div>
      {item.voteAverage ? (
        <span className="text-xs font-mono text-slate-500 whitespace-nowrap">★ {item.voteAverage.toFixed(1)}</span>
      ) : null}
    </li>
  );
}
