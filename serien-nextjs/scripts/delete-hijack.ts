import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteArticle() {
  await prisma.articles.deleteMany({
    where: { slug: 'hijack-staffel-2-finale-recap-und-ende-erklaert' }
  });
  console.log('✅ Artikel gelöscht');
}

deleteArticle().then(() => process.exit(0)).catch(console.error);
