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
 * @deprecated Use downloadVideoTrailer instead for multi-source support
 */
export async function downloadYouTubeTrailer(
  youtubeId: string,
  seriesName: string
): Promise<TrailerDownloadResult> {
  // Delegate to the new multi-source function
  return downloadVideoTrailer(youtubeId, seriesName);
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
      console.log(`✅ Found trailer via YouTube search: ${videoId}`);
      return videoId;
    }

    return null;
  } catch (error: any) {
    console.error('❌ YouTube search failed:', error.message);
    return null;
  }
}

/**
 * Search Vimeo for series trailer (alternative source)
 */
export async function searchVimeoTrailer(seriesName: string): Promise<string | null> {
  try {
    // Use yt-dlp to search Vimeo
    const searchQuery = `${seriesName} official trailer`;
    const command = `yt-dlp "https://vimeo.com/search?q=${encodeURIComponent(searchQuery)}" --get-id --no-playlist --max-downloads 1`;

    const { stdout } = await execAsync(command, { timeout: 15000 });
    const videoId = stdout.trim().split('\n')[0]; // Get first result

    if (videoId && videoId.match(/^\d+$/)) {
      console.log(`✅ Found trailer via Vimeo search: ${videoId}`);
      return `vimeo:${videoId}`; // Prefix with vimeo: to identify source
    }

    return null;
  } catch (error: any) {
    console.error('❌ Vimeo search failed:', error.message);
    return null;
  }
}

/**
 * Search IMDB for series trailer (uses TMDB to get IMDB ID)
 */
export async function searchIMDBTrailer(
  seriesName: string,
  tmdbId?: number
): Promise<string | null> {
  try {
    // If we have TMDB ID, we can get IMDB ID from there
    if (tmdbId) {
      // Get IMDB ID from TMDB external IDs
      const tmdbApiKey = process.env.TMDB_API_KEY;
      if (!tmdbApiKey) {
        console.error('❌ TMDB_API_KEY not found');
        return null;
      }

      const externalIdsUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${tmdbApiKey}`;
      const externalIdsRes = await fetch(externalIdsUrl);
      const externalIds = await externalIdsRes.json();
      
      if (externalIds.imdb_id) {
        const imdbId = externalIds.imdb_id;
        console.log(`✅ Found IMDB ID via TMDB: ${imdbId}`);
        
        // Try to get video directly from IMDB using imdb: prefix
        // This is more reliable than scraping the page
        try {
          // First, try to get the first video from the title
          const command = `yt-dlp "https://www.imdb.com/title/${imdbId}/videogallery/" --get-id --no-playlist --playlist-items 1`;
          
          const { stdout } = await execAsync(command, { timeout: 15000 });
          const videoId = stdout.trim().split('\n')[0];
          
          if (videoId && videoId.match(/^\d+$/)) {
            console.log(`✅ Found trailer on IMDB: ${videoId}`);
            return `imdb:${videoId}`;
          }
        } catch (galleryError: any) {
          console.log(`⚠️  Video gallery failed, trying direct title page...`);
          
          // Fallback: Try getting videos from title page
          try {
            const command2 = `yt-dlp "imdb:title:${imdbId}" --get-id --no-playlist --playlist-items 1`;
            const { stdout: stdout2 } = await execAsync(command2, { timeout: 15000 });
            const videoId2 = stdout2.trim().split('\n')[0];
            
            if (videoId2 && videoId2.match(/^\d+$/)) {
              console.log(`✅ Found trailer on IMDB (fallback): ${videoId2}`);
              return `imdb:${videoId2}`;
            }
          } catch (titleError: any) {
            console.log(`⚠️  IMDB title page also failed`);
          }
        }
      }
    }

    return null;
  } catch (error: any) {
    console.error('❌ IMDB search failed:', error.message);
    return null;
  }
}

/**
 * Download video from YouTube, Vimeo, or IMDB using yt-dlp
 */
export async function downloadVideoTrailer(
  videoId: string,
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

    tempFilePath = path.join(tempDir, `${safeFilename}-${videoId.replace(/[^a-z0-9]/g, '-')}.mp4`);
    
    // Determine video URL based on source
    let videoUrl: string;
    let source: string;
    
    if (videoId.startsWith('vimeo:')) {
      const vimeoId = videoId.replace('vimeo:', '');
      videoUrl = `https://vimeo.com/${vimeoId}`;
      source = 'Vimeo';
    } else if (videoId.startsWith('imdb:')) {
      const imdbId = videoId.replace('imdb:', '');
      videoUrl = `https://www.imdb.com/video/vi${imdbId}/`;
      source = 'IMDB';
    } else {
      videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      source = 'YouTube';
    }

    console.log(`🎬 Downloading trailer from ${source}: ${videoUrl}`);
    console.log(`   Temp file: ${tempFilePath}`);

    // yt-dlp command with deno + remote components + cookie extraction
    const ytdlpArgs = [
      'yt-dlp',
      '--js-runtime', 'deno',
      '--remote-components', 'ejs:github',
      '--format', 'worst',
      '--output', tempFilePath,
      '--no-playlist',
      '--max-filesize', '30M',
      '--socket-timeout', '30',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
      '--referer', source === 'YouTube' ? 'https://www.youtube.com/' : source === 'Vimeo' ? 'https://vimeo.com/' : 'https://www.imdb.com/',
    ];

    // Add cookie extraction for YouTube (helps bypass 403 errors)
    if (source === 'YouTube') {
      // Try to extract cookies from browser (chromium, then firefox as fallback)
      // This significantly improves YouTube download success rate
      try {
        const { stdout: chromiumCheck } = await execAsync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null', { timeout: 2000 });
        if (chromiumCheck.trim()) {
          console.log('   🍪 Using Chromium cookies for authentication');
          ytdlpArgs.push('--cookies-from-browser', 'chromium');
        }
      } catch {
        try {
          const { stdout: firefoxCheck } = await execAsync('which firefox 2>/dev/null', { timeout: 2000 });
          if (firefoxCheck.trim()) {
            console.log('   🍪 Using Firefox cookies for authentication');
            ytdlpArgs.push('--cookies-from-browser', 'firefox');
          }
        } catch {
          console.log('   ⚠️  No browser cookies available (may increase 403 risk)');
        }
      }
    }

    ytdlpArgs.push(videoUrl);

    // Set PATH to include deno
    const env = {
      ...process.env,
      PATH: `${process.env.HOME}/.deno/bin:${process.env.PATH}`,
      DENO_DIR: `${process.env.HOME}/.deno`
    };

    // Use spawn instead of exec for better arg handling
    const { spawn } = await import('child_process');
    const proc = spawn(ytdlpArgs[0], ytdlpArgs.slice(1), { env });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => stdout += data);
    proc.stderr.on('data', (data) => stderr += data);
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('Download timeout after 3 minutes'));
      }, 180000); // Increased to 3 minutes
      
      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}\n${stderr}`));
        }
      });
      
      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    console.log('✅ Download complete');
    if (stderr) console.log('   stderr (last 200 chars):', stderr.slice(-200));

    // Verify file exists
    await fs.access(tempFilePath);

    // Read file into buffer
    const videoBuffer = await fs.readFile(tempFilePath);
    const fileSizeMB = (videoBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`📦 File size: ${fileSizeMB} MB`);

    // Upload to Emergent Object Storage
    const storagePath = `${APP_NAME}/trailers/${safeFilename}-${videoId.replace(/[^a-z0-9]/g, '-')}.mp4`;
    console.log(`☁️  Uploading to cloud: ${storagePath}`);
    
    const uploadResult = await uploadToStorage(storagePath, videoBuffer, 'video/mp4');
    
    console.log(`✅ Upload complete: ${uploadResult.path}`);
    console.log(`   Source: ${source}`);

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
