/**
 * /serien — Series catalogue (root listing).
 *
 * SEO — Feb 2026 Serienfinder-Indexation-Fix:
 *  - Clean URL /serien ohne Filter → index, follow, self-canonical
 *  - Legacy /serien?genre=X (nur ein Primary-Filter) → 308 auf /serien/genre/X
 *  - Alle sonstigen Filter-Kombinationen → noindex, follow, canonical=/serien
 *  - Ungültige Werte → HTTP 404
 *
 * Sub-routes für SEO-canonical URLs:
 *   /serien/genre/[genre]
 *   /serien/streamer/[streamer]
 *   /serien/jahrzehnt/[decade]er
 */
import { Metadata } from 'next';
import { notFound, redirect, permanentRedirect } from 'next/navigation';
import SerienOverview from './_overview';
import {
  SITE_BASE,
  SerienFilters,
  buildTitle,
  buildDescription,
  hasIndexBreakingParams,
  cleanCanonicalPath,
  areFiltersValid,
  singlePrimaryFilterOnly,
} from './_lib';

interface PageProps {
  searchParams: Promise<SerienFilters>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const f = await searchParams;

  // Ungültig? → notFound() im Page-Body wirft 404 — Metadata darf hier nichts
  // ausliefern, das Google indexiert.
  if (!areFiltersValid(f)) {
    return {
      title: 'Nicht gefunden | serien.de',
      robots: { index: false, follow: false },
    };
  }

  const isCombined = hasIndexBreakingParams(f, 'none');
  const canonicalPath = cleanCanonicalPath(f, 'none');
  const canonical = `${SITE_BASE}${canonicalPath}`;
  const title = buildTitle(f);
  const description = buildDescription(f);

  return {
    title: `${title} im Überblick | serien.de`,
    description,
    alternates: { canonical },
    // Kombinierte Filter-URLs (?jahrzehnt=... &sort=... etc.) sind dünn und
    // erzeugen kaum Mehrwert — Google indexiert nur die clean Landing-Page.
    robots: isCombined
      ? { index: false, follow: true, googleBot: { index: false, follow: true } }
      : undefined, // default: index, follow
    openGraph: { title: `${title} | serien.de`, description, url: canonical, type: 'website' },
  };
}

export default async function SerienPage({ searchParams }: PageProps) {
  const f = await searchParams;

  // 1) Ungültige Filter-Werte → echtes 404, nicht auf /serien redirecten
  if (!areFiltersValid(f)) notFound();

  // 2) Legacy-Redirect: einzelner Primary-Filter (genre/streamer/jahrzehnt)
  //    ohne weitere Filter → 308 auf die clean Landing-Page.
  const single = singlePrimaryFilterOnly(f);
  if (single === 'genre' && f.genre) {
    permanentRedirect(`/serien/genre/${f.genre}`);
  }
  if (single === 'streamer' && f.streamer) {
    permanentRedirect(`/serien/streamer/${f.streamer}`);
  }
  if (single === 'jahrzehnt' && f.jahrzehnt) {
    permanentRedirect(`/serien/jahrzehnt/${f.jahrzehnt}er`);
  }

  // 3) Redundanter sort=popularity (Default) → strip param (temporär, 307)
  //    Wir prüfen NUR sort=popularity als singulären "Nicht-Filter", damit
  //    User-Klicks nicht in eine unnötige Query-URL gefangen bleiben.
  if (f.sort === 'popularity' && !f.genre && !f.streamer && !f.jahrzehnt && !f.status && !f.page) {
    redirect('/serien');
  }

  return <SerienOverview filters={f} />;
}
