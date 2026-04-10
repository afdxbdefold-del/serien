/**
 * Backfill OG Images
 * Pre-downloads and stores OG images for all articles that use TMDB hero images
 * but don't have a cached OG image in storage yet.
 * 
 * Usage: npx tsx scripts/backfill-og-images.ts
 */

import { PrismaClient } from '@prisma/client';
import { storeAllImagesForItem } from '../lib/image-storage';

const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";
let storageKey: string | null = null;

async function initStorage(): Promise<string> {
  if (storageKey) return storageKey;
  const emergentKey = process.env.EMERGENT_LLM_KEY;
  if (!emergentKey) throw new Error('EMERGENT_LLM_KEY not configured');

  const response = await fetch(`${STORAGE_URL}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergent_key: emergentKey }),
  });
  if (!response.ok) throw new Error(`Storage init failed: ${response.status}`);
  const data = await response.json();
  storageKey = data.storage_key;
  return storageKey;
}

async function checkExists(path: string): Promise<boolean> {
  try {
    const key = await initStorage();
    const res = await fetch(`${STORAGE_URL}/objects/${path}`, {
      method: 'HEAD',
      headers: { 'X-Storage-Key': key },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const prisma = new PrismaClient();

  try {
    // Find all articles with TMDB data but potentially missing OG images
    const articles = await prisma.articles.findMany({
      where: {
        tmdbId: { not: null },
      },
      select: {
        id: true,
        slug: true,
        tmdbId: true,
        tmdbType: true,
        heroImageUrl: true,
      },
      orderBy: { publishedAt: 'desc' },
    });

    console.log(`Found ${articles.length} articles with TMDB data`);

    let alreadyCached = 0;
    let downloaded = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const tmdbId = article.tmdbId!;
      const tmdbType = article.tmdbType as 'tv' | 'movie';
      const ogPath = `serien-nextjs/images/og/${tmdbType}/${tmdbId}.webp`;

      process.stdout.write(`[${i + 1}/${articles.length}] ${article.slug.substring(0, 50)}... `);

      // Check if OG image already exists in storage
      const exists = await checkExists(ogPath);
      if (exists) {
        console.log('✓ cached');
        alreadyCached++;
        continue;
      }

      // Download and store all images
      try {
        const results = await storeAllImagesForItem(tmdbType, tmdbId);
        if (results.og) {
          console.log('✅ downloaded');
          downloaded++;
        } else {
          console.log('⚠️  no TMDB image available');
          skipped++;
        }
      } catch (error: any) {
        console.log(`❌ failed: ${error.message?.substring(0, 60)}`);
        failed++;
      }

      // Small delay to avoid rate limiting
      if (downloaded % 10 === 0 && downloaded > 0) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`\n========== BACKFILL COMPLETE ==========`);
    console.log(`Total articles:  ${articles.length}`);
    console.log(`Already cached:  ${alreadyCached}`);
    console.log(`Downloaded:      ${downloaded}`);
    console.log(`Skipped (no img): ${skipped}`);
    console.log(`Failed:          ${failed}`);
    console.log(`=======================================`);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
