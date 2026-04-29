import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import NewsHub from '../_hub';
import {
  SITE_BASE,
  classifyFilter,
  buildStreamerH1, buildStreamerMetaTitle, buildStreamerDescription,
  buildKindH1, buildKindMetaTitle, buildKindDescription,
  buildMonthH1, buildMonthMetaTitle, buildMonthDescription,
} from '../_lib';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ filter: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { filter } = await params;
  const cls = classifyFilter(filter);
  if (!cls) return { title: 'Serien-News | serien.de' };

  let title = '';
  let description = '';
  let h1 = '';
  if (cls.kind === 'streamer') {
    title = buildStreamerMetaTitle(cls.entry);
    description = buildStreamerDescription(cls.entry);
    h1 = buildStreamerH1(cls.entry);
  } else if (cls.kind === 'kind') {
    title = buildKindMetaTitle(cls.entry);
    description = buildKindDescription(cls.entry);
    h1 = buildKindH1(cls.entry);
  } else {
    title = buildMonthMetaTitle(cls.year, cls.month);
    description = buildMonthDescription(cls.year, cls.month);
    h1 = buildMonthH1(cls.year, cls.month);
  }

  const canonical = `${SITE_BASE}/news/${filter}`;
  return {
    title,
    description,
    alternates: { canonical, languages: { 'de-DE': canonical } },
    openGraph: { title: h1, description, url: canonical, type: 'website', siteName: 'serien.de', locale: 'de_DE' },
    twitter: { card: 'summary_large_image', title: h1, description },
  };
}

export default async function NewsFilterPage({ params }: PageProps) {
  const { filter } = await params;
  const cls = classifyFilter(filter);
  if (!cls) notFound();

  let h1 = '';
  let intro = '';
  if (cls.kind === 'streamer') {
    h1 = buildStreamerH1(cls.entry);
    intro =
      `Hier findest du alle aktuellen ${cls.entry.label} Serien-News: neue Staffeln, Trailer, ` +
      `Streaming-Starts und wichtige Updates rund um die Originals und Lizenz-Serien. ` +
      `Täglich gepflegt auf serien.de.`;
  } else if (cls.kind === 'kind') {
    h1 = buildKindH1(cls.entry);
    intro =
      `Aktuelle Serien-News zum Thema „${cls.entry.label}" – frisch sortiert von der Redaktion. ` +
      `Verpasse keinen Trailer, Staffel-Start oder Hintergrund mehr.`;
  } else {
    h1 = buildMonthH1(cls.year, cls.month);
    intro =
      `Alle Serien-News aus ${h1.replace('Serien-News ', '')} im chronologischen Überblick: ` +
      `Trailer, Streaming-Starts, neue Staffeln und Hintergründe.`;
  }

  return (
    <NewsHub
      h1={h1}
      intro={intro}
      canonicalPath={`/news/${filter}`}
      filterSlug={filter}
    />
  );
}
