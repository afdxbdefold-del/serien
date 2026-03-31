import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { downloadVideoTrailer } from '../lib/trailer-downloader';

const prisma = new PrismaClient();

// Manually researched English YouTube trailer IDs
const REPLACEMENTS = [
  { title: 'The 100', youtubeId: 'ia1Fbg96vL0', name: 'The 100 Official Trailer' },
  { title: 'Yellowstone', youtubeId: 'HyluKjE3irs', name: 'Yellowstone Season 1 Trailer' },
  { title: 'Das Damengambit', youtubeId: 'oZn3qSgmLqI', name: "The Queen's Gambit Official Trailer Netflix" },
  { title: 'Sweet Tooth', youtubeId: 'PifvRiHVSCY', name: 'Sweet Tooth Official Trailer Netflix' },
  { title: 'FROM', youtubeId: 'pDHqAj4eJcM', name: 'FROM Official Trailer MGM+' },
  { title: 'Tulsa King', youtubeId: 'ydNwOJAOIlI', name: 'Tulsa King Official Trailer Paramount+' },
  { title: 'The Flash', youtubeId: 'Yj0l7iGKh8g', name: 'The Flash Season 1 Trailer CW' },
  { title: '1923', youtubeId: 'sbJJ4X1ECQA', name: '1923 Official Trailer Paramount+' },
  { title: "The Handmaid's Tale - Der Report der Magd", youtubeId: 'Dko41a0yMYI', name: "The Handmaid's Tale Trailer Hulu" },
  { title: 'Legends of Tomorrow', youtubeId: 'OXtA6DPYi6U', name: "DC's Legends of Tomorrow Trailer" },
  { title: 'Doctor Who', youtubeId: 'FvVZaO5tSwM', name: 'Doctor Who Season 14 Trailer BBC' },
  { title: 'The Big Bang Theory', youtubeId: 'WBb3lnfMPqM', name: 'The Big Bang Theory Season 1 Trailer' },
  { title: 'Only Murders in the Building', youtubeId: 'wP6dCxZDPyU', name: 'Only Murders Official Trailer' },
];

async function main() {
  console.log(`Ersetze ${REPLACEMENTS.length} Kinocheck-Trailer...\n`);
  
  let success = 0;
  let failed = 0;
  
  for (const item of REPLACEMENTS) {
    console.log(`\n🎬 ${item.title}`);
    console.log(`   YouTube: ${item.youtubeId}`);
    
    try {
      const series = await prisma.series.findFirst({
        where: { title: item.title },
        select: { tmdbId: true, slug: true }
      });
      
      if (!series) {
        console.log(`   ❌ Serie nicht in DB`);
        failed++;
        continue;
      }
      
      const result = await downloadVideoTrailer(item.youtubeId, series.slug || item.title);
      
      if (result.success && result.localPath) {
        await prisma.series.update({
          where: { tmdbId: series.tmdbId },
          data: { localTrailerPath: result.localPath }
        });
        console.log(`   ✅ Ersetzt: ${result.localPath.split('/').pop()}`);
        success++;
      } else {
        console.log(`   ❌ ${result.error}`);
        failed++;
      }
    } catch (err: any) {
      console.log(`   ❌ ${err.message}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 1500));
  }
  
  console.log(`\n=== FERTIG ===`);
  console.log(`Erfolgreich: ${success}`);
  console.log(`Fehlgeschlagen: ${failed}`);
}

main().then(() => prisma.$disconnect());
