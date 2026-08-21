import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { getLLMConfig } from '../lib/llm-config';

const prisma = new PrismaClient();
const config = getLLMConfig();
const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });

const BATCH_SIZE = 3;
const DELAY_MS = 1500;

async function generateBio(person: {
  name: string;
  biographyEn: string | null;
  biography: string | null;
  birthDate: Date | null;
  deathDate: Date | null;
  birthPlace: string | null;
  knownFor: string | null;
  tvCreditsJson: any;
  seriesOnSite: string[];
}): Promise<string | null> {
  const bioSource = person.biographyEn || person.biography || '';
  if (bioSource.length < 30 && (!person.tvCreditsJson || person.tvCreditsJson.length < 2)) {
    return null; // Not enough data
  }

  const tvCredits = (person.tvCreditsJson || []).slice(0, 10)
    .map((c: any) => `${c.name} (${c.year || '?'}) als ${c.character || '?'}, ${c.episodes || '?'} Episoden`)
    .join('\n');

  const seriesLinks = person.seriesOnSite.length > 0
    ? `\nSerien auf serien.de: ${person.seriesOnSite.join(', ')}`
    : '';

  const birthInfo = person.birthDate
    ? `Geboren: ${person.birthDate.toISOString().substring(0, 10)}${person.birthPlace ? ' in ' + person.birthPlace : ''}`
    : '';

  const deathInfo = person.deathDate
    ? `Gestorben: ${person.deathDate.toISOString().substring(0, 10)}`
    : '';

  const prompt = `Du bist Redakteur bei serien.de, einem deutschen Serien-Magazin.
Schreibe einen einzigartigen Kurzartikel über ${person.name} für ein deutsches Publikum.

FAKTEN:
${birthInfo}
${deathInfo}
Bekannt als: ${person.knownFor || 'Schauspieler/in'}
TMDB-Bio: ${bioSource.substring(0, 1500)}

Bekannteste TV-Rollen:
${tvCredits}
${seriesLinks}

REGELN:
- Exakt 2 Absätze, 150-250 Wörter gesamt
- Deutsch, journalistischer Magazin-Stil
- Fokus auf Serien-Karriere (Filme nur am Rande erwähnen)
- Erwähne 2-3 konkrete Rollen mit Seriennamen
- ${person.seriesOnSite.length > 0 ? 'Erwähne die Serien auf serien.de namentlich' : ''}
- NICHT die englische Bio einfach übersetzen
- Keine Aufzählungen, kein Markdown, nur Fließtext
- Schreibe im Präsens wo möglich`;

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 500,
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content?.trim() || null;
  } catch (e: any) {
    console.error(`  LLM Error for ${person.name}: ${e.message}`);
    return null;
  }
}

async function main() {
  // Get top 1000 enriched persons that need AI bio
  const persons = await prisma.$queryRaw<Array<{
    tmdbId: number; name: string; biography: string | null; biographyEn: string | null;
    birthDate: Date | null; deathDate: Date | null; birthPlace: string | null;
    knownFor: string | null; tvCreditsJson: any; socialLinks: any;
  }>>`
    SELECT p."tmdbId", p.name, p.biography, p."biographyEn", 
           p."birthDate", p."deathDate", p."birthPlace", p."knownFor", 
           p."tvCreditsJson", p."socialLinks"
    FROM persons p
    WHERE p."enrichedAt" IS NOT NULL
      AND (p.biography IS NULL OR length(p.biography) < 100 OR p.biography NOT LIKE '%serien%')
    ORDER BY p.popularity DESC NULLS LAST
    LIMIT 1000
  `;

  console.log(`🤖 AI-Bio-Generator: ${persons.length} Personen\n`);

  let success = 0, skipped = 0, failed = 0;

  for (let i = 0; i < persons.length; i += BATCH_SIZE) {
    const batch = persons.slice(i, i + BATCH_SIZE);

    for (const p of batch) {
      // Find series on our site
      const characters = await prisma.characters.findMany({
        where: { actorTmdbId: p.tmdbId },
        include: { series: { select: { title: true } } },
      });
      const seriesOnSite = [...new Set(characters.map(c => c.series?.title).filter(Boolean))] as string[];

      const bio = await generateBio({ ...p, seriesOnSite });

      if (!bio) {
        skipped++;
        console.log(`⏭️  ${success + skipped + failed}/${persons.length} ${p.name} (zu wenig Daten)`);
        continue;
      }

      await prisma.persons.update({
        where: { tmdbId: p.tmdbId },
        data: {
          biography: bio,
          updatedAt: new Date(),
        },
      });

      success++;
      const words = bio.split(/\s+/).length;
      console.log(`✅ ${success + skipped + failed}/${persons.length} ${p.name} (${words} Wörter)`);
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n🏁 FERTIG: ${success} generiert, ${skipped} übersprungen, ${failed} fehlgeschlagen`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
