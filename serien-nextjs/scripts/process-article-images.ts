/**
 * Process Article Images
 * Makes existing article images unique for Google
 * 
 * Usage:
 *   npx tsx scripts/process-article-images.ts [articleId]
 *   npx tsx scripts/process-article-images.ts --all
 */

import { PrismaClient } from '@prisma/client';
import { processImageForUniqueness } from '../lib/image-processor';
import * as path from 'path';

const prisma = new PrismaClient();

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'img', 'processed');

async function processArticleImage(articleId: string) {
  try {
    // Get article
    const article = await prisma.articles.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        title: true,
        slug: true,
        imageData: true,
        primarySeriesId: true,
      },
    });

    if (!article) {
      console.error(`❌ Article ${articleId} not found`);
      return false;
    }

    // Get series name
    let seriesName = 'Unknown';
    if (article.primarySeriesId) {
      const series = await prisma.series.findUnique({
        where: { tmdbId: article.primarySeriesId },
        select: { name: true, title: true },
      });
      seriesName = series?.name || series?.title || 'Unknown';
    }

    const imageData = article.imageData as any;
    
    if (!imageData?.tmdbBackdropPath) {
      console.log(`⊘ No backdrop for article: ${article.title}`);
      return false;
    }

    console.log(`\n📸 Processing: ${article.title}`);
    console.log(`   Series: ${seriesName}`);
    console.log(`   Original: ${imageData.tmdbBackdropPath}`);

    // Process image
    const sourceUrl = `${TMDB_IMAGE_BASE}${imageData.tmdbBackdropPath}`;
    const result = await processImageForUniqueness(sourceUrl, OUTPUT_DIR, {
      articleTitle: article.title,
      articleSlug: article.slug,
      seriesName,
      cropPercent: 5,
      quality: 90,
    });

    if (!result.success) {
      console.error(`❌ Processing failed: ${result.error}`);
      return false;
    }

    // Update article with processed image path
    const processedUrl = `/img/processed/${path.basename(result.processedPath!)}`;
    const originalBackup = `/img/processed/${path.basename(result.originalPath!)}`;

    await prisma.articles.update({
      where: { id: articleId },
      data: {
        imageData: {
          ...imageData,
          processedImageUrl: processedUrl,
          originalBackup: originalBackup,
          processedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`✅ Saved: ${processedUrl}`);
    return true;

  } catch (error: any) {
    console.error(`❌ Error processing article ${articleId}:`, error.message);
    return false;
  }
}

async function processAllArticles() {
  try {
    const articles = await prisma.articles.findMany({
      where: {
        status: 'published',
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
    });

    console.log(`\n🎬 Processing ${articles.length} articles...\n`);

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (const article of articles) {
      const result = await processArticleImage(article.id);
      
      if (result === true) {
        successCount++;
      } else if (result === false) {
        failCount++;
      } else {
        skipCount++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 SUMMARY`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Processed: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⊘ Skipped: ${skipCount}`);
    console.log(`📸 Total: ${articles.length}`);
    console.log('');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.error('Usage: npx tsx scripts/process-article-images.ts [articleId|--all]');
    process.exit(1);
  }

  if (arg === '--all') {
    await processAllArticles();
  } else {
    await processArticleImage(arg);
  }

  await prisma.$disconnect();
}

main();
