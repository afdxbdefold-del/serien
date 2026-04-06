/**
 * Submit all indexable URLs to IndexNow (Bing, Yandex, Seznam)
 * Run: npx tsx scripts/submit-indexnow.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const HOST = 'serien.de';
const BASE = `https://${HOST}`;
const KEY = '8e6827d79c19f8cbe91089129c21e303';
const BATCH_SIZE = 5000;

async function submitBatch(urls: string[], batchNum: number): Promise<void> {
  console.log(`\nBatch ${batchNum}: ${urls.length} URLs...`);

  const res = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `${BASE}/${KEY}.txt`,
      urlList: urls,
    }),
  });

  console.log(`  Status: ${res.status} ${res.statusText}`);
  if (res.status !== 200 && res.status !== 202) {
    const text = await res.text().catch(() => '');
    console.log(`  Response: ${text.substring(0, 200)}`);
  }
}

async function main() {
  console.log('=== IndexNow Submission ===\n');

  const [articles, series, persons, characters] = await Promise.all([
    prisma.articles.findMany({ where: { status: 'published' }, select: { slug: true } }),
    prisma.series.findMany({ select: { slug: true } }),
    prisma.$queryRawUnsafe<Array<{ slug: string }>>(
      'SELECT slug FROM persons WHERE biography IS NOT NULL AND LENGTH(biography) > 100'
    ),
    prisma.characters.findMany({ where: { publishStatus: 'published' }, select: { slug: true } }),
  ]);

  const seriesSlugs = new Set(series.map(s => s.slug));

  const allUrls: string[] = [
    BASE,
    `${BASE}/personen`,
    `${BASE}/figuren`,
    `${BASE}/trending`,
    ...articles.filter(a => !seriesSlugs.has(a.slug)).map(a => `${BASE}/${a.slug}`),
    ...series.map(s => `${BASE}/serie/${s.slug}`),
    ...persons.map(p => `${BASE}/person/${p.slug}`),
    ...characters.map(c => `${BASE}/figur/${c.slug}`),
  ];

  console.log(`Artikel:  ${articles.length}`);
  console.log(`Serien:   ${series.length}`);
  console.log(`Personen: ${persons.length}`);
  console.log(`Figuren:  ${characters.length}`);
  console.log(`─────────────────`);
  console.log(`GESAMT:   ${allUrls.length} URLs\n`);

  // Submit in batches
  for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
    const batch = allUrls.slice(i, i + BATCH_SIZE);
    await submitBatch(batch, Math.floor(i / BATCH_SIZE) + 1);
    if (i + BATCH_SIZE < allUrls.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n✅ Fertig!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
