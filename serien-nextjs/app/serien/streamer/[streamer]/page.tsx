/**
 * /serien/streamer/[streamer] — clean Streamer-Landing-Page.
 *
 * SEO (Feb 2026 Serienfinder-Fix): siehe /serien/genre/[genre]/page.tsx
 */
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SerienOverview from '../../_overview';
import {
  SITE_BASE,
  SerienFilters,
  STREAMERS,
  buildTitle,
  buildDescription,
  hasIndexBreakingParams,
  cleanCanonicalPath,
  areFiltersValid,
} from '../../_lib';

interface PageProps {
  params: Promise<{ streamer: string }>;
  searchParams: Promise<Omit<SerienFilters, 'streamer'>>;
}

export async function generateStaticParams() {
  return STREAMERS.map((s) => ({ streamer: s.slug }));
}

function resolve(params: { streamer: string }, sp: Omit<SerienFilters, 'streamer'>): SerienFilters | null {
  const exists = STREAMERS.some((s) => s.slug === params.streamer);
  if (!exists) return null;
  return { ...sp, streamer: params.streamer };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const f = resolve(await params, await searchParams);
  if (!f || !areFiltersValid(f)) {
    return { title: 'Nicht gefunden | serien.de', robots: { index: false, follow: false } };
  }

  const isCombined = hasIndexBreakingParams(f, 'streamer');
  const canonical = `${SITE_BASE}${cleanCanonicalPath(f, 'streamer')}`;
  const title = buildTitle(f);
  const description = buildDescription(f);

  return {
    title: `${title} im Überblick | serien.de`,
    description,
    alternates: { canonical },
    robots: isCombined
      ? { index: false, follow: true, googleBot: { index: false, follow: true } }
      : undefined,
    openGraph: { title: `${title} | serien.de`, description, url: canonical, type: 'website' },
  };
}

export default async function SerienStreamerPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const f = resolve(resolvedParams, await searchParams);
  if (!f) notFound();
  if (!areFiltersValid(f)) notFound();
  return (
    <SerienOverview
      filters={f}
      forcePrimary="streamer"
      resetHref={`/serien/streamer/${resolvedParams.streamer}`}
    />
  );
}
