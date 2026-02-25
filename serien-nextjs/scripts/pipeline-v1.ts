/**
 * EMERGENT TV-SERIES CONTENT PIPELINE v1
 * Full 7-step automated pipeline for TV series news
 */

import { PrismaClient } from '@prisma/client';
import { classifyContent, shouldSkipArticle, type ContentType } from '../lib/content-classifier';
import { resolveTmdbSeries, type TmdbResolutionResult } from '../lib/tmdb-resolver';
import { extractFacts } from '../lib/fact-extractor';
import { generateGermanArticle } from '../lib/content-generator';
import { optimizeHeadline } from '../lib/headline-optimizer';
import { rewriteArticleStyle } from '../lib/article-style-rewriter';
import { qualityCheck } from '../lib/quality-checker';
import { discoverGate } from '../lib/discover-gate';

const prisma = new PrismaClient();

interface CrawledSource {
  title: string;
  url: string;
  text: string;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function runContentPipeline(source: CrawledSource) {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 EMERGENT TV-SERIES CONTENT PIPELINE v1');
  console.log('='.repeat(70));
  console.log(`\n📄 Source: ${source.title}`);
  console.log(`🔗 URL: ${source.url}`);
  console.log('');

  try {
    // ========== STEP 1: CLASSIFY ==========
    console.log('━'.repeat(70));
    console.log('STEP 1: CONTENT CLASSIFICATION');
    console.log('━'.repeat(70));
    
    const classification = await classifyContent(
      source.title,
      source.url,
      source.text
    );

    console.log(`\n📊 Classification Result:`);
    console.log(`   Type: ${classification.content_type}`);
    console.log(`   Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
    console.log(`   Series found: ${classification.series_candidates.length}`);
    console.log(`   Reasoning: ${classification.reasoning}`);

    // HARD GATE: Skip if not allowed type
    if (shouldSkipArticle(classification)) {
      console.log(`\n❌ SKIPPED: Content type "${classification.content_type}" is not allowed`);
      console.log('   Allowed types: SINGLE_SERIES_NEWS, MULTI_SERIES_EDITORIAL');
      return { skipped: true, reason: classification.content_type };
    }

    console.log('\n✅ Classification passed - proceeding to TMDB resolution');

    // ========== STEP 2: TMDB RESOLVE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 2: TMDB RESOLUTION');
    console.log('━'.repeat(70));

    const resolution = await resolveTmdbSeries(
      classification.content_type as 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL',
      classification.series_candidates
    );

    console.log(`\n📊 Resolution Result:`);
    console.log(`   Primary Series: ${resolution.primarySeries.name} (ID: ${resolution.primarySeries.tmdbId})`);
    console.log(`   Related Series: ${resolution.relatedSeries.length}`);
    console.log(`   Total Resolved: ${resolution.totalResolved}`);

    // ========== STEP 3: FACT EXTRACTION ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 3: FACT EXTRACTION');
    console.log('━'.repeat(70));

    const facts = await extractFacts(source.title, source.text);

    // ========== STEP 4: AI GENERATE DE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4: AI CONTENT GENERATION (German)');
    console.log('━'.repeat(70));

    let generatedContent = await generateGermanArticle(
      facts,
      resolution.primarySeries.name,
      classification.content_type as 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL'
    );

    let articleTitle = source.title;

    // ========== STEP 4.1: HEADLINE OPTIMIZATION ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4.1: EMERGENT HEADLINE OPTIMIZATION');
    console.log('━'.repeat(70));

    const headlineResult = await optimizeHeadline({
      rawContent: facts.key_statements.join(' '),
      originalHeadline: articleTitle,
      seriesName: resolution.primarySeries.name,
      platform: resolution.primarySeries.networks?.[0] || 'Streaming',
    });

    articleTitle = headlineResult.final_headline;
    console.log(`✅ Original: "${source.title}"`);
    console.log(`✅ Optimized: "${articleTitle}"`);

    // ========== STEP 4.2: ARTICLE STYLE REWRITE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4.2: EMERGENT ARTICLE STYLE REWRITE');
    console.log('━'.repeat(70));

    generatedContent = await rewriteArticleStyle({
      extractedFacts: facts.key_statements.join('\n- '),
      seriesName: resolution.primarySeries.name,
      platform: resolution.primarySeries.networks?.[0] || 'Streaming',
      eventType: 'other', // Could be determined from classification
    });

    console.log(`✅ Article rewritten to serienjunkies.de style`);

    // ========== STEP 4.3: QUALITY CHECK ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4.3: EMERGENT QUALITY CHECK');
    console.log('━'.repeat(70));

    let qualityResult = await qualityCheck({
      generatedArticleHtml: generatedContent,
      finalHeadline: articleTitle,
      primarySeriesName: resolution.primarySeries.name,
      platform: resolution.primarySeries.networks?.[0],
      extractedFacts: facts.key_statements.join('\n'),
    });

    console.log(`📊 Quality Scores: ${qualityResult.scores.total}/40`);
    console.log(`   Style: ${qualityResult.scores.style}/10, Clarity: ${qualityResult.scores.clarity}/10`);
    console.log(`   Readability: ${qualityResult.scores.readability}/10, Trust: ${qualityResult.scores.trustworthiness}/10`);

    // AUTO-REWRITE on FAIL (once)
    if (qualityResult.status === 'FAIL' && qualityResult.autoRewriteRecommended) {
      console.log('\n🔄 Quality Check FAILED - Auto-Rewrite attempt...');
      
      // Re-optimize headline
      const reHeadlineResult = await optimizeHeadline({
        rawContent: facts.key_statements.join(' '),
        originalHeadline: articleTitle,
        seriesName: resolution.primarySeries.name,
        platform: resolution.primarySeries.networks?.[0] || 'Streaming',
      });
      articleTitle = reHeadlineResult.final_headline;

      // Re-rewrite content
      generatedContent = await rewriteArticleStyle({
        extractedFacts: facts.key_statements.join('\n- '),
        seriesName: resolution.primarySeries.name,
        platform: resolution.primarySeries.networks?.[0] || 'Streaming',
        eventType: 'other',
      });

      // Re-check
      qualityResult = await qualityCheck({
        generatedArticleHtml: generatedContent,
        finalHeadline: articleTitle,
        primarySeriesName: resolution.primarySeries.name,
        platform: resolution.primarySeries.networks?.[0],
        extractedFacts: facts.key_statements.join('\n'),
      });

      console.log(`📊 Re-check Scores: ${qualityResult.scores.total}/40 - ${qualityResult.status}`);
    }

    if (qualityResult.status === 'FAIL') {
      console.log('⚠️  Quality Check FAILED after rewrite - proceeding anyway');
      qualityResult.failReasons.forEach(reason => console.log(`   - ${reason}`));
    } else {
      console.log('✅ Quality Check PASSED');
    }

    // ========== STEP 4.4: DISCOVER GATE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4.4: EMERGENT DISCOVER GATE');
    console.log('━'.repeat(70));

    // Get TMDB image metadata for Discover check
    const primaryTmdbId = resolution.primarySeries.tmdbId;
    const heroImageMeta = {
      url: `/img/hero/tv/${primaryTmdbId}`,
      width: 1920, // TMDB Backdrop default
      height: 1080,
      source: 'TMDB_BACKDROP' as const,
    };

    let discoverResult = await discoverGate({
      final_headline: articleTitle,
      article_html: generatedContent,
      hero_image_metadata: heroImageMeta,
      publishedAt: new Date(), // NOW
      primary_series: resolution.primarySeries.name,
    });

    console.log(`📊 Discover Scores: ${discoverResult.scores.total}/40`);
    console.log(`   Headline: ${discoverResult.scores.headline_quality}/10, Image: ${discoverResult.scores.image_quality}/10`);
    console.log(`   Content: ${discoverResult.scores.content_trust}/10, Freshness: ${discoverResult.scores.freshness}/10`);

    // AUTO-REWRITE on FAIL (once)
    if (!discoverResult.discover_eligible && discoverResult.auto_rewrite_recommended) {
      console.log('\n🔄 Discover Gate FAILED - Auto-Rewrite attempt...');
      
      // Re-optimize headline (more aggressive)
      const reHeadlineResult = await optimizeHeadline({
        rawContent: facts.key_statements.join(' '),
        originalHeadline: articleTitle,
        seriesName: resolution.primarySeries.name,
        platform: resolution.primarySeries.networks?.[0] || 'Streaming',
      });
      articleTitle = reHeadlineResult.final_headline;

      // Re-rewrite content
      generatedContent = await rewriteArticleStyle({
        extractedFacts: facts.key_statements.join('\n- '),
        seriesName: resolution.primarySeries.name,
        platform: resolution.primarySeries.networks?.[0] || 'Streaming',
        eventType: 'other',
      });

      // Re-check Discover
      discoverResult = await discoverGate({
        final_headline: articleTitle,
        article_html: generatedContent,
        hero_image_metadata: heroImageMeta,
        publishedAt: new Date(),
        primary_series: resolution.primarySeries.name,
      });

      console.log(`📊 Re-check Discover: ${discoverResult.scores.total}/40 - ${discoverResult.discover_eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}`);
    }

    const discoverEligible = discoverResult.discover_eligible;
    if (discoverEligible) {
      console.log('✅ Discover Gate PASSED - Article is Discover-eligible');
    } else {
      console.log('⚠️  Discover Gate FAILED - Publishing without Discover tag');
      if (discoverResult.fail_reasons.length > 0) {
        discoverResult.fail_reasons.forEach(reason => console.log(`   - ${reason}`));
      }
    }

    // ========== STEP 5: IMAGES (TMDB) ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5: IMAGE PIPELINE (TMDB)');
    console.log('━'.repeat(70));
    
    const imageData = {
      tmdbId: primaryTmdbId,
      tmdbType: 'tv' as const,
      heroImageUrl: `/img/hero/tv/${primaryTmdbId}`,
      ogImageUrl: `/img/og/tv/${primaryTmdbId}`,
      cardImageUrl: `/img/card/tv/${primaryTmdbId}`,
      imageAttribution: 'TMDB',
    };

    console.log(`✅ Image URLs generated from primary series (TMDB ID: ${primaryTmdbId})`);

    // ========== STEP 6: DATES ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 6: DATE HANDLING');
    console.log('━'.repeat(70));

    const now = new Date();
    const sourceDate = new Date(); // Could extract from source, but we'll use NOW for now

    console.log(`✅ publishedAt: ${now.toISOString()} (NOW)`);
    console.log(`✅ sourcePublishedAt: ${sourceDate.toISOString()} (internal only)`);

    // ========== STEP 7: PUBLISH ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 7: PUBLISH TO DATABASE');
    console.log('━'.repeat(70));

    // Check for duplicate
    const existingArticle = await prisma.article.findUnique({
      where: { sourceUrl: source.url }
    });

    if (existingArticle) {
      console.log('⚠️  Article already exists - SKIPPING');
      return { skipped: true, reason: 'duplicate' };
    }

    // Generate excerpt from optimized content
    const articleExcerpt = facts.key_statements[0] || generatedContent.replace(/<[^>]*>/g, '').substring(0, 200);
    const slug = generateSlug(articleTitle);

    // Create article with transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get random author from database
      const authors = await tx.user.findMany({
        where: { role: 'author' },
        select: { id: true, name: true }
      });

      if (authors.length === 0) {
        throw new Error('No authors found in database');
      }

      // Select random author
      const randomAuthor = authors[Math.floor(Math.random() * authors.length)];
      console.log(`✍️  Selected random author: ${randomAuthor.name}`);

      // Create article
      const article = await tx.article.create({
        data: {
          id: `pipeline-${Date.now()}`,
          slug,
          title: articleTitle,
          excerpt: articleExcerpt,
          contentHtml: generatedContent,
          contentType: classification.content_type,
          authorId: randomAuthor.id,
          status: 'published',
          publishedAt: now,
          sourcePublishedAt: sourceDate,
          sourceUrl: source.url,
          readingTime: Math.ceil(generatedContent.split(' ').length / 200),
          confidence: classification.confidence,
          primarySeriesId: resolution.primarySeries.tmdbId,
          discoverEligible,
          ...imageData,
        },
      });

      // Create many-to-many relations for related series
      if (resolution.relatedSeries.length > 0) {
        await tx.articleSeries.createMany({
          data: resolution.relatedSeries.map((series, index) => ({
            articleId: article.id,
            seriesId: series.tmdbId,
            position: index + 1,
          })),
        });
      }

      return article;
    });

    console.log('\n✅ Article published successfully!');
    console.log(`   ID: ${result.id}`);
    console.log(`   Slug: ${result.slug}`);
    console.log(`   Primary Series: ${resolution.primarySeries.name}`);
    console.log(`   Related Series: ${resolution.relatedSeries.length}`);

    console.log('\n' + '='.repeat(70));
    console.log('🎉 PIPELINE COMPLETE');
    console.log('='.repeat(70) + '\n');

    return {
      success: true,
      article: result,
      classification,
      resolution,
    };

  } catch (error: any) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ PIPELINE FAILED');
    console.error('='.repeat(70));
    console.error(`Error: ${error.message}`);
    console.error('');
    
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ========== EXAMPLE USAGE ==========
async function main() {
  // Example: Single Series News - LIVE TEST MIT NEUER SERIE
  const testArticle: CrawledSource = {
    title: "Fallout Staffel 2: Amazon bestätigt Fortsetzung der Videospiel-Adaption",
    url: "https://example.com/fallout-season-2-amazon-2026",
    text: `Amazon Prime Video hat offiziell die zweite Staffel der erfolgreichen Fallout-Serie bestätigt. Die Videospiel-Adaption war einer der größten Hits des Jahres 2024. Ella Purnell und Walton Goggins kehren in ihren Hauptrollen zurück. Die Dreharbeiten zur zweiten Staffel beginnen im Sommer 2026. Jonathan Nolan und Lisa Joy bleiben als ausführende Produzenten an Bord.`
  };

  await runContentPipeline(testArticle);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
