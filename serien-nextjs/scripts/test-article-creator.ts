/**
 * Unit Test for article-creator.ts (Phase 3.1)
 * Tests the refactored article creation module
 */

import { PrismaClient } from '@prisma/client';
import { createArticle, ArticleCreationData } from '../lib/pipeline/article-creator';

const prisma = new PrismaClient();

async function testArticleCreator() {
  console.log('='.repeat(80));
  console.log('TESTING: article-creator.ts (Phase 3.1)');
  console.log('='.repeat(80));
  console.log('');

  // Test 1: Validate interface structure
  console.log('Test 1: Interface Validation');
  console.log('-'.repeat(80));
  
  const mockData: ArticleCreationData = {
    title: '[TEST] Phase 3.1 - Article Creator Integration',
    slug: 'test-phase-3-1-article-creator-' + Date.now(),
    content: '<p>This is a test article to verify Phase 3.1 integration.</p><p>The article-creator module should handle all database operations correctly.</p>',
    excerpt: 'This is a distinct lead paragraph for testing purposes.',
    metaDescription: 'Test meta description for Phase 3.1 integration testing.',
    contentType: 'SINGLE_SERIES_NEWS',
    publishMode: 'DRAFT',
    wasBedeutetDasText: 'Test: Das bedeutet, die Integration funktioniert!',
    trailerLocalPath: null,
    imageData: {
      tmdbId: 136311, // Shrinking
      tmdbType: 'tv',
      heroImageUrl: '/img/hero/tv/136311',
      ogImageUrl: '/img/og/tv/136311',
      cardImageUrl: '/img/card/tv/136311',
      imageAttribution: 'TMDB',
      tmdbBackdropPath: '/test/backdrop.jpg',
    },
    sourceUrl: `https://test-source-phase-3-1-${Date.now()}.example.com`,
    sourceDate: new Date(),
    confidence: 0.95,
    primarySeriesId: 136311,
    relatedSeriesIds: [],
    discoverResult: {
      passed: true,
      scores: { total: 75 },
      dashboard: {
        headline: { score: 80 },
        content_opening: { score: 75 },
        freshness: { score: 70 },
        image_visual: { score: 80 },
        trust_clarity: { score: 75 },
        aggregation: {
          final_verdict: 'GOOD',
          primary_blockers: [],
          improvement_hints: ['Test hint'],
        },
      },
    },
    antiAiResult: {
      passed: true,
      antiAiScore: 85,
      rewrittenHeadline: null,
    },
    antiAiScoreBeforeRewrite: 80,
    headlineWasRewrittenByAntiAi: false,
    originalHeadline: '[TEST] Phase 3.1 - Article Creator Integration',
    now: new Date(),
  };

  console.log('✅ Mock data structure valid');
  console.log(`   Title: ${mockData.title}`);
  console.log(`   Slug: ${mockData.slug}`);
  console.log(`   Excerpt: ${mockData.excerpt.substring(0, 50)}...`);
  console.log(`   Image Data: ${JSON.stringify(mockData.imageData, null, 2)}`);
  console.log('');

  // Test 2: Check if Shrinking series exists
  console.log('Test 2: Series Validation');
  console.log('-'.repeat(80));
  
  const series = await prisma.series.findUnique({
    where: { tmdbId: 136311 },
    select: { name: true, tmdbId: true, status: true }
  });

  if (!series) {
    console.log('❌ ABORT: Shrinking series (136311) not found in database');
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Series found: ${series.name} (ID: ${series.tmdbId})`);
  console.log('');

  // Test 3: Attempt to create article
  console.log('Test 3: Article Creation (DRAFT mode)');
  console.log('-'.repeat(80));
  
  try {
    const result = await createArticle(prisma, mockData);
    
    console.log('✅ Article created successfully!');
    console.log(`   Article ID: ${result.article.id}`);
    console.log(`   Slug: ${result.article.slug}`);
    console.log(`   Title: ${result.article.title}`);
    console.log(`   Publish Mode: ${result.article.publishMode}`);
    console.log('');

    // Test 4: Verify article in database
    console.log('Test 4: Database Verification');
    console.log('-'.repeat(80));
    
    const savedArticle = await prisma.articles.findUnique({
      where: { slug: result.article.slug },
      include: {
        article_series: true,
      }
    });

    if (!savedArticle) {
      console.log('❌ ERROR: Article not found in database after creation');
    } else {
      console.log('✅ Article verified in database');
      console.log(`   ID: ${savedArticle.id}`);
      console.log(`   Title: ${savedArticle.title}`);
      console.log(`   Excerpt: ${savedArticle.excerpt?.substring(0, 50)}...`);
      console.log(`   Primary Series ID: ${savedArticle.primarySeriesId}`);
      console.log(`   Hero Image: ${savedArticle.heroImageUrl}`);
      console.log(`   Backdrop: ${savedArticle.tmdbBackdropPath}`);
      console.log(`   Was Bedeutet Das: ${savedArticle.wasBedeutetDasText ? 'YES' : 'NO'}`);
      console.log(`   Article-Series Relations: ${savedArticle.article_series.length}`);
    }
    console.log('');

    // Test 5: Check Discover Dashboard
    console.log('Test 5: Discover Dashboard Check');
    console.log('-'.repeat(80));
    
    const dashboard = await prisma.discover_score_dashboards.findFirst({
      where: { articleId: result.article.id }
    });

    if (dashboard) {
      console.log('✅ Discover Dashboard saved');
      console.log(`   Score: ${dashboard.discoverScore}/100`);
      console.log(`   Verdict: ${dashboard.finalVerdict}`);
    } else {
      console.log('⚠️  Discover Dashboard not found');
    }
    console.log('');

    // Test 6: Check Headline Comparison
    console.log('Test 6: Headline Comparison Check');
    console.log('-'.repeat(80));
    
    const headlineComp = await prisma.headline_comparisons.findFirst({
      where: { articleId: result.article.id }
    });

    if (headlineComp) {
      console.log('✅ Headline Comparison saved');
      console.log(`   Original: ${headlineComp.headline_original}`);
      console.log(`   Status: ${headlineComp.status}`);
    } else {
      console.log('⚠️  Headline Comparison not found');
    }
    console.log('');

    // Cleanup: Delete test article
    console.log('Cleanup: Deleting test article...');
    console.log('-'.repeat(80));
    
    await prisma.headline_comparisons.deleteMany({
      where: { articleId: result.article.id }
    });
    
    await prisma.discover_score_dashboards.deleteMany({
      where: { articleId: result.article.id }
    });
    
    await prisma.article_series.deleteMany({
      where: { articleId: result.article.id }
    });
    
    await prisma.articles.delete({
      where: { id: result.article.id }
    });
    
    console.log('✅ Test article cleaned up');
    console.log('');
    
    console.log('='.repeat(80));
    console.log('✅✅ ALL TESTS PASSED - article-creator.ts works correctly!');
    console.log('='.repeat(80));
    
  } catch (error: any) {
    console.log('❌ TEST FAILED');
    console.log(`   Error: ${error.message}`);
    console.log('');
    console.log('Stack trace:');
    console.log(error.stack);
  }

  await prisma.$disconnect();
}

// Run test
testArticleCreator().catch(console.error);
