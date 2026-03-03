import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const url = 'https://thecinemaholic.com/the-last-thing-he-told-me-s2-ep1-recap/';
  
  const deleted = await prisma.articles.deleteMany({
    where: { sourceUrl: url }
  });
  
  console.log(`✅ Gelöscht: ${deleted.count} Artikel`);
}

main().then(() => process.exit(0)).catch(console.error);
