import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { getLLMConfig } from '../lib/llm-config';

const prisma = new PrismaClient();
const config = getLLMConfig();
const openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });

const BATCH_SIZE = 3;
const DELAY_MS = 1500;

async function generateSeriesText(series: {
  name: string | null;
  title: string;
  overview: string | null;
  genres: string[];
  networks: string[];
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  firstAirDate: Date | null;
  lastAirDate: Date | null;
  voteAverage: number | null;
  tagline: string | null;
  inProduction: boolean | null;
  cast: any;
  articleTitles: string[];
}): Promise<string | null> {
  const seriesName = series.name || series.title;
  const overview = series.overview || '';
  
  if (overview.length < 20 && !series.cast) {
    return null;
  }

  const castList = Array.isArray(series.cast) 
    ? series.cast.slice(0, 8).map((c: any) => `${c.name} als ${c.character || '?'}`).join(', ')
    : '';

  const year = series.firstAirDate ? new Date(series.firstAirDate).getFullYear() : '?';
  const endYear = series.lastAirDate ? new Date(series.lastAirDate).getFullYear() : null;
  const yearRange = endYear && endYear !== year ? `${year}-${endYear}` : `seit ${year}`;
  const status = series.inProduction ? 'läuft noch' : 'abgeschlossen';

  const newsContext = series.articleTitles.length > 0
    ? `\nAktuelle News auf serien.de:\n${series.articleTitles.slice(0, 5).map(t => `- ${t}`).join('\n')}`
    : '';

  const prompt = `Du bist Chefredakteur bei serien.de, dem deutschen Serien-Magazin.
Schreibe einen redaktionellen Überblick über die Serie "${seriesName}" für ein deutsches Publikum.

FAKTEN:
Titel: ${seriesName}
Zeitraum: ${yearRange} (${status})
Genre: ${(series.genres || []).join(', ')}
Netzwerk: ${(series.networks || []).join(', ')}
Staffeln: ${series.numberOfSeasons || '?'} | Episoden: ${series.numberOfEpisodes || '?'}
Bewertung: ${series.voteAverage ? series.voteAverage.toFixed(1) + '/10' : '?'}
${series.tagline ? 'Tagline: ' + series.tagline : ''}
TMDB-Beschreibung: ${overview}
Cast: ${castList}
${newsContext}

REGELN:
- Exakt 3 Absätze:
  1. Absatz: Worum geht es? (Prämisse, Setting, Hauptfiguren) ~80 Wörter
  2. Absatz: Was macht die Serie besonders? (Kritik, kulturelle Bedeutung, Vergleiche) ~80 Wörter
  3. Absatz: Streaming-Info und aktueller Stand (Staffeln, Verlängerung, Neuigkeiten) ~60 Wörter
- 200-280 Wörter gesamt
- Deutsch, journalistischer Magazin-Stil
- Erwähne mindestens 2 Schauspieler mit Rollennamen
- NICHT die TMDB-Beschreibung übersetzen oder umschreiben
- Eigene Formulierungen und Einordnungen
- Keine Aufzählungen, kein Markdown, nur Fließtext
- Schreibe im Präsens`;

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content?.trim() || null;
  } catch (e: any) {
    console.error(`  LLM Error for ${seriesName}: ${e.message}`);
    return null;
  }
}

async function main() {
  // Get top 1000 series that need AI text
  const series = await prisma.$queryRaw<Array<{
    tmdbId: number; title: string; name: string | null; overview: string | null;
    genres: string[]; networks: string[]; numberOfSeasons: number | null;
    numberOfEpisodes: number | null; firstAirDate: Date | null; lastAirDate: Date | null;
    voteAverage: number | null; tagline: string | null; inProduction: boolean | null;
    cast: any; extendedOverview: string | null;
  }>>`
    SELECT s."tmdbId", s.title, s.name, s.overview, s.genres, s.networks,
           s."numberOfSeasons", s."numberOfEpisodes", s."firstAirDate", s."lastAirDate",
           s."voteAverage", s.tagline, s."inProduction", s.cast, s."extendedOverview"
    FROM series s
    WHERE (s."extendedOverview" IS NULL OR LENGTH(s."extendedOverview") < 200)
    ORDER BY s.popularity DESC NULLS LAST
    LIMIT 1000
  `;

  console.log(`🎬 Serien AI-Text Generator: ${series.length} Serien\n`);

  let success = 0, skipped = 0, failed = 0;

  for (let i = 0; i < series.length; i += BATCH_SIZE) {
    const batch = series.slice(i, i + BATCH_SIZE);

    for (const s of batch) {
      const seriesName = s.name || s.title;

      // Fetch article titles for this series
      const articles = await prisma.articles.findMany({
        where: { primarySeriesId: s.tmdbId, status: { in: ['published', 'PUBLISHED'] } },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: { title: true },
      });

      const text = await generateSeriesText({
        ...s,
        articleTitles: articles.map(a => a.title),
      });

      if (!text) {
        skipped++;
        console.log(`⏭️  ${success + skipped + failed}/${series.length} ${seriesName} (zu wenig Daten)`);
        continue;
      }

      await prisma.series.update({
        where: { tmdbId: s.tmdbId },
        data: {
          extendedOverview: text,
          updatedAt: new Date(),
        },
      });

      success++;
      const words = text.split(/\s+/).length;
      console.log(`✅ ${success + skipped + failed}/${series.length} ${seriesName} (${words} Wörter)`);
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n🏁 FERTIG: ${success} generiert, ${skipped} übersprungen, ${failed} fehlgeschlagen`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
