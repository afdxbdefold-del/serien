/**
 * Article Creator Module
 * Handles the database transaction for creating articles with all related data
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { smartTruncate } from '../smart-truncate';

export interface ArticleCreationData {
  title: string;
  slug: string;
  content: string;
  metaDescription: string;
  contentType: string;
  publishMode: string;
  wasBedeutetDasText: string | null;
  trailerLocalPath: string | null;
  imageData: {
    heroImagePath?: string;
    cardImagePath?: string;
    ogImagePath?: string;
  };
  sourceUrl: string;
  sourceDate: Date;
  confidence: number;
  primarySeriesId: number;
  relatedSeriesIds: number[];
  discoverResult: any;
  antiAiResult: any;
  antiAiScoreBeforeRewrite: number;
  headlineWasRewrittenByAntiAi: boolean;
  originalHeadline: string;
  now: Date;
}

export interface ArticleCreationResult {
  article: {
    id: string;
    slug: string;
    title: string;
    contentHtml: string;
    publishMode: string;
  };
}

/**
 * Creates an article with all related data in a single transaction
 */
export async function createArticle(
  prisma: PrismaClient,
  data: ArticleCreationData
): Promise<ArticleCreationResult> {
  const result = await prisma.$transaction(async (tx) => {
    // Get random author
    const authors = await tx.users.findMany({
      where: { role: 'author' },
      select: { id: true, name: true }
    });

    if (authors.length === 0) {
      throw new Error('No authors found in database');
    }

    const randomAuthor = authors[Math.floor(Math.random() * authors.length)];
    console.log(`✍️  Selected random author: ${randomAuthor.name}`);
    console.log(`🔑 Generated slug: ${data.slug}`);

    // Validate slug
    if (!data.slug || data.slug.length < 5) {
      throw new Error(`Invalid slug: "${data.slug}" from title: "${data.title}"`);
    }

    // Check for duplicates
    const existingArticle = await tx.articles.findUnique({
      where: { slug: data.slug },
      select: { id: true, title: true }
    });
    
    if (existingArticle) {
      throw new Error(`Duplicate slug: ${data.slug} (existing: "${existingArticle.title}")`);
    }

    // Validate hero image
    console.log(`\n🖼️  Validating Hero Image for Google Discover...`);
    const heroImageUrl = `/img/hero/tv/${data.primarySeriesId}`;
    
    if (!heroImageUrl) {
      throw new Error('Hero Image fehlt - mindestens 1200 Pixel Breite erforderlich (Google Discover)');
    }
    
    console.log(`   Hero Image URL: ${heroImageUrl}`);
    console.log(`   ✅ Hero Image wird mit 1600x900 (16:9) gespeichert`);

    // Create article
    const article = await tx.articles.create({
      data: {
        id: `pipeline-${Date.now()}`,
        slug: data.slug,
        title: data.title,
        excerpt: smartTruncate(data.metaDescription, 200),
        contentHtml: data.content,
        contentType: data.contentType,
        authorId: randomAuthor.id,
        status: 'published',
        publishedAt: data.now,
        sourcePublishedAt: data.sourceDate,
        sourceUrl: data.sourceUrl,
        readingTime: Math.ceil(data.content.split(' ').length / 200),
        confidence: data.confidence,
        primarySeriesId: data.primarySeriesId,
        publishMode: data.publishMode,
        wasBedeutetDasText: data.wasBedeutetDasText,
        trailerLocalUrl: data.trailerLocalPath,
        ...data.imageData,
        updatedAt: data.now,
      },
    });

    // Create article-series relations
    if (data.relatedSeriesIds.length > 0) {
      await tx.article_series.createMany({
        data: data.relatedSeriesIds.map((seriesId, index) => ({
          articleId: article.id,
          seriesId,
          position: index + 1,
        })),
      });
    }

    // Store Discover Dashboard (with auto-cleanup)
    const dashboardCount = await tx.discover_score_dashboards.count();
    if (dashboardCount >= 1000) {
      const toDelete = dashboardCount - 999;
      const oldestEntries = await tx.discover_score_dashboards.findMany({
        orderBy: { timestamp: 'asc' },
        take: toDelete,
        select: { id: true },
      });
      
      await tx.discover_score_dashboards.deleteMany({
        where: { id: { in: oldestEntries.map(e => e.id) } },
      });
    }

    await tx.discover_score_dashboards.create({
      data: {
        id: `discover-${Date.now()}`,
        articleId: article.id,
        pipelineVersion: 'serien_pipeline_v1',
        headlineMetrics: data.discoverResult.dashboard.headline,
        contentMetrics: data.discoverResult.dashboard.content_opening,
        freshnessMetrics: data.discoverResult.dashboard.freshness,
        imageMetrics: data.discoverResult.dashboard.image_visual,
        trustMetrics: data.discoverResult.dashboard.trust_clarity,
        discoverScore: data.discoverResult.scores.total,
        finalVerdict: data.discoverResult.dashboard.aggregation.final_verdict,
        primaryBlockers: data.discoverResult.dashboard.aggregation.primary_blockers,
        improvementHints: data.discoverResult.dashboard.aggregation.improvement_hints,
      },
    });

    // Store Headline Comparison
    const headlineChanged = data.title !== data.originalHeadline;
    let headlineDelta: number | null = null;
    let comparisonStatus = 'NO_REWRITE';
    
    if (data.headlineWasRewrittenByAntiAi && headlineChanged) {
      const antiAiScoreAfterRewrite = data.antiAiResult.antiAiScore;
      headlineDelta = antiAiScoreAfterRewrite - data.antiAiScoreBeforeRewrite;
      
      if (headlineDelta >= 5) {
        comparisonStatus = 'IMPROVED';
      } else if (headlineDelta <= -5) {
        comparisonStatus = 'WORSE';
      } else {
        comparisonStatus = 'NEUTRAL';
      }
    } else if (headlineChanged) {
      comparisonStatus = 'NEUTRAL';
    }

    await tx.headline_comparisons.create({
      data: {
        id: `headline-${Date.now()}`,
        articleId: article.id,
        headline_original: data.originalHeadline,
        headline_rewritten: headlineChanged ? data.title : null,
        antiAiScore_original: data.headlineWasRewrittenByAntiAi 
          ? data.antiAiScoreBeforeRewrite 
          : data.antiAiResult.antiAiScore,
        antiAiScore_rewritten: data.headlineWasRewrittenByAntiAi 
          ? data.antiAiResult.antiAiScore 
          : null,
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

  return {
    article: {
      id: result.id,
      slug: result.slug,
      title: result.title,
      contentHtml: result.contentHtml,
      publishMode: result.publishMode,
    }
  };
}
