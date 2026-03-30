/**
 * Cloudflare R2 Storage Uploader
 * For uploading trailers to R2 (S3-compatible)
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import 'dotenv/config';

// R2 Configuration from environment
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'serien-trailer';
const R2_ENDPOINT = process.env.R2_ENDPOINT!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

// Initialize S3 client for R2
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
      throw new Error('R2 credentials not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT in .env');
    }
    
    s3Client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

/**
 * Upload a file buffer to R2
 */
export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string = 'video/mp4'
): Promise<{ success: boolean; url: string; error?: string }> {
  try {
    const client = getS3Client();
    
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    
    // Return public URL
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    
    return { success: true, url: publicUrl };
  } catch (error: any) {
    console.error('R2 upload error:', error.message);
    return { success: false, url: '', error: error.message };
  }
}

/**
 * Check if a file exists in R2
 */
export async function existsInR2(key: string): Promise<boolean> {
  try {
    const client = getS3Client();
    await client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  try {
    const client = getS3Client();
    await client.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));
    return true;
  } catch (error: any) {
    console.error('R2 delete error:', error.message);
    return false;
  }
}

/**
 * Upload a trailer video to R2
 */
export async function uploadTrailerToR2(
  seriesSlug: string,
  videoBuffer: Buffer
): Promise<{ success: boolean; url: string; key: string; error?: string }> {
  const key = `trailers/${seriesSlug}.mp4`;
  
  const result = await uploadToR2(key, videoBuffer, 'video/mp4');
  
  return {
    ...result,
    key,
  };
}

/**
 * Get the public URL for a trailer
 */
export function getTrailerR2Url(seriesSlug: string): string {
  return `${R2_PUBLIC_URL}/trailers/${seriesSlug}.mp4`;
}

/**
 * Check if R2 is properly configured
 */
export function isR2Configured(): boolean {
  return !!(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ENDPOINT);
}
