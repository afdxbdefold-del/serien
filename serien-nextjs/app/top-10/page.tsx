/**
 * TOP 10 STREAMING SERIEN — Pillar Page
 *
 * URL: /top-10
 *
 * Aggregates the daily Top-10 rankings from all 6 major streaming platforms
 * in Germany into one sharable, SEO-friendly landing page. Data comes from
 * our `streamer_rankings` table (populated by the FlixPatrol cron).
 *
 * Evergreen SEO target: "Top 10 Serien Deutschland", "beliebteste Serien",
 * "was gucken Netflix", "meistgesehene Serien jetzt".
 *
 * Design:
 *   - Hero + anchor nav per platform
 *   - Per platform: #1 hero card with backdrop · #2–10 poster strip · delta pills
 *   - ItemList JSON-LD per platform for rich results
 *   - FAQ at bottom
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { TrendingUp, Calendar } from 'lucide-react';
import { getCurrentTop10, type RankedSeries } from '@/lib/ranking-queries';
import type { FlixpatrolPlatform } from '@/lib/flixpatrol-scraper';
import { formatDateDE } from '@/lib/format-date';

export const revalidate = 1800; // 30 min — cron refills once a day
export const dynamic = 'force-static';

const URL = 'https://serien.de/top-10';
const TITLE = 'Top 10 Serien in Deutschland — Streaming-Rankings, täglich aktualisiert';
const DESC =
  'Die meistgesehenen Serien auf HBO Max, Netflix, Disney+, Prime Video, Apple TV+ und Paramount+ in Deutschland. Tägliches Ranking direkt von den Plattformen.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, type: 'website', locale: 'de_DE', siteName: 'serien.de' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
  other: { 'googlebot-news': 'noindex' },
};

/**
 * All platforms rendered on the page. `accentClass` drives the per-platform
 * accent color for the hero card. `brandBg` is the card-fill when we need
 * a solid logo background.
 */
const PLATFORMS: Array<{
  id: FlixpatrolPlatform;
  label: string;
  anchor: string;
  accentClass: string;
  brandHex: string;
  tagline: string;
}> = [
  { id: 'netflix',     label: 'Netflix',     anchor: 'netflix',      accentClass: 'from-red-600 to-red-700',           brandHex: '#E50914', tagline: 'Die Top 10 auf Netflix Deutschland' },
  { id: 'hbo-max',     label: 'HBO Max',     anchor: 'hbo-max',      accentClass: 'from-purple-600 to-indigo-700',     brandHex: '#6D28D9', tagline: 'Die Top 10 auf HBO Max Deutschland' },
  { id: 'disney-plus', label: 'Disney+',     anchor: 'disney-plus',  accentClass: 'from-blue-700 to-blue-900',         brandHex: '#113CCF', tagline: 'Die Top 10 auf Disney+ Deutschland' },
  { id: 'prime-video', label: 'Prime Video', anchor: 'prime-video',  accentClass: 'from-sky-500 to-cyan-600',          brandHex: '#00A8E1', tagline: 'Die Top 10 auf Amazon Prime Video' },
  { id: 'apple-tv',    label: 'Apple TV+',   anchor: 'apple-tv',     accentClass: 'from-gray-800 to-black',            brandHex: '#111827', tagline: 'Die Top 10 auf Apple TV+ Deutschland' },
  { id: 'paramount',   label: 'Paramount+',  anchor: 'paramount',    accentClass: 'from-blue-500 to-sky-700',          brandHex: '#0064FF', tagline: 'Die Top 10 auf Paramount+ Deutschland' },
];

function toAbsolutePoster(p: string | null): string | null {
  if (!p) return null;
  if (p.startsWith('http')) return p;
  return `https://image.tmdb.org/t/p/w500${p.startsWith('/') ? '' : '/'}${p}`;
}
function toAbsoluteBackdrop(p: string | null): string | null {
  if (!p) return null;
  if (p.startsWith('http')) return p;
  return `https://image.tmdb.org/t/p/w1280${p.startsWith('/') ? '' : '/'}${p}`;
}

function itemListLdJson(platformLabel: string, items: RankedSeries[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Top 10 ${platformLabel} Deutschland`,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: items.length,
    itemListElement: items.map((it) => ({
      '@type': 'ListItem',
      position: it.rank,
      item: {
        '@type': 'TVSeries',
        name: it.title,
        url: it.slug ? `https://serien.de/serie/${it.slug}` : URL,
      },
    })),
  });
}

function DeltaPill({ rank, previousRank }: { rank: number; previousRank: number | null }) {
  if (previousRank == null) {
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-400/90 text-black">NEU</span>;
  }
  const delta = previousRank - rank;
  if (delta === 0) return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-500/80 text-white">—</span>;
  const up = delta > 0;
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
        up ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'
      }`}
      title={`Vor 7 Tagen: Platz ${previousRank}`}
    >
      {up ? '▲' : '▼'} {Math.abs(delta)}
    </span>
  );
}

function PosterCard({ item, platformId }: { item: RankedSeries; platformId: string }) {
  const img = toAbsolutePoster(item.posterPath);
  const href = item.slug ? `/serie/${item.slug}` : undefined;
  const Wrapper: any = href ? Link : 'div';
  return (
    <Wrapper
      {...(href ? { href } : {})}
      data-testid={`top10page-${platformId}-rank-${item.rank}`}
      className="group relative block overflow-hidden rounded-xl bg-gray-900 aspect-[2/3] shadow-md hover:shadow-xl transition-shadow"
    >
      {img ? (
        <Image src={img} alt={item.title} fill sizes="(max-width:640px) 50vw, 20vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900" />
      )}
      <div className="absolute top-0 left-0 bg-gradient-to-br from-amber-400 to-amber-600 text-black font-black text-xl leading-none px-2.5 py-1.5 rounded-br-xl shadow-lg">
        {item.rank}
      </div>
      <div className="absolute top-1.5 right-1.5">
        <DeltaPill rank={item.rank} previousRank={item.previousRank} />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3">
        <div className="text-white text-sm font-semibold line-clamp-2 leading-tight">{item.title}</div>
      </div>
    </Wrapper>
  );
}

function HeroOneCard({ item, accentClass }: { item: RankedSeries; accentClass: string }) {
  const backdrop = toAbsoluteBackdrop(item.backdropPath) || toAbsolutePoster(item.posterPath);
  const href = item.slug ? `/serie/${item.slug}` : undefined;
  const Wrapper: any = href ? Link : 'div';
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className="group relative block overflow-hidden rounded-2xl shadow-xl aspect-[16/9] sm:aspect-[21/9]"
    >
      {backdrop ? (
        <Image src={backdrop} alt={item.title} fill priority sizes="(max-width:768px) 100vw, 66vw" className="object-cover group-hover:scale-[1.02] transition-transform duration-700" />
      ) : (
        <div className={`w-full h-full bg-gradient-to-br ${accentClass}`} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/10" />

      <div className="absolute top-4 left-4 flex items-center gap-2">
        <div className={`bg-gradient-to-br ${accentClass} text-white font-black text-2xl leading-none px-3.5 py-2 rounded-xl shadow-lg`}>
          #1
        </div>
        <DeltaPill rank={item.rank} previousRank={item.previousRank} />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
        <div className="text-xs sm:text-sm uppercase tracking-widest text-white/70 font-semibold mb-2">Nummer 1 heute</div>
        <h3 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-lg line-clamp-2">
          {item.title}
        </h3>
      </div>
    </Wrapper>
  );
}

async function PlatformSection({ p }: { p: (typeof PLATFORMS)[number] }) {
  const items = await getCurrentTop10(p.id, 'germany', 'tv');
  if (items.length === 0) return null;

  const [first, ...rest] = items;

  return (
    <section id={p.anchor} className="scroll-mt-24" aria-labelledby={`h2-${p.anchor}`} data-testid={`top10page-section-${p.id}`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase mb-1" style={{ color: p.brandHex }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.brandHex }} />
            {p.label}
          </div>
          <h2 id={`h2-${p.anchor}`} className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {p.tagline}
          </h2>
        </div>
        <Link
          href={`/${p.id === 'prime-video' ? 'prime-video-serien' : p.id === 'hbo-max' ? 'hbo-serien' : p.id === 'disney-plus' ? 'disney-plus-serien' : p.id === 'apple-tv' ? 'apple-tv-serien' : p.id === 'paramount' ? 'paramount-serien' : 'netflix-serien'}`}
          className="self-start sm:self-auto text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
        >
          Zum {p.label}-Hub →
        </Link>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListLdJson(p.label, items) }} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <HeroOneCard item={first} accentClass={p.accentClass} />
        </div>
        {/* Desktop only: positions 2-5 in side column */}
        <div className="hidden lg:grid grid-cols-2 gap-3">
          {rest.slice(0, 4).map((it) => (
            <PosterCard key={it.rank} item={it} platformId={p.id} />
          ))}
        </div>
      </div>

      {/* Mobile/Tablet: positions 2-10 (9 items, 3x3) — Desktop: only 6-10 (1x5) */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
        {rest.slice(0, 4).map((it) => (
          <div key={`mobile-${it.rank}`} className="lg:hidden">
            <PosterCard item={it} platformId={p.id} />
          </div>
        ))}
        {rest.slice(4).map((it) => (
          <PosterCard key={it.rank} item={it} platformId={p.id} />
        ))}
      </div>
    </section>
  );
}

export default async function Top10Page() {
  // Pre-fetch in parallel so per-platform sections can render off cached data
  const blocks = await Promise.all(
    PLATFORMS.map(async (p) => ({ p, items: await getCurrentTop10(p.id, 'germany', 'tv') })),
  );
  const populated = blocks.filter((b) => b.items.length > 0);
  const today = populated[0]?.items[0]
    ? new Date()
    : null;
  const todayLabel = today ? formatDateDE(today, { day: '2-digit', month: 'long', year: 'numeric' }) : '';

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white dark:from-[hsl(230,25%,5%)] dark:via-[hsl(230,25%,7%)] dark:to-[hsl(230,25%,5%)]" data-testid="top10-page">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gray-200 dark:border-gray-800">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-amber-500/10" />
        <div className="relative max-w-7xl mx-auto px-6 md:px-12 py-14 sm:py-20">
          <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded-full px-3 py-1 text-xs font-bold tracking-widest uppercase mb-5">
            <TrendingUp className="w-3.5 h-3.5" />
            Tägliches Ranking
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tight mb-5 leading-[1.05]">
            Top 10 Serien<br className="hidden sm:block" /> in Deutschland
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl leading-relaxed">
            Die meistgesehenen Serien auf Netflix, HBO Max, Disney+, Prime Video, Apple TV+ und Paramount+ — direkt von den Plattformen, jeden Tag neu.
          </p>
          {todayLabel && (
            <div className="mt-5 inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Calendar className="w-4 h-4" />
              Stand: {todayLabel}
            </div>
          )}

          {/* Anchor nav */}
          <nav className="mt-8 flex flex-wrap gap-2" aria-label="Plattform-Navigation">
            {populated.map(({ p }) => (
              <a
                key={p.id}
                href={`#${p.anchor}`}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-cyan-500 dark:hover:border-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                data-testid={`top10-nav-${p.id}`}
              >
                {p.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* Platform sections */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 space-y-16">
        {populated.map(({ p }) => (
          <PlatformSection key={p.id} p={p} />
        ))}
      </div>

      {/* FAQ */}
      <section className="bg-gray-50 dark:bg-[hsl(230,25%,7%)] border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-8">Häufige Fragen</h2>
          <dl className="space-y-6">
            {[
              { q: 'Woher kommen die Top-10-Daten?', a: 'Wir ziehen jeden Tag die offiziellen Plattform-Rankings und spiegeln sie für Deutschland. Die Reihenfolge entspricht dem, was Nutzerinnen und Nutzer auf HBO Max, Netflix, Disney+, Prime Video, Apple TV+ und Paramount+ tatsächlich schauen.' },
              { q: 'Wie oft wird die Liste aktualisiert?', a: 'Automatisch einmal täglich, typischerweise am frühen Morgen.' },
              { q: 'Was bedeuten die Pfeile neben der Platzierung?', a: 'Ein grüner ▲-Pfeil zeigt an, dass die Serie seit vor sieben Tagen aufgestiegen ist, ein roter ▼ zeigt einen Abstieg, ein "—" bedeutet unverändert, "NEU" ist ein Neueinstieg.' },
              { q: 'Warum fehlt manchmal ein Poster?', a: 'Neue oder wenig bekannte Serien sind noch nicht vollständig in unserer TMDB-Datenbank — wir ergänzen Bilder automatisch, sobald sie verfügbar sind.' },
            ].map((f, i) => (
              <div key={i}>
                <dt className="font-semibold text-gray-900 dark:text-white mb-1">{f.q}</dt>
                <dd className="text-gray-600 dark:text-gray-300 leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: [
                  { '@type': 'Question', name: 'Woher kommen die Top-10-Daten?', acceptedAnswer: { '@type': 'Answer', text: 'Wir ziehen jeden Tag die offiziellen Plattform-Rankings und spiegeln sie für Deutschland.' } },
                  { '@type': 'Question', name: 'Wie oft wird die Liste aktualisiert?', acceptedAnswer: { '@type': 'Answer', text: 'Automatisch einmal täglich, typischerweise am frühen Morgen.' } },
                ],
              }),
            }}
          />
        </div>
      </section>
    </main>
  );
}
