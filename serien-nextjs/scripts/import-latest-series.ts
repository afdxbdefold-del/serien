/**
 * IMPORT LATEST SERIES FROM TMDB
 * 
 * Fetches new/recent series from TMDB endpoints:
 *  - tv/airing_today
 *  - tv/on_the_air
 *  - discover/tv sorted by first_air_date.desc
 * Skips series already in the DB, imports new ones with cast.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function loadApiKey(): string {
  const envPath = path.join(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/TMDB_API_KEY="([^"]+)"/);
  if (!match) throw new Error('TMDB_API_KEY not found in .env');
  return match[1];
}

const TMDB_API_KEY = loadApiKey();
const TMDB_BASE = 'https://api.themoviedb.org/3';

let lastRequestTime = 0;
const MIN_INTERVAL = 120;

async function tmdbFetch(url: string): Promise<any> {
  const now = Date.now();
  if (now - lastRequestTime < MIN_INTERVAL) {
    await new Promise(r => setTimeout(r, MIN_INTERVAL - (now - lastRequestTime)));
  }
  lastRequestTime = Date.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

const GENRE_MAP: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids',
  9648: 'Mystery', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
  10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics', 37: 'Western',
};

function generateSlug(name: string, tmdbId: number): string {
  const base = name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // If slug would be empty or start with dash (non-Latin), use tmdbId prefix
  return base || `${tmdbId}`;
}

async function fetchLatestSeries(): Promise<any[]> {
  const all: any[] = [];
  const seen = new Set<number>();

  const sources = [
    { name: 'Airing Today', pages: 5, url: (p: number) => `${TMDB_BASE}/tv/airing_today?api_key=${TMDB_API_KEY}&language=de-DE&page=${p}` },
    { name: 'On The Air', pages: 5, url: (p: number) => `${TMDB_BASE}/tv/on_the_air?api_key=${TMDB_API_KEY}&language=de-DE&page=${p}` },
    { name: 'Newest (Discover)', pages: 10, url: (p: number) => `${TMDB_BASE}/discover/tv?api_key=${TMDB_API_KEY}&language=de-DE&sort_by=first_air_date.desc&first_air_date.lte=${new Date().toISOString().slice(0, 10)}&vote_count.gte=5&page=${p}` },
    { name: 'Popular', pages: 10, url: (p: number) => `${TMDB_BASE}/tv/popular?api_key=${TMDB_API_KEY}&language=de-DE&page=${p}` },
  ];

  for (const src of sources) {
    console.log(`\n  ${src.name}...`);
    for (let p = 1; p <= src.pages; p++) {
      try {
        const data = await tmdbFetch(src.url(p));
        for (const s of data.results || []) {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            all.push(s);
          }
        }
      } catch (e: any) {
        console.log(`    Page ${p} error: ${e.message}`);
      }
    }
    console.log(`    → ${all.length} unique gesammelt`);
  }

  return all;
}

async function importSeries(s: any): Promise<{ isNew: boolean; castCount: number }> {
  const existing = await prisma.series.findUnique({ where: { tmdbId: s.id } });
  if (existing) return { isNew: false, castCount: 0 };

  let slug = generateSlug(s.name, s.id);
  const genres = (s.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean);

  // Check slug conflict, append tmdbId if needed
  const slugExists = await prisma.series.findFirst({ where: { slug } });
  if (slugExists) slug = `${slug}-${s.id}`;

  try {
    await prisma.series.create({
      data: {
        tmdbId: s.id,
        title: s.name,
        name: s.name,
        originalName: s.original_name || null,
        slug,
        overview: s.overview || null,
        posterPath: s.poster_path || null,
        backdropPath: s.backdrop_path || null,
        firstAirDate: s.first_air_date ? new Date(s.first_air_date) : null,
        popularity: s.popularity || 0,
        genres,
        networks: [],
        updatedAt: new Date(),
      },
    });
  } catch (e: any) {
    if (e.code === 'P2002') return { isNew: false, castCount: 0 }; // skip duplicate
    throw e;
  }

  // Import cast
  let castCount = 0;
  try {
    const credits = await tmdbFetch(`${TMDB_BASE}/tv/${s.id}/credits?api_key=${TMDB_API_KEY}&language=de-DE`);
    const topCast = (credits.cast || [])
      .filter((c: any) => c.known_for_department === 'Acting')
      .slice(0, 10);

    for (const m of topCast) {
      try {
        const pid = generateSlug(m.name, m.id);
        await prisma.persons.upsert({
          where: { tmdbId: m.id },
          create: { id: pid, tmdbId: m.id, name: m.name, slug: pid, profilePath: m.profile_path, updatedAt: new Date() },
          update: { name: m.name, profilePath: m.profile_path, updatedAt: new Date() },
        });

        if (m.character?.trim()) {
          const charSlug = generateSlug(m.character.split('/')[0].trim(), m.id);
          await prisma.characters.upsert({
            where: { seriesTmdbId_name: { seriesTmdbId: s.id, name: m.character } },
            create: {
              name: m.character, slug: charSlug, seriesTmdbId: s.id,
              actorTmdbId: m.id, actorName: m.name,
              imageUrl: m.profile_path ? `https://image.tmdb.org/t/p/w500${m.profile_path}` : null,
            },
            update: { actorTmdbId: m.id, actorName: m.name },
          });
        }
        castCount++;
      } catch {}
    }
  } catch {}

  return { isNew: true, castCount };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   NEUESTE SERIEN VON TMDB IMPORTIEREN');
  console.log('═══════════════════════════════════════════════════════════════');

  const [initSeries, initPersons, initChars] = await Promise.all([
    prisma.series.count(), prisma.persons.count(), prisma.characters.count()
  ]);
  console.log(`\nDB vorher: ${initSeries} Serien, ${initPersons} Personen, ${initChars} Figuren`);

  const latest = await fetchLatestSeries();
  console.log(`\n${latest.length} Serien von TMDB geholt. Importiere neue...\n`);

  let newCount = 0, totalCast = 0, processed = 0;

  for (const s of latest) {
    const result = await importSeries(s);
    if (result.isNew) {
      newCount++;
      console.log(`  NEW: ${s.name} (${s.first_air_date || '?'}) +${result.castCount} Cast`);
    }
    totalCast += result.castCount;
    processed++;
    if (processed % 100 === 0) {
      console.log(`  ... ${processed}/${latest.length} geprüft, ${newCount} neu`);
    }
  }

  const [endSeries, endPersons, endChars] = await Promise.all([
    prisma.series.count(), prisma.persons.count(), prisma.characters.count()
  ]);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   FERTIG');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Serien:  ${initSeries} → ${endSeries} (+${endSeries - initSeries})`);
  console.log(`  Personen: ${initPersons} → ${endPersons} (+${endPersons - initPersons})`);
  console.log(`  Figuren: ${initChars} → ${endChars} (+${endChars - initChars})`);
  console.log(`  Neue Serien: ${newCount}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); });
