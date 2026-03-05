#!/usr/bin/env tsx
/**
 * Automatically search and add trailers to articles
 * Searches YouTube for "Serienname + Trailer + Deutsch"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TrailerSearchResult {
  url: string;
  title: string;
  source: string;
}

/**
 * Search for trailer using web search
 * Note: In production, this would use the web_search API
 * For now, this is a placeholder that needs manual implementation
 */
async function searchTrailer(seriesName: string): Promise<TrailerSearchResult | null> {
  console.log(`🔍 Searching for: "${seriesName} Trailer Deutsch"`);
  
  // TODO: Implement web search API call here
  // For now, return null - user needs to manually search
  console.log('⚠️  Manual search required. Search on YouTube: "${seriesName} Trailer Deutsch"');
  return null;
}

/**
 * Add trailer to article
 */
async function addTrailerToArticle(articleSlug: string, trailerUrl: string) {
  try {
    await prisma.articles.update({
      where: { slug: articleSlug },
      data: { heroVideoUrl: trailerUrl },
    });
    console.log(`✅ Trailer added to article: ${articleSlug}`);
  } catch (error: any) {
    console.error(`❌ Error updating article: ${error.message}`);
  }
}

/**
 * Find articles without trailers and their series
 */
async function findArticlesWithoutTrailers(limit: number = 10) {
  const articles = await prisma.articles.findMany({
    where: {
      status: 'published',
      heroVideoUrl: null,
      trailerLocalUrl: null,
    },
    take: limit,
    select: {
      slug: true,
      title: true,
      series: {
        select: {
          title: true,
          name: true,
        },
      },
    },
  });

  return articles;
}

async function main() {
  console.log('\n📊 Finding articles without trailers...\n');

  const articles = await findArticlesWithoutTrailers(10);

  console.log(`Found ${articles.length} articles without trailers:\n`);

  articles.forEach((article, i) => {
    const seriesName = article.series?.title || article.series?.name || 'Unknown';
    console.log(`${i + 1}. ${article.title}`);
    console.log(`   Series: ${seriesName}`);
    console.log(`   Slug: ${article.slug}`);
    console.log(`   Search: "${seriesName} Trailer Deutsch"`);
    console.log('');
  });

  console.log('\n💡 To add a trailer to an article:');
  console.log('   1. Search YouTube: "[Serienname] Trailer Deutsch"');
  console.log('   2. Run: npx tsx scripts/add-trailer.ts [article-slug] [youtube-url]');
}

// Allow manual trailer addition via command line
const args = process.argv.slice(2);
if (args.length === 2) {
  const [articleSlug, trailerUrl] = args;
  
  console.log(`\n📹 Adding trailer to article...`);
  console.log(`   Article: ${articleSlug}`);
  console.log(`   Trailer: ${trailerUrl}\n`);
  
  addTrailerToArticle(articleSlug, trailerUrl)
    .then(() => {
      console.log('\n✅ Done!');
      prisma.$disconnect();
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
} else {
  main()
    .then(() => {
      prisma.$disconnect();
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
