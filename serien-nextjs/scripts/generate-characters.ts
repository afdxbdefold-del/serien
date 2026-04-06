import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { getLLMConfig } from '../lib/llm-config';

const prisma = new PrismaClient();
const config = getLLMConfig();
const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });

const TMDB_KEY = process.env.TMDB_API_KEY!;
const DELAY_MS = 1200;
const CHARS_PER_SERIES = 5;

function makeSlug(name: string, seriesTitle: string): string {
  return `${name}-${seriesTitle}`
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function makeId(): string {
  return `char-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

function robustJsonParse(raw: string): any {
  let content = raw.trim();
  if (content.startsWith('```json')) content = content.slice(7);
  else if (content.startsWith('```')) content = content.slice(3);
  if (content.endsWith('```')) content = content.slice(0, -3);
  content = content.trim();

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  content = jsonMatch[0];

  try {
    return JSON.parse(content);
  } catch {
    // Fix common Claude issues: German quotes, unescaped newlines in strings
    const fixed = content
      .replace(/„/g, "'").replace(/"/g, "'").replace(/"/g, "'")
      .replace(/[\t]/g, ' ')
      .replace(/\n\n/g, '\\n\\n')
      // Fix unescaped newlines inside JSON string values
      .replace(/(?<=": ")([\s\S]*?)(?="[,\}])/g, (match) => 
        match.replace(/\n/g, ' ').replace(/\r/g, '')
      );
    try {
      return JSON.parse(fixed);
    } catch {
      // Last resort: extract fields with regex
      return extractWithRegex(content);
    }
  }
}

function extractWithRegex(raw: string): any {
  const extract = (key: string): string => {
    const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]*(?:"[^"]*)*?)(?:"|$)`, 's');
    const match = raw.match(regex);
    return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
  };

  return {
    shortDescription: extract('shortDescription'),
    whoIsContent: extract('whoIsContent'),
    roleInSeriesContent: extract('roleInSeriesContent'),
    importanceContent: extract('importanceContent'),
    appearancesContent: extract('appearancesContent'),
    qa: [],
    metaTitle: extract('metaTitle'),
    metaDescription: extract('metaDescription'),
  };
}

async function fetchTmdbCast(tmdbId: number): Promise<Array<{ name: string; character: string; id: number }>> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/credits?api_key=${TMDB_KEY}&language=de-DE`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.cast || []).slice(0, 10).map((c: any) => ({
      name: c.name,
      character: c.character,
      id: c.id,
    }));
  } catch {
    return [];
  }
}

async function generateCharContent(
  charName: string,
  actorName: string,
  seriesTitle: string,
  overview: string,
  genres: string[],
  seasons: number | null,
): Promise<any> {
  const prompt = `Du bist Redakteur bei serien.de. Erstelle einen Figuren-Artikel über "${charName}" aus "${seriesTitle}" (gespielt von ${actorName}).

Serie: ${seriesTitle} | Genre: ${(genres || []).join(', ')} | Staffeln: ${seasons || '?'}
Kontext: ${overview.substring(0, 400)}

Antworte als JSON-Objekt (KEIN Markdown, kein **, ##):
{
  "shortDescription": "1-2 Sätze über die Figur, ~30 Wörter",
  "whoIsContent": "Wer ist die Figur? Hintergrund, Persönlichkeit. 2 Absätze, ~150 Wörter Fließtext",
  "roleInSeriesContent": "Rolle und Entwicklung in der Serie. 2 Absätze, ~120 Wörter Fließtext",
  "importanceContent": "Warum ist die Figur wichtig? 1-2 Absätze, ~100 Wörter Fließtext",
  "appearancesContent": "Wichtige Auftritte und Wendepunkte. 1-2 Absätze, ~100 Wörter Fließtext",
  "qa": [{"question": "Frage?", "answer": "Antwort"}, {"question": "Frage?", "answer": "Antwort"}, {"question": "Frage?", "answer": "Antwort"}],
  "metaTitle": "${charName} (${seriesTitle}) - Rolle & Bedeutung",
  "metaDescription": "SEO-Beschreibung ~150 Zeichen"
}

Regeln: Deutsch, Fließtext, erwähne ${actorName}, keine Markdown-Formatierung, keine erfundenen Plot-Details.`;

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
      temperature: 0.7,
    });
    const raw = response.choices[0]?.message?.content?.trim() || '';
    const parsed = robustJsonParse(raw);
    if (!parsed || !parsed.whoIsContent) return null;

    // Strip any remaining markdown
    for (const key of ['shortDescription', 'whoIsContent', 'roleInSeriesContent', 'importanceContent', 'appearancesContent', 'metaTitle', 'metaDescription']) {
      if (parsed[key]) parsed[key] = parsed[key].replace(/\*\*/g, '').replace(/##\s?/g, '');
    }
    return parsed;
  } catch (e: any) {
    console.error(`  LLM Error for ${charName}: ${e.message}`);
    return null;
  }
}

async function main() {
  // Step 1: Get top 500 series by popularity that don't have characters
  const seriesList = await prisma.$queryRaw<Array<{
    tmdbId: number; title: string; name: string | null;
    overview: string | null; extendedOverview: string | null;
    genres: string[]; numberOfSeasons: number | null;
    cast: any; popularity: number | null;
  }>>`
    SELECT s."tmdbId", s.title, s.name, s.overview, s."extendedOverview",
           s.genres, s."numberOfSeasons", s.cast, s.popularity
    FROM series s
    WHERE NOT EXISTS (SELECT 1 FROM characters c WHERE c."seriesTmdbId" = s."tmdbId")
    ORDER BY s.popularity DESC NULLS LAST
    LIMIT 500
  `;

  console.log(`\n=== FIGUREN-GENERATOR: ${seriesList.length} Serien ===\n`);

  let totalCreated = 0, totalSkipped = 0, totalFailed = 0, seriesProcessed = 0;

  for (const series of seriesList) {
    seriesProcessed++;
    const seriesName = series.name || series.title;

    // Get cast: from DB or fetch from TMDB
    let castArr = Array.isArray(series.cast) ? series.cast : [];
    if (castArr.length < 3) {
      console.log(`  Fetching TMDB cast for ${seriesName}...`);
      castArr = await fetchTmdbCast(series.tmdbId);
      if (castArr.length >= 3) {
        // Save cast to DB for future use
        await prisma.series.update({
          where: { tmdbId: series.tmdbId },
          data: { cast: castArr as any, updatedAt: new Date() },
        });
      }
    }

    const topCast = castArr.slice(0, CHARS_PER_SERIES);
    if (topCast.length < 2) {
      console.log(`⏭️  ${seriesProcessed}/${seriesList.length} ${seriesName} (zu wenig Cast: ${castArr.length})`);
      totalSkipped++;
      continue;
    }

    console.log(`\n📺 ${seriesProcessed}/${seriesList.length} ${seriesName} (${topCast.length} Figuren)`);
    const overview = series.extendedOverview || series.overview || '';

    for (const castMember of topCast) {
      const charName = castMember.character || castMember.name;
      const actorName = castMember.name || 'Unbekannt';
      const actorTmdbId = castMember.id || null;

      if (!charName || charName.length < 2) {
        totalSkipped++;
        continue;
      }

      const slug = makeSlug(charName, seriesName);
      const existing = await prisma.characters.findUnique({ where: { slug } });
      if (existing) {
        console.log(`  ⏭️  ${charName} (existiert)`);
        totalSkipped++;
        continue;
      }

      const content = await generateCharContent(
        charName, actorName, seriesName, overview,
        series.genres || [], series.numberOfSeasons
      );

      if (!content) {
        totalFailed++;
        console.log(`  ❌ ${charName} (AI-Fehler)`);
        continue;
      }

      try {
        await prisma.characters.create({
          data: {
            id: makeId(),
            slug,
            name: charName,
            seriesTmdbId: series.tmdbId,
            actorTmdbId: actorTmdbId,
            shortDescription: content.shortDescription || '',
            whoIsContent: content.whoIsContent || '',
            roleInSeriesContent: content.roleInSeriesContent || '',
            importanceContent: content.importanceContent || '',
            appearancesContent: content.appearancesContent || '',
            qaContent: content.qa || [],
            metaTitle: content.metaTitle || `${charName} (${seriesName})`,
            metaDescription: content.metaDescription || '',
            publishStatus: 'published',
            status: 'unbekannt',
            firstAppearance: 'Staffel 1',
            seasons: series.numberOfSeasons ? `1-${series.numberOfSeasons}` : '1+',
            articleMentions: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        totalCreated++;
        console.log(`  ✅ ${charName} (${actorName})`);
      } catch (e: any) {
        totalFailed++;
        console.log(`  ❌ ${charName} DB: ${e.message.substring(0, 60)}`);
      }

      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n🏁 FERTIG: ${totalCreated} erstellt, ${totalSkipped} übersprungen, ${totalFailed} fehlgeschlagen`);
  console.log(`   Serien: ${seriesProcessed}/${seriesList.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
