import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const article = await prisma.article.findFirst({
    where: { slug: 'die-wahre-geschichte-von-the-gray-house-erklaert' },
    include: { 
      primarySeries: { select: { name: true, tmdbId: true } },
      author: { select: { name: true } }
    }
  });

  if (article) {
    console.log('✅ Artikel gefunden in DB:');
    console.log('   ID:', article.id);
    console.log('   Titel:', article.title);
    console.log('   Slug:', article.slug);
    console.log('   Status:', article.status);
    console.log('   Publish Mode:', article.publishMode);
    console.log('   Autor:', article.author.name);
    console.log('   Serie:', article.primarySeries?.name, `(TMDB: ${article.primarySeries?.tmdbId})`);
    console.log('   Trailer:', article.trailerLocalUrl ? '✅ Vorhanden' : '❌ Nicht vorhanden');
    console.log('   Was bedeutet das?:', article.wasBedeutetDasText ? '✅ Vorhanden' : '❌ Nicht vorhanden');
    console.log('\n📝 Excerpt (first 150 chars):');
    console.log('  ', article.excerpt?.substring(0, 150) + '...');
    console.log('\n📝 Meta Description:');
    console.log('  ', article.metaDescription);
    console.log('\n🔗 Article URL: http://localhost:3000/' + article.slug);
  } else {
    console.log('❌ Artikel nicht gefunden!');
  }

  await prisma.$disconnect();
}

main();
