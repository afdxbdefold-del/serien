import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debug() {
  const article = await prisma.articles.findFirst({
    where: { slug: 'hijack-staffel-2-finale-recap-und-ende-erklaert' },
    select: { 
      id: true,
      contentMarkdown: true,
      contentHtml: true
    }
  });
  
  if (!article) {
    console.log('❌ Artikel nicht gefunden');
    return;
  }
  
  const markdown = article.contentMarkdown as string || '';
  const html = article.contentHtml as string || '';
  
  console.log('📊 MARKDOWN LINKS:');
  const markdownLinks = markdown.match(/\[([^\]]+)\]\(\/figur\/[^)]+\)/g) || [];
  console.log('   Character Links:', markdownLinks.length);
  markdownLinks.slice(0, 5).forEach(link => console.log('   -', link));
  
  const castLinks = markdown.match(/\[([^\]]+)\]\(\/person\/[^)]+\)/g) || [];
  console.log('   Cast Links:', castLinks.length);
  castLinks.slice(0, 5).forEach(link => console.log('   -', link));
  
  console.log('\n📊 HTML LINKS:');
  const htmlCharLinks = html.match(/href="\/figur\/[^"]+"/g) || [];
  console.log('   Character Links:', htmlCharLinks.length);
  
  const htmlCastLinks = html.match(/href="\/person\/[^"]+"/g) || [];
  console.log('   Cast Links:', htmlCastLinks.length);
  
  console.log('\n🔍 PROBLEM:');
  if (markdownLinks.length > 0 && htmlCharLinks.length === 0) {
    console.log('   ❌ Links sind im Markdown, aber NICHT im HTML!');
    console.log('   → markdownToHtml() funktioniert nicht korrekt');
  } else if (markdownLinks.length === 0) {
    console.log('   ❌ Keine Links im Markdown!');
    console.log('   → Character/Cast Linking funktioniert nicht');
  } else {
    console.log('   ✅ Links sind im HTML vorhanden');
  }
}

debug().then(() => process.exit(0)).catch(console.error);
