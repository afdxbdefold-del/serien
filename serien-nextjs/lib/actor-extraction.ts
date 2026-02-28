/**
 * Actor Extraction & Person Management
 * For pipeline integration
 */

import { PrismaClient } from '@prisma/client';
import { searchTMDBPerson, getTMDBPersonDetails, createPersonSlug } from './tmdb-person';

const prisma = new PrismaClient();

export interface ExtractedActor {
  name: string;
  tmdbId: number;
  slug: string;
  biography: string;
  profilePath: string | null;
  popularity: number;
  birthDate: Date | null;
  birthPlace: string | null;
}

/**
 * Extract actor names from article content
 * Uses AI to identify real person names
 */
export async function extractActorsFromContent(
  contentHtml: string,
  seriesName: string
): Promise<string[]> {
  // Remove HTML tags for clean text analysis
  const cleanText = contentHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  
  // Simple regex patterns for common actor mention formats
  const patterns = [
    /(?:spielt|verkörpert|darstellt)\s+(?:von\s+)?([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)/g,
    /(?:Schauspieler|Schauspielerin|Darsteller|Darstellerin)\s+([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)/g,
    /([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)\s+(?:spielt|verkörpert)/g,
  ];
  
  const foundNames = new Set<string>();
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(cleanText)) !== null) {
      const name = match[1].trim();
      
      // Filter out common false positives
      if (
        name.length > 5 &&
        !name.includes('Staffel') &&
        !name.includes('Serie') &&
        name !== seriesName
      ) {
        foundNames.add(name);
      }
    }
  }
  
  // Limit to max 5 actors
  return Array.from(foundNames).slice(0, 5);
}

/**
 * Resolve actor names to TMDB persons
 * Returns only valid actors with TMDB match
 */
export async function resolveActorsToTMDB(
  actorNames: string[]
): Promise<ExtractedActor[]> {
  const resolvedActors: ExtractedActor[] = [];
  
  console.log(`🔍 Resolving ${actorNames.length} actors to TMDB...`);
  
  for (const name of actorNames) {
    try {
      // Search TMDB
      const searchResult = await searchTMDBPerson(name);
      
      if (!searchResult) {
        console.log(`   ⚠️  No TMDB match: ${name}`);
        continue;
      }
      
      // Get full details
      const details = await getTMDBPersonDetails(searchResult.id);
      
      if (!details) {
        console.log(`   ⚠️  Details fetch failed: ${name}`);
        continue;
      }
      
      resolvedActors.push({
        name: details.name,
        tmdbId: details.id,
        slug: createPersonSlug(details.name),
        biography: details.biography || '',
        profilePath: details.profile_path,
        popularity: details.popularity,
        birthDate: details.birthday ? new Date(details.birthday) : null,
        birthPlace: details.place_of_birth,
      });
      
      console.log(`   ✅ Resolved: ${name} → ${details.name} (TMDB: ${details.id})`);
      
    } catch (error) {
      console.log(`   ❌ Error resolving ${name}:`, error);
    }
  }
  
  return resolvedActors;
}

/**
 * Upsert persons to database
 * Creates or updates Person records
 */
export async function upsertPersons(actors: ExtractedActor[]): Promise<string[]> {
  const personIds: string[] = [];
  
  for (const actor of actors) {
    try {
      const personId = `person-${actor.tmdbId}`;
      
      await prisma.persons.upsert({
        where: { tmdbId: actor.tmdbId },
        create: {
          id: personId,
          tmdbId: actor.tmdbId,
          slug: actor.slug,
          name: actor.name,
          biography: actor.biography,
          profilePath: actor.profilePath,
          birthDate: actor.birthDate,
          birthPlace: actor.birthPlace,
          popularity: actor.popularity,
        },
        update: {
          name: actor.name,
          biography: actor.biography,
          profilePath: actor.profilePath,
          birthDate: actor.birthDate,
          birthPlace: actor.birthPlace,
          popularity: actor.popularity,
          updatedAt: new Date(),
        },
      });
      
      personIds.push(personId);
      console.log(`   ✅ Upserted person: ${actor.name} (${personId})`);
      
    } catch (error) {
      console.error(`   ❌ Failed to upsert ${actor.name}:`, error);
    }
  }
  
  return personIds;
}

/**
 * Link persons to article
 * Creates ArticlePerson relations
 */
export async function linkPersonsToArticle(
  articleId: string,
  personIds: string[]
): Promise<void> {
  try {
    // Delete existing relations
    await prisma.article_persons.deleteMany({
      where: { articleId },
    });
    
    // Create new relations
    for (const personId of personIds) {
      await prisma.article_persons.create({
        data: {
          articleId,
          personId,
        },
      });
    }
    
    console.log(`   ✅ Linked ${personIds.length} persons to article`);
    
  } catch (error) {
    console.error(`   ❌ Failed to link persons:`, error);
  }
}

/**
 * Full pipeline: Extract → Resolve → Upsert → Link
 */
export async function processArticleActors(
  articleId: string,
  contentHtml: string,
  seriesName: string
): Promise<number> {
  console.log('\n🎬 Processing article actors...');
  
  // Step 1: Extract actor names
  const actorNames = await extractActorsFromContent(contentHtml, seriesName);
  console.log(`   Found ${actorNames.length} potential actors:`, actorNames);
  
  if (actorNames.length === 0) {
    console.log('   ⚠️  No actors found, skipping');
    return 0;
  }
  
  // Step 2: Resolve to TMDB
  const resolvedActors = await resolveActorsToTMDB(actorNames);
  console.log(`   Resolved ${resolvedActors.length} actors to TMDB`);
  
  if (resolvedActors.length === 0) {
    console.log('   ⚠️  No TMDB matches, skipping');
    return 0;
  }
  
  // Step 3: Upsert to database
  const personIds = await upsertPersons(resolvedActors);
  
  // Step 4: Link to article
  await linkPersonsToArticle(articleId, personIds);
  
  console.log(`✅ Actor processing complete: ${personIds.length} persons linked\n`);
  
  return personIds.length;
}
