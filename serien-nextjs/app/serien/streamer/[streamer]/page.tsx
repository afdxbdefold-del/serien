import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SerienOverview from '../../_overview';
import { SITE_BASE, SerienFilters, STREAMERS, buildHref, buildTitle, buildDescription } from '../../_lib';

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
  if (!f) return { title: 'Serien | serien.de' };
  const title = buildTitle(f);
  const canonical = `${SITE_BASE}${buildHref(f, {}, { forcePrimary: 'streamer' })}`;
  const description = buildDescription(f);
  return {
    title: `${title} im Überblick | serien.de`,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} | serien.de`, description, url: canonical, type: 'website' },
  };
}

export default async function SerienStreamerPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const f = resolve(resolvedParams, await searchParams);
  if (!f) notFound();
  return (
    <SerienOverview
      filters={f}
      forcePrimary="streamer"
      resetHref={`/serien/streamer/${resolvedParams.streamer}`}
    />
  );
}
