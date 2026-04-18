/**
 * Repair script: Add missing internal links to articles.
 *
 * For each published article without any internal link (href="/..."):
 *   1. If it has a primary series → inject inline hub link on first mention of series name
 *   2. Additionally, inject a cross-link to 1 related article from the same series (inline, context-based)
 *
 * Safety:
 *   - Only touches <p> tags, never headings/lists
 *   - Only first occurrence per strategy (no keyword stuffing)
 *   - Skips if article has no primarySeriesId (no safe anchor)
 *
 * Run:
 *   npx tsx scripts/repair-missing-internal-links.ts          # dry-run
 *   npx tsx scripts/repair-missing-internal-links.ts --apply  # persists changes
 */

import prisma from '../lib/prisma';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');

type RelArticle = { id: string; slug: string; title: string };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasInternalLink(html: string): boolean {
  return /href="\/[^"]*"/.test(html);
}

function injectHubLink(html: string, seriesName: string, hubLink: string): { html: string; injected: boolean } {
  const escaped = escapeRegex(seriesName);
  // Match inside <p> only; avoid already-linked text
  let injected = false;
  const updated = html.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/g, (m, open, inner, close) => {
    if (injected) return m;
    // Skip if this <p> already contains an <a href="/
    if (/<a\s+[^>]*href="\/[^"]*"/i.test(inner)) return m;
    const rx = new RegExp(`(?<!<a[^>]*>)(?<!")(${escaped})(?![^<]*<\\/a>)(?!">)`, 'i');
    if (rx.test(inner)) {
      injected = true;
      return open + inner.replace(rx, `<a href="${hubLink}">$1</a>`) + close;
    }
    return m;
  });
  return { html: updated, injected };
}

function injectRelatedCrossLink(html: string, related: RelArticle, ownSeriesName: string): { html: string; injected: boolean } {
  // Strategy: ONLY match on the current article's series name (high-quality semantic link)
  // We skip paragraphs that already have an internal link to avoid doubling up.
  const escaped = escapeRegex(ownSeriesName);
  let injected = false;
  let seen = 0;
  const updated = html.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/g, (m, open, inner, close) => {
    if (injected) return m;
    // Skip <p> with any internal link (e.g., the hub link we just added)
    if (/<a\s+[^>]*href="\/[^"]*"/i.test(inner)) return m;
    const rx = new RegExp(`(?<!<a[^>]*>)(?<!")(${escaped})(?![^<]*<\\/a>)`, 'i');
    if (rx.test(inner)) {
      seen++;
      // Only replace on the SECOND paragraph that mentions the series name,
      // so hub link (first mention) and related link (second mention) are distinct.
      if (seen < 1) return m;
      injected = true;
      return open + inner.replace(rx, `<a href="/${related.slug}">$1</a>`) + close;
    }
    return m;
  });
  return { html: updated, injected };
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (will write to DB)' : 'DRY-RUN (no changes)'}`);

  const articles = await prisma.articles.findMany({
    where: { OR: [{ status: 'published' }, { status: 'PUBLISHED' }] },
    select: {
      id: true,
      slug: true,
      title: true,
      contentHtml: true,
      primarySeriesId: true,
      publishedAt: true,
      series: { select: { tmdbId: true, slug: true, name: true, title: true } },
    },
  });

  const targets = articles.filter(a => !hasInternalLink(a.contentHtml || ''));
  console.log(`\nArticles without internal links: ${targets.length}/${articles.length}`);

  const preview: any[] = [];
  let skippedNoSeries = 0;
  let skippedNoMatch = 0;
  let addedHub = 0;
  let addedRelated = 0;

  for (const a of targets) {
    const seriesSlug = a.series?.slug;
    const seriesName = a.series?.name || a.series?.title;

    if (!seriesSlug || !seriesName || !a.primarySeriesId) {
      skippedNoSeries++;
      continue;
    }

    let html = a.contentHtml || '';
    const hubLink = `/serie/${seriesSlug}`;

    const hubResult = injectHubLink(html, seriesName, hubLink);
    let hubInjected = hubResult.injected;
    html = hubResult.html;

    // Find 1 related article for cross-link
    let relatedInjected = false;
    const related = await prisma.articles.findFirst({
      where: {
        primarySeriesId: a.primarySeriesId,
        id: { not: a.id },
        OR: [{ status: 'published' }, { status: 'PUBLISHED' }],
        publishedAt: { not: null },
      },
      orderBy: { publishedAt: 'desc' },
      select: { id: true, slug: true, title: true },
    });

    if (related) {
      const relResult = injectRelatedCrossLink(html, related, seriesName);
      relatedInjected = relResult.injected;
      html = relResult.html;
    }

    if (!hubInjected && !relatedInjected) {
      skippedNoMatch++;
      continue;
    }

    if (hubInjected) addedHub++;
    if (relatedInjected) addedRelated++;

    preview.push({
      slug: a.slug,
      seriesName,
      hubInjected,
      relatedInjected,
      relatedSlug: related?.slug || null,
    });

    if (APPLY) {
      await prisma.articles.update({
        where: { id: a.id },
        data: { contentHtml: html },
      });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Eligible targets:          ${targets.length}`);
  console.log(`Skipped (no series):       ${skippedNoSeries}`);
  console.log(`Skipped (no keyword match): ${skippedNoMatch}`);
  console.log(`Would inject / Injected:   ${preview.length}`);
  console.log(`  - Hub link (series):     ${addedHub}`);
  console.log(`  - Related cross-link:    ${addedRelated}`);

  console.log(`\nFirst 15 previews:`);
  preview.slice(0, 15).forEach((p, i) => {
    const marks = [
      p.hubInjected ? `hub→${p.seriesName}` : '',
      p.relatedInjected ? `related→${p.relatedSlug}` : '',
    ].filter(Boolean).join(' + ');
    console.log(`  ${i + 1}. ${p.slug}  [${marks}]`);
  });

  fs.writeFileSync('/tmp/links-repair-preview.json', JSON.stringify(preview, null, 2));
  console.log(`\nFull preview: /tmp/links-repair-preview.json`);

  if (!APPLY) {
    console.log(`\n➡️  To apply: npx tsx scripts/repair-missing-internal-links.ts --apply`);
  }

  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
