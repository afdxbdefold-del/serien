/**
 * Generate long-form author bios (fullBio) for all authors using Claude Sonnet 4.6.
 *
 * Per author:
 *   - 3–4 paragraphs (~350–500 words)
 *   - Werdegang / Schwerpunkte / Ton / Interessen
 *   - Based on: existing short bio + expertise tags + written article topics
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

STRUKTUR (exakt 3 Absätze, ca. 400–500 Wörter gesamt):

**Absatz 1 – Wer & Woher (Experience-fokus):**
Werdegang, Stationen, wie viele Jahre im Bereich, warum serien.de. Konkrete Zahlen + Orte. Keine Floskeln.

**Absatz 2 – Was & Wie (Expertise-fokus):**
Inhaltliche Schwerpunkte mit BENCHMARK-Serien (konkrete Namen aus den Expertise-Bereichen). Arbeitsweise: Wie analysiert sie? Welche Quellen nutzt sie? (TMDB, Variety, Deadline, Trade Press, Interviews, Screener). Was macht ihre Perspektive einzigartig?

**Absatz 3 – Haltung & Versprechen (Authority + Trust):**
Qualitätsanspruch, redaktionelle Haltung, was Leser*innen konkret erwarten dürfen. Lieblingsserien (3–5 konkrete Titel, gemischt aus den Expertise-Genres). Schlusssatz mit klarer Positionierung.

HARTE REGELN:
- DEUTSCH, Sie-Form vermeiden (neutral)
- KEINE Floskeln: "leidenschaftlich", "unersetzlich", "begeistert", "liebt es", "mit Herz und Seele"
- KEINE KI-Phrasen: "In der heutigen schnelllebigen Welt…", "Im Zeitalter von Streaming…"
- Konkret > abstrakt
- Plain HTML: Genau 3 <p>-Tags, keine Überschriften, keine Listen
- Starte direkt mit dem Text, KEINE Einleitungsphrase
- Zahl-Werte erlaubt (z.B. "seit 2017", "über 200 Artikel", "rund 50 Serien pro Jahr")

ANTWORT (nur das HTML, nichts sonst):`;

  const modelsToTry = [model, 'gpt-4o-mini'];
  let lastError: any;
  for (const m of modelsToTry) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          model: m,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.7,
        });
        let text = completion.choices[0].message.content || '';
        text = text.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
        if (!text.includes('<p>')) {
          text = text.split(/\n\s*\n/).filter(Boolean).map(p => `<p>${p.trim()}</p>`).join('\n');
        }
        if (attempt > 0 || m !== model) console.log(`    ℹ used ${m} attempt ${attempt + 1}`);
        return text;
      } catch (e: any) {
        lastError = e;
        const msg = e?.message || String(e);
        if (msg.includes('502') || msg.includes('timeout') || msg.includes('ECONNRESET')) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        break;
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
      await new Promise(r => setTimeout(r, 500));
    } catch (e: any) {
      console.error(`    ✗ Error: ${e.message}`);
    }
  }

  console.log(`\nDone. ${APPLY ? '' : '\nRe-run with --apply to save.'}`);
  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
