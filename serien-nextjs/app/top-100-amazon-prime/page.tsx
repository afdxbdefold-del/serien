/**
 * TOP 100 PRIME VIDEO SERIEN — Pillar Page (nur Amazon Prime, täglich aktualisiert).
 */
import type { Metadata } from 'next';
import { loadTopList } from '@/lib/top-list-loader';
import TopListPage from '@/components/TopListPage';

export const revalidate = 86400;
export const dynamic = 'force-static';

const URL = 'https://serien.de/top-100-amazon-prime';
const TITLE = 'Top 100 Prime Video Serien 2026 — tägliches Ranking';
const DESC  = 'Die 100 beliebtesten Serien auf Amazon Prime Video – täglich aktualisiert. Basierend auf Leser-Klicks, TMDB-Popularität und redaktioneller Relevanz.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, type: 'website', locale: 'de_DE', siteName: 'serien.de' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

const FAQ = [
  { q: 'Was sind die besten Serien auf Amazon Prime Video?', a: 'Im täglich aktualisierten Ranking findest du die 100 aktuell beliebtesten Serien auf Prime Video — basierend auf echten Leser-Klicks auf serien.de, TMDB-Popularität und redaktioneller Relevanz.' },
  { q: 'Wie oft wird das Prime-Video-Ranking aktualisiert?', a: 'Das Ranking wird automatisch täglich neu berechnet. Die Uhrzeit der letzten Aktualisierung siehst du oben auf der Seite.' },
  { q: 'Sind Amazon Originals eingerechnet?', a: 'Ja, sowohl Amazon Originals (z.B. The Boys, Fallout, The Marvelous Mrs. Maisel, Reacher) als auch lizenzierte Serien auf Prime Video sind Teil des Rankings.' },
  { q: 'Was kostet Amazon Prime Video?', a: 'Prime Video ist im Amazon-Prime-Abonnement enthalten (ab 8,99 €/Monat). Ein reines Prime-Video-Abo kostet weniger, enthält aber keine Versand- und sonstigen Prime-Vorteile.' },
];

export default async function Page() {
  const items = await loadTopList({
    limit: 100,
    networkFilter: ['Amazon Prime Video', 'Prime Video', 'Amazon'],
  });
  return (
    <TopListPage
      items={items}
      h1="Top 100 Prime Video Serien 2026"
      subline="Die 100 beliebtesten Serien auf Amazon Prime Video in Deutschland — täglich aktualisiert. Bewertet nach echten Leser-Klicks, TMDB-Popularität und Redaktionsrelevanz."
      description={DESC}
      breadcrumbLabel="Top 100 Prime Video Serien"
      url={URL}
      updatedAt={new Date()}
      faq={FAQ}
      platformNavEnabled={false}
      topLabel="Die Top 10 Prime-Video-Serien — Was Deutschland gerade streamt"
      relatedPillars={[
        { label: 'Top 100 Serien (alle Streamer)', href: '/top-100-serien',       subtitle: 'Das große Haupt-Ranking' },
        { label: 'Top 100 Netflix Serien',         href: '/top-100-netflix',      subtitle: 'Nur die besten Netflix-Titel' },
        { label: 'Top 100 Disney+ Serien',         href: '/top-100-disney-plus',  subtitle: 'Marvel, Star Wars & mehr' },
      ]}
    />
  );
}
