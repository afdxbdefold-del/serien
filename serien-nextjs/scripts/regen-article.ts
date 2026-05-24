/* eslint-disable */
/**
 * Re-generate a single article using the HARDENED Rebuild generator
 * (post-Faithful-disable, with sourceContextBlock + antiAiBlock).
 *
 * Mirrors the live pipeline post-generation chain:
 *   sourceText → factExtractor → DACH context → generateStructuredContent
 *   → cast/character/streamer linking → markdown→HTML → sanitize → DB
 *
 * Usage: npx tsx scripts/regen-article.ts <slug>
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchFullArticleText } from '../lib/full-text-fetcher';
import { extractFacts } from '../lib/fact-extractor';
import { generateStructuredContent } from '../lib/structured-content-generator';
import { mapNetworksToDach } from '../lib/dach-network-mapping';
import { markdownToHtml } from '../lib/markdown-to-html';
import { sanitizeArticleContent } from '../lib/content-sanitizer';
import { linkCharactersInMarkdown, linkStreamersInMarkdown } from '../lib/character-linking-markdown';
import { linkCastInMarkdown } from '../lib/cast-linking-markdown';

const prisma = new PrismaClient();

function sectionsToMarkdown(sections: Array<{ h2?: string; heading?: string; paragraphs: string[] }>): string {
  const lines: string[] = [];
  for (const sec of sections) {
    const h = sec.h2 || sec.heading || '';
    if (h) lines.push(`\n## ${h}\n`);
    for (const p of sec.paragraphs || []) lines.push(`${p}\n`);
  }
  return lines.join('\n').trim();
}

async function fetchTmdbWatchProvidersDe(tmdbId: number): Promise<string[]> {
  try {
    const key = process.env.TMDB_API_KEY;
    if (!key) return [];
    const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/watch/providers?api_key=${key}`);
    const data: any = await res.json();
    const de = data?.results?.DE;
    const flatrate = de?.flatrate || [];
    return flatrate.map((p: any) => p.provider_name).filter(Boolean);
  } catch {
    return [];
  }
}

async function regen(slug: string) {
  const art = await prisma.articles.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, sourceUrl: true, title: true,
      primarySeriesId: true,
      series: { select: { title: true, name: true, networks: true, tmdbId: true } },
    },
  });
  if (!art) { console.log('NOT FOUND'); return; }
  if (!art.sourceUrl) { console.log('No sourceUrl'); return; }
  if (!art.primarySeriesId) { console.log('No primarySeriesId'); return; }

  const seriesName = art.series?.name || art.series?.title || 'Series';
  console.log(`\n📥 Fetching ${art.sourceUrl}…`);
  const fetched = await fetchFullArticleText(art.sourceUrl);
  if (!fetched?.fullText || fetched.fullText.length < 400) {
    console.log('❌ Source fetch failed');
    return;
  }
  console.log(`   ✅ ${fetched.wordCount}w from ${fetched.sourceDomain}`);

  console.log(`📊 Extracting facts…`);
  const facts = await extractFacts(fetched.headline || fetched.title || '', fetched.fullText);
  console.log(`   ✅ ${facts.key_statements?.length || 0} statements`);

  console.log(`🇩🇪 DACH context…`);
  const dachStreamers = await fetchTmdbWatchProvidersDe(art.series?.tmdbId || art.primarySeriesId);
  const fallback = mapNetworksToDach(art.series?.networks);
  const dachContext = {
    dachStreamers,
    dachExpectation: dachStreamers.length === 0 ? fallback?.expectation || null : null,
    originalNetworks: art.series?.networks || [],
  };
  console.log(`   DE streamers: ${dachStreamers.join(', ') || '<none>'}`);

  console.log(`✍️  Generating with HARDENED Rebuild prompt…`);
  const sourceWordCount = fetched.wordCount;
  const out: any = await generateStructuredContent({
    facts,
    seriesName,
    originalHeadline: fetched.headline || fetched.title || art.title,
    sourceText: fetched.fullText,
    sourceUrl: art.sourceUrl,
    contentType: 'NEWS' as any,
    dachContext,
    wordCountTarget: Math.max(1500, Math.min(sourceWordCount * 1.5, 2000)),
  });
  console.log(`   ✅ Headline: "${out.headline}"`);
  console.log(`   ✅ ${out.sections?.length || 0} sections, ${out.qa?.length || 0} qa`);

  // Build markdown body from sections (lead stays separately as excerpt)
  let markdown = sectionsToMarkdown(out.sections || []);

  console.log(`🎭 Linking cast/characters/streamers…`);
  const castR = await linkCastInMarkdown(markdown, art.primarySeriesId);
  markdown = castR.linkedMarkdown;
  const charR = await linkCharactersInMarkdown(markdown, art.primarySeriesId);
  markdown = charR.linkedMarkdown;
  const strR = linkStreamersInMarkdown(markdown);
  markdown = strR.linkedMarkdown;
  console.log(`   ✅ cast=${castR.castLinked}, chars=${charR.charactersLinked}, streamers=${strR.streamersLinked}`);

  const rawHtml = markdownToHtml(markdown);
  const html = sanitizeArticleContent(rawHtml, out.lead);
  console.log(`🎨 HTML: ${html.length}c, h2=${(html.match(/<h2/gi) || []).length}, links=${(html.match(/<a\s+href/gi) || []).length}`);

  // Excerpt = lead, short and clean
  const lead = (out.lead || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/\s+/g, ' ').trim();
  const sentences = lead.split(/(?<=[.!?])\s+/);
  let excerpt = sentences[0] || lead;
  if (excerpt.length < 100 && sentences[1]) excerpt = (excerpt + ' ' + sentences[1]).trim();
  if (excerpt.length > 280) excerpt = excerpt.slice(0, 277).replace(/\s+\S*$/, '') + '…';

  const dryRun = process.argv.includes('--dry');
  console.log(`\n=== NEW EXCERPT (${excerpt.length}c) ===`);
  console.log(excerpt);
  console.log(`\n=== NEW HEADLINE ===`);
  console.log(out.headline);
  console.log(`\n=== NEW HTML (first 2500c) ===`);
  console.log(html.slice(0, 2500));

  if (!dryRun) {
    await prisma.articles.update({
      where: { id: art.id },
      data: {
        contentHtml: html,
        excerpt,
        title: out.headline || art.title,
        metaDescription: out.metaDescription || undefined,
      },
    });
    console.log(`\n✅ DB updated for /${slug}`);
  } else {
    console.log(`\n(dry-run, DB unchanged)`);
  }
}

async function main() {
  const slug = process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) || '';
  if (!slug) { console.log('Usage: npx tsx scripts/regen-article.ts <slug> [--dry]'); process.exit(1); }
  await regen(slug);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
