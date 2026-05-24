/* eslint-disable */
/**
 * Scan published articles for Faithful-Translator boilerplate contamination
 * (Collider quiz answers, AI-summary widgets, watch-card boilerplate,
 * 2nd-person quiz hooks).
 *
 * Reports counts + sample slugs. Read-only.
 */
import prisma from '../lib/prisma';

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: '2nd-person quiz "Du bist ein"', re: /\bDu\s+bist\s+ein\s+\w+/i },
  { name: '2nd-person "Du gedeihst/gedeiht"', re: /\bDu\s+gedeih(t|st|est)\b/i },
  { name: '2nd-person "Du passt dich"', re: /\bDu\s+passt\s+dich\b/i },
  { name: '2nd-person "Du baust Loyalität"', re: /\bDu\s+baust\s+Loyalit/i },
  { name: '2nd-person "Du trägst die Last"', re: /\bDu\s+tr(ä|a)gst\s+(die\s+)?(Last|Gewicht|Weight)/i },
  { name: 'Quiz hook "Die Show, die … erlangt hat"', re: /Show,?\s+die\s+(die\s+)?meisten\s+(deiner|euren)\s+Antworten/i },
  { name: 'AI-Summary widget translit', re: /Generiere\s+eine\s+Zusammenfassung\s+dieser\s+Story/i },
  { name: 'Watch-Card translit', re: /\bRelease\s+Date\b.*Network/i },
  { name: 'Cast-Card translit', re: /\bSee\s+All\b.*Cast/i },
  { name: '"You are a Dutton" Variant', re: /\bDu\s+bist\s+ein\s+Dutton\b/i },
  { name: '"You are a Dwight Manfredi"', re: /\bDu\s+bist\s+ein\s+Dwight\s+Manfredi/i },
  { name: '"Tulsa King ist für"', re: /Tulsa\s+King\s+ist\s+f(ü|u)r/i },
];

async function main() {
  const articles = await prisma.articles.findMany({
    where: { status: 'published' },
    select: { slug: true, contentHtml: true, publishedAt: true, sourceUrl: true },
  });
  console.log(`Scanning ${articles.length} articles…\n`);

  const counts: Record<string, number> = {};
  const samples: Record<string, string[]> = {};
  const hitArticles = new Set<string>();
  const hitsBySource: Record<string, number> = {};

  for (const a of articles) {
    const html = a.contentHtml || '';
    let articleHit = false;
    for (const p of PATTERNS) {
      if (p.re.test(html)) {
        counts[p.name] = (counts[p.name] || 0) + 1;
        if (!samples[p.name]) samples[p.name] = [];
        if (samples[p.name].length < 3) samples[p.name].push(a.slug);
        articleHit = true;
      }
    }
    if (articleHit) {
      hitArticles.add(a.slug);
      const host = (a.sourceUrl || '').match(/https?:\/\/([^/]+)/)?.[1] || '<unknown>';
      hitsBySource[host] = (hitsBySource[host] || 0) + 1;
    }
  }

  console.log('=== Pattern Hits ===');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
    (samples[k] || []).forEach(s => console.log(`        /${s}`));
  });
  console.log(`\n=== Total contaminated articles: ${hitArticles.size} / ${articles.length} (${Math.round(hitArticles.size / articles.length * 1000) / 10}%) ===`);
  console.log('\n=== By source publisher ===');
  Object.entries(hitsBySource).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([host, n]) => {
    console.log(`  ${n.toString().padStart(4)}  ${host}`);
  });

  // Sample 5 contaminated slugs with their byline
  console.log('\n=== Sample contaminated articles (first 8) ===');
  const list = [...hitArticles].slice(0, 8);
  for (const slug of list) {
    const a = articles.find(x => x.slug === slug);
    console.log(`  /${slug}`);
    console.log(`    published: ${a?.publishedAt?.toISOString().slice(0, 10)}`);
    console.log(`    source:    ${a?.sourceUrl?.slice(0, 80)}`);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
