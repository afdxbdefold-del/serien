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
  cropPercent?: number; // Default: 0% - Editorial look needs no crop
  quality?: number; // Default: 90
  addGradient?: boolean; // Default: true - Subtle bottom gradient
  gradientHeight?: number; // Default: 15% - Subtle fade
  gradientOpacity?: number; // Default: 0.15 (15%) - Very subtle
}

/**
 * Process image to make it unique for Google Discover
 * EDITORIAL STYLE - NOT clickbait or social media
 * 
 * - Optional subtle crop
 * - Subtle black gradient (10-15% opacity) at bottom
 * - No text, no brand colors, no filters
 * - Maintains natural look
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
      cropPercent = 0, // EDITORIAL: No crop by default
      quality = 90,
      addGradient = true,
      gradientHeight = 15, // EDITORIAL: 15% subtle fade
      gradientOpacity = 0.15, // EDITORIAL: 15% opacity (10-20% range)
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

    // Generate unique filename with WebP extension
    const uniqueId = randomBytes(4).toString('hex');
    const timestamp = Date.now();
    const filename = `${articleSlug}-${timestamp}-${uniqueId}.webp`;
    const originalFilename = `${articleSlug}-${timestamp}-${uniqueId}-original.webp`;

    const processedPath = path.join(outputDir, filename);
    const originalPath = path.join(outputDir, originalFilename);

    // Save original as backup
    fs.writeFileSync(originalPath, imageBuffer);
    console.log(`[Image Processor] Original saved: ${originalPath}`);

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

    // Calculate crop dimensions if crop is requested
    let finalWidth = width;
    let finalHeight = height;
    let cropLeft = 0;
    let cropTop = 0;
    
    if (cropPercent > 0) {
      const cropAmount = Math.floor(Math.min(width, height) * (cropPercent / 100));
      cropLeft = cropAmount;
      cropTop = cropAmount;
      finalWidth = width - (cropAmount * 2);
      finalHeight = height - (cropAmount * 2);
    }

    console.log(`[Image Processor] Transforming:`);
    console.log(`  Original: ${width}x${height}`);
    if (cropPercent > 0) {
      console.log(`  Crop: ${cropLeft}px from each edge`);
    }
    console.log(`  Final: ${finalWidth}x${finalHeight}`);
    console.log(`  Gradient: ${addGradient ? `Yes (${gradientHeight}% height, ${Math.round(gradientOpacity * 100)}% opacity)` : 'No'}`);
    console.log(`  Style: Editorial (subtle, no clickbait)`);

    // Create gradient overlay buffer if requested
    let gradientBuffer: Buffer | undefined;
    
    if (addGradient) {
      // EDITORIAL GRADIENT: Subtle black fade at bottom
      // - Black color (#000000)
      // - Low opacity (10-20%)
      // - Small height (15-20%)
      // - Soft transition
      
      const gradientSvg = `
        <svg width="${finalWidth}" height="${finalHeight}">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
              <stop offset="${100 - gradientHeight}%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
              <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:${gradientOpacity}" />
            </linearGradient>
          </defs>
          <rect width="${finalWidth}" height="${finalHeight}" fill="url(#grad)" />
        </svg>
      `;
      
      gradientBuffer = Buffer.from(gradientSvg);
    }

    // Process image
    let processedImage = sharp(imageBuffer);
    
    // Apply crop if requested
    if (cropPercent > 0) {
      processedImage = processedImage.extract({
        left: cropLeft,
        top: cropTop,
        width: finalWidth,
        height: finalHeight,
      });
    }
    
    // Resize to ensure consistency
    processedImage = processedImage.resize(finalWidth, finalHeight, {
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

    // Save with metadata as WebP
    await processedImage
      .webp({
        quality,
        effort: 6, // 0-6, higher = better compression but slower
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
