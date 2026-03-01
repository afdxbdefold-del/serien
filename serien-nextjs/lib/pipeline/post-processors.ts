/**
 * Post-Processing Module
 * Handles all post-publication processing: actors, characters, images
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

export interface PostProcessingConfig {
  articleId: string;
  articleContent: string;
  seriesName: string;
  seriesTmdbId: number;
  articleCountForRotation: number;
  useProcessedImages: boolean;
}

/**
 * Process actor extraction and linking
 */
export async function processActors(
  articleId: string,
  articleContent: string,
  seriesName: string
): Promise<number> {
  try {
    const { processArticleActors } = await import('../actor-extraction.js');
    
    const linkedActorsCount = await processArticleActors(
      articleId,
      articleContent,
      seriesName
    );
    
    if (linkedActorsCount > 0) {
      console.log(`✅ ${linkedActorsCount} actors linked to article`);
    } else {
      console.log('⚠️  No actors linked (extraction or TMDB match failed)');
    }
    
    return linkedActorsCount;
  } catch (error: any) {
    console.log(`⚠️  Actor extraction skipped: ${error.message}`);
    return 0;
  }
}

/**
 * Apply auto-linking for actors in content
 */
export async function applyActorAutoLinking(
  articleId: string
): Promise<boolean> {
  try {
    const { applyAutoLinking } = await import('../actor-auto-linking.js');
    
    const linked = await applyAutoLinking(articleId);
    
    if (linked) {
      console.log(`✅ Actor names auto-linked in article content`);
    } else {
      console.log(`⚠️  No actors available for auto-linking`);
    }
    
    return linked;
  } catch (error: any) {
    console.log(`⚠️  Actor linking skipped: ${error.message}`);
    return false;
  }
}

/**
 * Import characters and apply character linking
 */
export async function processCharacters(
  prisma: PrismaClient,
  articleId: string,
  seriesTmdbId: number
): Promise<boolean> {
  try {
    // Check if characters exist
    const existingCharacters = await prisma.characters.count({
      where: {
        seriesTmdbId,
        publishStatus: 'published',
      },
    });
    
    if (existingCharacters === 0) {
      console.log('📚 No characters found for this series, importing automatically...');
      
      try {
        execSync(
          `cd /app/serien-nextjs && npx tsx scripts/import-characters.ts ${seriesTmdbId}`,
          { stdio: 'inherit', timeout: 120000 }
        );
        console.log('✅ Characters imported successfully');
      } catch (importError: any) {
        console.log('⚠️  Character import failed:', importError.message);
        return false;
      }
    } else {
      console.log(`✅ Characters already exist (${existingCharacters} characters)`);
    }
    
    // Apply character linking
    console.log('🔗 Applying character links to current article...');
    
    const { linkCharactersInArticle } = await import('../character-linking');
    const currentArticleContent = await prisma.articles.findUnique({
      where: { id: articleId },
      select: { contentHtml: true }
    });
    
    if (currentArticleContent?.contentHtml) {
      const linkedContent = await linkCharactersInArticle(
        currentArticleContent.contentHtml,
        seriesTmdbId
      );
      
      await prisma.articles.update({
        where: { id: articleId },
        data: { contentHtml: linkedContent }
      });
      
      console.log('✅ Character links applied to current article');
      return true;
    }
    
    return false;
  } catch (error: any) {
    console.error('⚠️  Character processing failed:', error.message);
    return false;
  }
}

/**
 * Process image for uniqueness (optional, based on env)
 */
export async function processImage(
  prisma: PrismaClient,
  articleId: string,
  seriesTmdbId: number,
  articleCountForRotation: number,
  articleTitle: string,
  articleSlug: string
): Promise<boolean> {
  try {
    // Get series with backdrops
    const seriesWithBackdrop = await prisma.series.findUnique({
      where: { tmdbId: seriesTmdbId },
      select: { 
        name: true, 
        title: true,
        backdrops: true 
      }
    });
    
    if (seriesWithBackdrop?.backdrops && seriesWithBackdrop.backdrops.length > 0) {
      const backdropIndex = articleCountForRotation % seriesWithBackdrop.backdrops.length;
      const backdropPath = seriesWithBackdrop.backdrops[backdropIndex];
      
      console.log(`   Using backdrop ${backdropIndex + 1}/${seriesWithBackdrop.backdrops.length}: ${backdropPath}`);
      
      const { processImageForUniqueness } = await import('../image-processor');
      const path = await import('path');
      
      const sourceUrl = `https://image.tmdb.org/t/p/original${backdropPath}`;
      const outputDir = path.join(process.cwd(), 'public', 'img', 'processed');
      
      // Gradient variations for uniqueness
      const gradientVariations = [
        { height: 13, opacity: 0.12 },
        { height: 15, opacity: 0.15 },
        { height: 17, opacity: 0.18 },
      ];
      
      const variantIndex = articleCountForRotation % 3;
      const gradient = gradientVariations[variantIndex];
      
      console.log(`   Using gradient variant ${variantIndex + 1}/3: ${Math.round(gradient.opacity * 100)}% opacity, ${gradient.height}% height`);
      
      const processResult = await processImageForUniqueness(sourceUrl, outputDir, {
        articleTitle,
        articleSlug,
        seriesName: seriesWithBackdrop.name || seriesWithBackdrop.title || 'Series',
        cropPercent: 0,
        quality: 90,
        addGradient: true,
        gradientHeight: gradient.height,
        gradientOpacity: gradient.opacity,
      });
      
      if (processResult.success) {
        const processedUrl = `/img/processed/${path.basename(processResult.processedPath!)}`;
        
        await prisma.articles.update({
          where: { id: articleId },
          data: { heroImagePath: processedUrl },
        });
        
        console.log(`✅ Processed image saved: ${processedUrl}`);
        return true;
      } else {
        console.log(`⚠️  Image processing failed: ${processResult.error}`);
        return false;
      }
    } else {
      console.log('⚠️  No backdrop available for processing');
      return false;
    }
  } catch (error: any) {
    console.log(`⚠️  Image processing skipped: ${error.message}`);
    return false;
  }
}

/**
 * Import cast members for the series
 */
export async function importCast(seriesTmdbId: number): Promise<number> {
  try {
    const { importSeriesCast } = await import('../cast-importer');
    const importedCount = await importSeriesCast(seriesTmdbId);
    
    if (importedCount > 0) {
      console.log(`✅ Cast import completed: ${importedCount} new persons added`);
    } else {
      console.log(`ℹ️  Cast import completed: All cast members already exist`);
    }
    
    return importedCount;
  } catch (error: any) {
    console.log(`⚠️  Cast import skipped: ${error.message}`);
    console.log('   → Article published successfully despite cast import failure');
    return 0;
  }
}

/**
 * Run all post-processing steps
 */
export async function runPostProcessing(
  prisma: PrismaClient,
  config: PostProcessingConfig
): Promise<void> {
  console.log('\n' + '━'.repeat(70));
  console.log('POST-PROCESSING');
  console.log('━'.repeat(70));

  // Step 1: Actor Extraction
  console.log('\n📌 Step 1: Actor Extraction & Linking');
  const linkedActorsCount = await processActors(
    config.articleId,
    config.articleContent,
    config.seriesName
  );

  // Step 2: Actor Auto-linking
  if (linkedActorsCount > 0) {
    console.log('\n📌 Step 2: Actor Auto-Linking');
    await applyActorAutoLinking(config.articleId);
  }

  // Step 3: Character Import & Linking
  console.log('\n📌 Step 3: Character Import & Linking');
  await processCharacters(
    prisma,
    config.articleId,
    config.seriesTmdbId
  );

  // Step 4: Image Processing (optional)
  if (config.useProcessedImages) {
    console.log('\n📌 Step 4: Image Processing');
    await processImage(
      prisma,
      config.articleId,
      config.seriesTmdbId,
      config.articleCountForRotation,
      '', // articleTitle - can be passed if needed
      ''  // articleSlug - can be passed if needed
    );
  } else {
    console.log('\n⊘ Image processing disabled (USE_PROCESSED_IMAGES=false)');
  }

  // Step 5: Cast Import
  console.log('\n📌 Step 5: Cast Import');
  await importCast(config.seriesTmdbId);

  console.log('\n✅ Post-processing completed');
}
