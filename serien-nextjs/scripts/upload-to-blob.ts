import { put, list } from '@vercel/blob';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');

interface UploadResult {
  success: number;
  failed: number;
  skipped: number;
}

// Upload a single file to Vercel Blob
async function uploadToBlob(localPath: string, blobPath: string): Promise<string | null> {
  try {
    const fileBuffer = fs.readFileSync(localPath);
    const blob = await put(blobPath, fileBuffer, {
      access: 'public',
      addRandomSuffix: false,
    });
    return blob.url;
  } catch (error) {
    console.error(`Failed to upload ${localPath}:`, error);
    return null;
  }
}

// Upload all series images (poster + backdrop)
async function uploadSeriesImages(): Promise<UploadResult> {
  console.log('\n=== Uploading Series Images to Vercel Blob ===');
  
  const seriesDir = path.join(IMAGES_DIR, 'series');
  if (!fs.existsSync(seriesDir)) {
    console.log('No series directory found');
    return { success: 0, failed: 0, skipped: 0 };
  }

  const seriesFolders = fs.readdirSync(seriesDir).filter(f => 
    fs.statSync(path.join(seriesDir, f)).isDirectory()
  );
  
  console.log(`Found ${seriesFolders.length} series folders`);
  
  let success = 0, failed = 0, skipped = 0;

  for (let i = 0; i < seriesFolders.length; i++) {
    const tmdbId = parseInt(seriesFolders[i]);
    if (isNaN(tmdbId)) continue;

    const folderPath = path.join(seriesDir, seriesFolders[i]);
    const posterPath = path.join(folderPath, 'poster.jpg');
    const backdropPath = path.join(folderPath, 'backdrop.jpg');

    let posterUrl: string | null = null;
    let backdropUrl: string | null = null;

    // Upload poster
    if (fs.existsSync(posterPath)) {
      posterUrl = await uploadToBlob(posterPath, `series/${tmdbId}/poster.jpg`);
      if (posterUrl) success++; else failed++;
    }

    // Upload backdrop
    if (fs.existsSync(backdropPath)) {
      backdropUrl = await uploadToBlob(backdropPath, `series/${tmdbId}/backdrop.jpg`);
      if (backdropUrl) success++; else failed++;
    }

    // Update database
    if (posterUrl || backdropUrl) {
      try {
        await prisma.series.update({
          where: { tmdbId },
          data: {
            ...(posterUrl && { posterLocalUrl: posterUrl }),
            ...(backdropUrl && { backdropLocalUrl: backdropUrl }),
          }
        });
      } catch (e) {
        // Series might not exist in DB
        skipped++;
      }
    }

    if ((i + 1) % 50 === 0) {
      console.log(`Progress: ${i + 1}/${seriesFolders.length} | Success: ${success} | Failed: ${failed}`);
    }
  }

  console.log(`\nSeries complete: ${success} uploaded, ${failed} failed, ${skipped} skipped`);
  return { success, failed, skipped };
}

// Upload all person profile images
async function uploadPersonImages(): Promise<UploadResult> {
  console.log('\n=== Uploading Person Images to Vercel Blob ===');
  
  const personsDir = path.join(IMAGES_DIR, 'persons');
  if (!fs.existsSync(personsDir)) {
    console.log('No persons directory found');
    return { success: 0, failed: 0, skipped: 0 };
  }

  const personFiles = fs.readdirSync(personsDir).filter(f => f.endsWith('.jpg'));
  console.log(`Found ${personFiles.length} person images`);
  
  let success = 0, failed = 0, skipped = 0;

  for (let i = 0; i < personFiles.length; i++) {
    const filename = personFiles[i];
    const tmdbId = parseInt(filename.replace('.jpg', ''));
    if (isNaN(tmdbId)) continue;

    const localPath = path.join(personsDir, filename);
    const blobUrl = await uploadToBlob(localPath, `persons/${tmdbId}.jpg`);

    if (blobUrl) {
      success++;
      // Update database
      try {
        await prisma.persons.update({
          where: { tmdbId },
          data: { localProfilePath: blobUrl }
        });
      } catch (e) {
        skipped++;
      }
    } else {
      failed++;
    }

    if ((i + 1) % 200 === 0) {
      console.log(`Progress: ${i + 1}/${personFiles.length} | Success: ${success} | Failed: ${failed}`);
    }
  }

  console.log(`\nPersons complete: ${success} uploaded, ${failed} failed, ${skipped} skipped`);
  return { success, failed, skipped };
}

// Main
async function main() {
  console.log('=== Vercel Blob Upload Script ===');
  console.log('Images directory:', IMAGES_DIR);

  const args = process.argv.slice(2);
  const type = args[0] || 'all';

  if (type === 'series' || type === 'all') {
    await uploadSeriesImages();
  }

  if (type === 'persons' || type === 'all') {
    await uploadPersonImages();
  }

  console.log('\n=== Upload Complete ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
