/**
 * Analyze and Fix Internal 404 Links
 * 
 * Scans all articles for internal links and checks if they resolve.
 * Removes or replaces broken links.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BrokenLink {
  articleSlug: string;
  articleTitle: string;
  brokenUrl: string;
  linkText: string;
  type: 'article' | 'serie' | 'figur' | 'person' | 'other';
  suggestion?: string;
}

interface LinkStats {
  totalLinks: number;
  validLinks: number;
  brokenLinks: number;
  fixedLinks: number;
  removedLinks: number;
}

async function analyzeAndFixLinks() {
  console.log('🔍 Analyzing internal links in all articles...\n');

  // Get all valid slugs/paths from database
  const [articles, series, characters, persons] = await Promise.all([
    prisma.articles.findMany({
      where: { OR: [{ status: 'published' }, { status: 'PUBLISHED' }] },
      select: { slug: true }
    }),
    prisma.series.findMany({
      select: { tmdbId: true, slug: true }
    }),
    prisma.characters.findMany({
      where: { publishStatus: 'published' },
      select: { slug: true }
    }),
    prisma.persons.findMany({
      select: { slug: true, tmdbId: true }
    })
  ]);

  // Create lookup sets
  const validArticleSlugs = new Set(articles.map(a => a.slug));
  const validSeriesSlugs = new Set(series.map(s => `${s.tmdbId}-${s.slug}`));
  const validSeriesTmdbIds = new Set(series.map(s => s.tmdbId.toString()));
  const validCharacterSlugs = new Set(characters.map(c => c.slug));
  const validPersonSlugs = new Set(persons.map(p => p.slug));
  const validPersonIds = new Set(persons.map(p => `${p.tmdbId}-${p.slug}`));

  console.log(`📊 Database stats:`);
  console.log(`   - Articles: ${validArticleSlugs.size}`);
  console.log(`   - Series: ${validSeriesSlugs.size}`);
  console.log(`   - Characters: ${validCharacterSlugs.size}`);
  console.log(`   - Persons: ${validPersonSlugs.size}`);
  console.log('');

  // Get all articles with content
  const allArticles = await prisma.articles.findMany({
    where: { OR: [{ status: 'published' }, { status: 'PUBLISHED' }] },
    select: { id: true, slug: true, title: true, contentHtml: true }
  });

  console.log(`📄 Scanning ${allArticles.length} articles for internal links...\n`);

  const brokenLinks: BrokenLink[] = [];
  const stats: LinkStats = {
    totalLinks: 0,
    validLinks: 0,
    brokenLinks: 0,
    fixedLinks: 0,
    removedLinks: 0
  };

  // Internal link patterns
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  const internalPaths = ['/figur/', '/serie/', '/person/', '/autoren', '/netflix-serien', '/kalender', '/serienfinder', '/figuren', '/personen'];

  for (const article of allArticles) {
    let match;
    linkRegex.lastIndex = 0;

    while ((match = linkRegex.exec(article.contentHtml)) !== null) {
      const url = match[1];
      const linkText = match[2];

      // Skip external links and anchors
      if (url.startsWith('http') && !url.includes('serien.de')) continue;
      if (url.startsWith('#')) continue;
      if (url.startsWith('mailto:')) continue;

      // Normalize URL
      let path = url;
      if (url.includes('serien.de')) {
        try {
          path = new URL(url).pathname;
        } catch {
          continue;
        }
      }

      stats.totalLinks++;

      // Check if link is valid
      let isValid = false;
      let linkType: BrokenLink['type'] = 'other';
      let suggestion: string | undefined;

      if (path.startsWith('/figur/')) {
        linkType = 'figur';
        const slug = path.replace('/figur/', '');
        isValid = validCharacterSlugs.has(slug);
        
        if (!isValid) {
          // Try to find similar character
          const similar = findSimilar(slug, Array.from(validCharacterSlugs));
          if (similar) suggestion = `/figur/${similar}`;
        }
      } else if (path.startsWith('/serie/')) {
        linkType = 'serie';
        const slug = path.replace('/serie/', '');
        isValid = validSeriesSlugs.has(slug) || validSeriesTmdbIds.has(slug.split('-')[0]);
        
        if (!isValid) {
          const similar = findSimilar(slug, Array.from(validSeriesSlugs));
          if (similar) suggestion = `/serie/${similar}`;
        }
      } else if (path.startsWith('/person/')) {
        linkType = 'person';
        const slug = path.replace('/person/', '');
        isValid = validPersonIds.has(slug) || validPersonSlugs.has(slug);
        
        if (!isValid) {
          const similar = findSimilar(slug, Array.from(validPersonIds));
          if (similar) suggestion = `/person/${similar}`;
        }
      } else if (path === '/' || internalPaths.some(p => path.startsWith(p))) {
        // Known valid paths
        isValid = true;
      } else if (path.startsWith('/')) {
        // Article link
        linkType = 'article';
        const slug = path.replace('/', '').replace(/\/$/, '');
        isValid = validArticleSlugs.has(slug);
        
        if (!isValid) {
          const similar = findSimilar(slug, Array.from(validArticleSlugs));
          if (similar) suggestion = `/${similar}`;
        }
      }

      if (isValid) {
        stats.validLinks++;
      } else {
        stats.brokenLinks++;
        brokenLinks.push({
          articleSlug: article.slug,
          articleTitle: article.title,
          brokenUrl: path,
          linkText,
          type: linkType,
          suggestion
        });
      }
    }
  }

  console.log('═'.repeat(60));
  console.log('📊 ANALYSIS RESULTS');
  console.log('═'.repeat(60));
  console.log(`Total internal links: ${stats.totalLinks}`);
  console.log(`Valid links: ${stats.validLinks}`);
  console.log(`Broken links: ${stats.brokenLinks}`);
  console.log('');

  if (brokenLinks.length === 0) {
    console.log('✅ No broken links found!');
    await prisma.$disconnect();
    return;
  }

  // Group broken links by type
  const byType: Record<string, BrokenLink[]> = {};
  for (const link of brokenLinks) {
    if (!byType[link.type]) byType[link.type] = [];
    byType[link.type].push(link);
  }

  console.log('🔴 BROKEN LINKS BY TYPE:');
  for (const [type, links] of Object.entries(byType)) {
    console.log(`\n  ${type.toUpperCase()} (${links.length}):`);
    for (const link of links.slice(0, 10)) {
      console.log(`    - ${link.brokenUrl}`);
      console.log(`      in: ${link.articleSlug}`);
      if (link.suggestion) {
        console.log(`      suggestion: ${link.suggestion}`);
      }
    }
    if (links.length > 10) {
      console.log(`    ... and ${links.length - 10} more`);
    }
  }

  // Fix broken links
  console.log('\n' + '═'.repeat(60));
  console.log('🔧 FIXING BROKEN LINKS');
  console.log('═'.repeat(60));

  const articlesToUpdate: Map<string, { id: string; contentHtml: string }> = new Map();

  // Load articles that need fixing
  const articleSlugsToFix = [...new Set(brokenLinks.map(l => l.articleSlug))];
  const articlesWithBrokenLinks = await prisma.articles.findMany({
    where: { slug: { in: articleSlugsToFix } },
    select: { id: true, slug: true, contentHtml: true }
  });

  for (const article of articlesWithBrokenLinks) {
    articlesToUpdate.set(article.slug, { id: article.id, contentHtml: article.contentHtml });
  }

  for (const broken of brokenLinks) {
    const articleData = articlesToUpdate.get(broken.articleSlug);
    if (!articleData) continue;

    let { contentHtml } = articleData;
    const escapedUrl = broken.brokenUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const linkPattern = new RegExp(
      `<a\\s+[^>]*href=["']${escapedUrl}["'][^>]*>([^<]*)<\\/a>`,
      'gi'
    );

    if (broken.suggestion) {
      // Replace with suggestion
      contentHtml = contentHtml.replace(linkPattern, (match, text) => {
        stats.fixedLinks++;
        console.log(`  ✅ Fixed: ${broken.brokenUrl} → ${broken.suggestion}`);
        return `<a href="${broken.suggestion}">${text}</a>`;
      });
    } else {
      // Remove link, keep text
      contentHtml = contentHtml.replace(linkPattern, (match, text) => {
        stats.removedLinks++;
        console.log(`  🗑️  Removed: ${broken.brokenUrl} (kept text: "${text.substring(0, 30)}...")`);
        return text;
      });
    }

    articleData.contentHtml = contentHtml;
  }

  // Save updated articles
  console.log('\n💾 Saving changes...');
  let savedCount = 0;

  for (const [slug, data] of articlesToUpdate) {
    await prisma.articles.update({
      where: { id: data.id },
      data: { contentHtml: data.contentHtml }
    });
    savedCount++;
  }

  console.log(`\n✅ Updated ${savedCount} articles`);
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Fixed links: ${stats.fixedLinks}`);
  console.log(`Removed links: ${stats.removedLinks}`);
  console.log(`Articles updated: ${savedCount}`);
  console.log('═'.repeat(60));

  await prisma.$disconnect();
}

function findSimilar(target: string, candidates: string[]): string | undefined {
  // Simple similarity: find candidate that contains most of target's words
  const targetWords = target.toLowerCase().split('-').filter(w => w.length > 2);
  
  let bestMatch: string | undefined;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candidateWords = candidate.toLowerCase().split('-').filter(w => w.length > 2);
    let score = 0;
    
    for (const word of targetWords) {
      if (candidateWords.some(cw => cw.includes(word) || word.includes(cw))) {
        score++;
      }
    }

    // Need at least 2 matching words
    if (score >= 2 && score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

analyzeAndFixLinks().catch(console.error);
