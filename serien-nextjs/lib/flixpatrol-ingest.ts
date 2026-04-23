/**
 * FLIXPATROL RANKING INGEST
 *
 * Runs the scraper for each configured platform/country, matches each
 * Top-10 title against our TMDB series table, and upserts daily snapshots
 * into `streamer_rankings`.
 *
 * Matching strategy:
 *   1. exact title match (case-insensitive, German + original)
 *   2. fuzzy: strip trailing year/qualifier like "(2022)", ":"-clauses
 *   3. TMDB API search (read-only, no rate concerns for 60 lookups/day)
 *
 * Not-matched rows are still persisted (tmdbId=null) so that trend
 * dashboards stay complete even if the series doesn't exist in our DB.
 */

import prisma from './prisma';
import {
  scrapeFlixpatrolTop10,
  FLIXPATROL_PLATFORMS,
  type FlixpatrolEntry,
  type FlixpatrolPlatform,
} from './flixpatrol-scraper';

interface MatchResult {
  tmdbId: number | null;
  matched: boolean;
}

/** Normalize for comparison: lowercase, strip punctuation, collapse spaces. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[:\-–—().,!?'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip `": Subtitle"` / `" (2022)"` / `" - Part 2"` style suffixes. */
function baseTitle(s: string): string {
  return s
    .replace(/\s*[:\-–—]\s.*$/, '')
    .replace(/\s*\(\d{4}(?:-\d{4})?\)\s*$/, '')
    .trim();
}

async function matchTmdbByTitle(title: string): Promise<MatchResult> {
  const candidates = [title, baseTitle(title)];
  const normalized = candidates.map(norm);

  // Single DB scan, case-insensitive, across both `name` + `title`
  const rows = await prisma.series.findMany({
    where: {
      OR: [
        { name: { in: candidates, mode: 'insensitive' } },
        { title: { in: candidates, mode: 'insensitive' } },
        { originalName: { in: candidates, mode: 'insensitive' } },
      ],
    },
    select: { tmdbId: true, name: true, title: true, originalName: true, popularity: true },
    orderBy: { popularity: 'desc' },
    take: 5,
  });
  if (rows.length > 0) {
    // Pick the popularity-leader whose name matches at all, after normalisation
    const winner = rows.find((r) =>
      [r.name, r.title, r.originalName].some((v) => v && normalized.includes(norm(v))),
    );
    if (winner) return { tmdbId: winner.tmdbId, matched: true };
  }

  // Fuzzy: LIKE on base title (covers cases like "Paradise (2025)" vs
  // DB holding "Paradise").
  const base = baseTitle(title);
  const likeRows = await prisma.series.findMany({
    where: {
      OR: [
        { name: { contains: base, mode: 'insensitive' } },
        { title: { contains: base, mode: 'insensitive' } },
      ],
    },
    select: { tmdbId: true, name: true, popularity: true },
    orderBy: { popularity: 'desc' },
    take: 3,
  });
  if (likeRows.length > 0 && likeRows[0].name) {
    // Only accept if normalized names share a hefty overlap to avoid
    // false positives on common words
    const candidate = norm(likeRows[0].name);
    const target = norm(base);
    if (candidate.includes(target) || target.includes(candidate)) {
      return { tmdbId: likeRows[0].tmdbId, matched: true };
    }
  }

  return { tmdbId: null, matched: false };
}

export interface IngestResult {
  platform: string;
  country: string;
  tvInserted: number;
  moviesInserted: number;
  matched: number;
  unmatched: number;
  date: string;
}

export async function ingestFlixpatrolPlatform(
  platform: FlixpatrolPlatform,
  country: string = 'germany',
): Promise<IngestResult> {
  const scraped = await scrapeFlixpatrolTop10(platform, country);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let matched = 0;
  let unmatched = 0;

  const upsert = async (entry: FlixpatrolEntry, type: 'tv' | 'movie') => {
    // Only TMDB-match TV shows — movies are out of scope for this product
    const match = type === 'tv' ? await matchTmdbByTitle(entry.title) : { tmdbId: null, matched: false };
    if (match.matched) matched++; else if (type === 'tv') unmatched++;

    await prisma.streamer_rankings.upsert({
      where: {
        platform_country_type_date_rank: {
          platform,
          country,
          type,
          date: today,
          rank: entry.rank,
        },
      },
      update: {
        title: entry.title,
        slug: entry.slug,
        tmdbId: match.tmdbId,
        tmdbMatched: match.matched,
      },
      create: {
        platform,
        country,
        type,
        date: today,
        rank: entry.rank,
        title: entry.title,
        slug: entry.slug,
        tmdbId: match.tmdbId,
        tmdbMatched: match.matched,
      },
    });
  };

  for (const e of scraped.tv) await upsert(e, 'tv');
  for (const e of scraped.movies) await upsert(e, 'movie');

  return {
    platform,
    country,
    tvInserted: scraped.tv.length,
    moviesInserted: scraped.movies.length,
    matched,
    unmatched,
    date: today.toISOString().slice(0, 10),
  };
}

export async function ingestAllPlatforms(country: string = 'germany'): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const platform of Object.keys(FLIXPATROL_PLATFORMS) as FlixpatrolPlatform[]) {
    try {
      const r = await ingestFlixpatrolPlatform(platform, country);
      results.push(r);
      // Be polite — 1s between requests so we don't hammer the target
      await new Promise((res) => setTimeout(res, 1000));
    } catch (err: any) {
      console.error(`[flixpatrol] ingest failed for ${platform}:`, err?.message || err);
      results.push({
        platform,
        country,
        tvInserted: 0,
        moviesInserted: 0,
        matched: 0,
        unmatched: 0,
        date: new Date().toISOString().slice(0, 10),
      });
    }
  }
  return results;
}
