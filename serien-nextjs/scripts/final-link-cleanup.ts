/**
 * Final Link Cleanup
 * 
 * Removes remaining broken link patterns:
 * - /tag/... links
 * - /netflix-news/, /amazon-prime-news/, /disney-plus-news/ old category links
 * - /serie/news/... links
 * - /movie4k/ links
 * - /browse/... links
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function finalCleanup() {
  console.log('🧹 Final link cleanup...\n');

  const articles = await prisma.articles.findMany({
    where: { OR: [{ status: 'published' }, { status: 'PUBLISHED' }] },
    select: { id: true, slug: true, contentHtml: true }
  });

  let totalRemoved = 0;
  let articlesUpdated = 0;

  const patterns = [
    // /tag/... links
    /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/tag\/[^"']+["'][^>]*>([^<]*)<\/a>/gi,
    // /netflix-news/, /amazon-prime-news/, /disney-plus-news/
    /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/netflix-news\/?["'][^>]*>([^<]*)<\/a>/gi,
    /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/amazon-prime-news\/?["'][^>]*>([^<]*)<\/a>/gi,
    /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/disney-plus-news\/?["'][^>]*>([^<]*)<\/a>/gi,
    // /serie/news/... links
    /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/serie\/news\/[^"']+["'][^>]*>([^<]*)<\/a>/gi,
    // /movie4k/ links
    /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/movie4k\/?["'][^>]*>([^<]*)<\/a>/gi,
    // /browse/... links
    /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/browse\/[^"']+["'][^>]*>([^<]*)<\/a>/gi,
    // /90-day-fiance/ old category link
    /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/90-day-fiance\/?["'][^>]*>([^<]*)<\/a>/gi,
    // Empty href links
    /<a\s+[^>]*href=["']["'][^>]*>([^<]*)<\/a>/gi,
    // Relative /the-witcher/ etc. without slug - keep text
    /<a\s+[^>]*href=["']\/the-witcher\/?["'][^>]*>([^<]*)<\/a>/gi,
    // /serie/90-day-fiance... links (not in DB)
    /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/serie\/90-day-fiance[^"']*["'][^>]*>([^<]*)<\/a>/gi,
  ];

  for (const article of articles) {
    let { contentHtml } = article;
    let removedInArticle = 0;

    for (const pattern of patterns) {
      contentHtml = contentHtml.replace(pattern, (match, text) => {
        removedInArticle++;
        return text;
      });
    }

    if (removedInArticle > 0) {
      await prisma.articles.update({
        where: { id: article.id },
        data: { contentHtml }
      });
      
      totalRemoved += removedInArticle;
      articlesUpdated++;
      console.log(`  ✅ ${article.slug}: removed ${removedInArticle} links`);
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(50));
  console.log(`Total links removed: ${totalRemoved}`);
  console.log(`Articles updated: ${articlesUpdated}`);
  console.log('═'.repeat(50));

  await prisma.$disconnect();
}

finalCleanup().catch(console.error);
