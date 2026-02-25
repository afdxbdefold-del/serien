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
import { antiAiFilter } from '../lib/anti-ai-filter';
import { discoverGate } from '../lib/discover-gate';
import { updateSeriesStatus } from '../lib/series-status-tracker';
import { generateWasBedeutetDas } from '../lib/was-bedeutet-das';
import { generateInternalLinks, validateInternalLinks } from '../lib/internal-linking-engine';

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

  // Declare timestamp at the start for consistent usage throughout pipeline
  const now = new Date();

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

    // Prepare series names for content generation
    const allSeriesNames = classification.content_type === 'MULTI_SERIES_EDITORIAL'
      ? [resolution.primarySeries.name, ...resolution.relatedSeries.map(s => s.name)]
      : [resolution.primarySeries.name];

    let generatedContent = await generateGermanArticle(
      facts,
      resolution.primarySeries.name,
      classification.content_type as 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL',
      allSeriesNames
    );

    let articleTitle = source.title;
    const originalHeadline = source.title; // Store for comparison
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

    // ========== STEP 5.5: WAS BEDEUTET DAS? ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5.5: WAS BEDEUTET DAS? BOX');
    console.log('━'.repeat(70));

    const wasBedeutetDasText = await generateWasBedeutetDas({
      articleHtml: generatedContent,
      headline: articleTitle,
      seriesName: resolution.primarySeries.name,
      contentType: classification.content_type,
      extractedFacts: facts.key_statements.join('\n'),
    });

    if (wasBedeutetDasText) {
      const wordCount = wasBedeutetDasText.split(/\s+/).length;
      console.log(`✅ Generated: "${wasBedeutetDasText}"`);
      console.log(`   (${wordCount} Wörter)`);
    } else {
      console.log(`⊘  Nicht generiert (nicht eligible oder validation failed)`);
    }

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
          classification.content_type as 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL',
          allSeriesNames
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

    // ========== STEP 6.5: ANTI-AI SMELL FILTER ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 6.5: ANTI-AI SMELL FILTER');
    console.log('━'.repeat(70));

    let antiAiResult = await antiAiFilter({
      articleHtml: generatedContent,
      headline: articleTitle,
      seriesName: resolution.primarySeries.name,
    });

    const antiAiScoreBeforeRewrite = antiAiResult.antiAiScore; // Store for comparison

    console.log(`📊 Anti-AI Score: ${antiAiResult.antiAiScore}/100 (min: 80)`);
    console.log(`   Status: ${antiAiResult.status}`);
    
    if (antiAiResult.details.hardBlocklist.found.length > 0) {
      console.log(`   ⚠️  Hard Blocklist: ${antiAiResult.details.hardBlocklist.found.join(', ')}`);
    }
    
    if (antiAiResult.details.aiDetectionCheck.verdict) {
      console.log(`   🤖 AI Detection: ${antiAiResult.details.aiDetectionCheck.verdict}`);
    }

    // AUTO-REWRITE if needed and quota available
    let headlineWasRewrittenByAntiAi = false;
    
    if (antiAiResult.status === 'FAIL' && !hasRewritten) {
      console.log('\n🔄 Anti-AI Filter FAILED - Attempting rewrite (1/1)...');
      hasRewritten = true;
      headlineWasRewrittenByAntiAi = true;

      // Full regeneration to avoid AI patterns
      generatedContent = await generateGermanArticle(
        facts,
        resolution.primarySeries.name,
        classification.content_type as 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL',
        allSeriesNames
      );

      editorialResult = await editorialRewrite({
        generatedArticleHtml: generatedContent,
        generatedHeadline: articleTitle,
        extractedFacts: facts.key_statements.join('\n- '),
        seriesName: resolution.primarySeries.name,
        platform: resolution.primarySeries.networks?.[0] || 'Streaming',
      });

      articleTitle = editorialResult.final_headline;
      generatedContent = editorialResult.rewritten_article_html;

      // Re-check both Quality + Anti-AI
      qualityResult = await qualityCheck({
        generatedArticleHtml: generatedContent,
        finalHeadline: articleTitle,
        primarySeriesName: resolution.primarySeries.name,
        platform: resolution.primarySeries.networks?.[0],
        extractedFacts: facts.key_statements.join('\n'),
      });

      antiAiResult = await antiAiFilter({
        articleHtml: generatedContent,
        headline: articleTitle,
        seriesName: resolution.primarySeries.name,
      });

      console.log(`📊 Re-check: Quality ${qualityResult.status}, Anti-AI ${antiAiResult.antiAiScore}/100`);
    }

    // If STILL FAIL after rewrite → SKIP_PUBLISH (save as DRAFT)
    if (antiAiResult.status === 'FAIL') {
      console.log('❌ Anti-AI Filter FAILED after rewrite → SKIP_PUBLISH');
      antiAiResult.failReasons.forEach(reason => console.log(`   - ${reason}`));
      
      // Save as DRAFT (same logic as quality fail)
      const authors = await prisma.user.findMany({
        where: { role: 'author' },
        select: { id: true }
      });
      
      const authorId = authors.length > 0 ? authors[0].id : 'system';
      const slug = generateSlug(articleTitle);
      const articleExcerpt = facts.key_statements[0] || generatedContent.replace(/<[^>]*>/g, '').substring(0, 200);
      
      const draftArticle = await prisma.article.create({
        data: {
          id: `draft-ai-${Date.now()}`,
          slug: `${slug}-draft-ai`,
          title: articleTitle,
          excerpt: articleExcerpt,
          contentHtml: generatedContent,
          contentType: classification.content_type,
          authorId,
          status: 'draft',
          publishMode: 'DRAFT',
          publishedAt: null,
          sourcePublishedAt: now,
          sourceUrl: source.url + '-draft-ai',
          readingTime: Math.ceil(generatedContent.split(' ').length / 200),
          confidence: classification.confidence,
          primarySeriesId: resolution.primarySeries.tmdbId,
        },
      });

      console.log(`📝 Saved as DRAFT (AI-Smell): ${draftArticle.id}`);
      
      return { skipped: true, reason: 'anti_ai_filter_failed', draft: draftArticle };
    }

    console.log('✅ Anti-AI Filter PASSED');

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

    console.log(`📊 Discover Scores (100-Punkte-System):`);
    console.log(`   A) Headline Quality:  ${discoverResult.scores.headline_quality}/30`);
    console.log(`   B) Freshness:         ${discoverResult.scores.freshness}/20`);
    console.log(`   C) Content Opening:   ${discoverResult.scores.content_opening}/20`);
    console.log(`   D) Image/Visual:      ${discoverResult.scores.image_visual}/15`);
    console.log(`   E) Trust/Clarity:     ${discoverResult.scores.trust_clarity}/15`);
    console.log(`   ─────────────────────────────`);
    console.log(`   TOTAL:                ${discoverResult.scores.total}/100`);

    // NO REWRITE in Discover Gate (already used rewrite quota)
    let publishMode = 'DISCOVER';
    
    if (discoverResult.discover_eligible) {
      console.log(`✅ Discover Gate PASSED (≥65) → PUBLISH_MODE: DISCOVER`);
      publishMode = 'DISCOVER';
    } else {
      console.log(`⚠️  Discover Gate FAILED (<65) → PUBLISH_MODE: SEARCH_ONLY`);
      if (discoverResult.fail_reasons.length > 0) {
        discoverResult.fail_reasons.forEach(reason => console.log(`   - ${reason}`));
      }
      publishMode = 'SEARCH_ONLY';
    }

    if (discoverResult.dashboard.aggregation.primary_blockers.length > 0) {
      console.log(`\n🚫 Primary Blockers:`);
      discoverResult.dashboard.aggregation.primary_blockers.forEach(b => console.log(`   - ${b}`));
    }
    
    if (discoverResult.dashboard.aggregation.improvement_hints.length > 0) {
      console.log(`\n💡 Improvement Hints:`);
      discoverResult.dashboard.aggregation.improvement_hints.forEach(h => console.log(`   - ${h}`));
    }

    // ========== STEP 7.5: INTERNAL LINKING ENGINE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 7.5: INTERNAL LINKING ENGINE');
    console.log('━'.repeat(70));

    // We need slug first for this step, so generate it here
    const slug = generateSlug(articleTitle);

    const internalLinksResult = await generateInternalLinks({
      articleId: `pipeline-${Date.now()}`, // Temporary, will be replaced
      contentHtml: generatedContent,
      primarySeriesId: resolution.primarySeries.tmdbId,
      primarySeriesName: resolution.primarySeries.name,
      primarySeriesSlug: resolution.primarySeries.slug || resolution.primarySeries.tmdbId,
      publishedAt: now,
    });

    // Update content with internal links
    generatedContent = internalLinksResult.updatedContentHtml;

    console.log(`✅ Internal Links injected:`);
    console.log(`   Hub Link: ${internalLinksResult.hubLink}`);
    console.log(`   Related Articles: ${internalLinksResult.relatedArticles.length}`);
    console.log(`   Total Links: ${internalLinksResult.totalInternalLinks}`);

    // Validate
    const linkValidation = validateInternalLinks(generatedContent, resolution.primarySeries.name);
    if (!linkValidation.valid) {
      console.log(`\n⚠️  Link Validation Warnings:`);
      linkValidation.errors.forEach(err => console.log(`   - ${err}`));
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

    // Generate excerpt
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

    // Prepare dates (now already declared earlier for internal linking)
    const sourceDate = new Date();

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
          wasBedeutetDasText,
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
          contentMetrics: discoverResult.dashboard.content_opening,
          freshnessMetrics: discoverResult.dashboard.freshness,
          imageMetrics: discoverResult.dashboard.image_visual,
          trustMetrics: discoverResult.dashboard.trust_clarity,
          discoverScore: discoverResult.scores.total,
          finalVerdict: discoverResult.dashboard.aggregation.final_verdict,
          primaryBlockers: discoverResult.dashboard.aggregation.primary_blockers,
          improvementHints: discoverResult.dashboard.aggregation.improvement_hints,
        },
      });

      // === STORE HEADLINE COMPARISON ===
      const headlineChanged = articleTitle !== originalHeadline;
      let headlineDelta: number | null = null;
      let comparisonStatus = 'NO_REWRITE';
      
      if (headlineWasRewrittenByAntiAi && headlineChanged) {
        // We have before/after scores
        const antiAiScoreAfterRewrite = antiAiResult.antiAiScore;
        headlineDelta = antiAiScoreAfterRewrite - antiAiScoreBeforeRewrite;
        
        if (headlineDelta >= 5) {
          comparisonStatus = 'IMPROVED';
        } else if (headlineDelta <= -5) {
          comparisonStatus = 'WORSE';
        } else {
          comparisonStatus = 'NEUTRAL';
        }
      } else if (headlineChanged) {
        // Headline was rewritten (by Editorial), but not by Anti-AI
        comparisonStatus = 'NEUTRAL';
      }

      await tx.headlineComparison.create({
        data: {
          articleId: article.id,
          headline_original: originalHeadline,
          headline_rewritten: headlineChanged ? articleTitle : null,
          antiAiScore_original: headlineWasRewrittenByAntiAi ? antiAiScoreBeforeRewrite : antiAiResult.antiAiScore,
          antiAiScore_rewritten: headlineWasRewrittenByAntiAi ? antiAiResult.antiAiScore : null,
          headline_delta: headlineDelta,
          status: comparisonStatus,
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

    // ========== STEP 9: UPDATE SERIES STATUS ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 9: UPDATE SERIES STATUS');
    console.log('━'.repeat(70));

    try {
      await updateSeriesStatus(resolution.primarySeries.tmdbId);
      console.log(`✅ Series status updated for ${resolution.primarySeries.name}`);
    } catch (error: any) {
      console.error(`⚠️  Failed to update series status: ${error.message}`);
    }

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
    url: "https://example.com/fallout-s2-discover-score-test-" + Date.now(),
    text: `Amazon Prime Video hat offiziell die zweite Staffel der erfolgreichen Fallout-Serie bestätigt. Die Videospiel-Adaption war einer der größten Hits des Jahres 2024. Ella Purnell und Walton Goggins kehren in ihren Hauptrollen zurück. Die Dreharbeiten zur zweiten Staffel beginnen im Sommer 2026. Jonathan Nolan und Lisa Joy bleiben als ausführende Produzenten an Bord.`
  };

  const result = await runContentPipeline(testArticle);
  
  // Handle different result types
  if ('skipped' in result && result.skipped) {
    console.log(`\n⚠️  Pipeline Result: SKIPPED`);
    console.log(`   Reason: ${result.reason}`);
    if ('draft' in result && result.draft) {
      console.log(`   Draft saved: ${result.draft.id}`);
    }
  } else if ('success' in result && result.success) {
    console.log(`\n✅ Pipeline Result: SUCCESS`);
    console.log(`   Article ID: ${result.article.id}`);
    console.log(`   Article Slug: ${result.article.slug}`);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
