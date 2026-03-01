/**
 * STEP 2: TMDB Resolver
 * Resolves series names to TMDB IDs and creates Series records if needed
 */

import { PrismaClient } from '@prisma/client';
import { searchTv, getTvDetails, getTvDetailsComplete } from './tmdb';
import { fetchTopBackdrops } from './tmdb-backdrops';

const prisma = new PrismaClient();

export interface ResolvedSeries {
  tmdbId: number;
  name: string;
  confidence: number;
  alreadyInDb: boolean;
}

export interface TmdbResolutionResult {
  primarySeries: ResolvedSeries;
  relatedSeries: ResolvedSeries[];
  totalResolved: number;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Resolve a single series (for SINGLE_SERIES_NEWS)
 */
export async function resolveSingleSeries(
  seriesName: string
): Promise<ResolvedSeries | null> {
  console.log(`\n🔍 Resolving single series: "${seriesName}"`);
  
  // Search TMDB
  const searchResult = await searchTv(seriesName, 'de-DE');
  
  if (!searchResult) {
    console.log('❌ No TMDB match found');
    return null;
  }

  console.log(`✅ Found: ${searchResult.name} (confidence: ${(searchResult.confidence * 100).toFixed(1)}%)`);

  if (searchResult.confidence < 0.75) {
    console.log('⚠️  Confidence too low (<75%)');
    return null;
  }

  const tmdbId = searchResult.tmdbId;

  // Check if already in DB
  const existing = await prisma.series.findUnique({
    where: { tmdbId }
  });

  if (existing) {
    console.log('✅ Series already in database');
    return {
      tmdbId,
      name: existing.name || existing.title,
      confidence: searchResult.confidence,
      alreadyInDb: true
    };
  }

  // Create new series with COMPLETE details
  console.log('📚 Creating new series record with FULL TMDB data...');
  const completeDetails = await getTvDetailsComplete(tmdbId, 'de-DE');
  
  if (!completeDetails) {
    throw new Error('Failed to fetch complete TMDB details');
  }

  const slug = generateSlug(completeDetails.name || seriesName);

  // Fetch top 10 backdrops
  console.log('📸 Fetching top 10 backdrops...');
  const topBackdrops = await fetchTopBackdrops('tv', tmdbId, 10);

  await prisma.series.create({
    data: {
      tmdbId,
      tmdbType: 'tv',
      title: completeDetails.name,
      slug,
      name: completeDetails.name,
      originalName: completeDetails.originalName,
      overview: completeDetails.overview,
      tagline: completeDetails.tagline,
      
      // Images
      posterPath: completeDetails.posterPath,
      backdropPath: completeDetails.backdropPath,
      backdrops: topBackdrops.length > 0 ? topBackdrops : null, // NEW: Top 10 backdrops
      
      // Metadata
      status: completeDetails.status,
      type: completeDetails.type,
      firstAirDate: completeDetails.firstAirDate ? new Date(completeDetails.firstAirDate) : null,
      lastAirDate: completeDetails.lastAirDate ? new Date(completeDetails.lastAirDate) : null,
      numberOfSeasons: completeDetails.numberOfSeasons,
      numberOfEpisodes: completeDetails.numberOfEpisodes,
      episodeRunTime: completeDetails.episodeRunTime,
      inProduction: completeDetails.inProduction,
      
      // Ratings
      voteAverage: completeDetails.voteAverage,
      voteCount: completeDetails.voteCount,
      popularity: completeDetails.popularity,
      
      // Genres & Networks
      genres: completeDetails.genres.map((g: any) => g.name),
      genresJson: completeDetails.genres,
      networks: completeDetails.networks.map((n: any) => n.name),
      networksJson: completeDetails.networks,
      
      // Production
      productionCompanies: completeDetails.productionCompanies.map((c: any) => c.name),
      productionCountries: completeDetails.productionCountries.map((c: any) => c.name),
      spokenLanguages: completeDetails.spokenLanguages.map((l: any) => l.name),
      originalLanguage: completeDetails.originalLanguage,
      
      // Cast, Crew, Seasons, Trailers
      cast: completeDetails.cast,
      crew: completeDetails.crew,
      seasons: completeDetails.seasons,
      trailers: completeDetails.trailers,
      
      // Keywords
      keywords: completeDetails.keywords,
      
      // Full backup
      tmdbData: completeDetails.tmdbData,
      
      // Required timestamps
      updatedAt: new Date(),
    }
  });

  console.log('✅ Series created with COMPLETE data:');
  console.log(`   Cast: ${completeDetails.cast.length} members`);
  console.log(`   Crew: ${completeDetails.crew.length} members`);
  console.log(`   Seasons: ${completeDetails.numberOfSeasons}`);
  console.log(`   Episodes: ${completeDetails.numberOfEpisodes}`);
  console.log(`   Trailers: ${completeDetails.trailers.length}`);
  console.log(`   Keywords: ${completeDetails.keywords.length}`);

  return {
    tmdbId,
    name: completeDetails.name || searchResult.name,
    confidence: searchResult.confidence,
    alreadyInDb: false
  };
}

/**
 * Resolve multiple series (for MULTI_SERIES_EDITORIAL)
 * Returns 3-7 series, sorted by confidence
 */
export async function resolveMultipleSeries(
  seriesNames: string[],
  minCount: number = 2,
  maxCount: number = 7
): Promise<ResolvedSeries[]> {
  console.log(`\n🔍 Resolving multiple series (${seriesNames.length} candidates)`);
  
  const resolved: ResolvedSeries[] = [];

  for (const name of seriesNames.slice(0, maxCount + 3)) { // Try more than max in case some fail
    try {
      const result = await resolveSingleSeries(name);
      if (result) {
        resolved.push(result);
      }
    } catch (error: any) {
      console.log(`⚠️  Failed to resolve "${name}": ${error.message}`);
    }

    if (resolved.length >= maxCount) {
      break;
    }
  }

  // Sort by confidence (highest first)
  resolved.sort((a, b) => b.confidence - a.confidence);

  console.log(`✅ Resolved ${resolved.length}/${seriesNames.length} series`);

  if (resolved.length < minCount) {
    throw new Error(`Not enough series resolved (got ${resolved.length}, need ${minCount})`);
  }

  return resolved.slice(0, maxCount);
}

/**
 * Main resolver function
 */
export async function resolveTmdbSeries(
  mode: 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL',
  seriesCandidates: string[]
): Promise<TmdbResolutionResult> {
  if (mode === 'SINGLE_SERIES_NEWS') {
    // Exact match 1 series
    if (seriesCandidates.length === 0) {
      throw new Error('No series candidates provided');
    }

    const primary = await resolveSingleSeries(seriesCandidates[0]);
    
    if (!primary) {
      throw new Error(`Failed to resolve primary series: ${seriesCandidates[0]}`);
    }

    return {
      primarySeries: primary,
      relatedSeries: [],
      totalResolved: 1
    };
  } else {
    // MULTI_SERIES_EDITORIAL: resolve 2-7 series (changed from 3-7)
    const allResolved = await resolveMultipleSeries(seriesCandidates, 2, 7);

    if (allResolved.length === 0) {
      throw new Error('Failed to resolve any series');
    }

    return {
      primarySeries: allResolved[0], // Highest confidence
      relatedSeries: allResolved.slice(1),
      totalResolved: allResolved.length
    };
  }
}
