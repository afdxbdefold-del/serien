/**
 * Character Import Script
 * Semi-automatic import of characters for a specific series
 * 
 * Usage: npx tsx scripts/import-characters.ts <TMDB_SERIES_ID>
 * Example: npx tsx scripts/import-characters.ts 250307
 */

import { PrismaClient } from '@prisma/client';
import { generateCharacterContent, createCharacterSlug } from '../lib/character-content-generator';
import { searchFandomCharacter, formatFandomDataForContent } from '../lib/fandom-scraper-apify';
import pLimit from 'p-limit';

const prisma = new PrismaClient();
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface TMDBCharacter {
  id: number;
  name: string;
  credit_id: string;
}

interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  order: number;
}

/**
 * Fetch characters from TMDB API
 */
async function fetchTMDBCharacters(seriesTmdbId: number): Promise<TMDBCastMember[]> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${seriesTmdbId}/aggregate_credits?api_key=${TMDB_API_KEY}&language=de-DE`
    );

    if (!response.ok) {
      console.error(`❌ TMDB API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    // Extract top 6 main cast members
    const cast = (data.cast || [])
      .slice(0, 6)
      .map((member: any) => ({
        id: member.id,
        name: member.name,
        character: member.roles?.[0]?.character || '',
        order: member.order || 999,
      }));

    return cast;
  } catch (error: any) {
    console.error(`❌ Error fetching TMDB characters:`, error.message);
    return [];
  }
}

/**
 * Fetch series details from TMDB
 */
async function fetchSeriesDetails(seriesTmdbId: number) {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${seriesTmdbId}?api_key=${TMDB_API_KEY}&language=de-DE`
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

/**
 * Import characters for a specific series
 */
export async function importSeriesCharacters(seriesTmdbId: number) {
  console.log(`\n🎭 Importing characters for series ${seriesTmdbId}...\n`);

  // Check if series exists in DB
  const series = await prisma.series.findUnique({
    where: { tmdbId: seriesTmdbId },
    select: { tmdbId: true, name: true, title: true },
  });

  if (!series) {
    console.error(`❌ Series ${seriesTmdbId} not found in database`);
    return;
  }

  const seriesName = series.name || series.title;
  console.log(`📺 Series: ${seriesName}`);

  // Fetch characters from TMDB
  const cast = await fetchTMDBCharacters(seriesTmdbId);

  if (cast.length === 0) {
    console.log(`⚠️  No characters found on TMDB`);
    return;
  }

  console.log(`✓ Found ${cast.length} characters\n`);

  // Fetch series details for content generation
  const seriesDetails = await fetchSeriesDetails(seriesTmdbId);

  let importedCount = 0;
  let skippedCount = 0;

  // 🚀 PARALLEL PROCESSING: Process up to 3 characters simultaneously
  const limit = pLimit(3);
  
  const tasks = cast.map((member) => 
    limit(async () => {
      try {
        const characterName = member.character;

        if (!characterName || characterName.length < 2) {
          console.log(`⊘ Skipping: No valid character name for actor ${member.name}`);
          skippedCount++;
          return { success: false, skipped: true };
        }

        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Processing: ${characterName}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        // Create slug
        const slug = createCharacterSlug(characterName, seriesName);

        // Check if character already exists
        const existing = await prisma.characters.findUnique({
          where: { slug },
        });

        if (existing) {
          console.log(`↩️  Character already exists: ${characterName}`);
          skippedCount++;
          return { success: false, skipped: true };
        }

        // Find actor in persons table
        const actor = await prisma.persons.findUnique({
          where: { tmdbId: member.id },
          select: { tmdbId: true, name: true },
        });

        console.log(`🎬 Actor: ${actor?.name || member.name} ${actor ? '(in DB)' : '(not in DB)'}`);

        // HYBRID APPROACH: Try Fandom first, fallback to AI
        console.log(`\n📚 Trying Fandom.com for character data...`);
        const fandomData = await searchFandomCharacter(characterName, seriesName);
        
        let content;
        
        if (fandomData.found && fandomData.description && fandomData.description.length > 100) {
          console.log(`✅ Found character on Fandom!`);
          console.log(`   Source: ${fandomData.source_url}`);
          console.log(`   Description length: ${fandomData.description.length} chars`);
          
          // Generate content using Fandom data as context
          console.log(`🤖 Generating content with Fandom context...`);
          const fandomContext = formatFandomDataForContent(fandomData);
          
          content = await generateCharacterContent({
            name: characterName,
            seriesName,
            tmdbSeriesData: seriesDetails,
            actorName: actor?.name || member.name,
            fandomContext, // Pass Fandom data as additional context
          });
        } else {
          console.log(`⚠️  Fandom data not found or insufficient`);
          console.log(`🤖 Generating AI content (fallback)...`);
          
          content = await generateCharacterContent({
            name: characterName,
            seriesName,
            tmdbSeriesData: seriesDetails,
            actorName: actor?.name || member.name,
          });
        }

        console.log(`✓ Content generated`);
        console.log(`   - Short description: ${content.shortDescription.substring(0, 80)}...`);
        console.log(`   - Who is: ${content.whoIsContent.split(' ').length} words`);
        console.log(`   - Q&A: ${content.qa.length} questions`);

        // Create character in DB
        await prisma.characters.create({
          data: {
            id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            slug,
            name: characterName,
            seriesTmdbId,
            tmdbCharacterId: null,
            actorTmdbId: actor?.tmdbId || null,
            shortDescription: content.shortDescription,
            whoIsContent: content.whoIsContent,
            roleInSeriesContent: content.roleInSeriesContent,
            importanceContent: content.importanceContent,
            appearancesContent: content.appearancesContent,
            qaContent: JSON.stringify(content.qa),
            metaTitle: content.metaTitle,
            metaDescription: content.metaDescription,
            publishStatus: 'published',
            status: 'unbekannt',
            firstAppearance: 'Staffel 1',
            seasons: '1+',
            articleMentions: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(`✅ Character created: ${characterName}`);
        console.log(`   URL: /figur/${slug}`);
        return { success: true, skipped: false };

      } catch (error: any) {
        console.error(`❌ Error processing character ${member.character}:`, error.message);
        return { success: false, skipped: false, error: true };
      }
    })
  );
  
  // Wait for all parallel tasks to complete
  const results = await Promise.all(tasks);
  
  // Count results
  importedCount = results.filter(r => r.success).length;
  skippedCount = results.filter(r => r.skipped).length;
  const errorCount = results.filter(r => r.error).length;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 SUMMARY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Imported: ${importedCount}`);
  console.log(`⊘ Skipped: ${skippedCount}`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount}`);
  }
  console.log(`📺 Series: ${seriesName}`);
  console.log(`\n🎉 Character import completed!\n`);
}

/**
 * Main execution
 */
async function main() {
  const seriesTmdbId = process.argv[2] ? parseInt(process.argv[2]) : null;

  if (!seriesTmdbId) {
    console.error('❌ Usage: npx tsx scripts/import-characters.ts <TMDB_SERIES_ID>');
    console.error('   Example: npx tsx scripts/import-characters.ts 250307');
    process.exit(1);
  }

  await importSeriesCharacters(seriesTmdbId);
  await prisma.$disconnect();
}

// Only run main if this script is executed directly
if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
