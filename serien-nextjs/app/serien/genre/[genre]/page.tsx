/**
 * /serien/genre/[genre] — clean Genre-Landing-Page.
 *
 * SEO (Feb 2026 Serienfinder-Fix):
 *  - Clean URL /serien/genre/drama → index, follow, self-canonical
 *  - Zusatz-Filter (?streamer=...&sort=...) → noindex, follow,
 *    canonical → /serien/genre/drama
 *  - Ungültige genre-Slugs → 404
 */
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SerienOverview from '../../_overview';
import {
  SITE_BASE,
  SerienFilters,
  GENRES,
  buildTitle,
  buildDescription,
  hasIndexBreakingParams,
  cleanCanonicalPath,
  areFiltersValid,
} from '../../_lib';

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
  if (!f || !areFiltersValid(f)) {
    return { title: 'Nicht gefunden | serien.de', robots: { index: false, follow: false } };
  }

  const isCombined = hasIndexBreakingParams(f, 'genre');
  const canonical = `${SITE_BASE}${cleanCanonicalPath(f, 'genre')}`;
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

export default async function SerienGenrePage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const f = resolve(resolvedParams, await searchParams);
  if (!f) notFound();
  // Ungültige Sekundär-Filter → 404 statt Soft-Redirect
  if (!areFiltersValid(f)) notFound();
  return (
    <SerienOverview
      filters={f}
      forcePrimary="genre"
      resetHref={`/serien/genre/${resolvedParams.genre}`}
    />
  );
}
