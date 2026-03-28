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
 * Priority: German trailer > English trailer
 */
export function findTrailerYouTubeId(trailersJson: any): string | null {
  if (!trailersJson || !Array.isArray(trailersJson)) {
    return null;
  }

  // Priority 1: German official trailer
  const germanOfficialTrailer = trailersJson.find((t: any) => 
    t.type === 'Trailer' && 
    t.site === 'YouTube' && 
    t.name?.toLowerCase().includes('official') &&
    (t.iso_639_1 === 'de' || t.name?.toLowerCase().includes('deutsch'))
  );

  if (germanOfficialTrailer) {
    console.log('✅ Found German official trailer');
    return germanOfficialTrailer.key;
  }

  // Priority 2: Any German trailer
  const germanTrailer = trailersJson.find((t: any) => 
    t.type === 'Trailer' && 
    t.site === 'YouTube' &&
    (t.iso_639_1 === 'de' || t.name?.toLowerCase().includes('deutsch'))
  );

  if (germanTrailer) {
    console.log('✅ Found German trailer');
    return germanTrailer.key;
  }

  // Priority 3: English official trailer (fallback)
  const englishOfficialTrailer = trailersJson.find((t: any) => 
    t.type === 'Trailer' && 
    t.site === 'YouTube' && 
    t.name?.toLowerCase().includes('official') &&
    (t.iso_639_1 === 'en' || !t.iso_639_1)
  );

  if (englishOfficialTrailer) {
    console.log('⚠️ Using English official trailer (no German found)');
    return englishOfficialTrailer.key;
  }

  // Priority 4: Any English trailer
  const englishTrailer = trailersJson.find((t: any) => 
    t.type === 'Trailer' && 
    t.site === 'YouTube' &&
    (t.iso_639_1 === 'en' || !t.iso_639_1)
  );

  if (englishTrailer) {
    console.log('⚠️ Using English trailer (no German found)');
    return englishTrailer.key;
  }

  // Priority 5: Any trailer as last resort
  const anyTrailer = trailersJson.find((t: any) => 
    t.type === 'Trailer' && t.site === 'YouTube'
  );

  if (anyTrailer) {
    console.log('⚠️ Using trailer in other language');
  }

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
 * Search YouTube for series trailer - DISABLED (requires yt-dlp)
 * Use TMDB trailers only on serverless
 */
export async function searchYouTubeTrailer(seriesName: string): Promise<string | null> {
  console.log('⚠️ YouTube search disabled on serverless - use TMDB trailers only');
  return null;
}

/**
 * Search Netflix for series trailer (NEW: Primary source #1)
 * Netflix hosts trailers directly on their platform (no DRM for trailers)
 */
export async function searchNetflixTrailer(seriesName: string, tmdbId?: number): Promise<string | null> {
  try {
    // Try direct Netflix URL if we have one
    // Format: https://www.netflix.com/title/{netflix_id}
    // We'll search for the series title page which usually has trailers
    const searchQuery = `${seriesName} site:netflix.com`;
    console.log(`🔍 Searching Netflix for: ${seriesName}`);
    
    // For now, we'll use a simple approach: try common Netflix URL patterns
    // TODO: Implement proper Netflix title search API or scraping
    return null; // Placeholder - Netflix needs title ID mapping
  } catch (error: any) {
    console.error('❌ Netflix search failed:', error.message);
    return null;
  }
}

/**
 * Search FilmStarts.de for series trailer (NEW: Primary source #2)
 * German trailer aggregator with direct downloads
 */
export async function searchFilmStartsTrailer(seriesName: string): Promise<string | null> {
  try {
    console.log(`🔍 Searching FilmStarts.de for: ${seriesName}`);
    
    // FilmStarts doesn't have a public API, but we can use yt-dlp to search
    // their trailer archive. For now, we'll use YouTube search with "site:filmstarts.de"
    // as a workaround to find FilmStarts URLs
    
    // Search YouTube for FilmStarts videos about this series
    const searchQuery = `${seriesName} trailer site:filmstarts.de`;
    const command = `yt-dlp "ytsearch1:${searchQuery}" --get-url --no-playlist 2>/dev/null || echo ""`;
    
    try {
      const { stdout } = await execAsync(command, { timeout: 15000 });
      const url = stdout.trim();
      
      // Check if we got a FilmStarts URL
      if (url && url.includes('filmstarts.de')) {
        console.log(`✅ Found FilmStarts URL: ${url}`);
        return `filmstarts:${url}`;
      }
    } catch {
      // Search failed, that's ok
    }
    
    console.log('⏭️  No trailer found on FilmStarts.de');
    return null;
  } catch (error: any) {
    console.error('❌ FilmStarts search failed:', error.message);
    return null;
  }
}

/**
 * Search VideoBuster.de for series trailer (NEW: Primary source #3)
 * German video rental service with trailer section
 */
export async function searchVideoBusterTrailer(seriesName: string): Promise<string | null> {
  try {
    console.log(`🔍 Searching VideoBuster.de for: ${seriesName}`);
    
    // Similar approach: Use YouTube search to find VideoBuster trailers
    const searchQuery = `${seriesName} trailer site:videobuster.de`;
    const command = `yt-dlp "ytsearch1:${searchQuery}" --get-url --no-playlist 2>/dev/null || echo ""`;
    
    try {
      const { stdout } = await execAsync(command, { timeout: 15000 });
      const url = stdout.trim();
      
      // Check if we got a VideoBuster URL
      if (url && url.includes('videobuster.de')) {
        console.log(`✅ Found VideoBuster URL: ${url}`);
        return `videobuster:${url}`;
      }
    } catch {
      // Search failed, that's ok
    }
    
    console.log('⏭️  No trailer found on VideoBuster.de');
    return null;
  } catch (error: any) {
    console.error('❌ VideoBuster search failed:', error.message);
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
 * Download video using yt-dlp
 */
async function downloadViaYtDlp(
  videoUrl: string,
  tempFilePath: string,
  source: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // yt-dlp command with optimized settings for each source
    const ytdlpArgs = [
      'yt-dlp',
      '--format', 'worst',
      '--output', tempFilePath,
      '--no-playlist',
      '--max-filesize', '60M',
      '--socket-timeout', '30',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
      '--referer', source === 'YouTube' ? 'https://www.youtube.com/' : 
                   source === 'Vimeo' ? 'https://vimeo.com/' : 
                   source === 'IMDB' ? 'https://www.imdb.com/' :
                   source === 'Netflix' ? 'https://www.netflix.com/' :
                   source === 'FilmStarts' ? 'https://www.filmstarts.de/' :
                   source === 'VideoBuster' ? 'https://www.videobuster.de/' :
                   'https://www.google.com/',
    ];

    // YouTube-specific: Use cookies for authentication
    if (source === 'YouTube') {
      const YOUTUBE_COOKIES_PATH = process.env.YOUTUBE_COOKIES_PATH || 
        path.join(process.cwd(), 'cookies', 'youtube-cookies.txt');
      
      try {
        await fs.access(YOUTUBE_COOKIES_PATH);
        ytdlpArgs.push('--cookies', YOUTUBE_COOKIES_PATH);
        console.log('   🍪 Using YouTube cookies for authentication');
      } catch {
        console.log('   ⚠️  No YouTube cookies found');
      }
    }

    ytdlpArgs.push(videoUrl);

    // Set PATH for yt-dlp
    const env = {
      ...process.env,
      PATH: process.env.PATH
    };

    // Use spawn for better arg handling
    const { spawn } = await import('child_process');
    const proc = spawn(ytdlpArgs[0], ytdlpArgs.slice(1), { env });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => stdout += data);
    proc.stderr.on('data', (data) => stderr += data);
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        proc.kill();
        reject(new Error('Download timeout after 5 minutes'));
      }, 300000); // 5 minutes

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Download YouTube video using yt-video-audio-downloader-api (PRIMARY - WORKS!)
 * This API provides direct download URLs that actually work
 */
async function downloadYouTubeViaYTAPI(
  videoId: string,
  tempFilePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const rapidApiKey = process.env.RAPIDAPI_KEY || process.env.RAPIDAPI_KEY_BACKUP;
    if (!rapidApiKey) {
      return { success: false, error: 'No RapidAPI key found in environment' };
    }

    console.log('   🌐 Using yt-video-audio-downloader-api (Primary)...');

    const response = await fetch('https://yt-video-audio-downloader-api.p.rapidapi.com/download', {
      method: 'POST',
      headers: {
        'x-rapidapi-host': 'yt-video-audio-downloader-api.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        format: 'mp4',
        quality: '360'
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return { success: false, error: `API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    
    if (data.error) {
      return { success: false, error: data.error };
    }

    const downloadUrl = data.downloadUrl || data.streamUrl;
    
    if (!downloadUrl) {
      return { success: false, error: 'No download URL in response' };
    }

    console.log(`   ✅ Got download URL! File: ${data.filename || 'video.mp4'}`);
    console.log('   📥 Downloading video...');

    // Download the video file
    const videoResponse = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!videoResponse.ok) {
      return { success: false, error: `Video download failed: ${videoResponse.status}` };
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    await fs.writeFile(tempFilePath, videoBuffer);

    console.log(`   ✅ Downloaded: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    return { success: true };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Download YouTube video using RapidAPI #3 (Cloud API Hub)
 * Third backup API - returns direct download URL
 */
async function downloadYouTubeViaRapidAPI3(
  videoId: string,
  tempFilePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const rapidApiKey = process.env.RAPIDAPI_KEY_BACKUP || process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      return { success: false, error: 'No RapidAPI key found in environment' };
    }

    console.log('   🌐 Using RapidAPI #3 (Cloud API Hub)...');

    // API #3: cloud-api-hub-youtube-downloader
    // Returns direct download URL immediately
    const apiUrl = `https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=${videoId}&filter=audioandvideo&quality=lowest`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'cloud-api-hub-youtube-downloader.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return { success: false, error: `RapidAPI #3 error: ${response.status} ${response.statusText} - ${errorText}` };
    }

    const data = await response.json();
    
    // Check if API returned direct URL
    if (!data.url) {
      return { success: false, error: 'No URL in RapidAPI #3 response' };
    }

    console.log('   ✅ Got direct download URL!');
    console.log(`   📦 File size: ${(data.filesize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   🎬 Format: ${data.format_note} (${data.width}x${data.height})`);

    console.log('   📥 Downloading video from direct URL...');

    // Download the video file
    const videoResponse = await fetch(data.url);
    if (!videoResponse.ok) {
      return { success: false, error: `Video download failed: ${videoResponse.status}` };
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    await fs.writeFile(tempFilePath, videoBuffer);

    console.log(`   ✅ Downloaded via RapidAPI #3: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    return { success: true };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Download YouTube video using RapidAPI #2 (Fast Downloader 24/7)
 * Backup API if the primary RapidAPI fails
 */
async function downloadYouTubeViaRapidAPI2(
  videoId: string,
  tempFilePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use backup API key or primary key
    const rapidApiKey = process.env.RAPIDAPI_KEY_BACKUP || process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      return { success: false, error: 'No RapidAPI key found in environment' };
    }

    console.log('   🌐 Using RapidAPI #2 (Fast Downloader 24/7)...');

    // API #2: youtube-video-fast-downloader-24-7
    // Returns file URL that needs to be polled until ready
    const apiUrl = `https://youtube-video-fast-downloader-24-7.p.rapidapi.com/download_video/${videoId}?quality=247`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'youtube-video-fast-downloader-24-7.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return { success: false, error: `RapidAPI #2 error: ${response.status} ${response.statusText} - ${errorText}` };
    }

    const data = await response.json();
    
    // Check if API returned file URL
    if (!data.file) {
      return { success: false, error: 'No file URL in RapidAPI #2 response' };
    }

    console.log('   ⏳ Video is being prepared (20-300 seconds)...');
    console.log('   📝 Comment:', data.comment);

    // Poll the file URL until it's ready (max 5 minutes)
    const downloadUrl = data.file;
    const maxAttempts = 60; // 60 attempts * 5 seconds = 5 minutes
    let videoReady = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      try {
        // Try to fetch the video file
        const videoResponse = await fetch(downloadUrl, { method: 'HEAD' });
        
        if (videoResponse.ok) {
          videoReady = true;
          console.log(`   ✅ Video ready after ${(attempt + 1) * 5} seconds!`);
          break;
        } else if (videoResponse.status === 404) {
          console.log(`   ⏳ Attempt ${attempt + 1}/${maxAttempts}: Still preparing...`);
        } else {
          console.log(`   ⚠️  Unexpected status ${videoResponse.status}`);
        }
      } catch (pollError: any) {
        console.log(`   ⚠️  Poll attempt ${attempt + 1} failed: ${pollError.message}`);
      }
    }

    if (!videoReady) {
      return { success: false, error: 'RapidAPI #2 timeout - video not ready after 5 minutes' };
    }

    console.log('   📥 Downloading video from RapidAPI #2...');

    // Download the video file
    const videoResponse = await fetch(downloadUrl);
    if (!videoResponse.ok) {
      return { success: false, error: `Video download failed: ${videoResponse.status}` };
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    await fs.writeFile(tempFilePath, videoBuffer);

    console.log(`   ✅ Downloaded via RapidAPI #2: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    return { success: true };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Download YouTube video using RapidAPI (bypasses YouTube blocking)
 * More reliable than yt-dlp for YouTube
 */
async function downloadYouTubeViaRapidAPI(
  videoId: string,
  tempFilePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      return { success: false, error: 'RAPIDAPI_KEY not found in environment' };
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log('   🌐 Using RapidAPI for YouTube download (bypasses blocking)...');

    // Call RapidAPI to initiate download - use format=360 for smaller file size
    const apiUrl = new URL('https://youtube-info-download-api.p.rapidapi.com/ajax/download.php');
    apiUrl.searchParams.set('format', '360'); // Use 360p for smaller files
    apiUrl.searchParams.set('url', youtubeUrl);

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'youtube-info-download-api.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return { success: false, error: `RapidAPI error: ${response.status} ${response.statusText} - ${errorText}` };
    }

    const data = await response.json();
    
    // Check if API returned success with progress_url (async download)
    if (data.success && data.progress_url) {
      console.log('   ⏳ Download initiated, polling for completion...');
      
      // Poll progress URL until download is ready (max 60 seconds)
      const maxAttempts = 30;
      let downloadUrl: string | null = null;
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        try {
          const progressResponse = await fetch(data.progress_url);
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            
            console.log(`   📊 Progress: ${progressData.progress || 0}% - ${progressData.text || 'Processing'}`);
            
            if (progressData.success === 1 && progressData.download_url) {
              downloadUrl = progressData.download_url;
              console.log('   ✅ Download ready!');
              break;
            }
            
            // Check for failure
            if (progressData.text && progressData.text.toLowerCase().includes('error')) {
              return { success: false, error: `RapidAPI processing failed: ${progressData.text}` };
            }
          }
        } catch (pollError: any) {
          console.log(`   ⚠️  Poll attempt ${attempt + 1} failed: ${pollError.message}`);
        }
      }
      
      if (!downloadUrl) {
        return { success: false, error: 'RapidAPI download timeout - no URL received after 60 seconds' };
      }
      
      console.log('   📥 Downloading video from RapidAPI URL...');
      
      // Download the video file
      const videoResponse = await fetch(downloadUrl);
      if (!videoResponse.ok) {
        return { success: false, error: `Video download failed: ${videoResponse.status}` };
      }

      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
      await fs.writeFile(tempFilePath, videoBuffer);

      console.log(`   ✅ Downloaded via RapidAPI: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
      return { success: true };
    }
    
    // Fallback: Check for direct download URL in response
    let downloadUrl: string | null = null;
    
    if (data.url) {
      downloadUrl = data.url;
    } else if (data.download_url) {
      downloadUrl = data.download_url;
    } else if (data.formats && Array.isArray(data.formats) && data.formats.length > 0) {
      // Find worst quality format (smallest file)
      const worstFormat = data.formats[data.formats.length - 1];
      downloadUrl = worstFormat.url || worstFormat.download_url;
    }

    if (!downloadUrl) {
      return { success: false, error: `No download URL in RapidAPI response: ${JSON.stringify(data).substring(0, 200)}` };
    }

    console.log('   📥 Downloading video from RapidAPI URL...');

    // Download the video file
    const videoResponse = await fetch(downloadUrl);
    if (!videoResponse.ok) {
      return { success: false, error: `Video download failed: ${videoResponse.status}` };
    }

    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    await fs.writeFile(tempFilePath, videoBuffer);

    console.log(`   ✅ Downloaded via RapidAPI: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    return { success: true };

  } catch (error: any) {
    return { success: false, error: error.message };
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
    
    // Sanitize filename (with fallback for undefined/null seriesName)
    const safeFilename = (seriesName || 'trailer')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50) || 'trailer';

    tempFilePath = path.join(tempDir, `${safeFilename}-${videoId.replace(/[^a-z0-9]/g, '-')}.mp4`);
    
    // Determine video URL based on source
    let videoUrl: string;
    let source: string;
    
    if (videoId.startsWith('netflix:')) {
      const netflixId = videoId.replace('netflix:', '');
      videoUrl = `https://www.netflix.com/title/${netflixId}`;
      source = 'Netflix';
    } else if (videoId.startsWith('filmstarts:')) {
      const filmstartsUrl = videoId.replace('filmstarts:', '');
      videoUrl = filmstartsUrl; // Full URL for FilmStarts
      source = 'FilmStarts';
    } else if (videoId.startsWith('videobuster:')) {
      const videobusterUrl = videoId.replace('videobuster:', '');
      videoUrl = videobusterUrl; // Full URL for VideoBuster
      source = 'VideoBuster';
    } else if (videoId.startsWith('vimeo:')) {
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

    // Special handling for YouTube: Use RapidAPI #1 as primary (most reliable!)
    if (source === 'YouTube') {
      console.log('   🚀 Attempting YouTube download via RapidAPI #1...');
      
      // RapidAPI #1 is the most reliable - works even for geo-blocked videos
      const rapidResult = await downloadYouTubeViaRapidAPI(videoId, tempFilePath);
      
      if (rapidResult.success) {
        console.log('   ✅ RapidAPI #1 download successful!');
      } else {
        console.log(`   ⚠️ RapidAPI #1 failed: ${rapidResult.error}`);
        console.log('   🔄 Trying RapidAPI #3 (Cloud API Hub) as fallback...');
        
        const rapid3Result = await downloadYouTubeViaRapidAPI3(videoId, tempFilePath);
        
        if (rapid3Result.success) {
          console.log('   ✅ RapidAPI #3 fallback successful!');
        } else {
          console.log(`   ⚠️ RapidAPI #3 failed: ${rapid3Result.error}`);
          console.log('   🔄 Trying RapidAPI #2 as last fallback...');
          
          const rapid2Result = await downloadYouTubeViaRapidAPI2(videoId, tempFilePath);
          
          if (!rapid2Result.success) {
            throw new Error(`All RapidAPI methods failed. Last error: ${rapid2Result.error}`);
          }
          console.log('   ✅ RapidAPI #2 fallback successful!');
        }
      }
      
      console.log('   ⏭️ Skipping ffmpeg re-encoding (serverless mode)');
    } else {
      // For non-YouTube sources, use yt-dlp directly
      const ytdlpResult = await downloadViaYtDlp(videoUrl, tempFilePath, source);
      if (!ytdlpResult.success) {
        throw new Error(ytdlpResult.error || 'Download failed');
      }
    }

    // Verify file was downloaded
    try {
      const stats = await fs.stat(tempFilePath);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      console.log(`✅ Video file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (error: any) {
      throw new Error(`Downloaded file verification failed: ${error.message}`);
    }

    // Read file into buffer for upload
    const videoBuffer = await fs.readFile(tempFilePath);
    console.log(`📦 File size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

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
