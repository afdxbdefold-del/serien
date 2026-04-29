import type { Metadata } from 'next';
import NewsHub from './_hub';
import { SITE_BASE, buildHubMetaTitle, buildHubDescription, buildHubTitle } from './_lib';

export const revalidate = 300; // 5 min ISR

export function generateMetadata(): Metadata {
  const canonical = `${SITE_BASE}/news`;
  const title = buildHubMetaTitle();
  const description = buildHubDescription();
  return {
    title,
    description,
    alternates: { canonical, languages: { 'de-DE': canonical } },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: 'serien.de',
      locale: 'de_DE',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default function NewsPage() {
  const intro =
    'Hier findest du alle aktuellen Serien-News auf einen Blick: neue Staffeln, Trailer, ' +
    'Streaming-Starts und Hintergründe von Netflix, Prime Video, Apple TV+ und Disney+. ' +
    'Frisch von der Redaktion, sortiert nach Veröffentlichungsdatum.';
  return (
    <NewsHub
      h1={buildHubTitle()}
      intro={intro}
      canonicalPath="/news"
      filterSlug={null}
    />
  );
}
