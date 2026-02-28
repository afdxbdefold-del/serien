import { PrismaClient } from '@prisma/client';
import { generateArticleQA } from '../lib/qa-generator.ts';

const prisma = new PrismaClient();

async function test() {
  const article = await prisma.articles.findFirst({
    where: { slug: 'cross-um-eine-3-staffel-bei-amazon-prime-verlaengert' },
    include: { series: true }
  });
  
  console.log('🧪 Testing Q&A Generation\n');
  console.log('Article:', article.title);
  console.log('Series:', article.series?.title);
  console.log('Content:', article.contentHtml?.length, 'chars\n');
  
  try {
    const qa = await generateArticleQA({
      title: article.title,
      contentHtml: article.contentHtml,
      seriesName: article.series?.title || 'Unknown'
    });
    
    if (qa && qa.length > 0) {
      console.log(`✅ Q&A Generated: ${qa.length} questions\n`);
      qa.forEach((q, i) => {
        console.log(`${i+1}. ${q.question}`);
        console.log(`   ${q.answer}\n`);
      });
    } else {
      console.log('❌ No Q&A generated (check logs above)');
    }
  } catch (error) {
    console.error('❌ Q&A Error:', error.message);
    console.error('Stack:', error.stack);
  }
  
  await prisma.$disconnect();
}

test().catch(console.error);
