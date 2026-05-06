/**
 * One-off: Search RSS sources for a topic with age filter.
 *   npx tsx scripts/search-sources.ts "Worst Ex Ever" 7
 *
 * Pure-fetch + simple XML regex parse — kein extra dep nötig.
 */
import { decodeGoogleNewsUrl } from '../lib/google-news-decoder';

const SOURCES: { name: string; rss: string; isHtml?: boolean }[] = [
  { name: 'Deadline TV', rss: 'https://deadline.com/v/tv/feed/' },
  { name: 'Variety TV', rss: 'https://variety.com/v/tv/feed/' },
  { name: 'Hollywood Reporter TV', rss: 'https://www.hollywoodreporter.com/c/tv/feed/' },
  { name: 'TVInsider', rss: 'https://www.tvinsider.com/feed/' },
  { name: 'Whats-On-Netflix', rss: 'https://www.whats-on-netflix.com/feed/' },
  { name: 'Screenrant TV', rss: 'https://screenrant.com/feed/category/tv/' },
  { name: 'Collider TV', rss: 'https://collider.com/feed/category/tv/' },
  { name: 'Cinemaholic', rss: 'https://thecinemaholic.com/feed/' },
  { name: 'TVLine Streaming', rss: 'https://www.tvline.com/category/streaming/feed/' },
  { name: 'Decider', rss: 'https://decider.com/feed/' },
];

interface Hit { source: string; title: string; url: string; pub: Date; ageDays: number; }

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '');
}

interface Item { title: string; link: string; pub: Date | null; summary: string; }

function parseRss(xml: string): Item[] {
  const items: Item[] = [];
  // Match both <item>…</item> and <entry>…</entry>
  const itemRe = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const block = m[2];
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) ||
      block.match(/<link[^>]*href="([^"]+)"/i);
    const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) ||
      block.match(/<dc:date>([\s\S]*?)<\/dc:date>/i) ||
      block.match(/<published>([\s\S]*?)<\/published>/i) ||
      block.match(/<updated>([\s\S]*?)<\/updated>/i);
    const descMatch = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
      block.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i) ||
      block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);

    const title = titleMatch ? decode(titleMatch[1]).trim() : '';
    const link = linkMatch ? decode(linkMatch[1]).trim() : '';
    const pubRaw = dateMatch ? decode(dateMatch[1]).trim() : '';
    const pub = pubRaw ? new Date(pubRaw) : null;
    const summary = descMatch ? decode(descMatch[1]).slice(0, 600) : '';
    if (title && link) items.push({ title, link, pub: pub && !isNaN(pub.getTime()) ? pub : null, summary });
  }
  return items;
}

async function main() {
  const query = (process.argv[2] || 'Worst Ex Ever').toLowerCase();
  const maxDays = Number(process.argv[3] || 7);
  const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;

  console.log(`🔎 Suche: "${query}"  (max ${maxDays} Tage alt)\n`);

  const allSources = [
    ...SOURCES,
    {
      name: 'Google News (search)',
      rss: `https://news.google.com/rss/search?q=${encodeURIComponent(`"${query}"`)}&hl=en-US&gl=US&ceid=US:en&when=${maxDays}d`,
    },
  ];

  const results = await Promise.all(allSources.map(async (src) => {
    try {
      const res = await fetch(src.rss, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; serien.de-search/1.0)' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { src: src.name, hits: [] as Hit[], error: `HTTP ${res.status}` };
      const xml = await res.text();
      const items = parseRss(xml);
      const hits: Hit[] = [];
      for (const it of items) {
        const blob = (it.title + ' ' + it.summary).toLowerCase();
        if (!blob.includes(query)) continue;
        if (!it.pub) continue;
        if (it.pub.getTime() < cutoff) continue;
        hits.push({
          source: src.name,
          title: it.title,
          url: it.link,
          pub: it.pub,
          ageDays: (Date.now() - it.pub.getTime()) / (1000 * 60 * 60 * 24),
        });
      }
      return { src: src.name, hits, error: null as string | null };
    } catch (e: any) {
      return { src: src.name, hits: [] as Hit[], error: e?.message?.slice(0, 100) || String(e) };
    }
  }));

  const allHits = results.flatMap((r) => r.hits).sort((a, b) => b.pub.getTime() - a.pub.getTime());

  console.log('━'.repeat(80));
  console.log(`📊 Gesamt: ${allHits.length} Treffer in ${allSources.length} Quellen`);
  console.log('━'.repeat(80));
  for (const r of results) {
    const status = r.error ? `❌ ${r.error}` : `${r.hits.length} hits`;
    console.log(`  ${r.src.padEnd(28)} → ${status}`);
  }

  if (allHits.length === 0) {
    console.log(`\n⚠️ Keine Treffer für "${query}" in den letzten ${maxDays} Tagen.`);
    return;
  }

  // Decode Google News wrapper URLs in parallel (max 8 at a time to be polite)
  const gnHits = allHits.filter((h) => /^https?:\/\/news\.google\.com\/rss\/articles\//i.test(h.url));
  if (gnHits.length > 0) {
    console.log(`\n⏳ Dekodiere ${gnHits.length} Google-News-Wrapper-URLs ...`);
    const limit = 8;
    for (let i = 0; i < gnHits.length; i += limit) {
      const batch = gnHits.slice(i, i + limit);
      await Promise.all(batch.map(async (h) => {
        const decoded = await decodeGoogleNewsUrl(h.url);
        if (decoded) h.url = decoded;
      }));
    }
  }

  console.log('\n━'.repeat(80));
  console.log('🎯 Treffer (neueste zuerst):');
  console.log('━'.repeat(80));
  for (const h of allHits) {
    const age = h.ageDays < 1
      ? `${Math.round(h.ageDays * 24)}h`
      : `${Math.round(h.ageDays * 10) / 10}d`;
    console.log(`\n[${age.padStart(5)} alt] ${h.source}`);
    console.log(`  ${h.title}`);
    console.log(`  ${h.url}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
