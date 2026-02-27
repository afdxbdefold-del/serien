/**
 * Re-encode existing trailer with correct settings
 * Fixes the moov atom position for web streaming
 */

import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";
let storageKey: string | null = null;

async function initStorage(): Promise<string> {
  if (storageKey) {
    return storageKey;
  }

  const emergentKey = process.env.EMERGENT_LLM_KEY;
  if (!emergentKey) {
    throw new Error('EMERGENT_LLM_KEY not found');
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
  return storageKey;
}

async function downloadFromStorage(storagePath: string): Promise<Buffer> {
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

async function reencodeVideo(storagePath: string): Promise<void> {
  console.log(`\n🎬 Re-encoding: ${storagePath}`);
  
  // Download original
  console.log('📥 Downloading from storage...');
  const videoBuffer = await downloadFromStorage(storagePath);
  console.log(`   Size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  
  // Save to temp file
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reencode-'));
  const inputPath = path.join(tempDir, 'original.mp4');
  const outputPath = path.join(tempDir, 'reencoded.mp4');
  
  await fs.writeFile(inputPath, videoBuffer);
  console.log('💾 Saved to temp file');
  
  // Analyze original with ffprobe
  console.log('\n🔍 Analyzing original video:');
  try {
    const { stdout } = await execAsync(`ffprobe -v error -show_format -show_streams -print_format json "${inputPath}"`);
    const probeData = JSON.parse(stdout);
    
    const videoStream = probeData.streams.find((s: any) => s.codec_type === 'video');
    const audioStream = probeData.streams.find((s: any) => s.codec_type === 'audio');
    
    console.log('   Video:', {
      codec: videoStream?.codec_name,
      profile: videoStream?.profile,
      level: videoStream?.level,
      pix_fmt: videoStream?.pix_fmt,
      width: videoStream?.width,
      height: videoStream?.height,
    });
    console.log('   Audio:', {
      codec: audioStream?.codec_name,
      sample_rate: audioStream?.sample_rate,
    });
    
    // Check moov atom position
    const { stdout: atomOutput } = await execAsync(`ffprobe -v error -show_entries format=start_time -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`);
    console.log('   Moov atom check:', atomOutput.trim() === '0.000000' ? '✅ At start' : '⚠️ Not at start');
  } catch (error: any) {
    console.log('   ⚠️ Analysis failed:', error.message);
  }
  
  // Re-encode with correct settings
  console.log('\n🔄 Re-encoding with web-optimized settings...');
  console.log('   Profile: H.264 Constrained Baseline');
  console.log('   Level: 3.0');
  console.log('   Pixel Format: yuv420p');
  console.log('   Audio: AAC 128k');
  console.log('   Flags: +faststart (moov at beginning)');
  
  try {
    await execAsync(
      `ffmpeg -i "${inputPath}" ` +
      `-c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p ` +
      `-c:a aac -b:a 128k ` +
      `-movflags +faststart ` +
      `-preset fast ` +
      `-y "${outputPath}"`,
      { timeout: 180000 }
    );
    
    console.log('✅ Re-encoding complete');
    
    // Analyze new video
    console.log('\n🔍 Analyzing re-encoded video:');
    try {
      const { stdout } = await execAsync(`ffprobe -v error -show_format -show_streams -print_format json "${outputPath}"`);
      const probeData = JSON.parse(stdout);
      
      const videoStream = probeData.streams.find((s: any) => s.codec_type === 'video');
      const audioStream = probeData.streams.find((s: any) => s.codec_type === 'audio');
      
      console.log('   Video:', {
        codec: videoStream?.codec_name,
        profile: videoStream?.profile,
        level: videoStream?.level,
        pix_fmt: videoStream?.pix_fmt,
        width: videoStream?.width,
        height: videoStream?.height,
      });
      console.log('   Audio:', {
        codec: audioStream?.codec_name,
        sample_rate: audioStream?.sample_rate,
      });
    } catch (error: any) {
      console.log('   ⚠️ Analysis failed:', error.message);
    }
    
    // Upload back to storage
    const reencodedBuffer = await fs.readFile(outputPath);
    console.log(`\n☁️  Uploading re-encoded video (${(reencodedBuffer.length / 1024 / 1024).toFixed(2)} MB)...`);
    
    await uploadToStorage(storagePath, reencodedBuffer, 'video/mp4');
    console.log('✅ Upload complete');
    
  } catch (error: any) {
    console.error('❌ Re-encoding failed:', error.message);
    throw error;
  } finally {
    // Cleanup
    try {
      await fs.unlink(inputPath);
      await fs.unlink(outputPath);
      await fs.rmdir(tempDir);
    } catch {}
  }
}

async function main() {
  try {
    // Find articles with trailers
    const articles = await prisma.article.findMany({
      where: {
        trailerLocalUrl: { not: null }
      },
      select: {
        id: true,
        title: true,
        slug: true,
        trailerLocalUrl: true,
      },
      take: 5, // Process first 5
    });
    
    if (articles.length === 0) {
      console.log('❌ No articles with trailers found');
      process.exit(0);
    }
    
    console.log(`\n📊 Found ${articles.length} articles with trailers\n`);
    
    for (const article of articles) {
      if (!article.trailerLocalUrl) continue;
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📰 ${article.title}`);
      console.log(`   Slug: ${article.slug}`);
      console.log(`   Storage Path: ${article.trailerLocalUrl}`);
      
      try {
        await reencodeVideo(article.trailerLocalUrl);
        console.log(`\n✅ Successfully re-encoded trailer for: ${article.title}`);
      } catch (error: any) {
        console.error(`\n❌ Failed to re-encode: ${error.message}`);
      }
    }
    
    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ Re-encoding complete for all videos');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
