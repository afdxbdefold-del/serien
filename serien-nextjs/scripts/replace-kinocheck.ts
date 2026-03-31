import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { downloadVideoTrailer, searchYouTubeTrailer } from '../lib/trailer-downloader';

const prisma = new PrismaClient();

const KINOCHECK_SERIES = [
  { title: 'The 100', search: 'The 100 official trailer' },
  { title: 'Hellsing Ultimate', search: 'Hellsing Ultimate official trailer' },
  { title: '1923', search: '1923 Paramount official trailer' },
  { title: 'Fear the Walking Dead', search: 'Fear the Walking Dead official trailer' },
  { title: 'Das Damengambit', search: "The Queen's Gambit official trailer Netflix" },
  { title: 'Dr. House', search: 'House MD official trailer' },
  { title: 'Power Book IV: Force', search: 'Power Book IV Force official trailer Starz' },
  { title: 'Sweet Tooth', search: 'Sweet Tooth official trailer Netflix' },
  { title: "The Handmaid's Tale - Der Report der Magd", search: "The Handmaid's Tale official trailer Hulu" },
  { title: 'Legends of Tomorrow', search: "DC's Legends of Tomorrow official trailer CW" },
  { title: 'Utopia', search: 'Utopia Amazon official trailer' },
  { title: 'FROM', search: 'FROM MGM official trailer' },
  { title: 'Doctor Who', search: 'Doctor Who BBC official trailer' },
  { title: 'Yellowstone', search: 'Yellowstone Paramount official trailer' },
  { title: 'The Flash', search: 'The Flash CW official trailer' },
  { title: 'Father Brown', search: 'Father Brown BBC official trailer' },
  { title: 'The Big Bang Theory', search: 'The Big Bang Theory official trailer CBS' },
  { title: 'Designated Survivor', search: 'Designated Survivor official trailer' },
  { title: 'Tulsa King', search: 'Tulsa King Paramount official trailer' },
  { title: 'Only Murders in the Building', search: 'Only Murders in the Building official trailer Hulu' },
];

async function main() {
  console.log(`Ersetze ${KINOCHECK_SERIES.length} Kinocheck-Trailer mit englischen Versionen...\n`);
  
  let success = 0;
  let failed = 0;
  
  for (const item of KINOCHECK_SERIES) {
    console.log(`\n🔍 ${item.title}`);
    console.log(`   Suche: "${item.search}"`);
    
    try {
      // Search for English trailer on YouTube
      const youtubeId = await searchYouTubeTrailer(item.search);
      
      if (!youtubeId) {
        console.log(`   ❌ Kein Video gefunden`);
        failed++;
        continue;
      }
      
      console.log(`   📹 Gefunden: ${youtubeId}`);
      
      // Get series from DB
      const series = await prisma.series.findFirst({
        where: { title: item.title },
        select: { tmdbId: true, slug: true }
      });
      
      if (!series) {
        console.log(`   ❌ Serie nicht in DB`);
        failed++;
        continue;
      }
      
      // Download and upload
      const result = await downloadVideoTrailer(youtubeId, series.slug || item.title);
      
      if (result.success && result.localPath) {
        await prisma.series.update({
          where: { tmdbId: series.tmdbId },
          data: { localTrailerPath: result.localPath }
        });
        console.log(`   ✅ Ersetzt!`);
        success++;
      } else {
        console.log(`   ❌ Download fehlgeschlagen: ${result.error}`);
        failed++;
      }
    } catch (err: any) {
      console.log(`   ❌ Error: ${err.message}`);
      failed++;
    }
    
    // Delay between downloads
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`\n=== FERTIG ===`);
  console.log(`Erfolgreich: ${success}`);
  console.log(`Fehlgeschlagen: ${failed}`);
}

main().then(() => prisma.$disconnect());
