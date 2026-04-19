import type { Metadata } from 'next';
import { loadTopList } from '@/lib/top-list-loader';
import TopListPage from '@/components/TopListPage';

export const revalidate = 86400;
export const dynamic = 'force-static';

const URL = 'https://serien.de/beste-mystery-serien';
const TITLE = 'Die besten Mystery-Serien 2026 — tägliches Ranking';
const DESC  = 'Die 100 besten Mystery-Serien im täglichen Ranking. Von Twist-Thrillern über Rätsel-Serien bis zu übernatürlichen Mystery-Storys.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, type: 'website', locale: 'de_DE', siteName: 'serien.de' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

const FAQ = [
  { q: 'Was sind aktuell die besten Mystery-Serien?', a: 'Im täglich aktualisierten Ranking findest du die 100 beliebtesten Mystery-Serien — von twist-lastigen Krimi-Mystery (True Detective, Only Murders in the Building) über übernatürliche Mystery (Stranger Things, From, Yellowjackets) bis zu klassischen Rätsel-Dramas (Lost, Dark).' },
  { q: 'Was unterscheidet Mystery von Thriller oder Sci-Fi?', a: 'Mystery zentriert sich um ein ungelöstes Rätsel, das Zuschauer mitlösen. Thriller setzen auf Spannung und Gefahr, Sci-Fi auf Technologie oder spekulative Zukunft. Viele Serien haben mehrere Genres — sie erscheinen dann in jedem passenden Ranking.' },
  { q: 'Wie oft wird das Ranking aktualisiert?', a: 'Das Mystery-Ranking wird täglich automatisch neu berechnet. Die Uhrzeit der letzten Aktualisierung siehst du oben auf der Seite.' },
  { q: 'Welche Mystery-Klassiker fehlen gerade?', a: 'Alte Mystery-Serien wie „Twin Peaks" oder „Akte X" erscheinen dann oben im Ranking, wenn aktuell viele serien.de-Leser darüber lesen — z.B. bei Streaming-Relaunches oder Jubiläen.' },
];

export default async function Page() {
  const items = await loadTopList({ limit: 100, genreFilter: ['Mystery'] });
  return (
    <TopListPage
      items={items}
      h1="Die besten Mystery-Serien 2026"
      subline="Die 100 besten Mystery-Serien — täglich aktualisiert. Rätsel, Twists und übernatürliche Storys, die Deutschland gerade fesseln."
      description={DESC}
      breadcrumbLabel="Beste Mystery-Serien"
      url={URL}
      updatedAt={new Date()}
      faq={FAQ}
      topLabel="Die Top 10 Mystery-Serien — Was Deutschland gerade schaut"
      relatedPillars={[
        { label: 'Top 100 Serien (alle Genres)',  href: '/top-100-serien',       subtitle: 'Das große Haupt-Ranking' },
        { label: 'Die besten Crime-Serien',       href: '/beste-crime-serien',   subtitle: 'Krimis, Thriller & Police Procedurals' },
        { label: 'Die besten Sci-Fi-Serien',      href: '/beste-sci-fi-serien',  subtitle: 'Science-Fiction & Fantasy' },
      ]}
    />
  );
}
