/**
 * Post-Processing Module (Simplified)
 * Handles all post-publication processing: actors, characters, images, Q&A
 * 
 * This is a refactored version that consolidates Steps 8.5, 8.6, 10, 11, 11.5, 11.6, 12
 * from the original pipeline into a single, maintainable module.
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

export interface PostProcessingConfig {
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  articleContent: string;
  seriesName: string;
  seriesTmdbId: number;
}

export interface PostProcessingResult {
  actorsExtracted: number;
  actorsLinked: boolean;
  charactersProcessed: boolean;
  imageProcessed: boolean;
  castImported: number;
  qaGenerated: boolean;
}

/**
 * STEP 8.5: Actor Extraction & TMDB Linking
 */
async function extractAndLinkActors(
  articleId: string,
  articleContent: string,
  seriesName: string
): Promise<number> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 8.5: ACTOR EXTRACTION & TMDB LINKING');
  console.log('━'.repeat(70));
  
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
 * STEP 8.6: Auto-Linking Actors in Content
 */
async function autoLinkActors(articleId: string): Promise<boolean> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 8.6: AUTO-LINKING ACTORS IN CONTENT');
  console.log('━'.repeat(70));
  
  try {
    const { applyAutoLinking } = await import('../actor-auto-linking.js');
    
    const linked = await applyAutoLinking(articleId);
    
    if (linked) {
      console.log('✅ Auto-linking complete');
    } else {
      console.log('⚠️  No changes made (no matches found)');
    }
    
    return linked;
  } catch (error: any) {
    console.log(`⚠️  Auto-linking skipped: ${error.message}`);
    return false;
  }
}

/**
 * STEP 10: Generate Q&A
 */
async function generateQA(
  prisma: PrismaClient,
  articleId: string,
  articleTitle: string,
  articleContent: string,
  seriesName: string
): Promise<boolean> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 10: GENERATE Q&A');
  console.log('━'.repeat(70));
  
  try {
    console.log('🤔 Generating Q&A for article...');
    
    const { generateArticleQA } = await import('../qa-generator');
    const qaItems = await generateArticleQA({
      title: articleTitle,
      contentHtml: articleContent,
      seriesName
    });

    if (qaItems && qaItems.length > 0) {
      console.log(`✅ Q&A generated: ${qaItems.length} questions`);
      
      await prisma.article_qa.create({
        data: {
          id: `${articleId}-qa`,
          articleId,
          questions: qaItems,
          schemaEnabled: true,
          generatedAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log(`   ✅ Q&A saved to database`);
      return true;
    } else {
      console.log('⚠️  No Q&A generated (LLM returned empty)');
      return false;
    }
  } catch (error: any) {
    console.log(`⚠️  Q&A generation skipped: ${error.message}`);
    return false;
  }
}

/**
 * STEP 11: Link Actors to Articles (Alternative method)
 */
async function linkActorsAlternative(
  prisma: PrismaClient,
  articleId: string
): Promise<boolean> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 11: ACTOR LINKING');
  console.log('━'.repeat(70));
  
  try {
    console.log('🎭 Linking actors to article...');
    
    const { processArticle } = await import('../../scripts/link-actors-to-articles');
    
    const articleForLinking = await prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        title: true,
        slug: true,
        contentHtml: true
      }
    });
    
    if (articleForLinking) {
      await processArticle(articleForLinking, false);
      console.log('✅ Actor linking completed');
      return true;
    } else {
      console.log('⚠️  Article not found for actor linking');
      return false;
    }
  } catch (error: any) {
    console.log(`⚠️  Actor linking skipped: ${error.message}`);
    console.log('   → Article published successfully despite actor linking failure');
    return false;
  }
}

/**
 * STEP 11.5: Auto Character Import & Linking
 */
async function processCharacters(
  prisma: PrismaClient,
  articleId: string,
  seriesTmdbId: number
): Promise<boolean> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 11.5: AUTO CHARACTER IMPORT');
  console.log('━'.repeat(70));
  console.log('');
  
  try {
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
        console.log('   Will skip linking for now (no characters available)...');
        return false;
      }
    } else {
      console.log(`✅ Characters already exist (${existingCharacters} characters)`);
    }
    
    // CRITICAL: Always try to apply character linking, even if import failed but characters exist
    console.log('🔗 Applying character links to current article...');
    
    const { linkCharactersInArticle } = await import('../character-linking');
    const currentArticleContent = await prisma.article.findUnique({
      where: { id: articleId },
      select: { contentHtml: true }
    });
    
    if (!currentArticleContent?.contentHtml) {
      console.log('⚠️  Article content not found, skipping linking');
      return false;
    }
    
    try {
      const linkedContent = await linkCharactersInArticle(
        currentArticleContent.contentHtml,
        seriesTmdbId
      );
      
      await prisma.article.update({
        where: { id: articleId },
        data: { contentHtml: linkedContent }
      });
      
      console.log('✅ Character links applied to current article');
      console.log(`   Article ID: ${articleId}`);
      return true;
    } catch (linkError: any) {
      console.error('❌ Character linking FAILED:', linkError.message);
      console.error('   This is CRITICAL - article has no internal links!');
      throw linkError; // Re-throw to make it visible
    }
  } catch (error: any) {
    console.error('❌ Character processing FAILED:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

/**
 * STEP 11.6: Image Processing for Uniqueness (Optional)
 */
async function processImageForUniqueness(
  prisma: PrismaClient,
  articleId: string,
  articleSlug: string,
  articleTitle: string,
  seriesTmdbId: number
): Promise<boolean> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 11.6: IMAGE PROCESSING');
  console.log('━'.repeat(70));
  console.log('');
  
  if (process.env.USE_PROCESSED_IMAGES !== 'true') {
    console.log('⊘ Image processing disabled (USE_PROCESSED_IMAGES=false)');
    return false;
  }
  
  try {
    console.log('🖼️  Processing article image for uniqueness...');
    
    const seriesWithBackdrop = await prisma.series.findUnique({
      where: { tmdbId: seriesTmdbId },
      select: { 
        backdrops: true, 
        backdropPath: true,
        name: true,
        title: true
      }
    });
    
    let backdropPath = seriesWithBackdrop?.backdropPath;
    
    if (seriesWithBackdrop?.backdrops && Array.isArray(seriesWithBackdrop.backdrops) && seriesWithBackdrop.backdrops.length > 0) {
      const { selectBackdropForArticle } = await import('../tmdb-backdrops');
      const articleCount = await prisma.article.count({
        where: { primarySeriesId: seriesTmdbId }
      });
      backdropPath = selectBackdropForArticle(seriesWithBackdrop.backdrops as any[], articleCount - 1);
    }
    
    if (backdropPath) {
      const { processImageForUniqueness: processImage } = await import('../image-processor');
      const path = await import('path');
      
      const sourceUrl = `https://image.tmdb.org/t/p/original${backdropPath}`;
      const outputDir = path.join(process.cwd(), 'public', 'img', 'processed');
      
      const articleCountForRotation = await prisma.article.count({
        where: { primarySeriesId: seriesTmdbId }
      });
      
      const gradientVariations = [
        { height: 13, opacity: 0.12 },
        { height: 15, opacity: 0.15 },
        { height: 17, opacity: 0.18 },
      ];
      
      const variantIndex = articleCountForRotation % 3;
      const gradient = gradientVariations[variantIndex];
      
      console.log(`   Using gradient variant ${variantIndex + 1}/3: ${Math.round(gradient.opacity * 100)}% opacity, ${gradient.height}% height`);
      
      const processResult = await processImage(sourceUrl, outputDir, {
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
        
        await prisma.article.update({
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
 * STEP 12: Cast Import
 */
async function importCast(seriesTmdbId: number): Promise<number> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 12: CAST IMPORT');
  console.log('━'.repeat(70));
  
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
 * Main Post-Processing Orchestrator
 * Runs all post-processing steps in sequence
 */
export async function runPostProcessing(
  prisma: PrismaClient,
  config: PostProcessingConfig
): Promise<PostProcessingResult> {
  console.log('\n' + '='.repeat(70));
  console.log('🔄 POST-PROCESSING');
  console.log('='.repeat(70));

  const result: PostProcessingResult = {
    actorsExtracted: 0,
    actorsLinked: false,
    charactersProcessed: false,
    imageProcessed: false,
    castImported: 0,
    qaGenerated: false
  };

  // Step 8.5: Actor Extraction
  result.actorsExtracted = await extractAndLinkActors(
    config.articleId,
    config.articleContent,
    config.seriesName
  );

  // Step 8.6: Actor Auto-linking (only if actors were extracted)
  if (result.actorsExtracted > 0) {
    result.actorsLinked = await autoLinkActors(config.articleId);
  }

  // Step 10: Q&A Generation
  result.qaGenerated = await generateQA(
    prisma,
    config.articleId,
    config.articleTitle,
    config.articleContent,
    config.seriesName
  );

  // Step 11: Alternative Actor Linking
  await linkActorsAlternative(prisma, config.articleId);

  // Step 11.5: Character Import & Linking
  result.charactersProcessed = await processCharacters(
    prisma,
    config.articleId,
    config.seriesTmdbId
  );

  // Step 11.6: Image Processing
  result.imageProcessed = await processImageForUniqueness(
    prisma,
    config.articleId,
    config.articleSlug,
    config.articleTitle,
    config.seriesTmdbId
  );

  // Step 12: Cast Import
  result.castImported = await importCast(config.seriesTmdbId);

  console.log('\n' + '='.repeat(70));
  console.log('✅ POST-PROCESSING COMPLETE');
  console.log('='.repeat(70));
  console.log(`   Actors Extracted: ${result.actorsExtracted}`);
  console.log(`   Actors Linked: ${result.actorsLinked ? 'Yes' : 'No'}`);
  console.log(`   Characters Processed: ${result.charactersProcessed ? 'Yes' : 'No'}`);
  console.log(`   Image Processed: ${result.imageProcessed ? 'Yes' : 'No'}`);
  console.log(`   Cast Imported: ${result.castImported}`);
  console.log(`   Q&A Generated: ${result.qaGenerated ? 'Yes' : 'No'}`);
  console.log('='.repeat(70) + '\n');

  return result;
}
