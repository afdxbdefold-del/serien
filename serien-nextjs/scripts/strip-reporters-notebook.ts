/**
 * Strips the "Aus der Redaktion · Datenstand …"  Reporter's Notebook block
 * from every article's contentHtml. Idempotent.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { stripNotebookBlock } from '../lib/reporters-notebook';

const prisma = new PrismaClient();

async function main() {
  const targets = await prisma.articles.findMany({
    where: { contentHtml: { contains: 'data-reporters-notebook' } },
    select: { id: true, slug: true, contentHtml: true },
  });
  console.log(`Found ${targets.length} articles with notebook block\n`);

  let ok = 0;
  for (const a of targets) {
    const cleaned = stripNotebookBlock(a.contentHtml);
    if (cleaned === a.contentHtml) continue;
    await prisma.articles.update({
      where: { id: a.id },
      data: { contentHtml: cleaned },
    });
    ok++;
    if (ok % 100 === 0) console.log(`  ${ok}/${targets.length} stripped`);
  }
  console.log(`\n🏁 ${ok} articles cleaned`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
