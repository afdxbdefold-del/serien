/**
 * Quick Test: Generate new article and verify links work immediately
 */
import { runPipelineV2 } from './pipeline-v2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 SCHNELLTEST: Funktionieren Links für neue Artikel?\n');
  
  const source = {
    title: 'The Recruit Season 2',
    url: 'https://thecinemaholic.com/the-recruit-season-2-release-date/',
    text: '',
    useFullTextMode: true,
  };
  
  console.log('⚡ Generiere Artikel...\n');
  
  const result = await runPipelineV2(source);
  
  if (!result) {
    console.log('❌ Pipeline fehlgeschlagen');
    process.exit(1);
  }
  
  // Check if links are in the article
  const article = await prisma.articles.findFirst({
    where: { id: result.articleId },
    select: { contentHtml: true }
  });
  
  const html = article?.contentHtml as string || '';
  const charLinks = (html.match(/href="\/figur\//g) || []).length;
  const castLinks = (html.match(/href="\/person\//g) || []).length;
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 ERGEBNIS:');
  console.log('='.repeat(70));
  console.log(`✅ Artikel generiert: ${result.headline}`);
  console.log(`📊 Character Links: ${charLinks}`);
  console.log(`📊 Cast Links: ${castLinks}`);
  
  if (charLinks > 0 || castLinks > 0) {
    console.log('\n🎉 ERFOLG! Links funktionieren sofort für neue Artikel!');
  } else {
    console.log('\n⚠️  Keine Links (aber möglicherweise hat LLM keine Namen verwendet)');
  }
  
  console.log(`\n🔗 Artikel: http://localhost:3000/${result.slug}`);
  console.log('='.repeat(70));
  
  process.exit(0);
}

main();
