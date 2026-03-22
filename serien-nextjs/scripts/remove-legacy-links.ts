/**
 * Remove Legacy Broken Links
 * 
 * Removes old-style links that no longer exist:
 * - /schauspieler/... (old actor links)
 * - /charaktere/... (old character links, should be /figur/)
 * - /serie/ empty links
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeLegacyLinks() {
  console.log('🧹 Removing legacy broken links...\n');

  const articles = await prisma.articles.findMany({
    where: { OR: [{ status: 'published' }, { status: 'PUBLISHED' }] },
    select: { id: true, slug: true, contentHtml: true }
  });

  console.log(`📄 Scanning ${articles.length} articles...\n`);

  let totalRemoved = 0;
  let articlesUpdated = 0;

  for (const article of articles) {
    let { contentHtml } = article;
    let removedInArticle = 0;

    // Remove /schauspieler/ links (both relative and absolute) - keep text only
    const schauspielerRegex = /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/schauspieler\/[^"']+["'][^>]*>([^<]*)<\/a>/gi;
    contentHtml = contentHtml.replace(schauspielerRegex, (match, text) => {
      removedInArticle++;
      return text;
    });

    // Remove /charaktere/ links (both relative and absolute) - keep text only  
    const charaktereRegex = /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/charaktere\/[^"']+["'][^>]*>([^<]*)<\/a>/gi;
    contentHtml = contentHtml.replace(charaktereRegex, (match, text) => {
      removedInArticle++;
      return text;
    });

    // Remove empty /serie/ links
    const emptySerieRegex = /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/serie\/["'][^>]*>([^<]*)<\/a>/gi;
    contentHtml = contentHtml.replace(emptySerieRegex, (match, text) => {
      removedInArticle++;
      return text;
    });

    // Remove /serie/undefined links
    const undefinedSerieRegex = /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/serie\/undefined["'][^>]*>([^<]*)<\/a>/gi;
    contentHtml = contentHtml.replace(undefinedSerieRegex, (match, text) => {
      removedInArticle++;
      return text;
    });

    // Remove /browse/ links (old Netflix browse links)
    const browseRegex = /<a\s+[^>]*href=["'](?:https?:\/\/serien\.de)?\/browse\/[^"']+["'][^>]*>([^<]*)<\/a>/gi;
    contentHtml = contentHtml.replace(browseRegex, (match, text) => {
      removedInArticle++;
      return text;
    });

    if (removedInArticle > 0) {
      await prisma.articles.update({
        where: { id: article.id },
        data: { contentHtml }
      });
      
      totalRemoved += removedInArticle;
      articlesUpdated++;
      console.log(`  ✅ ${article.slug}: removed ${removedInArticle} legacy links`);
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

removeLegacyLinks().catch(console.error);
