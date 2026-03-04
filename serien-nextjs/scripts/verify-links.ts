import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const article = await prisma.articles.findFirst({
    where: { slug: 'hijack-staffel-2-finale-erklaert-ueberleben-sam-und-marsha' },
    select: { 
      id: true,
      title: true,
      contentHtml: true
    }
  });
  
  const html = article?.contentHtml as string || '';
  
  console.log('📊 HTML-Links im Artikel:');
  const charLinks = html.match(/href="\/figur\/[^"]+"/g) || [];
  const castLinks = html.match(/href="\/person\/[^"]+"/g) || [];
  
  console.log(`   Character Links: ${charLinks.length}`);
  charLinks.forEach(link => console.log('   -', link));
  
  console.log(`   Cast Links: ${castLinks.length}`);
  castLinks.forEach(link => console.log('   -', link));
  
  if (charLinks.length > 0 || castLinks.length > 0) {
    console.log('\n✅ ERFOLGREICH! Links sind im HTML vorhanden!');
  } else {
    console.log('\n❌ FEHLER! Keine Links im HTML!');
  }
}

check().then(() => process.exit(0)).catch(console.error);
