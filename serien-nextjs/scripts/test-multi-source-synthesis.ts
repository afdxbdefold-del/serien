/**
 * Multi-Source Synthesis test.
 *
 * Strategy: scan the DB for cases where the same `coreEventNormalized` value
 * appears across TWO articles published within 48h but from DIFFERENT source
 * domains. Pick the first such pair, fetch both source texts, then run the
 * Faithful Translator in multi-source mode and print the result + metrics.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { translateFaithful } from '../lib/faithful-translator';
import { fetchFullArticleText } from '../lib/full-text-fetcher';

const prisma = new PrismaClient();

interface SiblingPair {
  coreEvent: string;
  primary: { slug: string; sourceUrl: string; sourceDomain: string; series: string; publishedAt: Date };
  secondary: { slug: string; sourceUrl: string; sourceDomain: string; publishedAt: Date };
}

async function findSiblingPairs(): Promise<SiblingPair[]> {
  // Pipeline currently dedupes by storyFingerprint, so true sibling pairs
  // are rare. Synthetic strategy: find two articles about the SAME series
  // (primarySeriesId) from DIFFERENT source hosts, published within 14
  // days of each other. Their topics will be related enough to demonstrate
  // multi-source synthesis (additional quotes + cross-validation).
  const groups = await prisma.$queryRaw<any[]>`
    WITH parsed AS (
      SELECT
        slug,
        "sourceUrl",
        "publishedAt",
        "primarySeriesId",
        regexp_replace(
          regexp_replace("sourceUrl", '^https?://(www\\.)?', ''),
          '/.*$', ''
        ) AS host
      FROM articles
      WHERE status = 'published'
        AND "sourceUrl" IS NOT NULL
        AND "primarySeriesId" IS NOT NULL
        AND "publishedAt" > (NOW() - INTERVAL '21 days')
    )
    SELECT
      "primarySeriesId" AS series_id,
      array_agg(slug ORDER BY "publishedAt" DESC) AS slugs,
      array_agg("sourceUrl" ORDER BY "publishedAt" DESC) AS urls,
      array_agg(host ORDER BY "publishedAt" DESC) AS domains,
      array_agg("publishedAt" ORDER BY "publishedAt" DESC) AS times,
      array_agg("primarySeriesId" ORDER BY "publishedAt" DESC) AS series_ids,
      COUNT(DISTINCT host)::int AS distinct_domains
    FROM parsed
    GROUP BY "primarySeriesId"
    HAVING COUNT(DISTINCT host) >= 2
    ORDER BY MAX("publishedAt") DESC
    LIMIT 10
  `;

  if (!groups.length) return [];

  const results: SiblingPair[] = [];
  // Resolve series name for the first viable group.
  for (const g of groups) {
    const primarySeriesId = g.series_ids[0];
    if (!primarySeriesId) continue;
    const series = await prisma.series.findUnique({
      where: { tmdbId: primarySeriesId },
      select: { title: true, name: true },
    });
    if (!series) continue;
    // Pick first two URLs from distinct domains
    const seen = new Set<string>();
    const picks: number[] = [];
    g.domains.forEach((d: string, i: number) => {
      if (!seen.has(d)) { seen.add(d); picks.push(i); }
    });
    if (picks.length < 2) continue;

    results.push({
      coreEvent: `series:${primarySeriesId}`,
      primary: {
        slug: g.slugs[picks[0]],
        sourceUrl: g.urls[picks[0]],
        sourceDomain: g.domains[picks[0]],
        series: series.title || series.name,
        publishedAt: g.times[picks[0]],
      },
      secondary: {
        slug: g.slugs[picks[1]],
        sourceUrl: g.urls[picks[1]],
        sourceDomain: g.domains[picks[1]],
        publishedAt: g.times[picks[1]],
      },
    });
  }
  return results;
}

async function main() {
  const pairs = await findSiblingPairs();
  if (!pairs.length) {
    console.log('❌ No sibling-source pair found in DB.');
    await prisma.$disconnect();
    return;
  }
  console.log(`🔍 ${pairs.length} candidate pairs found, trying each until both sources fetch successfully...`);

  let pair: SiblingPair | null = null;
  let primaryFetch: any = null;
  let secondaryFetch: any = null;
  for (const candidate of pairs) {
    console.log(`\n   trying: ${candidate.primary.sourceDomain} + ${candidate.secondary.sourceDomain}  (${candidate.primary.series})`);
    const [pf, sf] = await Promise.all([
      fetchFullArticleText(candidate.primary.sourceUrl).catch(() => null),
      fetchFullArticleText(candidate.secondary.sourceUrl).catch(() => null),
    ]);
    if (pf?.fullText && pf.fullText.length >= 400 && sf?.fullText && sf.fullText.length >= 400) {
      pair = candidate;
      primaryFetch = pf;
      secondaryFetch = sf;
      break;
    }
    console.log(`   ✗ skip (primary=${pf?.fullText?.length || 0}c, secondary=${sf?.fullText?.length || 0}c)`);
  }

  if (!pair || !primaryFetch || !secondaryFetch) {
    console.log('\n❌ None of the candidate pairs had both sources fetchable.');
    await prisma.$disconnect();
    return;
  }

  console.log('\n🔗 SIBLING SOURCE PAIR (both fetched OK)');
  console.log('   primary  :', pair.primary.sourceDomain, '—', pair.primary.sourceUrl);
  console.log('   secondary:', pair.secondary.sourceDomain, '—', pair.secondary.sourceUrl);
  console.log('   series   :', pair.primary.series);

  console.log(`📥 Primary  : ${primaryFetch.wordCount} words from ${primaryFetch.sourceDomain}`);
  console.log(`📥 Secondary: ${secondaryFetch.wordCount} words from ${secondaryFetch.sourceDomain}`);

  // ---- Single-source baseline ----
  console.log('\n🔸 BASELINE (single source) translation...');
  const baseline = await translateFaithful({
    sourceText: primaryFetch.fullText,
    sourceHeadline: primaryFetch.headline || primaryFetch.title || '',
    sourceUrl: pair.primary.sourceUrl,
    seriesName: pair.primary.series,
  });
  console.log(`   words: ${baseline.wordCount} | quotes: ${baseline.quotesPreserved} | paragraphs: ${baseline.paragraphCount}`);

  // ---- Multi-source synthesis ----
  console.log('\n🔸 MULTI-SOURCE SYNTHESIS...');
  const synth = await translateFaithful({
    sourceText: primaryFetch.fullText,
    sourceHeadline: primaryFetch.headline || primaryFetch.title || '',
    sourceUrl: pair.primary.sourceUrl,
    seriesName: pair.primary.series,
    additionalSources: [
      {
        url: pair.secondary.sourceUrl,
        text: secondaryFetch.fullText,
        headline: secondaryFetch.headline || secondaryFetch.title,
      },
    ],
  });

  console.log(`   words: ${synth.wordCount} | quotes: ${synth.quotesPreserved} | paragraphs: ${synth.paragraphCount}`);
  console.log(`   multiSource: ${JSON.stringify(synth.multiSource, null, 2)}`);

  console.log('\n📈 DELTA (baseline → synthesis):');
  console.log(`   words:  ${baseline.wordCount} → ${synth.wordCount}  (${synth.wordCount - baseline.wordCount > 0 ? '+' : ''}${synth.wordCount - baseline.wordCount})`);
  console.log(`   quotes: ${baseline.quotesPreserved} → ${synth.quotesPreserved}  (${synth.quotesPreserved > baseline.quotesPreserved ? '↑' : '='})`);

  console.log('\n📝 HEADLINE:', synth.headline);
  console.log('\n📝 LEAD:');
  console.log('   ', synth.leadParagraph);
  console.log('\n📝 LAST 600 CHARS OF HTML (incl. multi-source footer):');
  console.log(synth.contentHtml.slice(-600));

  if (synth.multiSource && synth.multiSource.contradictionsFlagged > 0) {
    console.log('\n⚠️  Contradictions flagged — check LLM output for accuracy.');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
