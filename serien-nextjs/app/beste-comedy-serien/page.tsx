import type { Metadata } from 'next';
import { loadTopList } from '@/lib/top-list-loader';
import TopListPage from '@/components/TopListPage';

export const revalidate = 86400;
export const dynamic = 'force-static';

const URL = 'https://serien.de/beste-comedy-serien';
const TITLE = 'Die besten Comedy-Serien 2026 — tägliches Ranking';
const DESC  = 'Die 100 lustigsten Comedy- und Sitcom-Serien im täglichen Ranking. Von Sitcom-Klassikern bis zur Modern Comedy — basierend auf echten Leser-Klicks.';

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
  { q: 'Was sind aktuell die besten Comedy-Serien?', a: 'Hier findest du die 100 beliebtesten Comedy- und Sitcom-Serien im täglich aktualisierten Ranking — von klassischen Sitcoms (Friends, The Big Bang Theory, Two and a Half Men) bis zu Mockumentaries (The Office, Parks and Recreation) und modernen Single-Cam-Comedies (Ted Lasso, Only Murders in the Building).' },
  { q: 'Welche Unterkategorien zählen zu Comedy?', a: 'Alle TMDB-Einträge mit den Genres „Comedy" und „Komödie". Sitcoms, Single-Cam-Comedies, Dramedies, Mockumentaries und Animated Comedies (South Park, Family Guy, Simpsons).' },
  { q: 'Wie oft wird das Ranking aktualisiert?', a: 'Das Comedy-Ranking wird täglich automatisch neu berechnet. Die Uhrzeit der letzten Aktualisierung siehst du oben auf der Seite.' },
  { q: 'Warum steht keine klassische 90er-Sitcom weiter oben?', a: 'Unser Hybrid-Score gewichtet aktuelle Leser-Klicks stark (60%). Klassiker wie Seinfeld oder Friends erscheinen dann, wenn wieder viele serien.de-Leser gerade darüber lesen — z.B. bei Reunion-Specials oder Streaming-Rückkehr.' },
];

export default async function Page() {
  const items = await loadTopList({ limit: 100, genreFilter: ['Comedy', 'Komödie'] });
  return (
    <TopListPage
      items={items}
      h1="Die besten Comedy-Serien 2026"
      subline="Die 100 lustigsten Comedy- und Sitcom-Serien — täglich aktualisiert. Von Sitcom-Klassikern bis Modern Comedy."
      description={DESC}
      breadcrumbLabel="Beste Comedy-Serien"
      url={URL}
      updatedAt={new Date()}
      faq={FAQ}
      topLabel="Die Top 10 Comedy-Serien — Was Deutschland gerade schaut"
      relatedPillars={[
        { label: 'Top 100 Serien (alle Genres)', href: '/top-100-serien',       subtitle: 'Das große Haupt-Ranking' },
        { label: 'Die besten Drama-Serien',      href: '/beste-drama-serien',   subtitle: 'Charakterdrama & Gesellschaft' },
        { label: 'Die besten Crime-Serien',      href: '/beste-crime-serien',   subtitle: 'Krimis, Thriller & Police Procedurals' },
      ]}
    />
  );
}
