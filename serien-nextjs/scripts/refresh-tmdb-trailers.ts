/**
 * TMDB Trailer Refresh Script
 * Fragt TMDB erneut ab für Serien ohne Trailer-Daten
 */

import prisma from '../lib/prisma';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

interface TMDBVideo {
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

async function fetchTMDBTrailers(tmdbId: number): Promise<TMDBVideo[]> {
  try {
    // Erst deutsche Trailer
    const deUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=de-DE`;
    const deRes = await fetch(deUrl);
    const deData = await deRes.json();
    
    let trailers = (deData.results || []).filter((v: TMDBVideo) => 
      v.site === 'YouTube' && v.type === 'Trailer'
    );
    
    // Falls keine deutschen, englische holen
    if (trailers.length === 0) {
      const enUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=en-US`;
      const enRes = await fetch(enUrl);
      const enData = await enRes.json();
      
      trailers = (enData.results || []).filter((v: TMDBVideo) => 
        v.site === 'YouTube' && v.type === 'Trailer'
      );
    }
    
    return trailers;
  } catch (error) {
    console.error(`Error fetching TMDB for ${tmdbId}:`, error);
    return [];
  }
}

async function main() {
  console.log('=== TMDB Trailer Refresh ===\n');
  
  // Hole alle Serien ohne lokalen Trailer und ohne TMDB-Trailer-Daten
  const seriesWithoutTrailer = await prisma.series.findMany({
    where: {
      localTrailerPath: null
    },
    select: { 
      tmdbId: true,
      name: true,
      trailers: true
    }
  });
  
  // Filtere nach solchen ohne TMDB-Trailer
  const noTmdbTrailer = seriesWithoutTrailer.filter(s => {
    const t = s.trailers as any[];
    return !t || t.length === 0;
  });
  
  console.log(`Gefunden: ${noTmdbTrailer.length} Serien ohne TMDB-Trailer\n`);
  
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < noTmdbTrailer.length; i++) {
    const series = noTmdbTrailer[i];
    
    process.stdout.write(`[${i + 1}/${noTmdbTrailer.length}] ${series.name}... `);
    
    const trailers = await fetchTMDBTrailers(series.tmdbId);
    
    if (trailers.length > 0) {
      await prisma.series.update({
        where: { tmdbId: series.tmdbId },
        data: { trailers: trailers }
      });
      console.log(`✅ ${trailers.length} Trailer gefunden!`);
      updated++;
    } else {
      console.log(`❌ Keine Trailer`);
      failed++;
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  console.log(`\n=== Ergebnis ===`);
  console.log(`Aktualisiert: ${updated}`);
  console.log(`Keine Trailer: ${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
