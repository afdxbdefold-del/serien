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
  const prompt = `Du schreibst eine ausführliche Autoren-Biografie für die Profilseite einer deutschen Serien-Redaktion (serien.de). Die Biografie wird als E-E-A-T-Signal für Google verwendet (Experience, Expertise, Authoritativeness, Trust).

AUTOR: ${name}
KURZBIO: ${shortBio}
EXPERTISE-TAGS: ${expertise.join(', ')}
BEISPIEL-ARTIKELTHEMEN (vom Autor geschrieben):
${sampleTitles.slice(0, 10).map(t => `  - ${t}`).join('\n')}

SCHREIBE EINE LANGBIO mit folgenden Regeln:
1. 3 Absätze, ca. 350–450 Wörter
2. Absatz 1: Werdegang + warum diese Person serien.de prägt (konkret, keine Phrasen)
3. Absatz 2: Inhaltliche Schwerpunkte (was analysiert sie? wie geht sie an Serien heran?) — orientiere dich an den Expertise-Tags und den Beispielartikeln
4. Absatz 3: Persönlicher Zugang, Lieblingsserien, Schreibstil, was Leser von ihr erwarten können
5. DEUTSCH, Du-Form nicht verwenden
6. Kein Marketing-Sprech ("leidenschaftlich", "unersetzlich", "weltklasse")
7. Konkret und spezifisch — erwähne echte Serien/Shows, Genres, Phänomene
8. Plain-Text HTML mit <p>-Tags (3 Absätze), keine Überschriften
9. KEINE Einleitungsphrase wie "Hier ist die Bio:" — starte direkt mit dem Fließtext

ANTWORT (nur der HTML-Text, keine Meta-Kommentare):`;

  const modelsToTry = [model, 'gpt-4o-mini'];
  let lastError: any;
  for (const m of modelsToTry) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          model: m,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1200,
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
