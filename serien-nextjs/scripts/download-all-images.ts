import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'images');

// Ensure directories exist
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Download image from TMDB
async function downloadImage(tmdbPath: string, localPath: string, size: string = 'w500'): Promise<boolean> {
  if (!tmdbPath) return false;
  
  const url = `${TMDB_IMAGE_BASE}/${size}${tmdbPath}`;
  const fullLocalPath = path.join(UPLOAD_DIR, localPath);
  
  // Skip if already exists
  if (fs.existsSync(fullLocalPath)) {
    return true;
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to download ${url}: ${response.status}`);
      return false;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Ensure directory exists
    ensureDir(path.dirname(fullLocalPath));
    
    fs.writeFileSync(fullLocalPath, buffer);
    return true;
  } catch (error) {
    console.error(`Error downloading ${url}:`, error);
    return false;
  }
}

// Download series images (poster + backdrop)
async function downloadSeriesImages() {
  console.log('\n=== Downloading Series Images ===');
  
  const series = await prisma.series.findMany({
    where: {
      OR: [
        { posterPath: { not: null }, posterLocalUrl: null },
        { backdropPath: { not: null }, backdropLocalUrl: null }
      ]
    },
    select: {
      tmdbId: true,
      slug: true,
      posterPath: true,
      backdropPath: true,
      posterLocalUrl: true,
      backdropLocalUrl: true
    }
  });
  
  console.log(`Found ${series.length} series to process`);
  
  let successPoster = 0, successBackdrop = 0, failed = 0;
  
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const updates: any = {};
    
    // Download poster
    if (s.posterPath && !s.posterLocalUrl) {
      const localPath = `series/${s.tmdbId}/poster.jpg`;
      if (await downloadImage(s.posterPath, localPath, 'w500')) {
        updates.posterLocalUrl = `/images/${localPath}`;
        successPoster++;
      } else {
        failed++;
      }
    }
    
    // Download backdrop
    if (s.backdropPath && !s.backdropLocalUrl) {
      const localPath = `series/${s.tmdbId}/backdrop.jpg`;
      if (await downloadImage(s.backdropPath, localPath, 'w1280')) {
        updates.backdropLocalUrl = `/images/${localPath}`;
        successBackdrop++;
      } else {
        failed++;
      }
    }
    
    // Update database
    if (Object.keys(updates).length > 0) {
      await prisma.series.update({
        where: { tmdbId: s.tmdbId },
        data: updates
      });
    }
    
    if ((i + 1) % 50 === 0) {
      console.log(`Progress: ${i + 1}/${series.length} | Poster: ${successPoster} | Backdrop: ${successBackdrop}`);
    }
  }
  
  console.log(`\nSeries complete: ${successPoster} posters, ${successBackdrop} backdrops, ${failed} failed`);
}

// Download person profile images
async function downloadPersonImages() {
  console.log('\n=== Downloading Person Profile Images ===');
  
  const persons = await prisma.persons.findMany({
    where: {
      profilePath: { not: null },
      localProfilePath: null
    },
    select: {
      tmdbId: true,
      slug: true,
      profilePath: true
    }
  });
  
  console.log(`Found ${persons.length} persons to process`);
  
  let success = 0, failed = 0;
  
  for (let i = 0; i < persons.length; i++) {
    const p = persons[i];
    
    if (!p.profilePath) continue;
    
    const localPath = `persons/${p.tmdbId}.jpg`;
    
    if (await downloadImage(p.profilePath, localPath, 'w185')) {
      await prisma.persons.update({
        where: { tmdbId: p.tmdbId },
        data: { localProfilePath: `/images/${localPath}` }
      });
      success++;
    } else {
      failed++;
    }
    
    if ((i + 1) % 100 === 0) {
      console.log(`Progress: ${i + 1}/${persons.length} | Success: ${success} | Failed: ${failed}`);
    }
    
    // Small delay to avoid rate limiting
    if (i % 50 === 0) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  console.log(`\nPersons complete: ${success} downloaded, ${failed} failed`);
}

// Main function
async function main() {
  console.log('=== Image Download Script ===');
  console.log('Upload directory:', UPLOAD_DIR);
  
  ensureDir(UPLOAD_DIR);
  ensureDir(path.join(UPLOAD_DIR, 'series'));
  ensureDir(path.join(UPLOAD_DIR, 'persons'));
  
  const args = process.argv.slice(2);
  const type = args[0] || 'all';
  const limit = parseInt(args[1]) || 0;
  
  console.log(`Mode: ${type}, Limit: ${limit || 'none'}`);
  
  if (type === 'series' || type === 'all') {
    await downloadSeriesImages();
  }
  
  if (type === 'persons' || type === 'all') {
    await downloadPersonImages();
  }
  
  console.log('\n=== Done ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
