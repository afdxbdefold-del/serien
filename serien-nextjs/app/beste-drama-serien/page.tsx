import type { Metadata } from 'next';
import { loadTopList } from '@/lib/top-list-loader';
import TopListPage from '@/components/TopListPage';

export const revalidate = 86400;
export const dynamic = 'force-static';

const URL = 'https://serien.de/beste-drama-serien';
const TITLE = 'Die besten Drama-Serien 2026 — tägliches Ranking';
const DESC  = 'Die 100 besten Drama-Serien im täglichen Ranking. Von Prestige-Dramas bis Family-Dramas — basierend auf echten Leser-Klicks und TMDB-Popularität.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, type: 'website', locale: 'de_DE', siteName: 'serien.de' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

const FAQ = [
  { q: 'Was sind aktuell die besten Drama-Serien?', a: 'Hier findest du die 100 beliebtesten Drama-Serien im täglich aktualisierten Ranking — von Prestige-Dramas (The Crown, Succession, Mad Men) über Medical Dramas (Grey\'s Anatomy, The Pitt, House M.D.) bis zu Family Dramas (This Is Us, Parenthood).' },
  { q: 'Was unterscheidet Drama von Crime oder Thriller?', a: 'Drama ist ein sehr breites Genre. TMDB kennzeichnet viele Crime-Serien auch als Drama — bei uns erscheinen sie in beiden Rankings. Reine Action- oder Thriller-Serien ohne starken charakterlichen Fokus werden hier nicht gelistet.' },
  { q: 'Wie oft wird das Ranking aktualisiert?', a: 'Das Drama-Ranking wird täglich automatisch neu berechnet. Die Uhrzeit der letzten Aktualisierung siehst du oben auf der Seite.' },
  { q: 'Warum steht Serie X hier UND im Crime-Ranking?', a: 'Serien mit mehreren Genres (z.B. „Crime & Drama" wie Breaking Bad oder The Wire) erscheinen in beiden passenden Rankings. Das ist gewollt — Leser suchen nach beiden Begriffen.' },
];

export default async function Page() {
  const items = await loadTopList({ limit: 100, genreFilter: ['Drama'] });
  return (
    <TopListPage
      items={items}
      h1="Die besten Drama-Serien 2026"
      subline="Die 100 besten Drama-Serien — täglich aktualisiert. Von Prestige-TV über Medical Dramas bis zu Family Dramas."
      description={DESC}
      breadcrumbLabel="Beste Drama-Serien"
      url={URL}
      updatedAt={new Date()}
      faq={FAQ}
      topLabel="Die Top 10 Drama-Serien — Was Deutschland gerade schaut"
      relatedPillars={[
        { label: 'Top 100 Serien (alle Genres)', href: '/top-100-serien',       subtitle: 'Das große Haupt-Ranking' },
        { label: 'Die besten Crime-Serien',      href: '/beste-crime-serien',   subtitle: 'Krimis, Thriller & Police Procedurals' },
        { label: 'Die besten Mystery-Serien',    href: '/beste-mystery-serien', subtitle: 'Rätsel, Twists & Ermittlungen' },
      ]}
    />
  );
}
