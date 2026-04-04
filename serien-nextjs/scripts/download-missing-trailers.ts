import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { downloadVideoTrailer, findTrailerYouTubeId } from '../lib/trailer-downloader';

const prisma = new PrismaClient();

async function main() {
  const series = await prisma.series.findMany({
    where: {
      OR: [
        { localTrailerPath: { equals: null as any } },
        { localTrailerPath: '' },
        { localTrailerPath: 'unavailable' },
      ],
      trailers: { not: { equals: null as any } }
    },
    select: { tmdbId: true, title: true, name: true, slug: true, trailers: true },
    orderBy: { tmdbId: 'asc' }
  });
  
  const toDownload = series.filter(s => {
    if (!s.trailers || !Array.isArray(s.trailers)) return false;
    return (s.trailers as any[]).some(t => t.site === 'YouTube' && t.key);
  });
  
  console.log(`Starting download of ${toDownload.length} trailers...\n`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < toDownload.length; i++) {
    const s = toDownload[i];
    const youtubeId = findTrailerYouTubeId(s.trailers);
    
    if (!youtubeId) {
      console.log(`${i+1}/${toDownload.length} ⏭️ ${s.title || s.name} - Kein YouTube Key`);
      continue;
    }
    
    console.log(`${i+1}/${toDownload.length} ⬇️ ${s.title || s.name} (${youtubeId})`);
    
    try {
      const result = await downloadVideoTrailer(youtubeId, s.slug || s.title || s.name || 'unknown');
      
      if (result.success && result.localPath) {
        await prisma.series.update({
          where: { tmdbId: s.tmdbId },
          data: { localTrailerPath: result.localPath }
        });
        console.log(`   ✅ ${result.localPath.split('/').pop()}`);
        success++;
      } else {
        console.log(`   ❌ ${result.error}`);
        // Mark as unavailable to skip next time
        await prisma.series.update({
          where: { tmdbId: s.tmdbId },
          data: { localTrailerPath: 'SKIP' }
        });
        failed++;
      }
    } catch (err: any) {
      console.log(`   ❌ ${err.message}`);
      failed++;
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log(`\n=== FERTIG ===`);
  console.log(`Erfolgreich: ${success}`);
  console.log(`Fehlgeschlagen: ${failed}`);
  
  const total = await prisma.series.count({ where: { localTrailerPath: { startsWith: 'https://pub-' } } });
  console.log(`Total mit R2: ${total}`);
}

main().then(() => prisma.$disconnect());
