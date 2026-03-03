import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const article = await prisma.articles.findFirst({
    where: { slug: 'cross-um-eine-3-staffel-bei-amazon-prime-verlaengert' },
    select: { id: true, title: true, contentHtml: true },
    orderBy: { createdAt: 'desc' }
  });

  if (article) {
    console.log('=== CROSS ARTIKEL (MIT H2-GENERATOR) ===');
    console.log('ID:', article.id);
    console.log('Title:', article.title);
    
    const hasDoubleHash = article.contentHtml.includes('##');
    const h2Count = (article.contentHtml.match(/<h2>/g) || []).length;
    const h3Count = (article.contentHtml.match(/<h3>/g) || []).length;
    
    console.log('\n=== STRUCTURE CHECK ===');
    console.log('Has ##:', hasDoubleHash);
    console.log('H2 count:', h2Count);
    console.log('H3 count:', h3Count);
    
    if (h2Count > 0) {
      console.log('\n=== H2 ÜBERSCHRIFTEN ===');
      const h2Matches = article.contentHtml.match(/<h2>([^<]+)<\/h2>/g);
      if (h2Matches) {
        h2Matches.forEach((h2, i) => {
          const text = h2.replace(/<\/?h2>/g, '');
          const words = text.split(/\s+/).length;
          console.log(`  ${i + 1}. "${text}"`);
          console.log(`     Länge: ${text.length} chars | ${words} Wörter`);
        });
      }
      
      // Check H2 closing tags
      const firstH2Index = article.contentHtml.indexOf('<h2>');
      const firstH2Close = article.contentHtml.indexOf('</h2>', firstH2Index);
      
      if (firstH2Close !== -1) {
        console.log('\n✅ H2 Tags sind korrekt geschlossen');
      } else {
        console.log('\n❌ H2 Tags nicht korrekt geschlossen');
      }
      
      // Show context
      if (firstH2Index !== -1) {
        console.log('\n=== ERSTE H2 KONTEXT ===');
        console.log(article.contentHtml.substring(firstH2Index - 50, firstH2Index + 250));
      }
    } else {
      console.log('\n❌ KEINE H2 TAGS GEFUNDEN!');
      console.log('Der H2-Generator wurde nicht ausgeführt oder ist fehlgeschlagen.');
    }
    
    console.log('\n=== FINAL VERDICT ===');
    if (!hasDoubleHash && h2Count >= 3) {
      console.log('✅✅✅ PERFEKT! Keine ##, korrekte H2-Tags vorhanden!');
    } else if (hasDoubleHash) {
      console.log('❌ FEHLER: Noch ## im HTML');
    } else if (h2Count === 0) {
      console.log('❌ FEHLER: Keine H2-Tags generiert');
    }
  } else {
    console.log('❌ Artikel nicht gefunden');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
