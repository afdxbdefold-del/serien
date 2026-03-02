/**
 * Rollback Processed Images
 * Restores original TMDB images
 * 
 * Usage:
 *   npx tsx scripts/rollback-processed-images.ts [articleId]
 *   npx tsx scripts/rollback-processed-images.ts --all
 */

import { PrismaClient } from '@prisma/client';
import { restoreOriginalImage } from '../lib/image-processor';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function rollbackArticleImage(articleId: string) {
  try {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        title: true,
        imageData: true,
      },
    });

    if (!article) {
      console.error(`❌ Article ${articleId} not found`);
      return false;
    }

    const imageData = article.imageData as any;

    if (!imageData?.processedImageUrl) {
      console.log(`⊘ No processed image for: ${article.title}`);
      return false;
    }

    console.log(`\n🔄 Rolling back: ${article.title}`);
    console.log(`   Processed: ${imageData.processedImageUrl}`);

    // Restore original
    const processedPath = path.join(
      process.cwd(),
      'public',
      imageData.processedImageUrl.replace(/^\//, '')
    );

    if (fs.existsSync(processedPath)) {
      const restored = await restoreOriginalImage(processedPath);
      
      if (!restored) {
        console.error(`❌ Restore failed`);
        return false;
      }
    }

    // Update database - remove processed image references
    const { processedImageUrl, originalBackup, processedAt, ...cleanImageData } = imageData;

    await prisma.article.update({
      where: { id: articleId },
      data: {
        imageData: cleanImageData,
      },
    });

    console.log(`✅ Rolled back successfully`);
    return true;

  } catch (error: any) {
    console.error(`❌ Error rolling back article ${articleId}:`, error.message);
    return false;
  }
}

async function rollbackAllArticles() {
  try {
    // Find all articles with processed images
    const articles = await prisma.article.findMany({
      where: {
        imageData: {
          path: ['processedImageUrl'],
          not: null,
        },
      },
      select: {
        id: true,
        title: true,
      },
    });

    console.log(`\n🔄 Rolling back ${articles.length} articles...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const article of articles) {
      const result = await rollbackArticleImage(article.id);
      
      if (result) {
        successCount++;
      } else {
        failCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 SUMMARY`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Rolled back: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
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
    console.error('Usage: npx tsx scripts/rollback-processed-images.ts [articleId|--all]');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx scripts/rollback-processed-images.ts pipeline-1234567890');
    console.error('  npx tsx scripts/rollback-processed-images.ts --all');
    process.exit(1);
  }

  if (arg === '--all') {
    await rollbackAllArticles();
  } else {
    await rollbackArticleImage(arg);
  }

  await prisma.$disconnect();
}

main();
