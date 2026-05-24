/**
 * Proper repair: re-translates the article AND runs the same post-processing
 * the live pipeline applies (cast linking, character linking, streamer
 * linking, markdown→HTML, Reporter's Notebook).
 *
 * Difference vs `repair-empty-articles.ts` (the broken first version): that
 * one bypassed the enrichment chain so articles ended up without internal
 * links, h2 sub-headings, bold emphasis, etc.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { translateFaithful } from '../lib/faithful-translator';
import { fetchFullArticleText } from '../lib/full-text-fetcher';
import { markdownToHtml } from '../lib/markdown-to-html';
import { linkCharactersInMarkdown, linkStreamersInMarkdown } from '../lib/character-linking-markdown';
import { linkCastInMarkdown } from '../lib/cast-linking-markdown';

const prisma = new PrismaClient();

function htmlToMarkdown(html: string): string {
  const sections: Array<{ heading: string; paragraphs: string[] }> = [];
  let currentHeading = '';
  let currentParas: string[] = [];
  const blocks = html.match(/<(p|h2)\b[^>]*>[\s\S]*?<\/\1>/gi) || [];
  for (const block of blocks) {
    if (/^<h2\b/i.test(block)) {
      if (currentParas.length > 0 || currentHeading) {
        sections.push({ heading: currentHeading, paragraphs: currentParas });
      }
      currentHeading = block.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i, '$1').trim();
      currentParas = [];
    } else {
      const t = block.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/i, '$1').trim();
      if (t) currentParas.push(t);
    }
  }
  if (currentParas.length > 0 || currentHeading) {
    sections.push({ heading: currentHeading, paragraphs: currentParas });
  }
  const lines: string[] = [];
  for (const sec of sections) {
    if (sec.heading) lines.push(`\n## ${sec.heading}\n`);
    for (const para of sec.paragraphs) {
      const md = para.replace(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '[$2]($1)');
      lines.push(`${md}\n`);
    }
  }
  return lines.join('\n').trim();
}

async function repair(slug: string) {
  const art = await prisma.articles.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      sourceUrl: true,
      primarySeriesId: true,
      title: true,
      series: { select: { title: true, name: true } },
    },
  });
  if (!art) {
    console.log(`❌ Article not found: ${slug}`);
    return;
  }
  if (!art.sourceUrl) {
    console.log(`❌ No sourceUrl for: ${slug}`);
    return;
  }
  if (!art.primarySeriesId) {
    console.log(`❌ No primarySeriesId for: ${slug}`);
    return;
  }

  console.log(`📥 Fetching ${art.sourceUrl}...`);
  const fetched = await fetchFullArticleText(art.sourceUrl);
  if (!fetched?.fullText || fetched.fullText.length < 400) {
    console.log(`❌ Source fetch failed`);
    return;
  }
  console.log(`   ✅ ${fetched.wordCount}w from ${fetched.sourceDomain}`);

  console.log(`🌐 Faithful translating...`);
  const t = await translateFaithful({
    sourceText: fetched.fullText,
    sourceHeadline: fetched.headline || fetched.title || '',
    sourceUrl: art.sourceUrl,
    seriesName: art.series?.title || art.series?.name || 'Series',
  });
  console.log(`   ✅ ${t.wordCount}w, ${t.paragraphCount}p, ${t.quotesPreserved}q`);

  let markdown = htmlToMarkdown(t.contentHtml);
  console.log(`📝 Markdown: ${markdown.length}c, ${(markdown.match(/^## /gm) || []).length} h2`);

  // ---- Enrichment Chain (mirrors pipeline-v2.ts steps 7.5 → 10) ----
  console.log(`🎭 Linking cast members…`);
  const castResult = await linkCastInMarkdown(markdown, art.primarySeriesId);
  markdown = castResult.linkedMarkdown;
  console.log(`   ✅ ${castResult.castLinked} cast links added`);

  console.log(`🎬 Linking characters…`);
  const charResult = await linkCharactersInMarkdown(markdown, art.primarySeriesId);
  markdown = charResult.linkedMarkdown;
  console.log(`   ✅ ${charResult.charactersLinked} character links added`);

  console.log(`📺 Linking streamers…`);
  const streamerResult = linkStreamersInMarkdown(markdown);
  markdown = streamerResult.linkedMarkdown;
  console.log(`   ✅ ${streamerResult.streamersLinked} streamer links added`);

  console.log(`🎨 Converting markdown to HTML…`);
  const html = markdownToHtml(markdown);
  console.log(`   ✅ HTML ${html.length}c, ${(html.match(/<h2/gi) || []).length} h2, ${(html.match(/<a\s+href/gi) || []).length} links`);

  console.log(`💾 Saving to DB…`);
  await prisma.articles.update({
    where: { id: art.id },
    data: { contentHtml: html },
  });
  console.log(`\n✅ DONE. Total contentHtml: ${html.length}c`);
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.log('Usage: npx tsx scripts/repair-with-enrichment.ts <slug>');
    process.exit(1);
  }
  await repair(slug);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
