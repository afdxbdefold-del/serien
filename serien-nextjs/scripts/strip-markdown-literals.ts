/**
 * Bulk-clean literal "**" markdown emphasis tokens that leaked through the
 * markdown→HTML conversion (cast/character linking inserts <a> inside the
 * `**span**`, which standard markdown parsers refuse to close).
 *
 * Strategy:
 *   - contentHtml: convert `**text**` → `<strong>text</strong>` (mirrors the
 *     production sanitizer step we just added).
 *   - excerpt: strip `**` entirely (excerpt is rendered as plain text).
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const articles = await prisma.$queryRaw<Array<{ id: string; slug: string; contentHtml: string; excerpt: string | null }>>`
    SELECT id, slug, "contentHtml", excerpt
    FROM articles
    WHERE status='published'
      AND ("contentHtml" LIKE '%**%' OR excerpt LIKE '%**%')
  `;
  console.log(`Found ${articles.length} articles with literal "**"\n`);

  let ok = 0;
  for (const a of articles) {
    const newHtml = a.contentHtml.replace(/\*\*([^*\n]{1,200}?)\*\*/g, '<strong>$1</strong>');
    const newExcerpt = a.excerpt
      ? a.excerpt.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/\s+/g, ' ').trim()
      : a.excerpt;

    if (newHtml === a.contentHtml && newExcerpt === a.excerpt) continue;

    await prisma.articles.update({
      where: { id: a.id },
      data: { contentHtml: newHtml, excerpt: newExcerpt },
    });
    ok++;
    if (ok % 10 === 0) console.log(`  ${ok}/${articles.length} cleaned`);
  }
  console.log(`\n🏁 ${ok} articles cleaned`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
