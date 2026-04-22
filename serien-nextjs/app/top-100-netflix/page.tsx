/**
 * TOP 100 NETFLIX SERIEN — Pillar Page (nur Netflix, täglich aktualisiert).
 */
import type { Metadata } from 'next';
import { loadTopList } from '@/lib/top-list-loader';
import TopListPage from '@/components/TopListPage';

export const revalidate = 86400;
export const dynamic = 'force-static';

const URL = 'https://serien.de/top-100-netflix';
const TITLE = 'Top 100 Netflix Serien 2026 — tägliches Ranking';
const DESC  = 'Die 100 beliebtesten Netflix-Serien in Deutschland – täglich aktualisiert. Basierend auf echten Leser-Klicks, TMDB-Popularität und redaktioneller Relevanz.';

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
  { q: 'Was sind die aktuell besten Serien auf Netflix?', a: 'Die 100 beliebtesten Netflix-Serien findest du hier im täglich aktualisierten Ranking. Unsere Top-Plätze basieren auf echten Leser-Klicks auf serien.de, TMDB-Popularität und aktueller redaktioneller Relevanz.' },
  { q: 'Wie oft wird das Netflix-Ranking aktualisiert?', a: 'Das Ranking wird automatisch täglich neu berechnet. Die genaue Uhrzeit der letzten Aktualisierung siehst du oben auf der Seite.' },
  { q: 'Sind auch Netflix-Originals dabei?', a: 'Ja, sowohl Netflix-Originals (z.B. Stranger Things, Squid Game, The Witcher) als auch lizenzierte Serien, die aktuell auf Netflix streamen, sind Teil des Rankings.' },
  { q: 'Was ist der Unterschied zum allgemeinen Serien-Ranking?', a: 'Diese Seite filtert ausschließlich nach Netflix-Serien, während das allgemeine Top-100-Serien-Ranking alle Streamer und linearen Sender einschließt.' },
];

export default async function Page() {
  const items = await loadTopList({ limit: 100, networkFilter: ['Netflix'] });
  return (
    <TopListPage
      items={items}
      h1="Top 100 Netflix Serien 2026"
      subline="Die 100 beliebtesten Netflix-Serien in Deutschland — täglich aktualisiert. Bewertet nach echten Leser-Klicks, TMDB-Popularität und Redaktionsrelevanz."
      description={DESC}
      breadcrumbLabel="Top 100 Netflix Serien"
      url={URL}
      updatedAt={new Date()}
      faq={FAQ}
      platformNavEnabled={false}
      topLabel="Die Top 10 Netflix-Serien — Was Deutschland gerade streamt"
      relatedPillars={[
        { label: 'Top 100 Serien (alle Streamer)', href: '/top-100-serien',        subtitle: 'Das große Haupt-Ranking' },
        { label: 'Top 100 Prime Video Serien',     href: '/top-100-amazon-prime',  subtitle: 'Die stärksten Amazon-Serien' },
        { label: 'Top 100 Disney+ Serien',         href: '/top-100-disney-plus',   subtitle: 'Marvel, Star Wars & mehr' },
      ]}
    />
  );
}
