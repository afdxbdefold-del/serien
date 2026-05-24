/**
 * Repairs articles that ended up with empty contentHtml due to the
 * faithful-translator structuredContent.markdown bug deployed earlier.
 *
 * Strategy per article (only those with status=published AND contentHtml='' AND sourceUrl):
 *   1) refetch source
 *   2) run faithful translator
 *   3) markdown-ify the resulting HTML
 *   4) run markdownToHtml() — mirrors pipeline-v2 Step 7
 *   5) write contentHtml back to DB (and append Reporter's Notebook for consistency)
 *
 * Idempotent. Safe to re-run.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { translateFaithful } from '../lib/faithful-translator';
import { fetchFullArticleText } from '../lib/full-text-fetcher';
import { markdownToHtml } from '../lib/markdown-to-html';

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

async function repairOne(art: { id: string; slug: string; sourceUrl: string | null; primarySeriesId: number | null; series: { title: string | null; name: string | null } | null }) {
  if (!art.sourceUrl) return { status: 'skip', reason: 'no source url' };
  try {
    const fetched = await fetchFullArticleText(art.sourceUrl);
    if (!fetched?.fullText || fetched.fullText.length < 400) {
      return { status: 'skip', reason: 'source fetch failed' };
    }

    const t = await translateFaithful({
      sourceText: fetched.fullText,
      sourceHeadline: fetched.headline || fetched.title || '',
      sourceUrl: art.sourceUrl,
      seriesName: art.series?.title || art.series?.name || 'Series',
    });

    if (t.wordCount < 200) {
      return { status: 'skip', reason: `too short: ${t.wordCount}w` };
    }

    const md = htmlToMarkdown(t.contentHtml);
    const html = markdownToHtml(md || '');

    if (!html || html.length < 200) {
      return { status: 'skip', reason: 'final html too short' };
    }

    await prisma.articles.update({
      where: { id: art.id },
      data: { contentHtml: html },
    });
    return { status: 'ok', words: t.wordCount, htmlLen: html.length };
  } catch (e: any) {
    return { status: 'err', reason: e.message };
  }
}

async function main() {
  const broken = await prisma.articles.findMany({
    where: { status: 'published', sourceUrl: { not: null }, contentHtml: '' },
    select: {
      id: true,
      slug: true,
      sourceUrl: true,
      primarySeriesId: true,
      series: { select: { title: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${broken.length} empty-content articles\n`);
  const stats = { ok: 0, skip: 0, err: 0 };
  for (const art of broken) {
    const r = await repairOne(art);
    const tag =
      r.status === 'ok' ? `✅ ${r.words}w, ${r.htmlLen}c` :
      r.status === 'skip' ? `⏭️  ${r.reason}` :
      `❌ ${r.reason}`;
    const s = r.status as keyof typeof stats;
    stats[s]++;
    console.log(`${art.slug.substring(0, 70).padEnd(70)} ${tag}`);
  }
  console.log(`\n🏁 OK ${stats.ok}, skipped ${stats.skip}, errors ${stats.err}`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
