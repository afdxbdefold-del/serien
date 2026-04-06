import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TMDB_KEY = process.env.TMDB_API_KEY!;
const BATCH_SIZE = 5;
const DELAY_MS = 300;

interface TmdbPerson {
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  popularity: number;
  known_for_department: string;
  external_ids?: {
    instagram_id?: string;
    twitter_id?: string;
    tiktok_id?: string;
    imdb_id?: string;
    wikidata_id?: string;
  };
  tv_credits?: {
    cast: Array<{
      id: number;
      name: string;
      character: string;
      episode_count: number;
      first_air_date?: string;
      vote_count?: number;
      popularity?: number;
    }>;
  };
}

async function fetchTmdbPerson(tmdbId: number): Promise<{ de: TmdbPerson; en: TmdbPerson } | null> {
  try {
    const [deRes, enRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/person/${tmdbId}?api_key=${TMDB_KEY}&language=de-DE&append_to_response=external_ids,tv_credits`),
      fetch(`https://api.themoviedb.org/3/person/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`),
    ]);
    if (!deRes.ok || !enRes.ok) return null;
    const [de, en] = await Promise.all([deRes.json(), enRes.json()]);
    return { de, en };
  } catch {
    return null;
  }
}

async function main() {
  // Get top 1000 persons by popularity + character count on our site
  const persons = await prisma.$queryRaw<Array<{ tmdbId: number; name: string; role_count: bigint }>>`
    SELECT p."tmdbId", p.name,
           COUNT(c.id) as role_count
    FROM persons p
    LEFT JOIN characters c ON c."actorTmdbId" = p."tmdbId"
    WHERE p."enrichedAt" IS NULL
    GROUP BY p."tmdbId", p.name
    ORDER BY role_count DESC, p."tmdbId" ASC
    LIMIT 1000
  `;

  console.log(`🚀 TMDB-Backfill: ${persons.length} Personen zu aktualisieren\n`);

  let success = 0, failed = 0;

  for (let i = 0; i < persons.length; i += BATCH_SIZE) {
    const batch = persons.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.all(batch.map(async (p) => {
      const data = await fetchTmdbPerson(p.tmdbId);
      if (!data) return { tmdbId: p.tmdbId, name: p.name, ok: false };

      const { de, en } = data;
      
      // Build TV credits JSON (top 20 by vote count)
      const tvCredits = (de.tv_credits?.cast || [])
        .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
        .slice(0, 20)
        .map(c => ({
          id: c.id,
          name: c.name,
          character: c.character,
          episodes: c.episode_count,
          year: c.first_air_date?.substring(0, 4) || null,
        }));

      // Build social links
      const ext = de.external_ids || {};
      const socialLinks: Record<string, string> = {};
      if (ext.instagram_id) socialLinks.instagram = ext.instagram_id;
      if (ext.twitter_id) socialLinks.twitter = ext.twitter_id;
      if (ext.tiktok_id) socialLinks.tiktok = ext.tiktok_id;
      if (ext.imdb_id) socialLinks.imdb = ext.imdb_id;
      if (ext.wikidata_id) socialLinks.wikidata = ext.wikidata_id;

      await prisma.persons.update({
        where: { tmdbId: p.tmdbId },
        data: {
          biography: de.biography || null,
          biographyEn: en.biography || null,
          birthDate: de.birthday ? new Date(de.birthday) : null,
          deathDate: de.deathday ? new Date(de.deathday) : null,
          birthPlace: de.place_of_birth || null,
          popularity: de.popularity || null,
          knownFor: de.known_for_department || null,
          socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
          tvCreditsJson: tvCredits.length > 0 ? tvCredits : null,
          enrichedAt: new Date(),
          updatedAt: new Date(),
        }
      });

      return { tmdbId: p.tmdbId, name: p.name, ok: true, bioEn: (en.biography || '').length };
    }));

    for (const r of results) {
      if (r.ok) {
        success++;
        console.log(`✅ ${success}/${persons.length} ${r.name} (Bio EN: ${(r as any).bioEn} Zeichen)`);
      } else {
        failed++;
        console.log(`❌ ${r.name} (TMDB-Fehler)`);
      }
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n🏁 FERTIG: ${success} OK, ${failed} fehlgeschlagen`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
