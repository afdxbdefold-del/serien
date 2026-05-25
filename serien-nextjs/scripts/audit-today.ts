/* eslint-disable */
/**
 * Read-only audit of all articles published today.
 *
 * For each article we capture:
 *  - first-tag of contentHtml (lead-as-<p>  vs.  body starts with <h2>)
 *  - H2 count
 *  - word count (stripped)
 *  - presence of unconverted **markdown** artefacts
 *  - presence of 2nd-person quiz boilerplate
 *  - first <p> word overlap with excerpt (duplicate-intro indicator)
 *  - source publisher
 *  - generator used (from pipeline_runs.metadata)
 */
import prisma from '../lib/prisma';

function strip(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
}
function overlap(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let n = 0;
  for (const w of ta) if (tb.has(w)) n++;
  return n / Math.min(ta.size, tb.size);
}

async function main() {
  const start = new Date(Date.now() - 30 * 60 * 60 * 1000);
  const arts = await prisma.articles.findMany({
    where: { status: 'published', publishedAt: { gte: start } },
    orderBy: { publishedAt: 'asc' },
    select: {
      slug: true, title: true, excerpt: true, contentHtml: true,
      publishedAt: true, sourceUrl: true,
    },
  });
  console.log(`\nArticles published today: ${arts.length}\n`);

  // Generator metadata
  const runs = await prisma.pipeline_runs.findMany({
    where: { createdAt: { gte: start }, status: 'success' },
    select: { inputSource: true, metadata: true, createdAt: true },
  });
  const genBySource = new Map<string, string>();
  runs.forEach((r) => {
    const u = r.inputSource || '';
    const g = (r.metadata as any)?.generator || '?';
    if (!genBySource.has(u)) genBySource.set(u, g);
  });

  // Stats
  const headers = ['#', 'time', 'startsH2', 'h2#', 'words', '**md', '"Du', 'lead/p1', 'gen', 'slug'];
  console.log(headers.join('\t'));
  let leadAsP = 0, leadAsH2 = 0, withMd = 0, withDuMarker = 0, withDup = 0;
  const slugsLeadAsP: string[] = [];
  const slugsWithDup: string[] = [];
  const sources: Record<string, number> = {};

  arts.forEach((a, i) => {
    const html = (a.contentHtml || '').trim();
    const firstTag = html.match(/<(\w+)/)?.[1]?.toLowerCase() || '';
    const startsH2 = firstTag === 'h2';
    const h2 = (html.match(/<h2/gi) || []).length;
    const words = strip(html).split(/\s+/).filter(Boolean).length;
    const md = (html.match(/\*\*[^*]+\*\*/g) || []).length;
    const du = /\bDu\s+(bist|gedeih|passt|tr[äa]gst|baust)\b/i.test(html) ? 1 : 0;
    const firstP = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const ov = firstP ? overlap(strip(firstP[1]), strip(a.excerpt || '')) : 0;
    const time = a.publishedAt?.toISOString().slice(11, 16) || '';
    const gen = (genBySource.get(a.sourceUrl || '') || '?').slice(0, 8);
    const host = (a.sourceUrl || '').match(/https?:\/\/([^/]+)/)?.[1] || '?';
    sources[host] = (sources[host] || 0) + 1;

    if (!startsH2) { leadAsP++; slugsLeadAsP.push(a.slug); } else { leadAsH2++; }
    if (md > 0) withMd++;
    if (du) withDuMarker++;
    if (ov >= 0.6) { withDup++; slugsWithDup.push(a.slug); }
    console.log([i + 1, time, startsH2 ? 'H2' : firstTag, h2, words, md, du, Math.round(ov * 100) + '%', gen, '/' + a.slug.slice(0, 70)].join('\t'));
  });

  console.log(`\n=== Summary ===`);
  console.log(`Total today:               ${arts.length}`);
  console.log(`Body starts with H2:       ${leadAsH2} (= GOOD)`);
  console.log(`Body starts with <p>:      ${leadAsP} (= still lead-in-body)`);
  console.log(`Unconverted **markdown**:  ${withMd}`);
  console.log(`"Du bist/gedeih/passt":    ${withDuMarker} (boilerplate)`);
  console.log(`First <p> ≥60% overlap excerpt (duplicate-intro): ${withDup}`);
  console.log(`\nSources (top 8):`);
  Object.entries(sources).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([h, n]) => console.log(`  ${n}× ${h}`));

  if (slugsLeadAsP.length) {
    console.log(`\nArticles still starting with <p> (lead-in-body):`);
    slugsLeadAsP.slice(0, 20).forEach((s) => console.log(`  /${s}`));
    if (slugsLeadAsP.length > 20) console.log(`  …and ${slugsLeadAsP.length - 20} more`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
