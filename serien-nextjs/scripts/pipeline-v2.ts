/**
 * PIPELINE V2 - OPTIMIZED
 * 
 * Key improvements over v1:
 * 1. Single LLM call for content + H2s + meta + Q&A
 * 2. Character linking BEFORE HTML conversion
 * 3. Parallelized post-processing
 * 4. Faster, cleaner, more reliable
 */

import { PrismaClient } from '@prisma/client';
import { generateStructuredContent } from '../lib/structured-content-generator';
import { linkCharactersInMarkdown } from '../lib/character-linking-markdown';
import { markdownToHtml } from '../lib/markdown-to-html';
import { classifyContent, shouldSkipArticle } from '../lib/content-classifier';
import { resolveTmdbSeries } from '../lib/tmdb-resolver';
import { searchTvEnhanced } from '../lib/tmdb-search-enhanced';
import { getTvDetailsComplete } from '../lib/tmdb';
import { extractFacts } from '../lib/fact-extractor';
import { fetchFullArticleText } from '../lib/full-text-fetcher';
import { importSeriesCharacters } from './import-characters';
import { importSeriesCast } from '../lib/cast-importer';
import { findTrailerYouTubeId, downloadYouTubeTrailer } from '../lib/trailer-downloader';
import { updateSeriesStatus } from '../lib/series-status-tracker';

const prisma = new PrismaClient();

interface PipelineV2Source {
  title: string;
  url: string;
  text: string;
  useFullTextMode?: boolean;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function runPipelineV2(source: PipelineV2Source) {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 PIPELINE V2 - OPTIMIZED');
  console.log('='.repeat(70));
  console.log(`📄 Source: ${source.title}`);
  console.log(`🔗 URL: ${source.url}\n`);

  const now = new Date();

  try {
    // ========== STEP 1: FULL TEXT FETCH ==========
    console.log('━'.repeat(70));
    console.log('STEP 1: FULL TEXT FETCH');
    console.log('━'.repeat(70));
    
    let fullSourceText = source.text;
    let sourceWordCount = 0;
    
    if (source.useFullTextMode) {
      const fullTextResult = await fetchFullArticleText(source.url);
      
      if (fullTextResult.wordCount > 100) {
        fullSourceText = fullTextResult.fullText;
        sourceWordCount = fullTextResult.wordCount;
        
        if (fullTextResult.title && fullTextResult.title.length > 5) {
          source.title = fullTextResult.title;
        }
        
        console.log(`✅ Full text: ${sourceWordCount} words`);
      }
    }

    // ========== STEP 2: CLASSIFICATION ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 2: CLASSIFICATION');
    console.log('━'.repeat(70));
    
    const classification = await classifyContent(
      source.title,
      source.url,
      fullSourceText
    );
    
    console.log(`✅ Type: ${classification.content_type}`);
    
    if (classification.content_type === 'SKIP' || classification.content_type === 'UNKNOWN') {
      console.log('⚠️  Article skipped (not relevant)');
      return null;
    }
    
    // Map to our internal type
    const contentType = classification.content_type === 'SINGLE_SERIES_NEWS' ? 'NEWS' : 'RANKING';

    // ========== STEP 3: ENHANCED TMDB RESOLUTION ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 3: ENHANCED TMDB RESOLUTION ⚡');
    console.log('━'.repeat(70));
    
    const searchResult = await searchTvEnhanced(source.title, fullSourceText);
    
    if (!searchResult || searchResult.confidence < 0.6) {
      console.log('❌ No confident TMDB match found');
      return null;
    }
    
    console.log(`✅ Series: ${searchResult.name} (ID: ${searchResult.tmdbId})`);
    console.log(`   Confidence: ${(searchResult.confidence * 100).toFixed(1)}%`);
    console.log(`   Method: ${searchResult.matchMethod}`);
    
    // Check if series exists in DB
    let dbSeries = await prisma.series.findUnique({
      where: { tmdbId: searchResult.tmdbId },
      select: { tmdbId: true, name: true, title: true, backdropPath: true, trailers: true }
    });
    
    if (!dbSeries) {
      // Create new series
      console.log('📚 Creating new series record...');
      const completeDetails = await getTvDetailsComplete(searchResult.tmdbId, 'de-DE');
      
      if (!completeDetails) {
        console.log('❌ Failed to fetch series details');
        return null;
      }
      
      // Create series (simplified)
      dbSeries = await prisma.series.create({
        data: {
          tmdbId: searchResult.tmdbId,
          name: completeDetails.name,
          title: completeDetails.name,
          slug: generateSlug(completeDetails.name),
          posterPath: completeDetails.posterPath,
          backdropPath: completeDetails.backdropPath,
          overview: completeDetails.overview || '',
          status: completeDetails.status,
          firstAirDate: completeDetails.firstAirDate ? new Date(completeDetails.firstAirDate) : null,
          trailers: completeDetails.trailers || [], // ✅ Save trailers from TMDB
          updatedAt: new Date(),
        }
      });
      
      console.log(`✅ Series created: ${dbSeries.name}`);
    } else {
      console.log(`✅ Series found in DB: ${dbSeries.name || dbSeries.title}`);
    }

    // ========== STEP 4: FACT EXTRACTION ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4: FACT EXTRACTION');
    console.log('━'.repeat(70));
    
    const facts = await extractFacts(fullSourceText, source.title);
    console.log(`✅ Extracted ${facts.length} facts`);

    // ========== STEP 5: STRUCTURED CONTENT GENERATION (ONE CALL!) ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5: STRUCTURED CONTENT GENERATION ⚡');
    console.log('━'.repeat(70));
    
    const structuredContent = await generateStructuredContent({
      facts,
      seriesName: dbSeries.name || dbSeries.title,
      originalHeadline: source.title,
      sourceText: fullSourceText,
      contentType,
      wordCountTarget: sourceWordCount > 0 ? Math.min(sourceWordCount * 1.2, 800) : 400,
    });
    
    console.log(`✅ Generated:`);
    console.log(`   Headline: "${structuredContent.headline}"`);
    console.log(`   Sections: ${structuredContent.sections.length} with H2s`);
    console.log(`   Q&A: ${structuredContent.qa.length} pairs`);

    // ========== STEP 6: CHARACTER IMPORT & LINKING (ON MARKDOWN!) ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 6: CHARACTER LINKING (Markdown) ⚡');
    console.log('━'.repeat(70));
    
    // Import characters first
    await importSeriesCharacters(dbSeries.tmdbId);
    
    // Link characters in markdown
    const linkResult = await linkCharactersInMarkdown(
      structuredContent.markdown,
      dbSeries.tmdbId
    );
    
    structuredContent.markdown = linkResult.linkedMarkdown;
    console.log(`✅ Linked ${linkResult.charactersLinked} characters`);

    // ========== STEP 7: MARKDOWN → HTML ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 7: MARKDOWN → HTML');
    console.log('━'.repeat(70));
    
    const contentHtml = markdownToHtml(structuredContent.markdown);
    
    // Verify H2s survived conversion
    const h2Count = (contentHtml.match(/<h2>/g) || []).length;
    console.log(`✅ HTML generated`);
    console.log(`   H2 tags: ${h2Count}`);
    
    if (h2Count === 0) {
      console.log('⚠️  WARNING: No H2 tags in HTML!');
    }

    // ========== STEP 8: PUBLISH ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 8: PUBLISH');
    console.log('━'.repeat(70));
    
    const slug = generateSlug(structuredContent.headline);
    const articleId = `pipeline-v2-${Date.now()}`;
    
    await prisma.articles.create({
      data: {
        id: articleId,
        title: structuredContent.headline,
        slug,
        contentHtml,
        excerpt: structuredContent.lead,
        metaDescription: structuredContent.metaDescription,
        heroImageUrl: dbSeries.backdropPath 
          ? `https://image.tmdb.org/t/p/original${dbSeries.backdropPath}`
          : null,
        tmdbId: dbSeries.tmdbId,
        authorId: 'author_001', // System author
        status: 'published', // ✅ Auto-publish articles
        publishedAt: now, // ✅ Set publication timestamp
        createdAt: now,
        updatedAt: now,
        sourceUrl: source.url,
      },
    });
    
    console.log(`✅ Article published`);
    console.log(`   ID: ${articleId}`);
    console.log(`   Slug: ${slug}`);

    // ========== STEP 9: POST-PROCESSING (PARALLEL!) ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 9: POST-PROCESSING (Parallel) ⚡');
    console.log('━'.repeat(70));
    
    await Promise.all([
      // Save Q&A
      (async () => {
        if (structuredContent.qa.length > 0) {
          const qaId = `qa-${articleId}`;
          await prisma.article_qa.create({
            data: {
              id: qaId,
              articleId,
              questions: structuredContent.qa, // Store as JSON array
              schemaEnabled: true,
              updatedAt: now,
            },
          });
          console.log(`   ✅ Q&A saved: ${structuredContent.qa.length} questions`);
        }
      })(),
      
      // Import cast
      (async () => {
        await importSeriesCast(dbSeries.tmdbId, dbSeries.tmdbId);
        console.log(`   ✅ Cast imported`);
      })(),
      
      // Download trailer
      (async () => {
        try {
          // Get trailer ID from series trailers JSON
          const trailerId = findTrailerYouTubeId(dbSeries.trailers);
          
          if (trailerId) {
            console.log(`   🎬 Found trailer ID: ${trailerId}`);
            const downloadResult = await downloadYouTubeTrailer(
              trailerId,
              dbSeries.name || dbSeries.title || ''
            );
            
            if (downloadResult.success && downloadResult.localPath) {
              // Update article with trailer URL
              await prisma.articles.update({
                where: { id: articleId },
                data: { heroVideoUrl: downloadResult.localPath }
              });
              console.log(`   ✅ Trailer downloaded and saved: ${downloadResult.localPath}`);
            } else {
              console.log(`   ⚠️  Trailer download failed: ${downloadResult.error}`);
            }
          } else {
            console.log(`   ℹ️  No trailer available for this series`);
          }
        } catch (error: any) {
          console.log(`   ❌ Trailer processing error: ${error.message}`);
        }
      })(),
      
      // Update series status
      (async () => {
        await updateSeriesStatus(
          dbSeries.tmdbId,
          'RENEWED', // Simple intent detection
          fullSourceText
        );
        console.log(`   ✅ Series status updated`);
      })(),
    ]);

    // ========== SUCCESS ==========
    console.log('\n' + '='.repeat(70));
    console.log('🎉 PIPELINE V2 COMPLETE');
    console.log('='.repeat(70));
    console.log(`✅ Article: ${structuredContent.headline}`);
    console.log(`✅ Slug: ${slug}`);
    console.log(`✅ H2 Count: ${h2Count}`);
    console.log(`✅ Character Links: Yes`);
    console.log('='.repeat(70));
    
    return {
      articleId,
      slug,
      headline: structuredContent.headline,
    };
    
  } catch (error: any) {
    console.log('\n' + '='.repeat(70));
    console.log('❌ PIPELINE V2 FAILED');
    console.log('='.repeat(70));
    console.log(`Error: ${error.message}`);
    console.log(error.stack);
    
    throw error;
  }
}

// CLI runner
if (require.main === module) {
  const url = process.argv[2];
  
  if (!url) {
    console.log('Usage: npx tsx scripts/pipeline-v2.ts <URL>');
    process.exit(1);
  }
  
  runPipelineV2({
    title: 'Extracting...',
    url,
    text: '',
    useFullTextMode: true,
  })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
