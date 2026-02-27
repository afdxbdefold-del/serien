/**
 * Image Storage System
 * Downloads images from TMDB and uploads to Emergent Object Storage
 */

import sharp from 'sharp';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";

let storageKey: string | null = null;
let storageKeyExpiry: number = 0;

async function initStorage(): Promise<string> {
  const now = Date.now();
  if (storageKey && storageKeyExpiry > now) {
    return storageKey;
  }

  const emergentKey = process.env.EMERGENT_LLM_KEY;
  if (!emergentKey) {
    throw new Error('EMERGENT_LLM_KEY not configured');
  }

  const response = await fetch(`${STORAGE_URL}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergent_key: emergentKey }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Storage init failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  storageKey = data.storage_key;
  storageKeyExpiry = now + (50 * 60 * 1000); // 50 min cache
  
  return storageKey;
}

/**
 * Download image from TMDB
 */
async function downloadTMDBImage(path: string, size: string = 'original'): Promise<Buffer> {
  const url = `${TMDB_IMAGE_BASE}/${size}${path}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`TMDB image fetch failed: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload image to Emergent Object Storage
 */
async function uploadToStorage(buffer: Buffer, storagePath: string): Promise<void> {
  const key = await initStorage();
  
  const response = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
    method: 'PUT',
    headers: {
      'X-Storage-Key': key,
      'Content-Type': 'image/webp',
    },
    body: buffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Storage upload failed: ${response.status} ${errorText}`);
  }
}

/**
 * Process and store hero image
 */
export async function storeHeroImage(
  tmdbPath: string,
  type: 'tv' | 'movie',
  id: number
): Promise<string> {
  try {
    // Download from TMDB
    const imageBuffer = await downloadTMDBImage(tmdbPath, 'original');
    
    // Transform to Hero format (1280x720, 16:9)
    const processedImage = await sharp(imageBuffer)
      .resize(1280, 720, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Upload to storage
    const storagePath = `serien-nextjs/images/hero/${type}/${id}.webp`;
    await uploadToStorage(processedImage, storagePath);
    
    console.log(`✅ Hero image stored: ${storagePath}`);
    return storagePath;
  } catch (error) {
    console.error(`❌ Failed to store hero image:`, error);
    throw error;
  }
}

/**
 * Process and store card image
 */
export async function storeCardImage(
  tmdbPath: string,
  type: 'tv' | 'movie',
  id: number
): Promise<string> {
  try {
    const imageBuffer = await downloadTMDBImage(tmdbPath, 'w500');
    
    // Transform to Card format (400x600, portrait)
    const processedImage = await sharp(imageBuffer)
      .resize(400, 600, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toBuffer();

    const storagePath = `serien-nextjs/images/card/${type}/${id}.webp`;
    await uploadToStorage(processedImage, storagePath);
    
    console.log(`✅ Card image stored: ${storagePath}`);
    return storagePath;
  } catch (error) {
    console.error(`❌ Failed to store card image:`, error);
    throw error;
  }
}

/**
 * Process and store OG image
 */
export async function storeOGImage(
  tmdbPath: string,
  type: 'tv' | 'movie',
  id: number
): Promise<string> {
  try {
    const imageBuffer = await downloadTMDBImage(tmdbPath, 'original');
    
    // Transform to OG format (1200x630)
    const processedImage = await sharp(imageBuffer)
      .resize(1200, 630, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .toBuffer();

    const storagePath = `serien-nextjs/images/og/${type}/${id}.webp`;
    await uploadToStorage(processedImage, storagePath);
    
    console.log(`✅ OG image stored: ${storagePath}`);
    return storagePath;
  } catch (error) {
    console.error(`❌ Failed to store OG image:`, error);
    throw error;
  }
}

/**
 * Process and store poster image
 */
export async function storePosterImage(
  tmdbPath: string,
  type: 'tv' | 'movie',
  id: number
): Promise<string> {
  try {
    const imageBuffer = await downloadTMDBImage(tmdbPath, 'w500');
    
    // Keep poster format, just convert to webp
    const processedImage = await sharp(imageBuffer)
      .webp({ quality: 80 })
      .toBuffer();

    const storagePath = `serien-nextjs/images/poster/${type}/${id}.webp`;
    await uploadToStorage(processedImage, storagePath);
    
    console.log(`✅ Poster image stored: ${storagePath}`);
    return storagePath;
  } catch (error) {
    console.error(`❌ Failed to store poster image:`, error);
    throw error;
  }
}

/**
 * Process and store person profile image
 */
export async function storePersonImage(
  tmdbPath: string,
  personId: number
): Promise<string> {
  try {
    const imageBuffer = await downloadTMDBImage(tmdbPath, 'w185');
    
    // Profile image format (300x450)
    const processedImage = await sharp(imageBuffer)
      .resize(300, 450, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toBuffer();

    const storagePath = `serien-nextjs/images/person/${personId}.webp`;
    await uploadToStorage(processedImage, storagePath);
    
    console.log(`✅ Person image stored: ${storagePath}`);
    return storagePath;
  } catch (error) {
    console.error(`❌ Failed to store person image:`, error);
    throw error;
  }
}

/**
 * Get TMDB image paths for a series/movie
 */
export async function getTMDBImagePaths(
  type: 'tv' | 'movie',
  id: number
): Promise<{ backdrop: string | null; poster: string | null }> {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new Error('TMDB_API_KEY not configured');

    const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}`;
    const response = await fetch(url, { next: { revalidate: 86400 } });
    
    if (!response.ok) return { backdrop: null, poster: null };
    
    const data = await response.json();
    return {
      backdrop: data.backdrop_path || null,
      poster: data.poster_path || null,
    };
  } catch (error) {
    console.error('TMDB API error:', error);
    return { backdrop: null, poster: null };
  }
}

/**
 * Download and store all images for a series/movie
 */
export async function storeAllImagesForItem(
  type: 'tv' | 'movie',
  id: number
): Promise<{
  hero: string | null;
  card: string | null;
  og: string | null;
  poster: string | null;
}> {
  console.log(`\n📸 Downloading images for ${type} ${id}...`);
  
  const { backdrop, poster } = await getTMDBImagePaths(type, id);
  
  if (!backdrop && !poster) {
    console.log('⚠️  No images found on TMDB');
    return { hero: null, card: null, og: null, poster: null };
  }

  const results = {
    hero: null as string | null,
    card: null as string | null,
    og: null as string | null,
    poster: null as string | null,
  };

  // Use backdrop for hero/og if available
  const heroSource = backdrop || poster;
  if (heroSource) {
    try {
      results.hero = await storeHeroImage(heroSource, type, id);
      results.og = await storeOGImage(heroSource, type, id);
    } catch (error) {
      console.error('Hero/OG image failed:', error);
    }
  }

  // Use poster for card
  const cardSource = poster || backdrop;
  if (cardSource) {
    try {
      results.card = await storeCardImage(cardSource, type, id);
      results.poster = await storePosterImage(cardSource, type, id);
    } catch (error) {
      console.error('Card/Poster image failed:', error);
    }
  }

  return results;
}
