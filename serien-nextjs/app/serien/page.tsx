/**
 * /serien — Series catalogue (root listing).
 * Sub-routes for SEO-canonical URLs:
 *   /serien/genre/[genre]
 *   /serien/streamer/[streamer]
 *   /serien/jahrzehnt/[decade]er
 */
import { Metadata } from 'next';
import SerienOverview from './_overview';
import { SITE_BASE, SerienFilters, buildHref, buildTitle, buildDescription } from './_lib';

interface PageProps {
  searchParams: Promise<SerienFilters>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const f = await searchParams;
  const title = buildTitle(f);
  const canonical = `${SITE_BASE}${buildHref(f, {})}`;
  const description = buildDescription(f);
  return {
    title: `${title} im Überblick | serien.de`,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} | serien.de`, description, url: canonical, type: 'website' },
  };
}

export default async function SerienPage({ searchParams }: PageProps) {
  const f = await searchParams;
  return <SerienOverview filters={f} />;
}
