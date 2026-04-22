import type { Metadata } from 'next';
import { loadTopList } from '@/lib/top-list-loader';
import TopListPage from '@/components/TopListPage';

export const revalidate = 86400;
export const dynamic = 'force-static';

const URL = 'https://serien.de/beste-sci-fi-serien';
const TITLE = 'Die besten Sci-Fi- & Fantasy-Serien 2026 — tägliches Ranking';
const DESC  = 'Die 100 besten Science-Fiction- und Fantasy-Serien im täglichen Ranking. Von Space Operas bis High Fantasy — basierend auf echten Leser-Klicks.';

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
  { q: 'Was sind aktuell die besten Sci-Fi- und Fantasy-Serien?', a: 'Im täglich aktualisierten Ranking findest du die 100 beliebtesten Serien aus dem Genre Sci-Fi & Fantasy — von Space Operas (The Expanse, Star Trek) über Dystopien (Black Mirror, The Handmaid\'s Tale) bis zu High Fantasy (House of the Dragon, The Rings of Power, The Witcher).' },
  { q: 'Warum sind Sci-Fi und Fantasy zusammengefasst?', a: 'TMDB führt beide als gemeinsames Genre „Sci-Fi & Fantasy". Wir behalten diese Klassifikation bei, weil die Zielgruppen stark überlappen und die meisten Fans beide Genres schauen.' },
  { q: 'Wie oft wird das Ranking aktualisiert?', a: 'Das Sci-Fi- & Fantasy-Ranking wird täglich automatisch neu berechnet. Die Uhrzeit der letzten Aktualisierung siehst du oben auf der Seite.' },
  { q: 'Sind Superhelden-Serien eingeschlossen?', a: 'Ja — Serien wie „The Boys", „Invincible", „Daredevil", „Loki" oder „WandaVision" sind in TMDB als Sci-Fi & Fantasy markiert und erscheinen daher hier.' },
];

export default async function Page() {
  const items = await loadTopList({ limit: 100, genreFilter: ['Sci-Fi & Fantasy'] });
  return (
    <TopListPage
      items={items}
      h1="Die besten Sci-Fi- & Fantasy-Serien 2026"
      subline="Die 100 besten Science-Fiction- und Fantasy-Serien — täglich aktualisiert. Space Operas, Dystopien, High Fantasy und Superhelden."
      description={DESC}
      breadcrumbLabel="Beste Sci-Fi-Serien"
      url={URL}
      updatedAt={new Date()}
      faq={FAQ}
      topLabel="Die Top 10 Sci-Fi- & Fantasy-Serien — Was Deutschland gerade schaut"
      relatedPillars={[
        { label: 'Top 100 Serien (alle Genres)', href: '/top-100-serien',       subtitle: 'Das große Haupt-Ranking' },
        { label: 'Die besten Mystery-Serien',    href: '/beste-mystery-serien', subtitle: 'Rätsel, Twists & Ermittlungen' },
        { label: 'Die besten Drama-Serien',      href: '/beste-drama-serien',   subtitle: 'Prestige-Dramen & Family' },
      ]}
    />
  );
}
