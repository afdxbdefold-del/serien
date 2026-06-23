/**
 * Ranks authors by available DB signals to identify removal candidates.
 *
 * Signals (no GSC integration here — those numbers live in Search Console):
 *  - articleCount: total published articles
 *  - avgWordCount: average article length
 *  - last30dCount: articles published in last 30 days
 *  - createdAtOldest: when their first article ran
 *  - boilerplateBio: 1 if the fullBio is empty/null (E-E-A-T-weakest)
 *  - shortBioLength: 1 if bio < 80 chars
 *
 * Run: npx tsx scripts/analyze-author-quality.ts
 */
import prisma from '../lib/prisma';

interface Row {
  id: string;
  name: string;
  bioLen: number;
  expertiseLen: number;
  articleCount: number;
  last30d: number;
  avgWordCount: number;
  oldestArticle: string | null;
}

async function main() {
  const users = await prisma.users.findMany({
    where: { articles: { some: { status: 'published' } } },
    select: { id: true, name: true, role: true, bio: true, fullBio: true, expertise: true, image: true },
  });

  const rows: Row[] = [];
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  for (const u of users) {
    const [count, last30, sample] = await Promise.all([
      prisma.articles.count({ where: { authorId: u.id, status: 'published' } }),
      prisma.articles.count({ where: { authorId: u.id, status: 'published', publishedAt: { gte: since30 } } }),
      prisma.articles.findMany({
        where: { authorId: u.id, status: 'published' },
        select: { contentHtml: true, publishedAt: true },
        orderBy: { publishedAt: 'asc' },
        take: 50,
      }),
    ]);

    let totalWords = 0; let articlesWithBody = 0;
    for (const s of sample) {
      if (s.contentHtml) {
        totalWords += s.contentHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
        articlesWithBody++;
      }
    }
    const oldestArticle = sample[0]?.publishedAt?.toISOString().slice(0, 10) || null;

    rows.push({
      id: u.id,
      name: u.name || '(unnamed)',
      bioLen: (u.fullBio || u.bio || '').length,
      expertiseLen: u.expertise?.length || 0,
      articleCount: count,
      last30d: last30,
      avgWordCount: articlesWithBody ? Math.round(totalWords / articlesWithBody) : 0,
      oldestArticle,
    });
  }

  // Rank: weakest first. Composite "weakness score":
  //   high volume + short bio + low expertise + low avg word count
  rows.sort((a, b) => {
    const wA = a.last30d * 2 - (a.bioLen / 50) - a.expertiseLen - (a.avgWordCount / 100);
    const wB = b.last30d * 2 - (b.bioLen / 50) - b.expertiseLen - (b.avgWordCount / 100);
    return wB - wA;
  });

  console.log('═'.repeat(110));
  console.log('AUTHOR QUALITY RANKING — weakest (HCU-risk) FIRST');
  console.log('═'.repeat(110));
  console.log(
    'Rank | Name                        |  Total | 30 d | AvgWords | BioLen | Expertise | Oldest',
  );
  console.log('-'.repeat(110));
  rows.forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(2, ' ')}.  | ${r.name.padEnd(28, ' ')} | ${String(r.articleCount).padStart(6, ' ')} | ${String(r.last30d).padStart(4, ' ')} | ${String(r.avgWordCount).padStart(8, ' ')} | ${String(r.bioLen).padStart(6, ' ')} | ${String(r.expertiseLen).padStart(9, ' ')} | ${r.oldestArticle ?? '—'}`,
    );
  });
  console.log('═'.repeat(110));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
