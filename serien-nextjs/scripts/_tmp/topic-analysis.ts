import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  // Letzte 50 Artikel-Titel + Source-URLs
  const latest = await p.articles.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    select: { title: true, sourceUrl: true, publishedAt: true, isRankingArticle: true, contentType: true, category: true },
    take: 50,
  });

  // Topic-Klassifikation per Keyword auf Titel
  const buckets: Record<string, string[]> = {
    'Rating/Score (Rotten Tomatoes, %)': [],
    'Ranking/Toplist (Platz, Top, beste)': [],
    'Viewership (Millionen, sahen, Hit)': [],
    'Cast (Rolle, zurück, überrascht)': [],
    'Release (Staffel, bestätigt, Finale, Season)': [],
    'Other': [],
  };
  const RX_RATING = /(rotten\s*tomatoes|100\s*%|90\s*%|bewert|\bscore\b|\bnote\b|\b10\/10\b|kritik)/i;
  const RX_RANK   = /(platz\s*\d|top\s*\d|\bbeste\b|\bwichtigst\b|\bdominiert\b|\bchart|\branking\b)/i;
  const RX_VIEW   = /(\d+\s*millionen|sahen|streaming-hit|\berfolg\b|\bdominiert\b|\brekord\b|\btriumph\b|\bhit\b)/i;
  const RX_CAST   = /(\bstar\b|\brolle\b|rückkehr|zurück|comeback|überrascht|besetzung|cast|ackles|garner)/i;
  const RX_RELEASE= /(staffel\s*\d|season\s*\d|finale|premiere|bestätigt|\bstart\b|erscheint|\brenewed\b)/i;

  for (const a of latest) {
    const t = a.title || '';
    if (RX_RATING.test(t))        buckets['Rating/Score (Rotten Tomatoes, %)'].push(t);
    else if (RX_RANK.test(t))     buckets['Ranking/Toplist (Platz, Top, beste)'].push(t);
    else if (RX_VIEW.test(t))     buckets['Viewership (Millionen, sahen, Hit)'].push(t);
    else if (RX_RELEASE.test(t))  buckets['Release (Staffel, bestätigt, Finale, Season)'].push(t);
    else if (RX_CAST.test(t))     buckets['Cast (Rolle, zurück, überrascht)'].push(t);
    else                          buckets['Other'].push(t);
  }

  console.log('=== Topic-Verteilung der letzten 50 Artikel ===\n');
  for (const [k, v] of Object.entries(buckets)) {
    const pct = ((v.length / latest.length) * 100).toFixed(0);
    console.log(`${pct.padStart(3)}% (${String(v.length).padStart(2)}) — ${k}`);
    for (const t of v.slice(0, 4)) console.log(`       • ${t.substring(0,78)}`);
    if (v.length > 4) console.log(`       … +${v.length-4} weitere`);
    console.log('');
  }

  // isRankingArticle-Verteilung
  const rankCount = latest.filter(a => a.isRankingArticle).length;
  console.log(`isRankingArticle=true: ${rankCount}/${latest.length} (${(rankCount/latest.length*100).toFixed(0)}%)`);

  // contentType-Verteilung
  const byType: Record<string, number> = {};
  for (const a of latest) byType[a.contentType || 'null'] = (byType[a.contentType || 'null'] || 0) + 1;
  console.log('contentType:', byType);

  // Source-Domain-Verteilung
  const byDomain: Record<string, number> = {};
  for (const a of latest) {
    try {
      const d = new URL(a.sourceUrl || '').hostname.replace('www.','');
      byDomain[d] = (byDomain[d] || 0) + 1;
    } catch { byDomain['unknown'] = (byDomain['unknown']||0)+1; }
  }
  console.log('Source-Domains:', byDomain);

  await p.$disconnect();
})();
