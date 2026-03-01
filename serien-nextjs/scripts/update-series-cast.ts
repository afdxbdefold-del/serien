/**
 * Update Series with Cast & Crew Data from TMDB
 * Populates series.cast and series.crew fields for better performance
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

/**
 * Fetch cast & crew from TMDB API
 */
async function fetchTMDBCredits(tmdbId: number): Promise<{ cast: TMDBCastMember[]; crew: TMDBCrewMember[] } | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdbId}/aggregate_credits?api_key=${TMDB_API_KEY}&language=de-DE`
    );

    if (!response.ok) {
      console.error(`   ❌ TMDB API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Extract cast (top 20)
    const cast = (data.cast || [])
      .slice(0, 20)
      .map((member: any) => ({
        id: member.id,  // TMDB ID for linking
        name: member.name,
        character: member.roles?.[0]?.character || '',
        profile_path: member.profile_path,
        order: member.order || 999,
      }));

    // Extract crew (directors, creators, writers, producers)
    const crew = (data.crew || [])
      .filter((member: any) => 
        ['Director', 'Creator', 'Executive Producer', 'Writer', 'Producer'].includes(member.jobs?.[0]?.job)
      )
      .slice(0, 20)
      .map((member: any) => ({
        id: member.id,
        name: member.name,
        job: member.jobs?.[0]?.job || '',
        department: member.department || '',
        profile_path: member.profile_path,
      }));

    return { cast, crew };
  } catch (error: any) {
    console.error(`   ❌ Error fetching TMDB credits:`, error.message);
    return null;
  }
}

/**
 * Update a single series with cast & crew data
 */
async function updateSeriesCredits(tmdbId: number): Promise<boolean> {
  try {
    // Check if series exists
    const series = await prisma.series.findUnique({
      where: { tmdbId },
      select: { name: true, title: true, cast: true, crew: true }
    });

    if (!series) {
      console.log(`   ⏭️  Series ${tmdbId} not found in database`);
      return false;
    }

    // Skip if already has cast data
    if (series.cast && Array.isArray(series.cast) && series.cast.length > 0) {
      console.log(`   ✓ ${series.name || series.title} already has cast data (${series.cast.length} members)`);
      return true;
    }

    console.log(`   📡 Fetching credits for: ${series.name || series.title}`);

    // Fetch from TMDB
    const credits = await fetchTMDBCredits(tmdbId);

    if (!credits) {
      console.log(`   ❌ Failed to fetch credits`);
      return false;
    }

    console.log(`   ✓ Fetched ${credits.cast.length} cast, ${credits.crew.length} crew`);

    // Update database
    await prisma.series.update({
      where: { tmdbId },
      data: {
        cast: credits.cast as any,
        crew: credits.crew as any,
        updatedAt: new Date(),
      },
    });

    console.log(`   ✅ Updated ${series.name || series.title}`);
    return true;

  } catch (error: any) {
    console.error(`   ❌ Error updating series ${tmdbId}:`, error.message);
    return false;
  }
}

/**
 * Update all series or specific ones
 */
async function main() {
  const targetTmdbId = process.argv[2] ? parseInt(process.argv[2]) : null;

  if (targetTmdbId) {
    // Single series update
    console.log(`\n🎬 Updating Cast/Crew for Series ${targetTmdbId}\n`);
    await updateSeriesCredits(targetTmdbId);
  } else {
    // Bulk update: All series without cast data
    console.log(`\n🎬 Bulk Update: Cast/Crew for All Series\n`);

    const seriesList = await prisma.series.findMany({
      where: {
        OR: [
          { cast: { equals: null } },
          { cast: { equals: [] } },
        ],
      },
      select: { tmdbId: true, name: true, title: true },
      orderBy: { popularity: 'desc' },
      take: 50, // Top 50 series by popularity
    });

    console.log(`📊 Found ${seriesList.length} series without cast data\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < seriesList.length; i++) {
      const series = seriesList[i];
      console.log(`\n[${i + 1}/${seriesList.length}] ${series.name || series.title} (TMDB: ${series.tmdbId})`);

      const success = await updateSeriesCredits(series.tmdbId);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Rate limiting: 1 second between requests
      if (i < seriesList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📝 Total: ${seriesList.length}`);
    console.log('='.repeat(60));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
