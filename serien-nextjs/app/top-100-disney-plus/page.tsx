/**
 * TOP 100 DISNEY+ SERIEN — Pillar Page (nur Disney+, täglich aktualisiert).
 */
import type { Metadata } from 'next';
import { loadTopList } from '@/lib/top-list-loader';
import TopListPage from '@/components/TopListPage';

export const revalidate = 86400;
export const dynamic = 'force-static';

const URL = 'https://serien.de/top-100-disney-plus';
const TITLE = 'Top 100 Disney+ Serien 2026 — tägliches Ranking';
const DESC  = 'Die 100 beliebtesten Disney+ Serien in Deutschland – täglich aktualisiert. Marvel, Star Wars, Pixar und exklusive Eigenproduktionen im Ranking.';

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
  { q: 'Was sind die besten Serien auf Disney+?', a: 'Die 100 aktuell beliebtesten Disney+ Serien findest du hier im täglich aktualisierten Ranking — basierend auf echten Leser-Klicks, TMDB-Popularität und redaktioneller Relevanz.' },
  { q: 'Wie oft wird das Disney+ Ranking aktualisiert?', a: 'Das Ranking wird automatisch täglich neu berechnet. Die Uhrzeit der letzten Aktualisierung siehst du oben auf der Seite.' },
  { q: 'Sind Marvel- und Star-Wars-Serien dabei?', a: 'Ja, alle Disney+ Exklusivproduktionen wie Marvel (Loki, The Mandalorian, WandaVision), Star Wars (Andor, Ahsoka), Pixar und 20th-Television-Serien sind Teil des Rankings.' },
  { q: 'Gehört Hulu auch zu Disney+?', a: 'In Deutschland ist Hulu nicht verfügbar — viele Hulu-Serien laufen bei uns direkt auf Disney+ oder Star (integriert in Disney+). Ausschließlich Disney+-Titel sind hier gelistet.' },
];

export default async function Page() {
  const items = await loadTopList({
    limit: 100,
    networkFilter: ['Disney+', 'Disney Plus', 'Disney'],
  });
  return (
    <TopListPage
      items={items}
      h1="Top 100 Disney+ Serien 2026"
      subline="Die 100 beliebtesten Serien auf Disney+ in Deutschland — täglich aktualisiert. Marvel, Star Wars, Pixar und mehr im Ranking."
      description={DESC}
      breadcrumbLabel="Top 100 Disney+ Serien"
      url={URL}
      updatedAt={new Date()}
      faq={FAQ}
      platformNavEnabled={false}
      topLabel="Die Top 10 Disney+ Serien — Was Deutschland gerade streamt"
      relatedPillars={[
        { label: 'Top 100 Serien (alle Streamer)', href: '/top-100-serien',       subtitle: 'Das große Haupt-Ranking' },
        { label: 'Top 100 Netflix Serien',         href: '/top-100-netflix',      subtitle: 'Nur die besten Netflix-Titel' },
        { label: 'Top 100 Prime Video Serien',     href: '/top-100-amazon-prime', subtitle: 'Die stärksten Amazon-Serien' },
      ]}
    />
  );
}
