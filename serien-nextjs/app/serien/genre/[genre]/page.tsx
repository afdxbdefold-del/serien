import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SerienOverview from '../../_overview';
import { SITE_BASE, SerienFilters, GENRES, buildHref, buildTitle, buildDescription } from '../../_lib';

interface PageProps {
  params: Promise<{ genre: string }>;
  searchParams: Promise<Omit<SerienFilters, 'genre'>>;
}

export async function generateStaticParams() {
  return GENRES.map((g) => ({ genre: g.slug }));
}

function resolve(params: { genre: string }, sp: Omit<SerienFilters, 'genre'>): SerienFilters | null {
  const exists = GENRES.some((g) => g.slug === params.genre);
  if (!exists) return null;
  return { ...sp, genre: params.genre };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const f = resolve(await params, await searchParams);
  if (!f) return { title: 'Serien | serien.de' };
  const title = buildTitle(f);
  const canonical = `${SITE_BASE}${buildHref(f, {}, { forcePrimary: 'genre' })}`;
  const description = buildDescription(f);
  return {
    title: `${title} im Überblick | serien.de`,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} | serien.de`, description, url: canonical, type: 'website' },
  };
}

export default async function SerienGenrePage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const f = resolve(resolvedParams, await searchParams);
  if (!f) notFound();
  return (
    <SerienOverview
      filters={f}
      forcePrimary="genre"
      resetHref={`/serien/genre/${resolvedParams.genre}`}
    />
  );
}
