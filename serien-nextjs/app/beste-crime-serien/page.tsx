import type { Metadata } from 'next';
import { loadTopList } from '@/lib/top-list-loader';
import TopListPage from '@/components/TopListPage';

export const revalidate = 86400;
export const dynamic = 'force-static';

const URL = 'https://serien.de/beste-crime-serien';
const TITLE = 'Die besten Crime-Serien 2026 — tägliches Ranking';
const DESC  = 'Die 100 besten Krimi- und Crime-Serien im täglichen Ranking. Von True Crime bis Police Procedural — basierend auf echten Leser-Klicks und TMDB-Popularität.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, type: 'website', locale: 'de_DE', siteName: 'serien.de' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

const FAQ = [
  { q: 'Was sind aktuell die besten Crime-Serien?', a: 'Die 100 beliebtesten Crime-Serien findest du hier im täglichen Ranking — von Police Procedurals über Thriller bis zu True Crime. Der Score kombiniert echte Leser-Klicks auf serien.de mit TMDB-Popularität und aktueller redaktioneller Relevanz.' },
  { q: 'Welche Unterkategorien zählen zu Crime?', a: 'Wir fassen alle TMDB-Einträge mit den Genres „Crime" und „Krimi" zusammen. Das umfasst Police Procedurals (NCIS, CSI, Criminal Minds), Detektiv-Serien (Sherlock, Poirot), Thriller (Breaking Bad, Ozark), Mystery-Crime (True Detective) und deutsche Krimis (Tatort, Polizeiruf).' },
  { q: 'Wie oft wird das Ranking aktualisiert?', a: 'Das Crime-Ranking wird täglich automatisch neu berechnet. Die Uhrzeit der letzten Aktualisierung siehst du oben auf der Seite.' },
  { q: 'Was unterscheidet diese Liste von einer Jahresbestenliste?', a: 'Jahresbestenlisten sind statisch und spiegeln nur die Redaktions-Sicht. Unser Ranking wird täglich neu berechnet und zeigt, was die serien.de-Leser aktuell wirklich lesen — nicht was vor 6 Monaten gepopult war.' },
];

export default async function Page() {
  const items = await loadTopList({ limit: 100, genreFilter: ['Crime', 'Krimi'] });
  return (
    <TopListPage
      items={items}
      h1="Die besten Crime-Serien 2026"
      subline="Die 100 beliebtesten Krimi- und Crime-Serien — täglich aktualisiert. Von True Crime über Police Procedurals bis zum klassischen Tatort-Krimi."
      description={DESC}
      breadcrumbLabel="Beste Crime-Serien"
      url={URL}
      updatedAt={new Date()}
      faq={FAQ}
      topLabel="Die Top 10 Crime-Serien — Was Deutschland gerade schaut"
      relatedPillars={[
        { label: 'Top 100 Serien (alle Genres)', href: '/top-100-serien',       subtitle: 'Das große Haupt-Ranking' },
        { label: 'Die besten Mystery-Serien',    href: '/beste-mystery-serien', subtitle: 'Rätsel, Twists & Ermittlungen' },
        { label: 'Die besten Drama-Serien',      href: '/beste-drama-serien',   subtitle: 'Charakterdrama & Gesellschaft' },
      ]}
    />
  );
}
