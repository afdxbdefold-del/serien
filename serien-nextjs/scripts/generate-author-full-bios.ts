/**
 * Generate long-form author bios (fullBio) for all authors using Claude Sonnet 4.5.
 *
 * Per author:
 *   - 3 paragraphs, ~400–500 words
 *   - E-E-A-T optimized: Experience / Expertise / Authority / Trust
 *   - Based on: existing short bio + expertise tags + last 10 article titles
 *
 * Claude-ONLY (no gpt-mini fallback — user requirement).
 * Retries: 5 attempts with exponential backoff on retriable errors.
 *
 * Run:
 *   npx tsx scripts/generate-author-full-bios.ts          # dry-run
 *   npx tsx scripts/generate-author-full-bios.ts --apply  # persists to DB
 */

import prisma from '../lib/prisma';
import { createLLMClient, getLLMConfig } from '../lib/llm-config';

const APPLY = process.argv.includes('--apply');

async function generateBio(
  name: string,
  shortBio: string,
  expertise: string[],
  sampleTitles: string[],
  model: string,
  client: ReturnType<typeof createLLMClient>,
): Promise<string> {
  const prompt = `Du schreibst eine Autoren-Biografie für serien.de — optimiert für Googles E-E-A-T-Signale (Experience, Expertise, Authoritativeness, Trust). Der Text wird auf /autor/${name.toLowerCase().replace(/\s+/g,'-')} angezeigt und ist ein direktes Ranking-Signal.

AUTOR: ${name}
KURZBIO (E-E-A-T-Summary): ${shortBio}
EXPERTISE: ${expertise.join(', ')}
LETZTE 10 ARTIKELTHEMEN:
${sampleTitles.slice(0, 10).map(t => `  - ${t}`).join('\n')}

E-E-A-T-REGELN für den Text:

**Experience (echte Erfahrung zeigen):**
- Konkrete Stationen im Werdegang (Studium, frühere Medien, Jahre im Journalismus)
- Hands-on: Screener gesehen, Set-Besuche, Junkets, Reviews seit Jahr X
- Persönliche Stil-Marker: "seit 2015", "seit der ersten Staffel", "nach über 200 Reviews"

**Expertise (Tiefe belegen):**
- Fachbegriffe korrekt: Showrunner, Episodenstruktur, Genre-Konventionen, Streaming-Metriken
- Konkrete Werke nennen, die in den Expertise-Bereich passen (nicht nur aus den Beispiel-Artikeln — auch verwandte Klassiker/Benchmarks)
- Analytische Perspektive: Was macht eine Serie gut? Wo liegt der Fokus? (Erzählstruktur? Charakterbogen? Production Design?)

**Authoritativeness (Autorität):**
- Tonfall sicher, nicht devot ("analysiert", "ordnet ein", "bewertet" — NIE "liebt", "findet toll", "schwärmt")
- Positionierung innerhalb der deutschen Streaming-/Seriengesellschaft
- Ein Absatz über Qualitätsstandards beim Schreiben: Was erwarten Leser*innen? (z.B. "spoilerfrei wenn angekündigt", "zwischen Faktenlage und Spekulation differenziert")

**Trust (Vertrauen):**
- Transparenz: Serien.de folgt Autorenrichtlinien, keine bezahlten Reviews
- Aktualisierungen: neue Infos werden nachgepflegt statt überschrieben
- Fehlerkultur: Korrekturen werden markiert

STRUKTUR (exakt 3 Absätze, ZWINGEND 400–500 Wörter GESAMT — d.h. jeder Absatz ~130–170 Wörter):

**Absatz 1 – Wer & Woher (Experience-fokus, 130–170 Wörter):**
Werdegang mit konkreten Stationen (Universität + Stadt, frühere Medien/Publikationen, Jahr des Einstiegs, Art der Tätigkeit). Mindestens 4 konkrete Eckdaten (Jahreszahlen, Orte, Mengenangaben wie "über 300 Artikel"). Keine Floskeln.

**Absatz 2 – Was & Wie (Expertise-fokus, 130–170 Wörter):**
Inhaltliche Schwerpunkte mit MINDESTENS 5 BENCHMARK-Serien (konkrete Titel in <em>-Tags). Arbeitsweise detailliert: Welche Quellen? (TMDB, Variety, Deadline, The Hollywood Reporter, Trade Press, Interviews, Screener). Analytische Methodik: Was wird geprüft (Showrunner-Wechsel, Produktionsbudgets, Besetzungsentscheidungen, Tonalitäts-Konsistenz)? Wie differenziert sie zwischen bestätigten Daten, Gerüchten und Spekulation?

**Absatz 3 – Haltung & Versprechen (Authority + Trust, 130–170 Wörter):**
Qualitätsanspruch, redaktionelle Haltung (keine bezahlten Reviews, Update-Policy mit Zeitstempel, Spoiler-Kennzeichnung, Transparenz bei Streaming-Zahlen). MINDESTENS 4 persönliche Benchmark-Serien aus den Expertise-Genres mit je 1 kurzer Begründung (z.B. "<em>Better Call Saul</em> für Charakterentwicklung"). Schlusssatz mit klarer Positionierung der Erwartungshaltung an Leser.

HARTE REGELN:
- DEUTSCH, Sie-Form vermeiden (neutral)
- KEINE Floskeln: "leidenschaftlich", "unersetzlich", "begeistert", "liebt es", "mit Herz und Seele"
- KEINE KI-Phrasen: "In der heutigen schnelllebigen Welt…", "Im Zeitalter von Streaming…"
- Konkret > abstrakt
- Plain HTML: Genau 3 <p>-Tags, keine Überschriften, keine Listen
- Starte direkt mit dem Text, KEINE Einleitungsphrase
- Zahl-Werte erlaubt (z.B. "seit 2017", "über 200 Artikel", "rund 50 Serien pro Jahr")

ANTWORT (nur das HTML, nichts sonst):`;

  const modelsToTry = [model]; // Claude-only (user requirement: never use gpt-mini for articles)
  let lastError: any;
  for (const m of modelsToTry) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          model: m,
          messages: [{ role: 'user', content: prompt }],
          max_completion_tokens: 2500,
          temperature: 0.7,
        });
        let text = completion.choices[0].message.content || '';
        text = text.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
        if (!text.includes('<p>')) {
          text = text.split(/\n\s*\n/).filter(Boolean).map(p => `<p>${p.trim()}</p>`).join('\n');
        }
        if (attempt > 0) console.log(`    ℹ succeeded on attempt ${attempt + 1}`);
        return text;
      } catch (e: any) {
        lastError = e;
        const msg = e?.message || String(e);
        const retriable = msg.includes('502') || msg.includes('503') || msg.includes('504')
          || msg.includes('timeout') || msg.includes('ECONNRESET') || msg.includes('rate_limit')
          || msg.includes('overloaded') || msg.includes('529');
        if (retriable && attempt < 4) {
          const backoff = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s, 16s
          console.log(`    ⚠ retriable error "${msg.substring(0, 80)}" — retry in ${backoff}ms`);
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        throw e;
      }
    }
  }
  throw lastError;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const authors = await prisma.users.findMany({
    where: { bio: { not: null }, role: { in: ['author', 'admin'] } },
    select: { id: true, name: true, bio: true, expertise: true },
  });

  console.log(`Authors found: ${authors.length}\n`);

  const client = createLLMClient();
  const { model } = getLLMConfig();
  console.log(`Model: ${model}\n`);

  const failures: string[] = [];
  let succeeded = 0;

  for (const author of authors) {
    // Get sample article titles written by this author
    const articles = await prisma.articles.findMany({
      where: {
        authorId: author.id,
        OR: [{ status: 'published' }, { status: 'PUBLISHED' }],
      },
      take: 10,
      orderBy: { publishedAt: 'desc' },
      select: { title: true },
    });

    const titles = articles.map(a => a.title);
    if (titles.length === 0) {
      console.log(`  ⊘ ${author.name}: no articles, skipping`);
      continue;
    }

    console.log(`  → Generating for ${author.name} (${titles.length} articles)...`);
    try {
      const fullBio = await generateBio(
        author.name || 'Anonym',
        author.bio || '',
        author.expertise || [],
        titles,
        model,
        client,
      );
      console.log(`    ✓ ${fullBio.length} chars generated`);
      if (APPLY) {
        await prisma.users.update({
          where: { id: author.id },
          data: { fullBio } as any,
        });
        console.log(`    💾 Saved to DB`);
      } else {
        console.log(`    PREVIEW: ${fullBio.substring(0, 200).replace(/<[^>]+>/g, ' ')}…`);
      }
      succeeded++;
      await new Promise(r => setTimeout(r, 500));
    } catch (e: any) {
      console.error(`    ✗ Error: ${e.message}`);
      failures.push(`${author.name}: ${e.message}`);
    }
  }

  console.log(`\n============================================`);
  console.log(`✓ Succeeded: ${succeeded}/${authors.length}`);
  if (failures.length) {
    console.log(`✗ Failed: ${failures.length}`);
    failures.forEach(f => console.log(`   - ${f}`));
  }
  console.log(`${APPLY ? '💾 Persisted to DB' : '(dry-run) Re-run with --apply to save.'}`);
  await prisma.$disconnect();
  if (failures.length > 0) process.exit(1);
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
