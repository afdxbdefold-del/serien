/**
 * Image Storage System
 *
 * Downloads images from TMDB, prozessiert sie mit Sharp und schreibt sie
 * direkt in Cloudflare R2 (S3-kompatibel). Aug 2026 Feb 2026 umgestellt
 * vom Emergent-Object-Storage-Proxy auf direktes R2-Upload — damit läuft
 * die Bild-Pipeline unabhängig vom Emergent-Backend weiter.
 *
 * Public-URL-Muster: {NEXT_PUBLIC_R2_URL}/{storagePath}
 * z.B. https://pub-xxx.r2.dev/serien-nextjs/images/hero/tv/123.webp
 *
 * Storage-Path-Konvention (unverändert gegenüber der alten Emergent-Version,
 * damit bestehende DB-Referenzen weiterfunktionieren):
 *   serien-nextjs/images/hero/{type}/{id}.webp
 *   serien-nextjs/images/card/{type}/{id}.webp
 *   serien-nextjs/images/og/{type}/{id}.webp
 *   serien-nextjs/images/poster/{type}/{id}.webp
 *   serien-nextjs/images/person/{id}.webp
 */

import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const R2_BUCKET = process.env.R2_BUCKET_NAME;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (r2Client) return r2Client;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
    throw new Error(
      'R2 nicht konfiguriert. Setze R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME',
    );
  }
  r2Client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY,
      secretAccessKey: R2_SECRET_KEY,
    },
  });
  return r2Client;
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
 * Upload image direkt nach R2. Setzt Content-Type und ein aggressives
 * Cache-Control, weil unsere Bild-Namen deterministisch aus TMDB-ID
 * abgeleitet sind — beim Re-Import wird der Key überschrieben.
 */
async function uploadToStorage(buffer: Buffer, storagePath: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: storagePath,
      Body: buffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

/**
 * Process and store hero image
 * Google Discover optimized: 1600x900 (16:9), min 1200px width
 */
export async function storeHeroImage(
  tmdbPath: string,
  type: 'tv' | 'movie',
  id: number
): Promise<string> {
  try {
    // Download from TMDB
    const imageBuffer = await downloadTMDBImage(tmdbPath, 'original');
    
    // Transform to Hero format (1600x900, 16:9) - Google Discover optimized
    const processedImage = await sharp(imageBuffer)
      .resize(1600, 900, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 90 }) // Higher quality for Discover
      .toBuffer();

    // Upload to storage
    const storagePath = `serien-nextjs/images/hero/${type}/${id}.webp`;
    await uploadToStorage(processedImage, storagePath);
    
    console.log(`✅ Hero image stored: ${storagePath} (1600x900 - Google Discover ready)`);
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
