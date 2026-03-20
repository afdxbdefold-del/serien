/**
 * Post-processing script to add internal links to articles
 * This ensures cast and character links work even if the initial pipeline failed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LinkableEntity {
  name: string;
  slug: string;
  type: 'person' | 'character';
}

async function getSeriesLinkableEntities(tmdbId: number): Promise<LinkableEntity[]> {
  const entities: LinkableEntity[] = [];
  
  // Get series with cast JSON
  const series = await prisma.series.findUnique({
    where: { tmdbId },
    select: { cast: true }
  });
  
  // Parse cast JSON and find persons
  if (series?.cast && Array.isArray(series.cast)) {
    for (const castMember of series.cast as any[]) {
      if (castMember.name) {
        // Check if person exists in DB with a slug
        const person = await prisma.persons.findFirst({
          where: { name: castMember.name },
          select: { name: true, slug: true }
        });
        if (person?.slug) {
          entities.push({ name: person.name, slug: `/person/${person.slug}`, type: 'person' });
        }
      }
    }
  }
  
  // Get characters with name variants
  const characters = await prisma.characters.findMany({
    where: { seriesTmdbId: tmdbId },
    select: { name: true, slug: true }
  });
  
  for (const c of characters) {
    if (c.slug) {
      // Add full name
      entities.push({ name: c.name, slug: `/figur/${c.slug}`, type: 'character' });
      
      // Add common short names/variants for One Piece characters
      const shortNames: Record<string, string[]> = {
        'Monkey D. Luffy': ['Luffy', 'Ruffy', 'Monkey D Luffy'],
        'Roronoa Zoro': ['Zoro', 'Lorenor Zorro'],
        'Vice-Admiral Garp': ['Garp', 'Monkey D. Garp'],
      };
      
      if (shortNames[c.name]) {
        for (const variant of shortNames[c.name]) {
          entities.push({ name: variant, slug: `/figur/${c.slug}`, type: 'character' });
        }
      }
    }
  }
  
  // Sort by name length (longest first) to avoid partial replacements
  entities.sort((a, b) => b.name.length - a.name.length);
  
  return entities;
}

function addLinksToHtml(html: string, entities: LinkableEntity[]): { html: string; linksAdded: number } {
  let result = html;
  let linksAdded = 0;
  const linkedNames = new Set<string>();
  
  for (const entity of entities) {
    // Skip if already linked
    if (linkedNames.has(entity.name.toLowerCase())) continue;
    
    // Create regex to find name NOT already in a link
    // Match the name only if it's NOT preceded by "> or followed by </a>
    const nameEscaped = entity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Pattern: find name that's not inside an existing <a> tag
    const pattern = new RegExp(
      `(?<!<a[^>]*>.*?)\\b(${nameEscaped})\\b(?![^<]*</a>)`,
      'i'
    );
    
    // Only replace FIRST occurrence (first mention rule)
    const match = result.match(pattern);
    if (match) {
      const link = `<a href="${entity.slug}" class="text-cyan-600 dark:text-cyan-400 hover:underline">${match[1]}</a>`;
      result = result.replace(pattern, link);
      linkedNames.add(entity.name.toLowerCase());
      linksAdded++;
    }
  }
  
  return { html: result, linksAdded };
}

async function fixArticleLinks(articleSlug: string): Promise<void> {
  console.log(`\n🔗 Fixing links for: ${articleSlug}`);
  
  const article = await prisma.articles.findUnique({
    where: { slug: articleSlug },
    select: { 
      id: true, 
      title: true, 
      contentHtml: true, 
      primarySeriesId: true 
    }
  });
  
  if (!article) {
    console.log('   ❌ Article not found');
    return;
  }
  
  if (!article.primarySeriesId) {
    console.log('   ❌ No series assigned');
    return;
  }
  
  console.log(`   📺 Series TMDB ID: ${article.primarySeriesId}`);
  
  // Get linkable entities
  const entities = await getSeriesLinkableEntities(article.primarySeriesId);
  console.log(`   📋 Found ${entities.length} linkable entities`);
  
  if (entities.length === 0) {
    console.log('   ⚠️  No entities to link');
    return;
  }
  
  // Add links
  const { html: newHtml, linksAdded } = addLinksToHtml(article.contentHtml, entities);
  
  if (linksAdded === 0) {
    console.log('   ℹ️  No new links needed');
    return;
  }
  
  // Update article
  await prisma.articles.update({
    where: { id: article.id },
    data: { contentHtml: newHtml }
  });
  
  console.log(`   ✅ Added ${linksAdded} internal links`);
}

async function fixAllArticlesForSeries(tmdbId: number): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔧 FIXING ALL ARTICLES FOR SERIES TMDB ID: ${tmdbId}`);
  console.log('='.repeat(60));
  
  const articles = await prisma.articles.findMany({
    where: { primarySeriesId: tmdbId },
    select: { slug: true, title: true }
  });
  
  console.log(`Found ${articles.length} articles\n`);
  
  for (const article of articles) {
    await fixArticleLinks(article.slug);
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎉 DONE');
  console.log('='.repeat(60));
}

// Run for One Piece
fixAllArticlesForSeries(111110)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
