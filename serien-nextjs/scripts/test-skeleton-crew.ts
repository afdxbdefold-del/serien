/**
 * Test: Skeleton Crew Season 2
 * Testing: Parallel + Apify optimizations
 */
import { runPipelineV2 } from './pipeline-v2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎬 SKELETON CREW SEASON 2 - PIPELINE V2 TEST');
  console.log('🚀 Testing: Parallel Scraping + Apify Integration');
  console.log('='.repeat(70));
  
  const startTime = Date.now();
  
  const source = {
    title: 'Skeleton Crew Season 2',
    url: 'https://thecinemaholic.com/skeleton-crew-season-2/',
    text: '',
    useFullTextMode: true,
  };
  
  try {
    const result = await runPipelineV2(source);
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (result) {
      // Check links immediately
      const article = await prisma.articles.findFirst({
        where: { id: result.articleId },
        select: { contentHtml: true }
      });
      
      const html = article?.contentHtml as string || '';
      const charLinks = html.match(/href="\/figur\/[^"]+"/g) || [];
      const castLinks = html.match(/href="\/person\/[^"]+"/g) || [];
      
      console.log('\n' + '='.repeat(70));
      console.log('✅ ARTIKEL ERFOLGREICH GENERIERT');
      console.log('='.repeat(70));
      console.log(`📝 ${result.headline}`);
      console.log(`🔗 http://localhost:3000/${result.slug}`);
      console.log(`🆔 ${result.articleId}`);
      console.log(`⏱️  Gesamtzeit: ${totalTime}s`);
      console.log(`\n📊 INTERNE LINKS:`);
      console.log(`   Character Links: ${charLinks.length}`);
      console.log(`   Cast Links: ${castLinks.length}`);
      console.log('='.repeat(70));
      
      if (parseInt(totalTime) < 120) {
        console.log('\n🎉 PERFORMANCE-ZIEL ERREICHT! Unter 2 Minuten!');
      }
    } else {
      console.log('\n⚠️  Pipeline returned null');
    }
  } catch (error: any) {
    console.error('\n❌ FEHLER:', error.message);
  }
  
  process.exit(0);
}

main();
