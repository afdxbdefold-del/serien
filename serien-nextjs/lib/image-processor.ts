/**
 * Image Processor
 * Makes TMDB images unique for Google with minimal transformations
 * Option C: Crop + Resize + Metadata
 */

import sharp from 'sharp';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface ProcessedImageResult {
  success: boolean;
  processedPath?: string;
  originalPath?: string;
  error?: string;
}

interface ImageProcessingOptions {
  articleTitle?: string;
  articleSlug?: string;
  seriesName?: string;
  cropPercent?: number; // Default: 5%
  quality?: number; // Default: 90
  addGradient?: boolean; // Default: true - Add bottom gradient overlay
  gradientHeight?: number; // Default: 30% - Height of gradient from bottom
}

/**
 * Process image to make it unique for Google
 * - Crops 5% from edges
 * - Adds gradient overlay (bottom fade to dark)
 * - Slight resize
 * - Unique filename
 * - Custom metadata
 */
export async function processImageForUniqueness(
  sourceUrl: string,
  outputDir: string,
  options: ImageProcessingOptions = {}
): Promise<ProcessedImageResult> {
  try {
    const {
      articleTitle = 'Article',
      articleSlug = 'article',
      seriesName = 'Series',
      cropPercent = 5,
      quality = 90,
      addGradient = true,
      gradientHeight = 30, // 30% of image height
    } = options;

    // Create output directory if not exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Download original image
    console.log(`[Image Processor] Downloading from: ${sourceUrl}`);
    const response = await fetch(sourceUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Generate unique filename
    const uniqueId = randomBytes(4).toString('hex');
    const timestamp = Date.now();
    const filename = `${articleSlug}-${timestamp}-${uniqueId}.jpg`;
    const originalFilename = `${articleSlug}-${timestamp}-${uniqueId}-original.jpg`;

    const processedPath = path.join(outputDir, filename);
    const originalPath = path.join(outputDir, originalFilename);

    // Save original as backup
    fs.writeFileSync(originalPath, imageBuffer);
    console.log(`[Image Processor] Original saved: ${originalPath}`);

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

    // Calculate crop dimensions (remove 5% from each edge = 10% total)
    const cropAmount = Math.floor(Math.min(width, height) * (cropPercent / 100));
    const newWidth = width - (cropAmount * 2);
    const newHeight = height - (cropAmount * 2);

    console.log(`[Image Processor] Transforming:`);
    console.log(`  Original: ${width}x${height}`);
    console.log(`  Crop: ${cropAmount}px from each edge`);
    console.log(`  New: ${newWidth}x${newHeight}`);
    console.log(`  Gradient: ${addGradient ? `Yes (${gradientHeight}% from bottom)` : 'No'}`);

    // Create gradient overlay buffer if requested
    let gradientBuffer: Buffer | undefined;
    
    if (addGradient) {
      const gradientHeightPx = Math.floor(newHeight * (gradientHeight / 100));
      
      // Create SVG gradient (fade from transparent to semi-transparent black)
      const gradientSvg = `
        <svg width="${newWidth}" height="${newHeight}">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
              <stop offset="${100 - gradientHeight}%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
              <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.6" />
            </linearGradient>
          </defs>
          <rect width="${newWidth}" height="${newHeight}" fill="url(#grad)" />
        </svg>
      `;
      
      gradientBuffer = Buffer.from(gradientSvg);
    }

    // Process image with cropping
    let processedImage = sharp(imageBuffer)
      .extract({
        left: cropAmount,
        top: cropAmount,
        width: newWidth,
        height: newHeight,
      })
      .resize(newWidth, newHeight, {
        fit: 'cover',
        position: 'center',
      });

    // Add gradient overlay if requested
    if (addGradient && gradientBuffer) {
      processedImage = processedImage.composite([
        {
          input: gradientBuffer,
          blend: 'over',
        },
      ]);
    }

    // Save with metadata
    await processedImage
      .jpeg({
        quality,
        mozjpeg: true, // Better compression
      })
      .withMetadata({
        exif: {
          IFD0: {
            ImageDescription: `${articleTitle} - ${seriesName}`,
            Copyright: 'TMDB / Editorial Use',
            Software: 'Custom Image Processor',
          },
        },
      })
      .toFile(processedPath);

    console.log(`[Image Processor] ✅ Processed: ${processedPath}`);

    return {
      success: true,
      processedPath,
      originalPath,
    };
  } catch (error: any) {
    console.error(`[Image Processor] ❌ Error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if processed images should be used (based on env var)
 */
export function shouldUseProcessedImages(): boolean {
  return process.env.USE_PROCESSED_IMAGES === 'true';
}

/**
 * Get processed image path or fallback to original
 */
export function getImagePath(
  processedPath: string | null,
  originalPath: string
): string {
  if (shouldUseProcessedImages() && processedPath && fs.existsSync(processedPath)) {
    return processedPath;
  }
  return originalPath;
}

/**
 * Restore original image (rollback processed image)
 */
export async function restoreOriginalImage(
  processedPath: string
): Promise<boolean> {
  try {
    const dir = path.dirname(processedPath);
    const filename = path.basename(processedPath);
    const originalFilename = filename.replace(/\.jpg$/, '-original.jpg');
    const originalPath = path.join(dir, originalFilename);

    if (!fs.existsSync(originalPath)) {
      console.error(`[Image Processor] Original not found: ${originalPath}`);
      return false;
    }

    // Copy original over processed
    fs.copyFileSync(originalPath, processedPath);
    console.log(`[Image Processor] ✅ Restored: ${processedPath}`);

    return true;
  } catch (error: any) {
    console.error(`[Image Processor] ❌ Restore failed:`, error.message);
    return false;
  }
}
