/**
 * A/B Test: Faithful Translator vs current article body.
 *
 * Pulls 5 recent articles that have a `sourceUrl`, refetches the source,
 * runs the faithful translator, then prints a side-by-side metric diff
 * (word count, sentence stdev, AI-phrase hits, quote count) — and the first
 * 600 chars of each so you can eyeball quality.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { translateFaithful } from '../lib/faithful-translator';
import { fetchFullArticleText } from '../lib/full-text-fetcher';

const AI_PHRASES = [
  'genau diese', 'genau dieser', 'genau dieses', 'genau das',
  'unmissverständlich', 'schlicht ', 'letztlich', 'wirklich ',
  'trotz dieses vermeintlichen', 'im schnitt verschwand',
];

function metrics(html: string) {
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = txt.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  const lens = sentences.map((s) => s.trim().split(/\s+/).length);
  const mean = lens.reduce((a, b) => a + b, 0) / Math.max(lens.length, 1);
  const stdev = Math.sqrt(
    lens.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(lens.length, 1)
  );
  const aiHits: Record<string, number> = {};
  AI_PHRASES.forEach((p) => {
    const m = txt.toLowerCase().match(new RegExp(p, 'g'));
    if (m && m.length) aiHits[p.trim()] = m.length;
  });
  const totalAi = Object.values(aiHits).reduce((a, b) => a + b, 0);
  const shortPct = (lens.filter((l) => l <= 6).length / Math.max(lens.length, 1)) * 100;
  const quotes = (txt.match(/[„"]/g) || []).length;
  const h2 = (html.match(/<h2/gi) || []).length;
  return {
    words: txt.split(/\s+/).filter(Boolean).length,
    sentences: sentences.length,
    avgLen: +mean.toFixed(1),
    stdev: +stdev.toFixed(1),
    shortPct: +shortPct.toFixed(1),
    aiHits,
    totalAi,
    quotes,
    h2,
  };
}

async function main() {
  const prisma = new PrismaClient();
  const arts = await prisma.articles.findMany({
    where: {
      status: 'published',
      sourceUrl: { not: null },
      contentHtml: { not: '' },
      primarySeriesId: { not: null },
    },
    select: {
      slug: true,
      title: true,
      contentHtml: true,
      sourceUrl: true,
      series: { select: { name: true, title: true } },
    },
    orderBy: { publishedAt: 'desc' },
    take: 5,
  });

  console.log(`\nA/B Comparing ${arts.length} articles\n`);

  for (const a of arts) {
    console.log('\n' + '═'.repeat(80));
    console.log(`▶ ${a.slug}`);
    console.log(`  source: ${a.sourceUrl}`);
    console.log('═'.repeat(80));

    const current = metrics(a.contentHtml);
    console.log('\n📊 CURRENT (rebuilt-from-facts pipeline):');
    console.log(`   ${current.words} words, ${current.sentences} sentences, avgLen ${current.avgLen}, stdev ${current.stdev}, short ${current.shortPct}%, quotes ${current.quotes}, h2 ${current.h2}`);
    if (current.totalAi > 0) console.log('   AI-phrases:', current.aiHits);

    try {
      const fetched = await fetchFullArticleText(a.sourceUrl!);
      if (!fetched || !fetched.fullText || fetched.fullText.length < 400) {
        console.log('\n⚠️  Source fetch failed or too short — skipping translation');
        continue;
      }
      console.log(`\n📥 Source fetched: ${fetched.wordCount} words from ${fetched.sourceDomain}`);

      const translated = await translateFaithful({
        sourceText: fetched.fullText,
        sourceHeadline: fetched.headline || fetched.title || a.title,
        sourceUrl: a.sourceUrl!,
        seriesName: a.series?.title || a.series?.name || 'Series',
      });

      const faithful = metrics(translated.contentHtml);
      console.log('\n✨ FAITHFUL TRANSLATION:');
      console.log(`   ${faithful.words} words, ${faithful.sentences} sentences, avgLen ${faithful.avgLen}, stdev ${faithful.stdev}, short ${faithful.shortPct}%, quotes ${faithful.quotes}, h2 ${faithful.h2}`);
      if (faithful.totalAi > 0) console.log('   AI-phrases:', faithful.aiHits);
      console.log(`\n   Headline: ${translated.headline}`);
      console.log(`   Lead:     ${translated.leadParagraph.substring(0, 250)}...`);
      console.log(`\n   Notes:    ${translated.notes.join(', ') || 'none'}`);

      // Delta summary
      console.log('\n📈 DELTA:');
      console.log(`   stdev:   ${current.stdev} → ${faithful.stdev}  ${faithful.stdev > current.stdev ? '↑ (better)' : faithful.stdev < current.stdev ? '↓' : '='}`);
      console.log(`   short%:  ${current.shortPct} → ${faithful.shortPct}  ${faithful.shortPct > current.shortPct ? '↑ (better)' : '='}`);
      console.log(`   h2:      ${current.h2} → ${faithful.h2}  ${faithful.h2 < current.h2 ? '↓ (less listicle)' : '='}`);
      console.log(`   quotes:  ${current.quotes} → ${faithful.quotes}  ${faithful.quotes > current.quotes ? '↑ (more O-Ton)' : '='}`);
      console.log(`   AI-floskeln: ${current.totalAi} → ${faithful.totalAi}  ${faithful.totalAi < current.totalAi ? '↓ (better)' : '='}`);
    } catch (e: any) {
      console.log(`\n❌ Translation failed: ${e.message}`);
    }
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
