import { getTvDetailsComplete } from '../lib/tmdb';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAllegianceTrailers() {
  try {
    console.log('🔄 Hole Trailer-Daten von TMDB für Allegiance (ID: 61703)...');
    const details = await getTvDetailsComplete(61703, 'de-DE');
    
    if (!details || !details.trailers) {
      console.log('⚠️  Keine Trailer-Daten gefunden');
      await prisma.$disconnect();
      process.exit(1);
    }
    
    console.log('\n✅ Trailers gefunden:');
    console.log(JSON.stringify(details.trailers, null, 2));
    
    // Update Serie mit Trailer-Daten
    await prisma.series.update({
      where: { tmdbId: 61703 },
      data: { trailers: details.trailers }
    });
    
    console.log('\n✅ Allegiance Series mit Trailers aktualisiert!');
    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Fehler:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

updateAllegianceTrailers();
