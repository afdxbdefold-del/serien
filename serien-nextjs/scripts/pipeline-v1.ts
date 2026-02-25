/**
 * EMERGENT TV-SERIES CONTENT PIPELINE v1
 * SPEC_VERSION: serien_pipeline_v1
 * 
 * Full automated pipeline with strict quality gates
 */

import { PrismaClient } from '@prisma/client';
import { classifyContent, shouldSkipArticle, type ContentType } from '../lib/content-classifier';
import { resolveTmdbSeries, type TmdbResolutionResult } from '../lib/tmdb-resolver';
import { extractFacts } from '../lib/fact-extractor';
import { generateGermanArticle } from '../lib/content-generator';
import { editorialRewrite } from '../lib/editorial-rewriter';
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

    // ========== STEP 4: AI GENERATE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4: AI CONTENT GENERATION');
    console.log('━'.repeat(70));

    let generatedContent = await generateGermanArticle(
      facts,
      resolution.primarySeries.name,
      classification.content_type as 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL'
    );

    let articleTitle = source.title;
    console.log(`✅ Generated article (${generatedContent.length} chars)`);

    // ========== STEP 5: EDITORIAL REWRITE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5: EDITORIAL REWRITE (Headline + First 2 Paragraphs)');
    console.log('━'.repeat(70));

    let editorialResult = await editorialRewrite({
      generatedArticleHtml: generatedContent,
      generatedHeadline: articleTitle,
      extractedFacts: facts.key_statements.join('\n- '),
      seriesName: resolution.primarySeries.name,
      platform: resolution.primarySeries.networks?.[0] || 'Streaming',
    });

    articleTitle = editorialResult.final_headline;
    generatedContent = editorialResult.rewritten_article_html;

    console.log(`✅ Headline: "${articleTitle}" (${articleTitle.length} chars)`);
    console.log(`✅ Content rewritten (first 2 paragraphs + lead)`);

    // ========== STEP 6: QUALITY CHECK ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 6: QUALITY CHECK');
    console.log('━'.repeat(70));

    let qualityResult = await qualityCheck({
      generatedArticleHtml: generatedContent,
      finalHeadline: articleTitle,
      primarySeriesName: resolution.primarySeries.name,
      platform: resolution.primarySeries.networks?.[0],
      extractedFacts: facts.key_statements.join('\n'),
    });

    console.log(`📊 Quality Scores:`);
    console.log(`   Headline:  ${qualityResult.scores.headline}/100 (min: 70)`);
    console.log(`   Content:   ${qualityResult.scores.content}/100 (min: 70)`);
    console.log(`   Structure: ${qualityResult.scores.structure}/100 (min: 65)`);

    // REWRITE COUNTER (MAX 1 TOTAL)
    let hasRewritten = false;

    // AUTO-REWRITE on FAIL (ONCE)
    if (qualityResult.status === 'FAIL' && !hasRewritten) {
      console.log('\n🔄 Quality Check FAILED - Attempting rewrite (1/1)...');
      hasRewritten = true;

      if (qualityResult.requiresFullRewrite) {
        console.log('   → FULL Rewrite (body issues detected)');
        
        // Regenerate complete article
        generatedContent = await generateGermanArticle(
          facts,
          resolution.primarySeries.name,
          classification.content_type as 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL'
        );

        // Rewrite again
        editorialResult = await editorialRewrite({
          generatedArticleHtml: generatedContent,
          generatedHeadline: articleTitle,
          extractedFacts: facts.key_statements.join('\n- '),
          seriesName: resolution.primarySeries.name,
          platform: resolution.primarySeries.networks?.[0] || 'Streaming',
        });

        articleTitle = editorialResult.final_headline;
        generatedContent = editorialResult.rewritten_article_html;
      } else {
        console.log('   → Headline + First 2 Paragraphs only');
        
        // Just rewrite editorial (headline + first 2 paragraphs)
        editorialResult = await editorialRewrite({
          generatedArticleHtml: generatedContent,
          generatedHeadline: articleTitle,
          extractedFacts: facts.key_statements.join('\n- '),
          seriesName: resolution.primarySeries.name,
          platform: resolution.primarySeries.networks?.[0] || 'Streaming',
        });

        articleTitle = editorialResult.final_headline;
        generatedContent = editorialResult.rewritten_article_html;
      }

      // Re-check
      qualityResult = await qualityCheck({
        generatedArticleHtml: generatedContent,
        finalHeadline: articleTitle,
        primarySeriesName: resolution.primarySeries.name,
        platform: resolution.primarySeries.networks?.[0],
        extractedFacts: facts.key_statements.join('\n'),
      });

      console.log(`📊 Re-check: Headline ${qualityResult.scores.headline}, Content ${qualityResult.scores.content}, Structure ${qualityResult.scores.structure}`);
      console.log(`   Status: ${qualityResult.status}`);
    }

    // If STILL FAIL after rewrite → SKIP_PUBLISH (save as DRAFT)
    if (qualityResult.status === 'FAIL') {
      console.log('❌ Quality Check FAILED after rewrite → SKIP_PUBLISH');
      qualityResult.failReasons.forEach(reason => console.log(`   - ${reason}`));
      
      // Get author for draft
      const authors = await prisma.user.findMany({
        where: { role: 'author' },
        select: { id: true }
      });
      
      const authorId = authors.length > 0 ? authors[0].id : 'system';
      
      // Save as DRAFT
      const slug = generateSlug(articleTitle);
      const articleExcerpt = facts.key_statements[0] || generatedContent.replace(/<[^>]*>/g, '').substring(0, 200);
      const now = new Date();
      
      const draftArticle = await prisma.article.create({
        data: {
          id: `draft-${Date.now()}`,
          slug: `${slug}-draft`,
          title: articleTitle,
          excerpt: articleExcerpt,
          contentHtml: generatedContent,
          contentType: classification.content_type,
          authorId,
          status: 'draft',
          publishMode: 'DRAFT',
          publishedAt: null,
          sourcePublishedAt: now,
          sourceUrl: source.url,
          readingTime: Math.ceil(generatedContent.split(' ').length / 200),
          confidence: classification.confidence,
          primarySeriesId: resolution.primarySeries.tmdbId,
        },
      });

      console.log(`📝 Saved as DRAFT: ${draftArticle.id}`);
      
      return { skipped: true, reason: 'quality_check_failed', draft: draftArticle };
    }

    console.log('✅ Quality Check PASSED');

    // ========== STEP 7: DISCOVER GATE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 7: DISCOVER GATE');
    console.log('━'.repeat(70));

    const primaryTmdbId = resolution.primarySeries.tmdbId;
    const heroImageMeta = {
      url: `/img/hero/tv/${primaryTmdbId}`,
      width: 1920,
      height: 1080,
      source: 'TMDB_BACKDROP' as const,
    };

    const discoverResult = await discoverGate({
      final_headline: articleTitle,
      article_html: generatedContent,
      hero_image_metadata: heroImageMeta,
      publishedAt: new Date(), // NOW
      primary_series: resolution.primarySeries.name,
    });

    console.log(`📊 Discover Scores:`);
    console.log(`   Discover Probability: ${(discoverResult.scores.discover_probability * 100).toFixed(1)}% (min: 65%)`);
    console.log(`   Freshness Score:      ${discoverResult.scores.freshness_score}/100 (min: 80)`);
    console.log(`   Headline Quality:     ${discoverResult.scores.headline_quality}/100`);
    console.log(`   Image Quality:        ${discoverResult.scores.image_quality}/100`);

    // NO REWRITE in Discover Gate (already used rewrite quota)
    let publishMode = 'DISCOVER';
    
    if (discoverResult.discover_eligible) {
      console.log('✅ Discover Gate PASSED → PUBLISH_MODE: DISCOVER');
      publishMode = 'DISCOVER';
    } else {
      console.log('⚠️  Discover Gate FAILED → PUBLISH_MODE: SEARCH_ONLY');
      if (discoverResult.fail_reasons.length > 0) {
        discoverResult.fail_reasons.forEach(reason => console.log(`   - ${reason}`));
      }
      publishMode = 'SEARCH_ONLY';
    }

    console.log(`\n📊 Dashboard Metrics:`);
    console.log(`   Discover Score: ${(discoverResult.dashboard.aggregation.discover_score * 100).toFixed(1)}%`);
    console.log(`   Verdicts: H=${discoverResult.dashboard.headline.verdict} C=${discoverResult.dashboard.content.verdict} F=${discoverResult.dashboard.freshness.verdict} I=${discoverResult.dashboard.images.verdict} T=${discoverResult.dashboard.trust.verdict}`);
    if (discoverResult.dashboard.aggregation.primary_blockers.length > 0) {
      console.log(`   Blockers: ${discoverResult.dashboard.aggregation.primary_blockers.join('; ')}`);
    }

    // ========== STEP 8: PUBLISH ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 8: PUBLISH');
    console.log('━'.repeat(70));

    // Check for duplicate
    const existingArticle = await prisma.article.findUnique({
      where: { sourceUrl: source.url }
    });

    if (existingArticle) {
      console.log('⚠️  Article already exists - SKIPPING');
      return { skipped: true, reason: 'duplicate' };
    }

    // Generate slug and excerpt
    const slug = generateSlug(articleTitle);
    const articleExcerpt = facts.key_statements[0] || generatedContent.replace(/<[^>]*>/g, '').substring(0, 200);


    // Generate image data
    const imageData = {
      tmdbId: primaryTmdbId,
      tmdbType: 'tv' as const,
      heroImageUrl: `/img/hero/tv/${primaryTmdbId}`,
      ogImageUrl: `/img/og/tv/${primaryTmdbId}`,
      cardImageUrl: `/img/card/tv/${primaryTmdbId}`,
      imageAttribution: 'TMDB',
    };

    console.log(`✅ Images: TMDB ID ${primaryTmdbId}`);

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
          publishMode,
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

      // === STORE DISCOVER DASHBOARD ===
      // Auto-cleanup: Keep only last 1000 results
      const dashboardCount = await tx.discoverScoreDashboard.count();
      if (dashboardCount >= 1000) {
        // Delete oldest entries
        const toDelete = dashboardCount - 999;
        const oldestEntries = await tx.discoverScoreDashboard.findMany({
          orderBy: { timestamp: 'asc' },
          take: toDelete,
          select: { id: true },
        });
        
        await tx.discoverScoreDashboard.deleteMany({
          where: {
            id: { in: oldestEntries.map(e => e.id) },
          },
        });
      }

      // Store dashboard metrics
      await tx.discoverScoreDashboard.create({
        data: {
          articleId: article.id,
          pipelineVersion: 'serien_pipeline_v1',
          headlineMetrics: discoverResult.dashboard.headline,
          contentMetrics: discoverResult.dashboard.content,
          freshnessMetrics: discoverResult.dashboard.freshness,
          imageMetrics: discoverResult.dashboard.images,
          trustMetrics: discoverResult.dashboard.trust,
          discoverScore: discoverResult.dashboard.aggregation.discover_score,
          finalVerdict: discoverResult.dashboard.aggregation.final_verdict,
          primaryBlockers: discoverResult.dashboard.aggregation.primary_blockers,
          improvementHints: discoverResult.dashboard.aggregation.improvement_hints,
        },
      });

      return article;
    });

    console.log('\n✅ Article published successfully!');
    console.log(`   ID: ${result.id}`);
    console.log(`   Slug: ${result.slug}`);
    console.log(`   Title: ${result.title}`);
    console.log(`   Publish Mode: ${result.publishMode}`);
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
    url: "https://example.com/fallout-season-2-test-dashboard-2026",
    text: `Amazon Prime Video hat offiziell die zweite Staffel der erfolgreichen Fallout-Serie bestätigt. Die Videospiel-Adaption war einer der größten Hits des Jahres 2024. Ella Purnell und Walton Goggins kehren in ihren Hauptrollen zurück. Die Dreharbeiten zur zweiten Staffel beginnen im Sommer 2026. Jonathan Nolan und Lisa Joy bleiben als ausführende Produzenten an Bord.`
  };

  await runContentPipeline(testArticle);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
