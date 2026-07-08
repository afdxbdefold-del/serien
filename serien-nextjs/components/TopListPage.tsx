/**
 * TOP LIST PAGE — shared renderer for Pillar Pages.
 *
 * All visual structure (hero, sticky platform nav, top 10 grid, 11–30
 * cards, 31–N rows, FAQ) lives here so each Pillar route is ~30 lines of
 * config.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { RankedSeries } from '@/lib/top-list-loader';

interface FaqItem {
  q: string;
  a: string;
}

export interface TopListPageProps {
  items: RankedSeries[];
  h1: string;
  subline: string;                    // subheading below H1
  description: string;                // meta + card description
  breadcrumbLabel: string;            // e.g. "Top 100 Serien"
  url: string;                        // canonical URL (for schema)
  updatedAt: Date;
  faq: FaqItem[];
  platformNavEnabled?: boolean;       // hide for plattform-specific pillars
  topLabel?: string;                  // heading for the top-10 block
  relatedPillars?: Array<{ label: string; href: string; subtitle?: string }>;
}

function posterSrc(it: RankedSeries): string | null {
  if (it.posterLocalUrl) return it.posterLocalUrl;
  if (it.posterPath) return `/img/tmdb/w342${it.posterPath}`;
  return null;
}

export default function TopListPage({
  items,
  h1,
  subline,
  description,
  breadcrumbLabel,
  url,
  updatedAt,
  faq,
  platformNavEnabled = true,
  topLabel = 'Die Top 10 — Was Deutschland gerade schaut',
  relatedPillars,
}: TopListPageProps) {
  const platformCounts: Record<string, number> = {};
  for (const it of items) platformCounts[it.platformTag] = (platformCounts[it.platformTag] || 0) + 1;
  const platforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const hero = items.slice(0, 10);
  const grid = items.slice(10, 30);
  const list = items.slice(30);

  const schemaItemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    name: h1,
    description,
    numberOfItems: items.length,
    dateModified: updatedAt.toISOString(),
    url,
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
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <main className="min-h-screen bg-slate-50" data-testid="top-list-pillar">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaItemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFaq) }} />

      <header className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white border-b border-slate-800">
        <div className="max-w-[1000px] mx-auto px-6 py-14">
          <nav className="text-xs text-slate-400 mb-6">
            <Link href="/" className="hover:text-slate-200">Startseite</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-200">{breadcrumbLabel}</span>
          </nav>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">{h1}</h1>
          <p className="text-lg text-slate-300 max-w-3xl">{subline}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="rounded-full bg-slate-800 px-3 py-1">
              🕒 Zuletzt aktualisiert: {updatedAt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'long', timeStyle: 'short' })}
            </span>
            <span className="rounded-full bg-slate-800 px-3 py-1">📺 {items.length} Serien</span>
            <span className="rounded-full bg-slate-800 px-3 py-1">⚡ Hybrid-Score: 60/30/10</span>
          </div>
        </div>
      </header>

      {platformNavEnabled && platforms.length > 0 && (
        <section className="bg-white border-b border-slate-200 sticky top-0 z-10 backdrop-blur" data-testid="platform-nav">
          <div className="max-w-[1000px] mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Streamer:</span>
            {platforms.map(([p, n]) => (
              <span
                key={p}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 whitespace-nowrap"
                data-testid={`platform-chip-${p.toLowerCase().replace(/\W+/g, '-')}`}
              >
                {p} <span className="text-slate-400">({n})</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="max-w-[1000px] mx-auto px-6 py-10 space-y-16">
        <section aria-labelledby="heading-top10" data-testid="top10-section">
          <h2 id="heading-top10" className="text-2xl font-bold text-slate-900 mb-6">{topLabel}</h2>
          <ol className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {hero.map((it) => <HeroCard key={it.tmdbId} item={it} />)}
          </ol>
        </section>

        {grid.length > 0 && (
          <section aria-labelledby="heading-11-30" data-testid="ranks-11-30-section">
            <h2 id="heading-11-30" className="text-xl font-bold text-slate-900 mb-6">Platz 11 – {10 + grid.length}</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {grid.map((it) => <CompactCard key={it.tmdbId} item={it} />)}
            </ul>
          </section>
        )}

        {list.length > 0 && (
          <section aria-labelledby="heading-31-n" data-testid="ranks-31-n-section">
            <h2 id="heading-31-n" className="text-xl font-bold text-slate-900 mb-6">Platz 31 – {30 + list.length}</h2>
            <ol className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white overflow-hidden">
              {list.map((it) => <RowItem key={it.tmdbId} item={it} />)}
            </ol>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-8" data-testid="faq-section">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Häufige Fragen</h2>
          <dl className="space-y-6">
            {faq.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold text-slate-900 mb-1">{f.q}</dt>
                <dd className="text-slate-700 leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {relatedPillars && relatedPillars.length > 0 && (
          <section data-testid="related-pillars">
            <h2 className="text-xl font-bold text-slate-900 mb-5">Weitere Rankings</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedPillars.map((rp) => (
                <li key={rp.href}>
                  <Link
                    href={rp.href}
                    data-testid={`related-pillar-${rp.href.replace(/[^a-z0-9]+/gi, '-')}`}
                    className="block rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-400 hover:shadow transition"
                  >
                    <div className="text-sm font-semibold text-slate-900">{rp.label}</div>
                    {rp.subtitle && <div className="text-xs text-slate-500 mt-1">{rp.subtitle}</div>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="text-center text-xs text-slate-500">
          Ranking-Daten basieren auf serien.de Nutzungsdaten und{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="nofollow noopener" className="underline">TMDB</a>.
          Nächste Aktualisierung: morgen früh. Kein Warten auf Wochen-Charts.
        </footer>
      </div>
    </main>
  );
}

function HeroCard({ item }: { item: RankedSeries }) {
  const src = posterSrc(item);
  return (
    <li className="group relative" data-testid={`hero-card-rank-${item.rank}`}>
      <Link href={`/serie/${item.slug}`} className="block rounded-xl overflow-hidden bg-slate-200 shadow-sm hover:shadow-lg transition-shadow relative aspect-[2/3]">
        {src ? (
          <Image src={src} alt={item.title} fill sizes="(min-width: 1024px) 200px, 50vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Kein Bild</div>
        )}
        <span className="absolute top-2 left-2 rounded-full bg-amber-500 text-white text-xs font-bold px-2 py-0.5 shadow">#{item.rank}</span>
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
        {src ? <Image src={src} alt={item.title} fill sizes="80px" className="object-cover" /> : null}
      </Link>
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs text-amber-600">#{item.rank}</span>
          <Link href={`/serie/${item.slug}`} className="text-sm font-semibold text-slate-900 hover:underline line-clamp-1">{item.title}</Link>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{item.platformTag}{item.firstAirDate ? ` · ${item.firstAirDate.getFullYear()}` : ''}</p>
        {item.genres.length > 0 && <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{item.genres.join(' · ')}</p>}
      </div>
    </li>
  );
}

function RowItem({ item }: { item: RankedSeries }) {
  return (
    <li className="flex items-baseline gap-4 px-4 py-3 hover:bg-slate-50" data-testid={`row-rank-${item.rank}`}>
      <span className="font-mono text-sm text-slate-400 w-10 flex-none">#{item.rank}</span>
      <div className="flex-1 min-w-0">
        <Link href={`/serie/${item.slug}`} className="text-sm font-medium text-slate-900 hover:underline">{item.title}</Link>
        <span className="ml-2 text-xs text-slate-500">{item.platformTag}{item.firstAirDate ? ` · ${item.firstAirDate.getFullYear()}` : ''}</span>
      </div>
      {item.voteAverage ? <span className="text-xs font-mono text-slate-500 whitespace-nowrap">★ {item.voteAverage.toFixed(1)}</span> : null}
    </li>
  );
}
