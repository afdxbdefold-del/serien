import { put } from '@vercel/blob';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');
const BATCH_SIZE = 10; // Parallel uploads

// Upload a single file to Vercel Blob
async function uploadToBlob(localPath: string, blobPath: string): Promise<string | null> {
  try {
    const fileBuffer = fs.readFileSync(localPath);
    const blob = await put(blobPath, fileBuffer, {
      access: 'public',
      addRandomSuffix: false,
    });
    return blob.url;
  } catch (error: any) {
    console.error(`Failed ${blobPath}:`, error.message);
    return null;
  }
}

// Process in batches
async function processBatch<T>(items: T[], batchSize: number, processor: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
    
    if ((i + batchSize) % 100 === 0 || i + batchSize >= items.length) {
      console.log(`Progress: ${Math.min(i + batchSize, items.length)}/${items.length}`);
    }
  }
}

// Upload series images
async function uploadSeriesImages() {
  console.log('\n=== Uploading Series Images ===');
  
  const seriesDir = path.join(IMAGES_DIR, 'series');
  if (!fs.existsSync(seriesDir)) {
    console.log('No series directory');
    return;
  }

  const folders = fs.readdirSync(seriesDir).filter(f => 
    fs.statSync(path.join(seriesDir, f)).isDirectory()
  );
  
  console.log(`Found ${folders.length} series folders`);
  let success = 0, failed = 0;

  await processBatch(folders, BATCH_SIZE, async (folder) => {
    const tmdbId = parseInt(folder);
    if (isNaN(tmdbId)) return;

    const folderPath = path.join(seriesDir, folder);
    const posterPath = path.join(folderPath, 'poster.jpg');
    const backdropPath = path.join(folderPath, 'backdrop.jpg');
    
    const updates: any = {};

    if (fs.existsSync(posterPath)) {
      const url = await uploadToBlob(posterPath, `series/${tmdbId}/poster.jpg`);
      if (url) { updates.posterLocalUrl = url; success++; } else failed++;
    }

    if (fs.existsSync(backdropPath)) {
      const url = await uploadToBlob(backdropPath, `series/${tmdbId}/backdrop.jpg`);
      if (url) { updates.backdropLocalUrl = url; success++; } else failed++;
    }

    if (Object.keys(updates).length > 0) {
      try {
        await prisma.series.update({ where: { tmdbId }, data: updates });
      } catch (e) {}
    }
  });

  console.log(`Series: ${success} success, ${failed} failed`);
}

// Upload person images
async function uploadPersonImages() {
  console.log('\n=== Uploading Person Images ===');
  
  const personsDir = path.join(IMAGES_DIR, 'persons');
  if (!fs.existsSync(personsDir)) {
    console.log('No persons directory');
    return;
  }

  const files = fs.readdirSync(personsDir).filter(f => f.endsWith('.jpg'));
  console.log(`Found ${files.length} person images`);
  let success = 0, failed = 0;

  await processBatch(files, BATCH_SIZE, async (filename) => {
    const tmdbId = parseInt(filename.replace('.jpg', ''));
    if (isNaN(tmdbId)) return;

    const localPath = path.join(personsDir, filename);
    const url = await uploadToBlob(localPath, `persons/${tmdbId}.jpg`);

    if (url) {
      success++;
      try {
        await prisma.persons.update({ where: { tmdbId }, data: { localProfilePath: url } });
      } catch (e) {}
    } else {
      failed++;
    }
  });

  console.log(`Persons: ${success} success, ${failed} failed`);
}

// Main
async function main() {
  const type = process.argv[2] || 'all';
  console.log('=== Vercel Blob Upload ===');
  console.log('Type:', type, '| Batch size:', BATCH_SIZE);

  if (type === 'series' || type === 'all') await uploadSeriesImages();
  if (type === 'persons' || type === 'all') await uploadPersonImages();

  console.log('\n=== Done ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
