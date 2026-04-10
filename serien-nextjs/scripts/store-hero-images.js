/**
 * Store Article Hero Images - V2 (Optimized)
 * Skips checkExists to halve API calls. Just uploads directly.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";
const prisma = new PrismaClient();
let storageKey = null;
let storageKeyExpiry = 0;

async function initStorage() {
  const now = Date.now();
  if (storageKey && storageKeyExpiry > now) return storageKey;

  const res = await fetch(`${STORAGE_URL}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergent_key: process.env.EMERGENT_LLM_KEY }),
  });
  if (!res.ok) throw new Error(`Storage init failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  storageKey = data.storage_key;
  storageKeyExpiry = now + 50 * 60 * 1000;
  return storageKey;
}

async function uploadToStorage(storagePath, imageBuffer, contentType) {
  const key = await initStorage();
  const res = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
    method: 'PUT',
    headers: { 'X-Storage-Key': key, 'Content-Type': contentType },
    body: Buffer.from(imageBuffer),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload ${res.status}: ${text.substring(0,100)}`);
  }
  return true;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== Store Article Hero Images V2 ===\n');

  // Get articles where ogImagePath is still null
  const articles = await prisma.articles.findMany({
    where: {
      heroImageUrl: { not: null },
      ogImagePath: null,
    },
    select: { id: true, slug: true, heroImageUrl: true },
    orderBy: { publishedAt: 'desc' },
  });

  console.log(`${articles.length} articles remaining\n`);

  // Process in batches of 10 with pauses
  const BATCH_SIZE = 10;
  const BATCH_PAUSE = 5000; // 5s between batches
  const PER_ITEM_PAUSE = 500; // 500ms between items

  let stored = 0, errors = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    try {
      const heroUrl = article.heroImageUrl;
      if (!heroUrl) { errors++; continue; }

      // Build full download URL
      let downloadUrl = heroUrl;
      if (heroUrl.startsWith('/')) {
        // Relative path → use production domain
        downloadUrl = 'https://serien.de' + heroUrl;
      } else if (heroUrl.startsWith('http') && heroUrl.includes('/t/p/original/')) {
        // TMDB original → use w1280 to reduce rate limiting
        downloadUrl = heroUrl.replace('/t/p/original/', '/t/p/w1280/');
      }

      if (!downloadUrl.startsWith('http')) { errors++; continue; }

      const ext = heroUrl.includes('.png') ? 'png' : heroUrl.includes('.webp') ? 'webp' : 'jpg';
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const storagePath = `serien-nextjs/images/articles/${article.slug}.${ext}`;

      const imgRes = await fetch(downloadUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SerienBot/1.0)' },
        signal: AbortSignal.timeout(15000),
      });

      if (!imgRes.ok) {
        if (imgRes.status === 403 || imgRes.status === 429) {
          // Rate limited, long pause then continue
          console.log(`  RATE LIMITED (${imgRes.status}) at item ${i} - pausing 10s`);
          await sleep(10000);
        }
        errors++;
        continue;
      }

      const buf = await imgRes.arrayBuffer();
      if (buf.byteLength < 500) { errors++; continue; }

      // Upload to our storage
      await uploadToStorage(storagePath, buf, contentType);

      // Save path in DB
      await prisma.articles.update({
        where: { id: article.id },
        data: { ogImagePath: storagePath },
      });

      stored++;
      
      await sleep(PER_ITEM_PAUSE);

      // Batch pause
      if (stored % BATCH_SIZE === 0) {
        console.log(`  [${i+1}/${articles.length}] Stored: ${stored}, Errors: ${errors}`);
        await sleep(BATCH_PAUSE);
      }

    } catch (err) {
      const msg = err.message || String(err);
      if (msg.includes('503') || msg.includes('429')) {
        console.log(`  STORAGE RATE LIMITED at item ${i} - pausing 15s`);
        await sleep(15000);
      }
      errors++;
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Stored: ${stored} | Errors: ${errors} | Total: ${articles.length}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
