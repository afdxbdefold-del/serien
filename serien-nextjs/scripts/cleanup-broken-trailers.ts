/**
 * Cleanup broken trailers (< 500KB = incomplete downloads)
 * Sets localTrailerPath to null so articles fall back to hero image
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MIN_SIZE = 500_000; // 500KB minimum for a valid trailer

async function cleanBrokenTrailers() {
  console.log('=== BROKEN TRAILER CLEANUP ===\n');
  
  const allSeries = await prisma.series.findMany({
    where: { 
      localTrailerPath: { not: null },
      NOT: { localTrailerPath: 'SKIP' }
    },
    select: { tmdbId: true, name: true, localTrailerPath: true },
  });
  
  console.log(`Prüfe ${allSeries.length} Trailer...\n`);
  
  const broken: Array<{ tmdbId: number; name: string; url: string; size: number }> = [];
  const batchSize = 20;
  
  for (let i = 0; i < allSeries.length; i += batchSize) {
    const batch = allSeries.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (s) => {
      try {
        const res = await fetch(s.localTrailerPath!, { method: 'HEAD' });
        const size = parseInt(res.headers.get('content-length') || '0');
        
        if (size < MIN_SIZE) {
          broken.push({ 
            tmdbId: s.tmdbId, 
            name: s.name || 'Unknown', 
            url: s.localTrailerPath!, 
            size 
          });
        }
      } catch {
        // Can't reach URL — also mark as broken
        broken.push({ 
          tmdbId: s.tmdbId, 
          name: s.name || 'Unknown', 
          url: s.localTrailerPath!, 
          size: -1 
        });
      }
    }));
    
    process.stdout.write(`\r  Geprüft: ${Math.min(i + batchSize, allSeries.length)}/${allSeries.length}`);
  }
  
  console.log(`\n\n❌ ${broken.length} kaputte Trailer gefunden (von ${allSeries.length})\n`);
  
  if (broken.length === 0) {
    console.log('✅ Alle Trailer sind in Ordnung!');
    return;
  }
  
  // Fix series: set localTrailerPath to null
  let seriesFixed = 0;
  for (const b of broken) {
    await prisma.series.update({
      where: { tmdbId: b.tmdbId },
      data: { localTrailerPath: null },
    });
    seriesFixed++;
  }
  console.log(`✅ ${seriesFixed} Series: localTrailerPath → null`);
  
  // Fix articles: remove heroVideoUrl that points to broken trailers
  const brokenUrls = broken.map(b => b.url);
  const affectedArticles = await prisma.articles.findMany({
    where: { heroVideoUrl: { in: brokenUrls } },
    select: { id: true, title: true, heroVideoUrl: true },
  });
  
  if (affectedArticles.length > 0) {
    await prisma.articles.updateMany({
      where: { heroVideoUrl: { in: brokenUrls } },
      data: { heroVideoUrl: null },
    });
    console.log(`✅ ${affectedArticles.length} Artikel: heroVideoUrl → null`);
  } else {
    console.log('ℹ️  Keine Artikel mit kaputten Trailer-URLs gefunden');
  }
  
  console.log('\n=== ZUSAMMENFASSUNG ===');
  console.log(`Kaputte Trailer entfernt: ${broken.length}`);
  console.log(`Verbleibende OK Trailer: ${allSeries.length - broken.length}`);
  console.log(`Betroffene Artikel bereinigt: ${affectedArticles.length}`);
  console.log('\nArtikel zeigen jetzt das Hero-Bild statt kaputte Videos.');
}

cleanBrokenTrailers()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(e => { console.error('FEHLER:', e); process.exit(1); });
