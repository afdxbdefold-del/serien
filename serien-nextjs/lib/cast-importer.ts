/**
 * Cast Importer - Automatically imports cast members to persons table
 * Called during article publishing to ensure all actors have internal pages
 */

import { PrismaClient } from '@prisma/client';
import { uploadPersonProfile } from './blob-uploader';

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

/**
 * Create slug for person page
 */
function createPersonSlug(name: string, tmdbId: number): string {
  const nameSlug = name
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  return `${tmdbId}-${nameSlug}`;
}

/**
 * Fetch cast from TMDB API
 */
async function fetchTMDBCast(tmdbId: number): Promise<TMDBCastMember[]> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdbId}/aggregate_credits?api_key=${TMDB_API_KEY}&language=de-DE`
    );

    if (!response.ok) {
      console.error(`   ❌ TMDB API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    // Extract top 10 cast members
    const cast = (data.cast || [])
      .slice(0, 10)
      .map((member: any) => ({
        id: member.id,
        name: member.name,
        character: member.roles?.[0]?.character || '',
        profile_path: member.profile_path,
        order: member.order || 999,
      }));

    return cast;
  } catch (error: any) {
    console.error(`   ❌ Error fetching TMDB cast:`, error.message);
    return [];
  }
}

/**
 * Import cast members for a series into persons table AND series.cast JSON
 * Only imports if they don't already exist
 */
export async function importSeriesCast(seriesTmdbId: number): Promise<number> {
  try {
    console.log(`\n👥 Importing cast members for series ${seriesTmdbId}...`);

    // Fetch cast from TMDB
    const cast = await fetchTMDBCast(seriesTmdbId);

    if (cast.length === 0) {
      console.log(`   ⚠️  No cast members found`);
      return 0;
    }

    console.log(`   ✓ Fetched ${cast.length} cast members`);

    let importedCount = 0;

    for (const member of cast) {
      try {
        // Check if person already exists
        const existing = await prisma.persons.findUnique({
          where: { tmdbId: member.id },
        });

        if (existing) {
          // console.log(`   ↩️  ${member.name} already exists`);
          continue;
        }

        // Create new person entry
        const slug = createPersonSlug(member.name, member.id);
        
        await prisma.persons.create({
          data: {
            id: `person-${member.id}`,
            tmdbId: member.id,
            slug,
            name: member.name,
            profilePath: member.profile_path || null,
            biography: null,
            knownFor: null,
            birthDate: null,
            birthPlace: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // ✅ Upload profile image to Vercel Blob (async)
        if (member.profile_path) {
          uploadPersonProfile(member.id, member.profile_path)
            .then((blobUrl) => {
              if (blobUrl) {
                prisma.persons.update({
                  where: { tmdbId: member.id },
                  data: { localProfilePath: blobUrl }
                }).catch(() => {});
              }
            })
            .catch(() => {});
        }

        console.log(`   ✅ Imported: ${member.name}`);
        importedCount++;

      } catch (error: any) {
        // Ignore duplicate key errors (race condition)
        if (error.code === 'P2002') {
          // console.log(`   ↩️  ${member.name} already exists (race condition)`);
          continue;
        }
        console.error(`   ❌ Failed to import ${member.name}:`, error.message);
      }
    }

    if (importedCount > 0) {
      console.log(`   🎉 Imported ${importedCount} new cast members`);
    } else {
      console.log(`   ℹ️  All cast members already exist`);
    }

    // ✅ UPDATE series.cast JSON field for frontend display
    try {
      await prisma.series.update({
        where: { tmdbId: seriesTmdbId },
        data: {
          cast: cast.map(member => ({
            id: member.id,
            name: member.name,
            character: member.character,
            profile_path: member.profile_path,
            order: member.order,
          })),
          updatedAt: new Date(),
        },
      });
      console.log(`   ✅ Updated series.cast field with ${cast.length} members`);
    } catch (error: any) {
      console.error(`   ⚠️  Failed to update series.cast field:`, error.message);
    }

    return importedCount;

  } catch (error: any) {
    console.error(`   ❌ Error importing cast:`, error.message);
    return 0;
  }
}
