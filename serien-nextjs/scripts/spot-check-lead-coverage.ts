/* eslint-disable */
/**
 * Spot-check 12 backfilled articles. For each, compare the excerpt
 * (which carries the lead) against the first body section. We flag the
 * named entities, numbers, years and dates that appear in the excerpt
 * but NOT in the first <h2>+<p>+<p> block — those would be the
 * "lost facts" if the LLM had assumed the lead suffices.
 */
import prisma from '../lib/prisma';

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Extract "fact tokens": Capitalized multi-letter words, years, plain numbers,
// month names. Lowercase fillers are ignored.
const STOP = new Set([
  'Die','Der','Das','Den','Dem','Des','Ein','Eine','Einer','Eines','Einem','Und','Oder','Aber','Doch','Dass',
  'Mit','Von','Zur','Zum','Aus','Bei','Vor','Nach','Auf','An','In','Im','Am','Über','Unter','Hinter','Vorbei',
  'Wer','Was','Wie','Warum','Wann','Wo','Wohin','Woher','Wieso','Welche','Welcher','Welches',
  'Ist','Sind','Hat','Hatte','Hatten','War','Waren','Wird','Werden','Wurde','Wurden','Sollte','Soll','Konnte','Können',
  'Sie','Er','Es','Ich','Du','Wir','Ihr','Sich','Selbst','Auch','Schon','Noch','Nur','Sehr','Gerade','Nicht',
  'Mehr','Weniger','Wieder','Immer','Jetzt','Heute','Damals','Bereits','Trotz','Während','Bisher','Allerdings',
  'Trailer','Serie','Staffel','Folge','Episode','Show','TV','Streaming','Drama','Comedy','Saison',
]);

function tokenize(text: string): Set<string> {
  const toks = new Set<string>();
  // Years 1900-2099
  for (const y of text.match(/\b(19\d{2}|20\d{2})\b/g) || []) toks.add(y);
  // Pure numbers ≥ 2 digits (e.g. "47 Millionen", "300")
  for (const n of text.match(/\b\d{2,}(?:[,.]\d+)?\b/g) || []) toks.add(n);
  // Capitalized German/English tokens — entities
  for (const w of text.match(/\b[A-ZÄÖÜ][a-zäöüß'-]{2,}\b/g) || []) {
    if (!STOP.has(w)) toks.add(w);
  }
  return toks;
}

async function main() {
  const arts = await prisma.articles.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: 200,
    select: { slug: true, excerpt: true, contentHtml: true },
  });

  // Filter to those that look backfilled: contentHtml starts directly with <h2>
  const backfilled = arts.filter((a) => (a.contentHtml || '').trim().startsWith('<h2'));
  const sample = backfilled.slice(0, 12);
  console.log(`Backfilled (start with <h2>): ${backfilled.length} of last 200 published.`);
  console.log(`Checking ${sample.length}…\n`);

  let totalMissing = 0;
  for (const a of sample) {
    const exc = a.excerpt || '';
    // First section: H2 + up to first two <p>'s
    const m = a.contentHtml?.match(/^<h2[^>]*>([\s\S]*?)<\/h2>\s*((?:<p[^>]*>[\s\S]*?<\/p>\s*){1,2})/);
    const sec1H2 = m ? stripHtml(m[1]) : '';
    const sec1Paras = m ? stripHtml(m[2]) : '';
    const sec1 = sec1H2 + ' ' + sec1Paras;

    const excTokens = tokenize(exc);
    const sec1Tokens = tokenize(sec1);
    const missing = [...excTokens].filter((t) => !sec1Tokens.has(t));

    console.log(`/${a.slug}`);
    console.log(`  H2#1: ${sec1H2.slice(0, 80)}`);
    console.log(`  excerpt tokens: ${excTokens.size}, section-1 tokens: ${sec1Tokens.size}`);
    console.log(`  ❗ Missing from section-1: ${missing.length === 0 ? '<none>' : missing.join(', ')}`);
    if (missing.length >= 3) totalMissing++;
    console.log();
  }
  console.log(`\n=== Result ===`);
  console.log(`Articles where ≥3 unique fact-tokens from excerpt are missing from section 1: ${totalMissing} / ${sample.length}`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
