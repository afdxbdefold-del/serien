/**
 * TOP 100 SERIEN — Pillar Page (alle Streamer, täglich aktualisiert).
 * Rendering + Ranking leben geteilt in `lib/top-list-loader.ts` +
 * `components/TopListPage.tsx`, sodass plattformspezifische Varianten
 * (/top-100-netflix etc.) dieselbe Engine nutzen.
 */
import type { Metadata } from 'next';
import { loadTopList } from '@/lib/top-list-loader';
import TopListPage from '@/components/TopListPage';

export const revalidate = 86400; // 24h ISR
export const dynamic = 'force-static';

const URL = 'https://serien.de/top-100-serien';
const TITLE = 'Top 100 Serien 2026 — täglich aktualisiertes Serien-Ranking';
const DESC  = 'Die 100 beliebtesten Serien in Deutschland – täglich aktualisiert. Bewertet nach Klicks, TMDB-Popularität und Redaktionsrelevanz. Mit Filter für Netflix, Prime, Disney+, Apple TV+.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, type: 'website', locale: 'de_DE', siteName: 'serien.de' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
  other: { 'googlebot-news': 'noindex' },
};

const FAQ = [
  { q: 'Wie wird das Top-100-Serien-Ranking berechnet?', a: 'Das Ranking basiert auf einem Hybrid-Score: 60% Leser-Klicks auf serien.de in den letzten 14 Tagen, 30% aktuelle TMDB-Popularität und 10% redaktionelle Relevanz (Artikel-Frequenz in den letzten 30 Tagen).' },
  { q: 'Wie oft wird das Ranking aktualisiert?', a: 'Die Top 100 werden täglich neu berechnet und automatisch veröffentlicht. Die letzte Aktualisierung findest du oben auf der Seite.' },
  { q: 'Welche Streamer werden berücksichtigt?', a: 'Alle relevanten Streaming-Anbieter in Deutschland: Netflix, Prime Video, Disney+, Apple TV+, Paramount+, Sky/WOW, Joyn, ARD-Mediathek, ZDF-Mediathek und mehr.' },
  { q: 'Warum steht Serie X nicht im Ranking?', a: 'Serien benötigen entweder hohe TMDB-Popularität oder kürzliche Artikel auf serien.de, um in den Kandidatenpool aufgenommen zu werden. Sehr alte oder Nischen-Serien ohne aktuelle Berichterstattung können fehlen.' },
];

export default async function Page() {
  const items = await loadTopList({ limit: 100 });
  return (
    <TopListPage
      items={items}
      h1="Top 100 Serien 2026"
      subline="Die 100 beliebtesten Serien in Deutschland — täglich aktualisiert. Bewertet nach echten Leser-Klicks, TMDB-Popularität und redaktioneller Relevanz."
      description={DESC}
      breadcrumbLabel="Top 100 Serien"
      url={URL}
      updatedAt={new Date()}
      faq={FAQ}
      relatedPillars={[
        { label: 'Top 100 Netflix Serien',     href: '/top-100-netflix',      subtitle: 'Nur die besten Netflix-Titel' },
        { label: 'Top 100 Prime Video Serien', href: '/top-100-amazon-prime', subtitle: 'Die stärksten Amazon-Serien' },
        { label: 'Top 100 Disney+ Serien',     href: '/top-100-disney-plus',  subtitle: 'Marvel, Star Wars & Eigenproduktionen' },
      ]}
    />
  );
}
