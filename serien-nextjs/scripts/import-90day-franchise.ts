/**
 * Import 90 Day Fiancé Franchise
 * Importiert alle Serien der Franchise in die Datenbank
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Alle Serien der Franchise mit deutschen Titeln und Kategorien
const FRANCHISE_SHOWS = [
  // Hauptserie
  { tmdbId: 61575, category: 'main', germanTitle: 'In 90 Tagen zum Altar' },
  
  // Beziehungen & Fortsetzungen
  { tmdbId: 67757, category: 'relationships', germanTitle: '90 Day Fiancé: Happily Ever After?' },
  { tmdbId: 74920, category: 'relationships', germanTitle: '90 Day Fiancé: What Now?' },
  { tmdbId: 101451, category: 'relationships', germanTitle: '90 Day Fiancé: Self-Quarantined' },
  { tmdbId: 154591, category: 'relationships', germanTitle: '90 Day Fiancé: After The 90 Days' },
  
  // Vor & nach dem K-1 Visum
  { tmdbId: 73319, category: 'visa', germanTitle: '90 Day Fiancé: Before the 90 Days' },
  { tmdbId: 90046, category: 'visa', germanTitle: '90 Day Fiancé: The Other Way' },
  
  // Dating & Drama
  { tmdbId: 118422, category: 'dating', germanTitle: '90 Day: The Single Life' },
  { tmdbId: 128495, category: 'dating', germanTitle: '90 Day Fiancé: Love in Paradise' },
  
  // Reaktionen / Kommentare
  { tmdbId: 94009, category: 'reactions', germanTitle: '90 Day Fiancé: Pillow Talk' },
  { tmdbId: 115029, category: 'reactions', germanTitle: '90 Day Bares All' },
  
  // Internationale Version
  { tmdbId: 205154, category: 'international', germanTitle: '90 Day Fiancé UK' },
  
  // Experiment / neue Formate
  { tmdbId: 230272, category: 'experimental', germanTitle: '90 Day: The Last Resort' },
  { tmdbId: 114659, category: 'experimental', germanTitle: '90 Day Diaries' },
  
  // Einzelne Paar-Spin-offs
  { tmdbId: 107128, category: 'spinoffs', germanTitle: 'Darcey & Stacey' },
  { tmdbId: 91169, category: 'spinoffs', germanTitle: 'The Family Chantel' },
  { tmdbId: 157719, category: 'spinoffs', germanTitle: 'David & Annie: After the 90 Days' },
  { tmdbId: 218742, category: 'spinoffs', germanTitle: 'Loren & Alexei: After the 90 Days' },
  
  // Specials
  { tmdbId: 96613, category: 'specials', germanTitle: '90 Day Fiancé: Just Landed' },
  { tmdbId: 124081, category: 'specials', germanTitle: '90 Day: Foody Call' },
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
  
  // Prüfe ob Serie bereits existiert
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
  console.log('🎬 90 DAY FIANCÉ FRANCHISE IMPORT');
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
    // Rate limiting
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('═'.repeat(60));
  console.log(`✅ Import abgeschlossen: ${imported} importiert, ${skipped} übersprungen`);
  console.log('═'.repeat(60));
  
  await prisma.$disconnect();
}

main().catch(console.error);
