import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const article = await prisma.articles.findFirst({
    where: { slug: 'hijack-staffel-2-finale-recap-und-ende-erklaert' },
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
  
  // Check characters
  const chars = await prisma.characters.findMany({
    where: { seriesTmdbId: 251062 }, // Hijack
    select: { name: true, slug: true }
  });
  
  console.log('\n🎭 Generierte Charaktere:');
  chars.forEach((c, i) => {
    console.log(`   ${i+1}. ${c.name} → /figur/${c.slug}`);
  });
}

check().then(() => process.exit(0)).catch(console.error);
