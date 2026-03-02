/**
 * Phase 3: Actor Linking & Database Population Script
 * 
 * This script:
 * 1. Extracts actor names from articles
 * 2. Searches TMDB for person data
 * 3. Creates person records in database
 * 4. Links articles to persons via article_persons
 * 5. Updates article HTML to include person page links
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  searchTMDBPerson,
  getTMDBPersonDetails,
  createPersonSlug,
  TMDBPersonDetails
} from '../lib/tmdb-person';

const prisma = new PrismaClient();

interface ActorMention {
  name: string;
  articleId: string;
  articleTitle: string;
}

/**
 * Extract potential actor names from article HTML
 * Focuses on <strong> tags which typically contain important names
 */
function extractActorNames(html: string, title: string): string[] {
  const actors = new Set<string>();
  
  // PRIMARY: Extract names from <strong> tags (most reliable)
  const strongPattern = /<strong>([^<]+)<\/strong>/g;
  let match;
  
  while ((match = strongPattern.exec(html)) !== null) {
    const text = match[1].trim();
    
    // Check if it's a person name (2-4 words, properly capitalized)
    const words = text.split(/\s+/);
    
    if (words.length >= 2 && words.length <= 4) {
      // Check if all words start with capital letter
      const isProperName = words.every(word => /^[A-ZÄÖÜ]/.test(word));
      
      if (isProperName) {
        // Exclude obvious non-names
        const excludePatterns = [
          /^\d+/,                    // Starts with number
          /Staffel|Season/i,         // Season references
          /Netflix|HBO|Amazon/i,     // Company names
          /Academy|School|University/i, // Institutions
          /Addams$/,                 // Character surnames without first name context
          /^Mai|Juni|Juli|Januar/i,  // Months
          /^Ende|Anfang|Weitere/i,   // German common words
          /Ireland|Irland|Rumänien/i // Places
        ];
        
        const shouldExclude = excludePatterns.some(pattern => pattern.test(text));
        
        if (!shouldExclude) {
          actors.add(text);
        }
      }
    }
  }
  
  return Array.from(actors);
}

/**
 * Create or get person record from TMDB
 */
async function createPersonRecord(
  tmdbId: number,
  personData: TMDBPersonDetails
): Promise<string | null> {
  try {
    const slug = `${tmdbId}-${createPersonSlug(personData.name)}`;
    const personId = uuidv4();
    
    // Check if already exists
    const existing = await prisma.persons.findUnique({
      where: { tmdbId }
    });
    
    if (existing) {
      console.log(`  ✓ Person already exists: ${personData.name}`);
      return existing.id;
    }
    
    // Create new person
    await prisma.persons.create({
      data: {
        id: personId,
        tmdbId,
        slug,
        name: personData.name,
        biography: personData.biography || null,
        profilePath: personData.profile_path || null,
        knownFor: personData.known_for_department || 'Acting',
        birthDate: personData.birthday ? new Date(personData.birthday) : null,
        birthPlace: personData.place_of_birth || null,
        popularity: personData.popularity || 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    console.log(`  ✓ Created person: ${personData.name} (${slug})`);
    return personId;
  } catch (error) {
    console.error(`  ✗ Failed to create person ${personData.name}:`, error);
    return null;
  }
}

/**
 * Link article to person
 */
async function linkArticleToPerson(articleId: string, personId: string): Promise<boolean> {
  try {
    // Check if link already exists
    const existing = await prisma.article_persons.findUnique({
      where: {
        articleId_personId: { articleId, personId }
      }
    });
    
    if (existing) {
      return true;
    }
    
    await prisma.article_persons.create({
      data: { articleId, personId }
    });
    
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to link article to person:`, error);
    return false;
  }
}

/**
 * Update article HTML to include person links
 */
async function updateArticleWithPersonLinks(
  articleId: string,
  actorMappings: Map<string, { tmdbId: number; slug: string }>
): Promise<boolean> {
  try {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { contentHtml: true }
    });
    
    if (!article) {
      return false;
    }
    
    let updatedHtml = article.contentHtml;
    
    // Replace actor names with links (only first occurrence to avoid over-linking)
    for (const [actorName, { tmdbId, slug }] of actorMappings) {
      const personUrl = `/person/${tmdbId}-${slug}`;
      
      // Create link with proper styling
      const link = `<a href="${personUrl}" class="text-blue-600 hover:text-blue-800 underline font-medium">${actorName}</a>`;
      
      // Replace first occurrence only (case-sensitive)
      const regex = new RegExp(`\\b${actorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      updatedHtml = updatedHtml.replace(regex, link);
    }
    
    // Update article
    await prisma.article.update({
      where: { id: articleId },
      data: { contentHtml: updatedHtml, updatedAt: new Date() }
    });
    
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to update article HTML:`, error);
    return false;
  }
}

/**
 * Process a single article
 */
async function processArticle(article: any, dryRun: boolean = false): Promise<void> {
  console.log(`\n📄 Processing: ${article.title}`);
  
  // Extract actor names
  const extractedNames = extractActorNames(article.contentHtml, article.title);
  console.log(`  → Found ${extractedNames.length} potential actors: ${extractedNames.join(', ')}`);
  
  if (extractedNames.length === 0) {
    console.log(`  ℹ️  No actors found, skipping.`);
    return;
  }
  
  const actorMappings = new Map<string, { tmdbId: number; slug: string }>();
  let successCount = 0;
  
  // Search TMDB for each name
  for (const name of extractedNames) {
    console.log(`\n  🔍 Searching TMDB for: ${name}`);
    
    const searchResult = await searchTMDBPerson(name);
    
    if (!searchResult) {
      console.log(`    ✗ Not found or not a valid actor`);
      continue;
    }
    
    console.log(`    ✓ Found: ${searchResult.name} (ID: ${searchResult.id}, Popularity: ${searchResult.popularity.toFixed(1)})`);
    
    // Get detailed person data
    const personDetails = await getTMDBPersonDetails(searchResult.id, false);
    
    if (!personDetails) {
      console.log(`    ✗ Failed to get person details`);
      continue;
    }
    
    if (dryRun) {
      console.log(`    [DRY RUN] Would create: ${personDetails.name}`);
      successCount++;
      continue;
    }
    
    // Create person record
    const personId = await createPersonRecord(searchResult.id, personDetails);
    
    if (!personId) {
      continue;
    }
    
    // Link article to person
    const linked = await linkArticleToPerson(article.id, personId);
    
    if (linked) {
      const slug = createPersonSlug(personDetails.name);
      actorMappings.set(name, { tmdbId: searchResult.id, slug });
      successCount++;
    }
  }
  
  // Update article HTML with links
  if (!dryRun && actorMappings.size > 0) {
    const updated = await updateArticleWithPersonLinks(article.id, actorMappings);
    if (updated) {
      console.log(`  ✓ Updated article HTML with ${actorMappings.size} person links`);
    }
  }
  
  console.log(`  ✅ Processed ${successCount}/${extractedNames.length} actors`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : undefined;
  const articleSlug = args.includes('--article') ? args[args.indexOf('--article') + 1] : undefined;
  
  console.log('🚀 Actor Linking & Database Population Script');
  console.log('='.repeat(50));
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }
  
  try {
    let articles;
    
    if (articleSlug) {
      // Process single article
      articles = await prisma.article.findMany({
        where: {
          slug: articleSlug,
          status: 'published'
        },
        select: {
          id: true,
          title: true,
          slug: true,
          contentHtml: true
        }
      });
      
      if (articles.length === 0) {
        console.log(`❌ Article not found: ${articleSlug}`);
        return;
      }
    } else {
      // Process multiple articles
      articles = await prisma.article.findMany({
        where: {
          status: 'published'
        },
        take: limit,
        orderBy: {
          publishedAt: 'desc'
        },
        select: {
          id: true,
          title: true,
          slug: true,
          contentHtml: true
        }
      });
    }
    
    console.log(`📊 Processing ${articles.length} article(s)\n`);
    
    for (const article of articles) {
      await processArticle(article, dryRun);
      
      // Rate limiting: wait 500ms between articles to avoid TMDB rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Summary
    const personCount = await prisma.persons.count();
    const linksCount = await prisma.article_persons.count();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ COMPLETE');
    console.log(`📊 Total persons in database: ${personCount}`);
    console.log(`📊 Total article-person links: ${linksCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { processArticle, extractActorNames };
