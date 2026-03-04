/**
 * Test: School Spirits Season 3 Episode 6 Recap
 */
import { runPipelineV2 } from './pipeline-v2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎬 SCHOOL SPIRITS S3E6 - PIPELINE V2 TEST');
  console.log('='.repeat(70));
  
  const source = {
    title: 'School Spirits Season 3 Episode 6 Recap',
    url: 'https://thecinemaholic.com/school-spirits-season-3-episode-6-recap/',
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
      console.log(`🆔 ${result.articleId}`);
      console.log(`\n📊 INTERNE LINKS:`);
      console.log(`   Character Links: ${charLinks.length}`);
      if (charLinks.length > 0) {
        charLinks.slice(0, 5).forEach(link => console.log(`   ✅ ${link}`));
      }
      console.log(`   Cast Links: ${castLinks.length}`);
      if (castLinks.length > 0) {
        castLinks.slice(0, 5).forEach(link => console.log(`   ✅ ${link}`));
      }
      
      if (charLinks.length > 0 || castLinks.length > 0) {
        console.log(`\n🎉 ERFOLG! Links funktionieren automatisch!`);
      } else {
        console.log(`\n⚠️  Keine Links (LLM hat möglicherweise keine Namen verwendet)`);
      }
      console.log('='.repeat(70));
    } else {
      console.log('\n⚠️  Pipeline returned null (Artikel wurde übersprungen)');
    }
  } catch (error: any) {
    console.error('\n❌ FEHLER:', error.message);
  }
  
  process.exit(0);
}

main();
