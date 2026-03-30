/**
 * Migrate trailers from Emergent Storage to Cloudflare R2
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-123f15a3ef8046ef838c6f186d87bffe.r2.dev';
const EMERGENT_BASE = 'https://integrations.emergentagent.com/objstore/api/v1/storage/public';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function migrateTrailers() {
  console.log('=== Migrating Trailers from Emergent to R2 ===\n');

  // Get all series with trailers (Emergent URLs)
  const series = await prisma.series.findMany({
    where: {
      localTrailerPath: {
        not: null,
        not: { startsWith: 'https://pub-' }, // Skip already migrated
      }
    },
    select: {
      tmdbId: true,
      slug: true,
      title: true,
      localTrailerPath: true,
    }
  });

  console.log(`Found ${series.length} trailers to migrate\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const oldPath = s.localTrailerPath!;
    
    // Skip if already R2 URL
    if (oldPath.startsWith('https://pub-')) {
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${series.length}] ${s.title || s.slug}`);
    
    try {
      // Construct Emergent URL
      let emergentUrl = oldPath;
      if (!oldPath.startsWith('http')) {
        emergentUrl = `${EMERGENT_BASE}/${oldPath}`;
      }

      // Download from Emergent
      console.log(`   📥 Downloading from Emergent...`);
      const response = await fetch(emergentUrl);
      
      if (!response.ok) {
        console.log(`   ❌ Download failed: ${response.status}`);
        failed++;
        continue;
      }

      const videoBuffer = Buffer.from(await response.arrayBuffer());
      console.log(`   📦 Size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      // Extract filename from old path
      const filename = oldPath.split('/').pop() || `${s.slug}.mp4`;
      const r2Key = `trailers/${filename}`;

      // Upload to R2
      console.log(`   ☁️  Uploading to R2...`);
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME || 'serien-trailer',
        Key: r2Key,
        Body: videoBuffer,
        ContentType: 'video/mp4',
      }));

      const newUrl = `${R2_PUBLIC_URL}/${r2Key}`;

      // Update database
      await prisma.series.update({
        where: { tmdbId: s.tmdbId },
        data: { localTrailerPath: newUrl }
      });

      console.log(`   ✅ Migrated: ${newUrl}`);
      success++;

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      failed++;
    }

    // Progress every 10
    if ((i + 1) % 10 === 0) {
      console.log(`\n--- Progress: ${success} success, ${failed} failed, ${skipped} skipped ---\n`);
    }
  }

  console.log('\n=== Migration Complete ===');
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
}

migrateTrailers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
