/**
 * Import The Walking Dead Franchise
 * Importiert alle Serien der Franchise in die Datenbank
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Alle Serien der Franchise mit Kategorien
const FRANCHISE_SHOWS = [
  // Hauptserie
  { tmdbId: 1402, category: 'main', germanTitle: 'The Walking Dead' },
  
  // Spin-offs (Hauptcharaktere)
  { tmdbId: 62286, category: 'spinoff-main', germanTitle: 'Fear the Walking Dead' },
  { tmdbId: 211684, category: 'spinoff-main', germanTitle: 'The Walking Dead: Daryl Dixon' },
  { tmdbId: 194583, category: 'spinoff-main', germanTitle: 'The Walking Dead: Dead City' },
  { tmdbId: 206586, category: 'spinoff-main', germanTitle: 'The Walking Dead: The Ones Who Live' },
  
  // Limited Series
  { tmdbId: 94305, category: 'limited', germanTitle: 'The Walking Dead: World Beyond' },
  { tmdbId: 136248, category: 'anthology', germanTitle: 'Tales of the Walking Dead' },
  
  // Dokumentation & Specials
  { tmdbId: 129035, category: 'specials', germanTitle: 'The Walking Dead: Origins' },
  
  // Webserien
  { tmdbId: 235900, category: 'web', germanTitle: 'The Walking Dead: Webisodes' },
  { tmdbId: 233436, category: 'web', germanTitle: 'The Walking Dead: Red Machete' },
  { tmdbId: 234950, category: 'web', germanTitle: 'Fear the Walking Dead: Passage' },
  { tmdbId: 274853, category: 'web', germanTitle: 'The Walking Dead: Cold Storage' },
  { tmdbId: 272594, category: 'web', germanTitle: 'The Walking Dead: Torn Apart' },
  { tmdbId: 275503, category: 'web', germanTitle: 'The Walking Dead: The Oath' },
  { tmdbId: 226340, category: 'web', germanTitle: 'Fear the Walking Dead: Dead in the Water' },
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchTmdbDetails(tmdbId: number) {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=de-DE&append_to_response=keywords,credits`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function importSeries(show: typeof FRANCHISE_SHOWS[0]) {
  const details = await fetchTmdbDetails(show.tmdbId);
  if (!details) {
    console.log(`❌ TMDB nicht gefunden: ${show.tmdbId}`);
    return null;
  }
  
  const existing = await prisma.series.findUnique({
    where: { tmdbId: show.tmdbId }
  });
  
  if (existing) {
    console.log(`⏭️  Bereits vorhanden: ${details.name}`);
    return existing;
  }
  
  const slug = generateSlug(show.germanTitle || details.name);
  
  const series = await prisma.series.create({
    data: {
      tmdbId: show.tmdbId,
      title: show.germanTitle || details.name,
      name: details.name,
      originalName: details.original_name,
      slug,
      overview: details.overview,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      firstAirDate: details.first_air_date ? new Date(details.first_air_date) : null,
      lastAirDate: details.last_air_date ? new Date(details.last_air_date) : null,
      status: details.status,
      numberOfSeasons: details.number_of_seasons,
      numberOfEpisodes: details.number_of_episodes,
      genres: details.genres?.map((g: any) => g.name) || [],
      networks: details.networks?.map((n: any) => n.name) || [],
      voteAverage: details.vote_average,
      voteCount: details.vote_count,
      popularity: details.popularity,
      tmdbData: details,
      updatedAt: new Date(),
    }
  });
  
  console.log(`✅ Importiert: ${series.title} (${series.tmdbId})`);
  return series;
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🧟 THE WALKING DEAD FRANCHISE IMPORT');
  console.log('═'.repeat(60));
  
  let imported = 0;
  let skipped = 0;
  
  for (const show of FRANCHISE_SHOWS) {
    const result = await importSeries(show);
    if (result) {
      imported++;
    } else {
      skipped++;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('═'.repeat(60));
  console.log(`✅ Import abgeschlossen: ${imported} importiert, ${skipped} übersprungen`);
  console.log('═'.repeat(60));
  
  await prisma.$disconnect();
}

main().catch(console.error);
