/**
 * Fix Series Links Without TMDB ID
 * 
 * Converts old-style /serie/slug/ links to new format /serie/{tmdbId}-{slug}
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSeriesLinks() {
  console.log('🔧 Fixing series links without TMDB ID...\n');

  // Get all series with their slugs and tmdbIds
  const allSeries = await prisma.series.findMany({
    select: { tmdbId: true, slug: true, name: true, title: true }
  });

  // Create a lookup map: slug -> correct URL
  const seriesLookup = new Map<string, string>();
  for (const series of allSeries) {
    const correctUrl = `/serie/${series.tmdbId}-${series.slug}`;
    seriesLookup.set(series.slug || '', correctUrl);
    
    // Also add variations
    const name = (series.name || series.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (name) seriesLookup.set(name, correctUrl);
  }

  console.log(`📊 Loaded ${seriesLookup.size} series slugs\n`);

  // Get all articles
  const articles = await prisma.articles.findMany({
    where: { OR: [{ status: 'published' }, { status: 'PUBLISHED' }] },
    select: { id: true, slug: true, contentHtml: true }
  });

  let totalFixed = 0;
  let totalRemoved = 0;
  let articlesUpdated = 0;

  // Regex to find /serie/slug-only/ links (without number at start)
  const serieSlugRegex = /<a\s+([^>]*)href=["'](?:https?:\/\/serien\.de)?\/serie\/([a-z][a-z0-9-]+)\/?["']([^>]*)>([^<]*)<\/a>/gi;

  for (const article of articles) {
    let { contentHtml } = article;
    let modified = false;

    contentHtml = contentHtml.replace(serieSlugRegex, (match, before, slug, after, text) => {
      // Skip if slug starts with a number (already has tmdbId)
      if (/^\d/.test(slug)) return match;
      
      const correctUrl = seriesLookup.get(slug.toLowerCase());
      
      if (correctUrl) {
        totalFixed++;
        modified = true;
        console.log(`  ✅ ${article.slug}: /serie/${slug}/ → ${correctUrl}`);
        return `<a ${before}href="${correctUrl}"${after}>${text}</a>`;
      } else {
        // Remove link, keep text
        totalRemoved++;
        modified = true;
        console.log(`  🗑️  ${article.slug}: removed /serie/${slug}/ (no match)`);
        return text;
      }
    });

    if (modified) {
      await prisma.articles.update({
        where: { id: article.id },
        data: { contentHtml }
      });
      articlesUpdated++;
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(50));
  console.log(`Fixed links: ${totalFixed}`);
  console.log(`Removed links: ${totalRemoved}`);
  console.log(`Articles updated: ${articlesUpdated}`);
  console.log('═'.repeat(50));

  await prisma.$disconnect();
}

fixSeriesLinks().catch(console.error);
