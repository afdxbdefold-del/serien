/**
 * Test: The Housemaid 2
 */
import { runPipelineV2 } from './pipeline-v2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎬 THE HOUSEMAID 2 - PIPELINE V2 TEST');
  console.log('='.repeat(70));
  
  const source = {
    title: 'The Housemaid 2',
    url: 'https://thecinemaholic.com/the-housemaid-2/',
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
      const charLinks = (html.match(/href="\/figur\//g) || []).length;
      const castLinks = (html.match(/href="\/person\//g) || []).length;
      
      console.log('\n' + '='.repeat(70));
      console.log('✅ ARTIKEL ERFOLGREICH GENERIERT');
      console.log('='.repeat(70));
      console.log(`📝 ${result.headline}`);
      console.log(`🔗 http://localhost:3000/${result.slug}`);
      console.log(`📊 Character Links: ${charLinks}`);
      console.log(`📊 Cast Links: ${castLinks}`);
      console.log('='.repeat(70));
    } else {
      console.log('\n⚠️  Pipeline returned null');
    }
  } catch (error: any) {
    console.error('\n❌ TEST FEHLGESCHLAGEN:', error.message);
  }
  
  process.exit(0);
}

main();
