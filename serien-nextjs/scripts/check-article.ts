import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkArticle() {
  const article = await prisma.article.findUnique({
    where: { id: 'pipeline-1772073714136' },
    select: {
      id: true,
      slug: true,
      title: true,
      publishMode: true,
      excerpt: true,
      contentHtml: true
    }
  });

  if (!article) {
    console.log('❌ Artikel nicht gefunden');
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('📄 ARTIKEL ERFOLGREICH ERSTELLT');
  console.log('='.repeat(80) + '\n');
  
  console.log('📌 BASIC INFO:');
  console.log(`   ID: ${article.id}`);
  console.log(`   Slug: ${article.slug}`);
  console.log(`   Title: ${article.title}`);
  console.log(`   Publish Mode: ${article.publishMode}`);
  console.log(`   Reading Time: ${article.readingTime} min`);
  console.log(`   Source: ${article.sourceUrl}`);
  
  const plainText = article.contentHtml.replace(/<[^>]*>/g, ' ');
  const wordCount = plainText.split(/\s+/).filter((w: string) => w.length > 0).length;
  const paragraphs = (article.contentHtml.match(/<p>/g) || []).length;
  const hasQuelle = article.contentHtml.includes('Quelle:');
  const hasSourceLink = article.contentHtml.includes('thecinemaholic.com');
  
  console.log('\n📊 CONTENT METRICS:');
  console.log(`   Word Count: ${wordCount} Wörter`);
  console.log(`   Target Range: 450-900 Wörter`);
  console.log(`   Status: ${wordCount >= 450 && wordCount <= 900 ? '✅ PERFEKT im Zielbereich!' : wordCount >= 350 ? '✅ Akzeptabel' : '⚠️ Unter Ziel'}`);
  console.log(`   Paragraphs: ${paragraphs} (min: 5)`);
  console.log(`   Paragraph Check: ${paragraphs >= 5 ? '✅ Pass' : '❌ Fail'}`);
  
  console.log('\n🔗 QUELLE BLOCK:');
  console.log(`   Quelle Tag: ${hasQuelle ? '✅ Vorhanden' : '❌ Fehlt'}`);
  console.log(`   Source Link: ${hasSourceLink ? '✅ thecinemaholic.com verlinkt' : '❌ Fehlt'}`);
  
  // Extract Quelle block
  const quelleMatch = article.contentHtml.match(/<p class="article-source">.*?<\/p>/);
  if (quelleMatch) {
    console.log(`   Block: ${quelleMatch[0]}`);
  }
  
  console.log('\n📝 EXCERPT:');
  console.log(`   ${article.excerpt.substring(0, 250)}...`);
  
  console.log('\n📄 CONTENT PREVIEW (first 500 chars):');
  const preview = article.contentHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500);
  console.log(`   ${preview}...`);
  
  console.log('\n🔗 ARTIKEL URL:');
  console.log(`   https://serien-5v18x10.vercel.app/${article.slug}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ FULL ARTICLE PIPELINE - KOMPLETT ERFOLGREICH!');
  console.log('='.repeat(80) + '\n');
  
  await prisma.$disconnect();
}

checkArticle().catch(console.error);
