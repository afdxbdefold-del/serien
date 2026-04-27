import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SerienOverview from '../../_overview';
import { SITE_BASE, SerienFilters, DECADES, buildHref, buildTitle, buildDescription } from '../../_lib';

interface PageProps {
  params: Promise<{ decade: string }>;
  searchParams: Promise<Omit<SerienFilters, 'jahrzehnt'>>;
}

export async function generateStaticParams() {
  return DECADES.map((d) => ({ decade: `${d}er` }));
}

function parseDecade(raw: string): string | null {
  const m = raw.match(/^(\d{4})er$/);
  if (!m) return null;
  const decade = parseInt(m[1], 10);
  return DECADES.includes(decade) ? String(decade) : null;
}

function resolve(params: { decade: string }, sp: Omit<SerienFilters, 'jahrzehnt'>): SerienFilters | null {
  const decade = parseDecade(params.decade);
  if (!decade) return null;
  return { ...sp, jahrzehnt: decade };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const f = resolve(await params, await searchParams);
  if (!f) return { title: 'Serien | serien.de' };
  const title = buildTitle(f);
  const canonical = `${SITE_BASE}${buildHref(f, {}, { forcePrimary: 'jahrzehnt' })}`;
  const description = buildDescription(f);
  return {
    title: `${title} im Überblick | serien.de`,
    description,
    alternates: { canonical },
    openGraph: { title: `${title} | serien.de`, description, url: canonical, type: 'website' },
  };
}

export default async function SerienDecadePage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const f = resolve(resolvedParams, await searchParams);
  if (!f) notFound();
  return (
    <SerienOverview
      filters={f}
      forcePrimary="jahrzehnt"
      resetHref={`/serien/jahrzehnt/${resolvedParams.decade}`}
    />
  );
}
