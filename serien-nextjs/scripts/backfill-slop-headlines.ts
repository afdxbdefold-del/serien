/**
 * BACKFILL: Re-titles existing articles whose stored title hits the v5.3 AI-slop killers.
 *
 * Targets:
 *   - "verändert alles" / "ändert alles" / "stellt alles auf den Kopf"
 *   - "X enthüllt|verrät|zeigt|erklärt|offenbart, warum/wie/weshalb/was Y"
 *   - "stellt alles auf den Prüfstand"
 *
 * For every match, calls generateHeadlines() with v5.3 prompt + scoring,
 * picks the winner, updates the DB title, and revalidates the page.
 *
 *   yarn tsx scripts/backfill-slop-headlines.ts                # dry-run, prints proposals
 *   yarn tsx scripts/backfill-slop-headlines.ts --apply        # writes to DB
 *   yarn tsx scripts/backfill-slop-headlines.ts --apply --limit=5
 */
import prisma from '../lib/prisma';
import { generateHeadlines } from '../lib/headline-engine';

const SLOP_REGEXES: RegExp[] = [
  /\b(ver[äa]ndert|[äa]ndert)\s+alles\b/i,
  /stellt\s+alles\s+auf\s+den\s+(kopf|pr[üu]fstand)/i,
  /\balles\s+wird\s+anders\b/i,
  /\b(enth[üu]llt|verr[äa]t|verraet|zeigt|erkl[äa]rt|offenbart|verk[üu]ndet|beweist|best[äa]tigt|bestätigt)\s*,\s*(warum|wieso|weshalb|wie|was|woran|wann|wo)\b/i,
];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;

  console.log(`Mode: ${apply ? 'APPLY (writes DB)' : 'DRY-RUN'} | limit=${limit}`);

  const candidates = await prisma.articles.findMany({
    where: { status: 'published' },
    select: {
      id: true, slug: true, title: true, contentHtml: true,
      primarySeriesId: true,
      series: { select: { name: true } },
      article_persons: { select: { persons: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const slop = candidates.filter((a) => SLOP_REGEXES.some((rx) => rx.test(a.title)));
  console.log(`Scanned ${candidates.length} published articles → ${slop.length} match slop patterns.\n`);

  const todo = slop.slice(0, limit);
  const results: Array<{ slug: string; before: string; after: string | null; score: number; reason?: string }> = [];

  for (const a of todo) {
    const seriesName = a.series?.name || a.title.split(/[:!?,]/)[0].trim();
    const persons = (a.article_persons || []).map((ap) => ap.persons?.name).filter(Boolean) as string[];
    const content = stripHtml(a.contentHtml || '').substring(0, 2000);

    if (!content || content.length < 200) {
      results.push({ slug: a.slug, before: a.title, after: null, score: 0, reason: 'content too short' });
      continue;
    }

    try {
      const r = await generateHeadlines({
        originalHeadline: a.title,
        articleContent: content,
        seriesName,
        entities: { persons, keywords: [] },
        explorationMode: true,
        preserveOriginalStyle: false,
      });
      const winner = r.winner;
      // Backfill threshold: 28. The default v5.3 floor (50) targets fresh
      // breaking-news headlines; re-titles for archival features rarely
      // carry the heavy event verbs (abgesetzt, verlängert) that boost score,
      // but the LLM still produces clearly human, Discover-resonant prose.
      const FLOOR = 25;
      if (!winner || winner.score < FLOOR) {
        results.push({ slug: a.slug, before: a.title, after: winner?.text || null, score: winner?.score || 0, reason: `winner < ${FLOOR} (${winner?.score})` });
        continue;
      }
      // Make sure winner doesn't itself contain a slop hit (regen-safe)
      if (SLOP_REGEXES.some((rx) => rx.test(winner.text))) {
        results.push({ slug: a.slug, before: a.title, after: winner.text, score: winner.score, reason: 'winner still slop' });
        continue;
      }

      results.push({ slug: a.slug, before: a.title, after: winner.text, score: winner.score });

      if (apply) {
        await prisma.articles.update({
          where: { id: a.id },
          data: { title: winner.text, updatedAt: new Date() },
        });
      }
    } catch (e: any) {
      results.push({ slug: a.slug, before: a.title, after: null, score: 0, reason: `error: ${e?.message || e}` });
    }
  }

  console.log('─'.repeat(80));
  for (const r of results) {
    const tag = r.after && !r.reason ? `✓ [${r.score}]` : `✗ [${r.reason || '—'}]`;
    console.log(`${tag}\n  - ${r.slug}\n    BEFORE: ${r.before}\n    AFTER : ${r.after || '(no replacement)'}`);
  }
  console.log('─'.repeat(80));
  const ok = results.filter((r) => r.after && !r.reason).length;
  console.log(`Result: ${ok}/${results.length} articles ${apply ? 'updated' : 'would be updated'}.`);

  // Trigger revalidation on apply
  if (apply && ok > 0) {
    const slugs = results.filter((r) => r.after && !r.reason).map((r) => `/${r.slug}`);
    console.log(`Revalidating ${slugs.length} pages + homepage…`);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
    const secret = process.env.REVALIDATE_SECRET;
    if (!secret) {
      console.log('  → skipped: REVALIDATE_SECRET is not configured');
    } else {
      try {
        const resp = await fetch(`${baseUrl}/api/internal/revalidate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
          body: JSON.stringify({ paths: ['/', ...slugs] }),
        });
        console.log(`  → ${resp.status} ${resp.statusText}`);
      } catch (e: any) {
        console.log(`  → revalidate error: ${e?.message}`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
