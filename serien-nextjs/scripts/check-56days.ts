import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const article = await prisma.articles.findFirst({
    where: { slug: '56-tage-staffel-2-plot-und-cast-theorien' },
    select: { 
      id: true,
      title: true,
      heroVideoUrl: true,
      contentHtml: true
    }
  });
  
  console.log('📄 Artikel Details:');
  console.log('   ID:', article?.id);
  console.log('   Title:', article?.title);
  console.log('   heroVideoUrl:', article?.heroVideoUrl ? '✅ ' + article.heroVideoUrl : '❌ LEER');
  console.log('   Content length:', article?.contentHtml?.length, 'chars');
  console.log('   H2 tags:', (article?.contentHtml?.match(/<h2>/g) || []).length);
  console.log('   Character links:', (article?.contentHtml?.match(/href="\/figur\//g) || []).length);
  console.log('   Cast links:', (article?.contentHtml?.match(/href="\/person\//g) || []).length);
}

check().then(() => process.exit(0)).catch(console.error);
