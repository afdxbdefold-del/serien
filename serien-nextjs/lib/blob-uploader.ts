/**
 * Vercel Blob Image Uploader
 * Automatically uploads images to Vercel Blob Storage
 */

import { put } from '@vercel/blob';

const BLOB_BASE = process.env.BLOB_PUBLIC_URL || process.env.NEXT_PUBLIC_BLOB_URL!;
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

interface UploadResult {
  success: boolean;
  url: string | null;
  error?: string;
}

/**
 * Download image from TMDB and upload to Vercel Blob
 */
async function downloadAndUpload(
  tmdbPath: string,
  blobPath: string,
  size: string = 'w500'
): Promise<UploadResult> {
  try {
    const tmdbUrl = `${TMDB_IMAGE_BASE}/${size}${tmdbPath}`;
    
    // Download from TMDB
    const response = await fetch(tmdbUrl);
    if (!response.ok) {
      return { success: false, url: null, error: `TMDB fetch failed: ${response.status}` };
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Upload to Vercel Blob
    const blob = await put(blobPath, buffer, {
      access: 'public',
      addRandomSuffix: false,
    });
    
    return { success: true, url: blob.url };
  } catch (error: any) {
    // If blob already exists, construct the URL
    if (error.message?.includes('already exists')) {
      return { success: true, url: `${BLOB_BASE}/${blobPath}` };
    }
    return { success: false, url: null, error: error.message };
  }
}

/**
 * Upload series poster to Blob
 */
export async function uploadSeriesPoster(
  tmdbId: number,
  posterPath: string | null
): Promise<string | null> {
  if (!posterPath) return null;
  
  const result = await downloadAndUpload(
    posterPath,
    `series/${tmdbId}/poster.jpg`,
    'w500'
  );
  
  return result.url;
}

/**
 * Upload series backdrop to Blob
 */
export async function uploadSeriesBackdrop(
  tmdbId: number,
  backdropPath: string | null
): Promise<string | null> {
  if (!backdropPath) return null;
  
  const result = await downloadAndUpload(
    backdropPath,
    `series/${tmdbId}/backdrop.jpg`,
    'w1280'
  );
  
  return result.url;
}

/**
 * Upload person profile to Blob
 */
export async function uploadPersonProfile(
  tmdbId: number,
  profilePath: string | null
): Promise<string | null> {
  if (!profilePath) return null;
  
  const result = await downloadAndUpload(
    profilePath,
    `persons/${tmdbId}.jpg`,
    'w185'
  );
  
  return result.url;
}

/**
 * Upload all images for a series (poster + backdrop)
 */
export async function uploadSeriesImages(
  tmdbId: number,
  posterPath: string | null,
  backdropPath: string | null
): Promise<{ posterUrl: string | null; backdropUrl: string | null }> {
  const [posterUrl, backdropUrl] = await Promise.all([
    uploadSeriesPoster(tmdbId, posterPath),
    uploadSeriesBackdrop(tmdbId, backdropPath),
  ]);
  
  return { posterUrl, backdropUrl };
}

/**
 * Get Blob URL for series poster (existing or construct)
 */
export function getSeriesPosterBlobUrl(tmdbId: number): string {
  return `${BLOB_BASE}/series/${tmdbId}/poster.jpg`;
}

/**
 * Get Blob URL for series backdrop (existing or construct)
 */
export function getSeriesBackdropBlobUrl(tmdbId: number): string {
  return `${BLOB_BASE}/series/${tmdbId}/backdrop.jpg`;
}

/**
 * Get Blob URL for person profile (existing or construct)
 */
export function getPersonProfileBlobUrl(tmdbId: number): string {
  return `${BLOB_BASE}/persons/${tmdbId}.jpg`;
}
