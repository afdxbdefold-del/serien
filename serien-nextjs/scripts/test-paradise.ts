/**
 * Test: Paradise TV Series (should have character links)
 */
import { runPipelineV2 } from './pipeline-v2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎬 PARADISE - PIPELINE V2 TEST (mit Link-Verifikation)');
  console.log('='.repeat(70));
  
  const source = {
    title: 'Paradise Episode 1 Recap',
    url: 'https://thecinemaholic.com/paradise-episode-1-recap/',
    text: '',
    useFullTextMode: true,
  };
  
  try {
    const result = await runPipelineV2(source);
    
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
      console.log(`\n📊 LINKS IM ARTIKEL:`);
      console.log(`   Character Links: ${charLinks.length}`);
      charLinks.slice(0, 3).forEach(link => console.log(`   - ${link}`));
      console.log(`   Cast Links: ${castLinks.length}`);
      castLinks.slice(0, 3).forEach(link => console.log(`   - ${link}`));
      
      if (charLinks.length > 0 || castLinks.length > 0) {
        console.log(`\n🎉 BESTÄTIGT: Links funktionieren sofort für neue Artikel!`);
      }
      console.log('='.repeat(70));
    } else {
      console.log('\n⚠️  Pipeline returned null');
    }
  } catch (error: any) {
    console.error('\n❌ FEHLER:', error.message);
  }
  
  process.exit(0);
}

main();
