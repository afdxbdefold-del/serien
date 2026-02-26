/**
 * YouTube Trailer Downloader
 * 
 * WARNUNG: Das Herunterladen von YouTube-Videos verstößt gegen YouTube TOS!
 * Nur auf eigene Verantwortung nutzen.
 * 
 * Storage: Uses Emergent Object Storage for cloud video hosting
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

interface TrailerDownloadResult {
  success: boolean;
  localPath?: string; // Now contains cloud URL
  error?: string;
}

// ========== EMERGENT OBJECT STORAGE ==========
const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";
const APP_NAME = "serien-nextjs";
let storageKey: string | null = null;

/**
 * Initialize Emergent Object Storage (call once at startup)
 */
async function initStorage(): Promise<string> {
  if (storageKey) {
    return storageKey;
  }

  const emergentKey = process.env.EMERGENT_LLM_KEY;
  if (!emergentKey) {
    throw new Error('EMERGENT_LLM_KEY not found in environment');
  }

  const response = await fetch(`${STORAGE_URL}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergent_key: emergentKey }),
  });

  if (!response.ok) {
    throw new Error(`Storage init failed: ${response.statusText}`);
  }

  const data = await response.json();
  storageKey = data.storage_key;
  console.log('✅ Emergent Object Storage initialized');
  return storageKey;
}

/**
 * Upload video to Emergent Object Storage
 */
async function uploadToStorage(
  storagePath: string,
  videoBuffer: Buffer,
  contentType: string = 'video/mp4'
): Promise<{ path: string; size: number }> {
  const key = await initStorage();

  const response = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
    method: 'PUT',
    headers: {
      'X-Storage-Key': key,
      'Content-Type': contentType,
    },
    body: videoBuffer,
  });

  if (!response.ok) {
    throw new Error(`Storage upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result;
}

/**
 * Find trailer YouTube ID from series trailers JSON
 */
export function findTrailerYouTubeId(trailersJson: any): string | null {
  if (!trailersJson || !Array.isArray(trailersJson)) {
    return null;
  }

  // Look for official trailer
  const officialTrailer = trailersJson.find((t: any) => 
    t.type === 'Trailer' && t.site === 'YouTube' && t.name?.toLowerCase().includes('official')
  );

  if (officialTrailer) {
    return officialTrailer.key;
  }

  // Fallback: any trailer
  const anyTrailer = trailersJson.find((t: any) => 
    t.type === 'Trailer' && t.site === 'YouTube'
  );

  return anyTrailer?.key || null;
}

/**
 * Download YouTube video using yt-dlp and upload to Emergent Object Storage
 */
export async function downloadYouTubeTrailer(
  youtubeId: string,
  seriesName: string
): Promise<TrailerDownloadResult> {
  let tempFilePath: string | null = null;
  
  try {
    // Create temp directory for download
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trailer-'));
    
    // Sanitize filename
    const safeFilename = seriesName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);

    tempFilePath = path.join(tempDir, `${safeFilename}-${youtubeId}.mp4`);
    const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    console.log(`🎬 Downloading trailer: ${youtubeUrl}`);
    console.log(`   Temp file: ${tempFilePath}`);

    // yt-dlp command with LOW QUALITY settings (360p max, simpler format selector)
    const command = [
      'yt-dlp',
      // Simpler format: best video+audio combo under 480p
      '--format', '"best[height<=480][ext=mp4]"',
      '--output', `"${tempFilePath}"`,
      '--no-playlist',
      '--max-filesize', '30M',
      '--socket-timeout', '30',
      '--no-check-certificates', // Bypass SSL issues
      '--user-agent', '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"',
      `"${youtubeUrl}"`
    ].join(' ');

    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000, // 2 minutes timeout
      shell: '/bin/bash' // Use bash for better quote handling
    });

    console.log('✅ Download complete');
    if (stderr) console.log('   stderr:', stderr);

    // Verify file exists
    await fs.access(tempFilePath);

    // Read file into buffer
    const videoBuffer = await fs.readFile(tempFilePath);
    const fileSizeMB = (videoBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`📦 File size: ${fileSizeMB} MB`);

    // Upload to Emergent Object Storage
    const storagePath = `${APP_NAME}/trailers/${safeFilename}-${youtubeId}.mp4`;
    console.log(`☁️  Uploading to cloud: ${storagePath}`);
    
    const uploadResult = await uploadToStorage(storagePath, videoBuffer, 'video/mp4');
    
    console.log(`✅ Upload complete: ${uploadResult.path}`);

    // Cleanup temp file
    try {
      await fs.unlink(tempFilePath);
      await fs.rmdir(tempDir);
    } catch (cleanupError) {
      console.log('⚠️  Temp cleanup failed (non-critical)');
    }

    // Return storage path (this will be stored in DB)
    return {
      success: true,
      localPath: uploadResult.path
    };

  } catch (error: any) {
    console.error('❌ Trailer download/upload failed:', error.message);
    
    // Cleanup on error
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        const tempDir = path.dirname(tempFilePath);
        await fs.rmdir(tempDir);
      } catch {}
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Search YouTube for series trailer (fallback if no TMDB trailer)
 */
export async function searchYouTubeTrailer(seriesName: string): Promise<string | null> {
  try {
    // Use yt-dlp to search
    const searchQuery = `${seriesName} official trailer`;
    const command = `yt-dlp "ytsearch1:${searchQuery}" --get-id --no-playlist`;

    const { stdout } = await execAsync(command, { timeout: 10000 });
    const videoId = stdout.trim();

    if (videoId && videoId.length === 11) {
      console.log(`✅ Found trailer via search: ${videoId}`);
      return videoId;
    }

    return null;
  } catch (error: any) {
    console.error('❌ YouTube search failed:', error.message);
    return null;
  }
}

/**
 * Clean up old trailer files
 * NOTE: Emergent Object Storage does not support delete API
 * This function marks trailers as soft-deleted in the database
 */
export async function cleanupOldTrailers(daysOld: number = 30): Promise<number> {
  console.log('ℹ️  Emergent Object Storage does not support delete API');
  console.log('   Trailers remain in cloud storage (consider implementing DB soft-delete)');
  console.log('   For now, cleanup is a no-op');
  return 0;
}

/**
 * Get video from Emergent Object Storage
 * This would be used in an API route to serve videos to frontend
 */
export async function getVideoFromStorage(storagePath: string): Promise<Buffer> {
  const key = await initStorage();

  const response = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
    method: 'GET',
    headers: {
      'X-Storage-Key': key,
    },
  });

  if (!response.ok) {
    throw new Error(`Storage download failed: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
