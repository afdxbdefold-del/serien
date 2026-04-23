/**
 * BATCH HEADLINE REWRITE — score-reveal cleanup
 *
 * Finds all published articles whose current headline trips any hard-killer
 * pattern (Rotten Tomatoes, Metacritic, IMDb, numeric % / N,N/10 / score: N,
 * "triumphiert mit", etc.), generates 5 rewrite candidates per article via
 * the existing Discover rewrite loop, picks the best-scoring one, and writes
 * the full before/after review to a Markdown report for human approval.
 *
 * Two-phase flow:
 *   phase 1 (default):  DRY-RUN. Generates report only. No DB writes.
 *   phase 2 (--apply):  Reads the report back and applies approved rewrites.
 *
 * Usage:
 *   npx tsx scripts/batch-rewrite-scorereveal.ts
 *   npx tsx scripts/batch-rewrite-scorereveal.ts --apply
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { detectHardKillers } from '../lib/headline-scorer-v5';
import { rewriteHeadlineIfWeak } from '../lib/headline-rewrite-loop';
import { discoverGate } from '../lib/discover-gate';

const prisma = new PrismaClient();

interface ReportEntry {
  slug: string;
  currentTitle: string;
  proposedTitle: string;
  before: { score: number; penalties: number; reasons: string[] };
  after: { score: number };
  candidates: Array<{ text: string; performance: number }>;
  skipped?: string;
}

function isScoreRevealHeadline(title: string): boolean {
  const hits = detectHardKillers(title);
  return hits.some(
    (h) =>
      h.phrase.startsWith('score_reveal') ||
      ['rotten tomatoes', 'metacritic', 'imdb-score', 'imdb-wertung', 'kritiker-score', 'triumphiert mit'].includes(
        h.phrase,
      ),
  );
}

async function runDryRun() {
  console.log('→ Scanning published articles for score-reveal headlines...');
  const all = await prisma.articles.findMany({
    where: { status: 'published' },
    select: {
      slug: true,
      title: true,
      contentHtml: true,
      excerpt: true,
      wasBedeutetDasText: true,
      darumRelevantText: true,
      series: { select: { name: true, title: true } },
    },
    orderBy: { publishedAt: 'desc' },
  });

  const targets = all.filter((a) => isScoreRevealHeadline(a.title));
  console.log(`  Found ${targets.length} articles.\n`);

  const report: ReportEntry[] = [];

  let i = 0;
  for (const a of targets) {
    i++;
    const seriesName = a.series?.name || a.series?.title || '';
    const contentText =
      [a.excerpt, a.darumRelevantText, a.wasBedeutetDasText, a.contentHtml?.slice(0, 1500)]
        .filter(Boolean)
        .join('\n') || a.title;

    console.log(`[${i}/${targets.length}] ${a.title}`);

    // Score the existing headline via the Discover Gate so the rewrite loop
    // gets the actual "before" score + reasons to feed back to the LLM.
    let gateBefore;
    try {
      gateBefore = await discoverGate({
        final_headline: a.title,
        article_html: `<p>${contentText.slice(0, 800)}</p>`,
        hero_image_metadata: { url: '', width: 1920, height: 1080, source: 'TMDB_BACKDROP' as const },
        publishedAt: new Date(),
        primary_series: seriesName,
      });
    } catch (err: any) {
      console.log(`   ✗ gate failed: ${err?.message}`);
      report.push({
        slug: a.slug,
        currentTitle: a.title,
        proposedTitle: a.title,
        before: { score: 0, penalties: 0, reasons: [] },
        after: { score: 0 },
        candidates: [],
        skipped: `gate error: ${err?.message}`,
      });
      continue;
    }

    const perf = gateBefore.dashboard.headline_performance;

    // Invoke rewrite loop (generates 5 candidates, picks best-scoring).
    const rewrite = await rewriteHeadlineIfWeak({
      originalHeadline: a.title,
      seriesName,
      articleContent: contentText,
      beforeScore: perf.score,
      beforeReasons: perf.reasons,
    });

    if (!rewrite.attempted) {
      console.log(`   ∘ skipped (score already ≥ threshold)`);
      report.push({
        slug: a.slug,
        currentTitle: a.title,
        proposedTitle: a.title,
        before: { score: perf.score, penalties: 0, reasons: perf.reasons },
        after: { score: perf.score },
        candidates: [],
        skipped: 'already at/above threshold',
      });
      continue;
    }

    console.log(
      `   ${rewrite.applied ? '✓' : '✗'}  ${perf.score} → ${rewrite.afterPerformance}  (+${rewrite.gain})  "${rewrite.finalHeadline}"`,
    );

    report.push({
      slug: a.slug,
      currentTitle: a.title,
      proposedTitle: rewrite.finalHeadline,
      before: { score: perf.score, penalties: 0, reasons: perf.reasons },
      after: { score: rewrite.afterPerformance },
      candidates: rewrite.candidates,
    });
  }

  // Write Markdown report
  const outDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `score-reveal-rewrites-${new Date().toISOString().slice(0, 10)}.md`);
  const md = buildMarkdown(report);
  fs.writeFileSync(outFile, md);

  // Write JSON report for --apply step
  const jsonFile = path.join(outDir, `score-reveal-rewrites-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2));

  console.log(`\n✓ Report written to: ${outFile}`);
  console.log(`✓ JSON (for --apply): ${jsonFile}`);
  console.log(`\n${report.filter((r) => r.proposedTitle !== r.currentTitle).length}/${report.length} rewrites ready for approval.`);
}

function buildMarkdown(report: ReportEntry[]): string {
  const total = report.length;
  const changed = report.filter((r) => r.proposedTitle !== r.currentTitle).length;
  const skipped = report.filter((r) => r.skipped).length;

  const lines: string[] = [
    `# Score-Reveal Headlines — Rewrite Review`,
    ``,
    `**Generated:** ${new Date().toISOString()}`,
    `**Total matched:** ${total}`,
    `**Ready for rewrite:** ${changed}`,
    `**Skipped:** ${skipped}`,
    ``,
    `## Instructions`,
    ``,
    `Review each block below. To **approve** the proposed rewrite, leave the block unchanged.`,
    `To **reject** (keep original), add \`REJECT\` at the start of the line right above the slug.`,
    `To **use a different candidate**, replace the "proposed:" line with the candidate you want.`,
    ``,
    `Then run: \`npx tsx scripts/batch-rewrite-scorereveal.ts --apply\``,
    ``,
    `---`,
    ``,
  ];

  for (const e of report) {
    lines.push(`## ${e.slug}`);
    if (e.skipped) {
      lines.push(`> Skipped: ${e.skipped}`);
      lines.push(``);
      continue;
    }
    lines.push(``);
    lines.push(`**current:**   ${e.currentTitle}   (Performance ${e.before.score}/30)`);
    lines.push(`**proposed:**  ${e.proposedTitle}   (Performance ${e.after.score}/30)`);
    lines.push(``);
    if (e.candidates.length > 1) {
      lines.push(`<details><summary>Other candidates</summary>`);
      lines.push(``);
      for (const c of e.candidates.slice(1)) {
        lines.push(`- [${c.performance}/30] ${c.text}`);
      }
      lines.push(``);
      lines.push(`</details>`);
      lines.push(``);
    }
    lines.push(`---`);
    lines.push(``);
  }

  return lines.join('\n');
}

async function runApply() {
  const reports = fs
    .readdirSync(path.join(process.cwd(), 'reports'))
    .filter((n) => n.startsWith('score-reveal-rewrites-') && n.endsWith('.json'))
    .sort()
    .reverse();
  if (reports.length === 0) {
    console.log('No report JSON found. Run without --apply first.');
    return;
  }
  const latest = reports[0];
  const mdFile = latest.replace('.json', '.md');
  console.log(`→ Applying rewrites from: ${latest}`);

  const entries: ReportEntry[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'reports', latest), 'utf-8'),
  );

  // Parse the .md file for REJECT markers + edited proposals
  const md = fs.readFileSync(path.join(process.cwd(), 'reports', mdFile), 'utf-8');
  const blocks = md.split(/^## /m).slice(1);

  let applied = 0;
  let rejected = 0;
  for (const block of blocks) {
    const firstLine = block.split('\n')[0].trim();
    if (firstLine.startsWith('REJECT')) {
      rejected++;
      continue;
    }
    const slugMatch = firstLine;
    const entry = entries.find((e) => e.slug === slugMatch);
    if (!entry || entry.skipped || entry.proposedTitle === entry.currentTitle) continue;

    // Honour manual edits: pick up the "proposed:" line from the md block.
    const editedMatch = block.match(/\*\*proposed:\*\*\s+(.+?)\s{3,}/);
    const finalTitle = editedMatch?.[1]?.trim() || entry.proposedTitle;

    await prisma.articles.update({
      where: { slug: entry.slug },
      data: { title: finalTitle, updatedAt: new Date() },
    });
    applied++;
    console.log(`  ✓ ${entry.slug} → ${finalTitle}`);
  }

  console.log(`\nDone. Applied: ${applied} · Rejected: ${rejected}`);
}

async function main() {
  try {
    if (process.argv.includes('--apply')) {
      await runApply();
    } else {
      await runDryRun();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
