import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import NewsHub from '../../_hub';
import { SITE_BASE } from '../../_lib';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ page: string }>;
}

function parseArchivePage(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const parsed = parseArchivePage((await params).page);
  if (!parsed) {
    return {
      title: 'News-Archiv nicht gefunden | serien.de',
      robots: { index: false, follow: false },
    };
  }

  const canonical = parsed === 1 ? `${SITE_BASE}/news` : `${SITE_BASE}/news/seite/${parsed}`;
  return {
    title: `Serien-News Archiv – Seite ${parsed} | serien.de`,
    description: `Ältere Serien-News, Trailer und Streaming-Updates auf Seite ${parsed} des serien.de-Archivs.`,
    alternates: { canonical, languages: { 'de-DE': canonical } },
    openGraph: {
      title: `Serien-News Archiv – Seite ${parsed}`,
      description: `Ältere Serien-News und Streaming-Updates auf Seite ${parsed}.`,
      url: canonical,
      type: 'website',
      siteName: 'serien.de',
      locale: 'de_DE',
    },
  };
}

export default async function NewsArchivePage({ params }: PageProps) {
  const parsed = parseArchivePage((await params).page);
  if (!parsed) notFound();
  if (parsed === 1) permanentRedirect('/news');

  return (
    <NewsHub
      h1={`Serien-News Archiv – Seite ${parsed}`}
      intro="Ältere Meldungen, Trailer, Staffelstarts und Streaming-Updates in chronologischer Reihenfolge."
      canonicalPath={`/news/seite/${parsed}`}
      filterSlug={null}
      page={parsed}
    />
  );
}
