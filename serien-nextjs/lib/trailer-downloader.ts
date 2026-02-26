/**
 * YouTube Trailer Downloader
 * 
 * WARNUNG: Das Herunterladen von YouTube-Videos verstößt gegen YouTube TOS!
 * Nur auf eigene Verantwortung nutzen.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface TrailerDownloadResult {
  success: boolean;
  localPath?: string;
  error?: string;
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
 * Download YouTube video using yt-dlp
 */
export async function downloadYouTubeTrailer(
  youtubeId: string,
  seriesName: string
): Promise<TrailerDownloadResult> {
  try {
    // Create videos directory if it doesn't exist
    const videosDir = path.join(process.cwd(), 'public', 'videos', 'trailers');
    await fs.mkdir(videosDir, { recursive: true });

    // Sanitize filename
    const safeFilename = seriesName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);

    const outputPath = path.join(videosDir, `${safeFilename}-${youtubeId}`);
    const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;

    console.log(`🎬 Downloading trailer: ${youtubeUrl}`);
    console.log(`   Output: ${outputPath}`);

    // yt-dlp command with LOW QUALITY settings (360p max, 480p fallback)
    const command = [
      'yt-dlp',
      // Format priority: 360p → 480p → best available
      '--format', '(bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4])/(bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4])/best',
      '--merge-output-format', 'mp4',
      '--output', `${outputPath}.mp4`,
      '--no-playlist',
      '--max-filesize', '30M',  // Reduced: 360p should be ~10-20MB
      '--socket-timeout', '30',
      youtubeUrl
    ].join(' ');

    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000 // 2 minutes timeout
    });

    console.log('✅ Download complete');
    if (stderr) console.log('stderr:', stderr);

    // Verify file exists
    const finalPath = `${outputPath}.mp4`;
    await fs.access(finalPath);

    // Return relative public path
    const publicPath = `/videos/trailers/${safeFilename}-${youtubeId}.mp4`;
    
    return {
      success: true,
      localPath: publicPath
    };

  } catch (error: any) {
    console.error('❌ Trailer download failed:', error.message);
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
 * Clean up old trailer files (optional maintenance function)
 */
export async function cleanupOldTrailers(daysOld: number = 30): Promise<number> {
  try {
    const videosDir = path.join(process.cwd(), 'public', 'videos', 'trailers');
    const files = await fs.readdir(videosDir);
    
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(videosDir, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    console.log(`🧹 Cleaned up ${deletedCount} old trailers`);
    return deletedCount;
  } catch (error: any) {
    console.error('Cleanup failed:', error.message);
    return 0;
  }
}
