/**
 * One-off Title Preview Script
 *
 * Generates a headline for a given source URL WITHOUT running the full
 * pipeline (no DB writes, no duplicate check, no quality gates). Just
 * fetches the article text, extracts facts, runs the structured-content
 * generator, and prints the headline + meta + lead.
 *
 * Usage:
 *   npx tsx scripts/preview-title.ts <URL> [seriesName]
 */
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env' });
dotenvConfig({ path: '.env.local', override: false });

import { fetchFullArticleText } from '../lib/full-text-fetcher';
import { extractFacts } from '../lib/fact-extractor';
import { generateStructuredContent } from '../lib/structured-content-generator';
import { isTrueStorySource, assessTrueStoryCertainty } from '../lib/true-story-format';

async function main() {
  const url = process.argv[2];
  const seriesNameOverride = process.argv[3];
  if (!url) {
    console.error('Usage: npx tsx scripts/preview-title.ts <URL> [seriesName]');
    process.exit(1);
  }

  console.log('═'.repeat(70));
  console.log('🔮 TITLE PREVIEW (no DB writes, no dedup)');
  console.log('═'.repeat(70));
  console.log(`URL: ${url}\n`);

  // 1. Fetch
  const fetched = await fetchFullArticleText(url);
  console.log(`📄 Fetched: ${fetched.wordCount} words`);
  console.log(`   Source title: "${fetched.title}"\n`);

  const seriesName = seriesNameOverride || 'Should I Marry A Murderer?';
  console.log(`🎬 Series: ${seriesName}\n`);

  // 2. Detect content type
  const isTrueStory = isTrueStorySource(url, fetched.title);
  const contentType: 'NEWS' | 'TRUE_STORY' = isTrueStory ? 'TRUE_STORY' : 'NEWS';
  const trueStoryCertainty = isTrueStory
    ? assessTrueStoryCertainty(fetched.title, fetched.fullText, ['Documentary', 'Crime'])
    : undefined;
  console.log(`📂 Detected contentType: ${contentType}${trueStoryCertainty ? ` (${trueStoryCertainty})` : ''}\n`);

  // 3. Facts
  const facts = await extractFacts(fetched.title || '', fetched.fullText);
  console.log(`📊 Facts extracted: ${Object.keys(facts || {}).length} keys\n`);

  // 4. Generate
  const out = await generateStructuredContent({
    facts,
    seriesName,
    originalHeadline: fetched.title || '',
    sourceText: fetched.fullText,
    sourceUrl: url,
    contentType,
    trueStoryCertainty,
    wordCountTarget: 600,
  });

  console.log('═'.repeat(70));
  console.log('🎯 GENERATED:');
  console.log('═'.repeat(70));
  console.log(`\nHEADLINE:\n  ${out.headline}\n`);
  console.log(`META DESCRIPTION:\n  ${out.metaDescription}\n`);
  console.log(`LEAD:\n  ${out.lead}\n`);
  console.log(`SECTIONS (${out.sections.length}): ${out.sections.map((s) => s.h2).join(' | ')}`);
  console.log(`Q&A (${out.qa.length}): ${out.qa.map((q) => q.question).slice(0, 3).join(' | ')}`);
  console.log('═'.repeat(70));
}

main().catch((e) => { console.error(e); process.exit(1); });
