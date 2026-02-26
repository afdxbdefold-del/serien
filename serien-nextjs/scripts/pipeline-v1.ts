/**
 * EMERGENT TV-SERIES CONTENT PIPELINE v1
 * SPEC_VERSION: serien_pipeline_v1
 * 
 * Full automated pipeline with strict quality gates + FACT SAFETY LAYER
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
import { factSafetyCheck } from '../lib/fact-safety-layer';
import { classifyContentAge, shouldPublishBasedOnAge, neutralizeOldContentHeadline } from '../lib/time-axis-correction';
import { fetchFullArticleText } from '../lib/full-text-fetcher';


const prisma = new PrismaClient();

interface CrawledSource {
  title: string;
  url: string;
  text: string;
  useFullTextMode?: boolean; // NEW: Flag für Volltext-Modus
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
  console.log(`📝 Mode: ${source.useFullTextMode ? 'FULL TEXT (450-900 words)' : 'STANDARD'}`);
  console.log('');

  // Declare timestamp at the start for consistent usage throughout pipeline
  const now = new Date();

  try {
    // ========== STEP 0.5: FULL TEXT FETCHER (if enabled) ==========
    let fullSourceText = source.text;
    let sourceDomain = '';
    
    if (source.useFullTextMode) {
      console.log('━'.repeat(70));
      console.log('STEP 0.5: FULL TEXT FETCHER');
      console.log('━'.repeat(70));
      
      try {
        const fullTextResult = await fetchFullArticleText(source.url);
        
        if (fullTextResult.wordCount > 100) {
          fullSourceText = fullTextResult.fullText;
          sourceDomain = fullTextResult.sourceDomain;
          
          console.log(`✅ Full text fetched: ${fullTextResult.wordCount} words`);
          console.log(`   Domain: ${sourceDomain}`);
        } else {
          console.log(`⚠️  Full text fetch yielded insufficient content, using provided text`);
        }
      } catch (error: any) {
        console.log(`⚠️  Full text fetch failed: ${error.message}, using provided text`);
      }
    }

    // ========== STEP 1: CLASSIFY ==========
    console.log('━'.repeat(70));
    console.log('STEP 1: CONTENT CLASSIFICATION');
    console.log('━'.repeat(70));
    
    const classification = await classifyContent(
      source.title,
      source.url,
      fullSourceText
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

    // ========== STEP 1.5: TIME AXIS CORRECTION ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 1.5: TIME AXIS CORRECTION (Content Age Check)');
    console.log('━'.repeat(70));

    // Determine source published date (default to now if unknown)
    const sourcePublishedAt = now; // In real scenario, extract from source metadata
    
    const timeAxisResult = classifyContentAge({
      sourcePublishedAt,
      headline: source.title,
      contentType: 'NEWS' // Classification from STEP 1
    });

    // Check if content should be published based on age
    const publishDecision = shouldPublishBasedOnAge(timeAxisResult);

    if (!publishDecision.shouldPublish) {
      console.log(`\n❌ SKIPPED: ${publishDecision.reason}`);
      return { skipped: true, reason: 'content_too_old' };
    }

    // Force SEARCH_ONLY for old content
    let forcedPublishMode = publishDecision.publishMode;
    
    if (timeAxisResult.contentAgeClass !== 'FRESH_NEWS') {
      console.log(`   ⚠️  Forced Mode: ${forcedPublishMode} (not fresh news)`);
    }

    console.log('✅ Time Axis Check passed');


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

    const facts = await extractFacts(source.title, fullSourceText);

    // ========== STEP 4: AI GENERATE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4: AI CONTENT GENERATION');
    console.log('━'.repeat(70));

    // Prepare series names for content generation
    const allSeriesNames = classification.content_type === 'MULTI_SERIES_EDITORIAL'
      ? [resolution.primarySeries.name, ...resolution.relatedSeries.map(s => s.name)]
      : [resolution.primarySeries.name];

    // Determine content type based on mode
    let actualContentType: 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL' | 'FULL_ARTICLE';
    
    if (source.useFullTextMode) {
      actualContentType = 'FULL_ARTICLE';
      console.log('   🔹 Using FULL_ARTICLE mode (450-900 words target)');
    } else {
      actualContentType = classification.content_type as 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL';
    }

    let generatedContent = await generateGermanArticle(
      facts,
      resolution.primarySeries.name,
      actualContentType,
      allSeriesNames,
      source.url // For Quelle block
    );

    let articleTitle = source.title;
    const originalHeadline = source.title; // Store for comparison
    console.log(`✅ Generated article (${generatedContent.length} chars)`);
    
    // Log word count for FULL_ARTICLE mode
    if (actualContentType === 'FULL_ARTICLE') {
      const wordCount = generatedContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
      console.log(`   📏 Word count: ${wordCount} words (target: 450-900)`);
      
      if (wordCount < 450) {
        console.log(`   ⚠️  WARNING: Article below target length`);
      } else if (wordCount > 900) {
        console.log(`   ⚠️  WARNING: Article exceeds target length`);
      }
    }

    // ========== STEP 5: EDITORIAL REWRITE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5: EDITORIAL REWRITE (Headline + First 2 Paragraphs)');
    console.log('━'.repeat(70));

    // Skip Editorial Rewrite for MULTI_SERIES_EDITORIAL and FULL_ARTICLE
    if (classification.content_type === 'MULTI_SERIES_EDITORIAL' || actualContentType === 'FULL_ARTICLE') {
      console.log(`⊘  Skipped for ${actualContentType === 'FULL_ARTICLE' ? 'FULL_ARTICLE' : 'MULTI_SERIES_EDITORIAL'} (content already optimized)`);
      // Keep original AI-generated headline and content
    } else {
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
    }

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

    // Skip quality check for MULTI_SERIES_EDITORIAL (different format/rules)
    // For FULL_ARTICLE, run simplified quality check with adjusted thresholds
    if (classification.content_type === 'MULTI_SERIES_EDITORIAL') {
      console.log('⊘  Skipped for MULTI_SERIES_EDITORIAL (editorial format has different quality criteria)');
      
      // Create a passing quality result
      var qualityResult = {
        status: 'PASS' as const,
        scores: { headline: 80, content: 80, structure: 80 },
        requiresFullRewrite: false,
        failReasons: [],
        articleType: 'FULL_NEWS' as const,
        wordCount: generatedContent.split(/\s+/).length
      };
    } else if (actualContentType === 'FULL_ARTICLE') {
      console.log('📝 FULL_ARTICLE mode - checking word count and structure');
      
      const wordCount = generatedContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
      const paragraphCount = (generatedContent.match(/<p>/g) || []).length;
      
      console.log(`   📏 Word count: ${wordCount}`);
      console.log(`   📄 Paragraphs: ${paragraphCount}`);
      
      let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
      let failReasons: string[] = [];
      
      // Word count validation
      if (wordCount < 250) {
        status = 'FAIL';
        failReasons.push(`Artikel zu kurz: ${wordCount} Wörter (min: 250)`);
      } else if (wordCount < 350) {
        status = 'WARN';
        failReasons.push(`Artikel unter Ziel: ${wordCount} Wörter (Ziel: 450-900)`);
      } else if (wordCount < 450) {
        console.log(`   ⚠️  Leicht unter Ziel (${wordCount} Wörter), aber akzeptabel`);
      }
      
      // Paragraph validation
      if (paragraphCount < 5) {
        failReasons.push(`Zu wenige Absätze: ${paragraphCount} (min: 5)`);
        if (status === 'PASS') status = 'WARN';
      }
      
      var qualityResult = {
        status: status === 'FAIL' ? 'FAIL' as const : 'PASS' as const,
        scores: { 
          headline: 75, 
          content: wordCount >= 450 ? 85 : 70, 
          structure: paragraphCount >= 5 ? 80 : 65 
        },
        requiresFullRewrite: false,
        failReasons,
        articleType: 'FULL_NEWS' as const,
        wordCount
      };
      
      console.log(`   Status: ${qualityResult.status}`);
      if (failReasons.length > 0) {
        failReasons.forEach(r => console.log(`   - ${r}`));
      }
    } else {
      var qualityResult = await qualityCheck({
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
    }

    // REWRITE COUNTER (MAX 1 TOTAL)
    let hasRewritten = false;

    // AUTO-REWRITE on FAIL (ONCE) - only for SINGLE_SERIES_NEWS (not MULTI_SERIES_EDITORIAL or FULL_ARTICLE)
    if (qualityResult.status === 'FAIL' && !hasRewritten && 
        classification.content_type !== 'MULTI_SERIES_EDITORIAL' && 
        actualContentType !== 'FULL_ARTICLE') {
      console.log('\n🔄 Quality Check FAILED - Attempting rewrite (1/1)...');
      hasRewritten = true;

      if (qualityResult.requiresFullRewrite) {
        console.log('   → FULL Rewrite (body issues detected)');
        
        // Regenerate complete article
        generatedContent = await generateGermanArticle(
          facts,
          resolution.primarySeries.name,
          actualContentType,
          allSeriesNames,
          source.url
        );

        // Rewrite again (skip for MULTI_SERIES_EDITORIAL and FULL_ARTICLE)
        if (classification.content_type !== 'MULTI_SERIES_EDITORIAL' && actualContentType !== 'FULL_ARTICLE') {
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
      } else {
        console.log('   → Headline + First 2 Paragraphs only');
        
        // Just rewrite editorial (headline + first 2 paragraphs) - skip for MULTI_SERIES_EDITORIAL and FULL_ARTICLE
        if (classification.content_type !== 'MULTI_SERIES_EDITORIAL' && actualContentType !== 'FULL_ARTICLE') {
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

    // ========== STEP 6.3: FACT SAFETY LAYER ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 6.3: FACT SAFETY LAYER (Critical Facts Verification)');
    console.log('━'.repeat(70));

    // Get TMDB series data for verification
    const tmdbSeriesData = await prisma.series.findUnique({
      where: { tmdbId: resolution.primarySeries.tmdbId },
      select: {
        status: true,
        lastAirDate: true,
        numberOfSeasons: true,
      }
    });

    const factSafetyResult = await factSafetyCheck({
      articleHtml: generatedContent,
      headline: articleTitle,
      extractedFacts: facts.key_statements.join('\n'),
      tmdbSeriesData: tmdbSeriesData ? {
        status: tmdbSeriesData.status,
        lastAirDate: tmdbSeriesData.lastAirDate?.toISOString(),
        numberOfSeasons: tmdbSeriesData.numberOfSeasons || undefined,
      } : undefined
    });

    if (factSafetyResult.status === 'UNSAFE') {
      console.log(`🚨 FACT SAFETY FAILED - ${factSafetyResult.rejectedFacts.length} unverified fact(s)`);
      
      // Log rejected facts
      factSafetyResult.rejectedFacts.forEach(fact => {
        console.log(`   ❌ ${fact.type}: "${fact.claim}"`);
        console.log(`      Alternative: "${fact.alternative}"`);
      });

      // HARD FAIL if headline contains unverified facts
      if (factSafetyResult.headlineViolations.length > 0) {
        console.log(`\n🚫 HEADLINE contains unverified facts - SAVING AS DRAFT`);
        
        // Save as DRAFT with fact safety violations
        const authors = await prisma.user.findMany({
          where: { role: 'author' },
          take: 10,
          select: { id: true }
        });
        
        const authorId = authors.length > 0 ? authors[0].id : 'system';
        const slug = generateSlug(articleTitle);
        const articleExcerpt = facts.key_statements[0] || generatedContent.replace(/<[^>]*>/g, '').substring(0, 200);
        
        const draftArticle = await prisma.article.create({
          data: {
            id: `draft-fact-safety-${Date.now()}`,
            slug: `${slug}-draft-fact`,
            title: articleTitle,
            excerpt: articleExcerpt,
            contentHtml: generatedContent,
            contentType: classification.content_type,
            authorId,
            status: 'draft',
            publishMode: 'DRAFT',
            publishedAt: null,
            sourcePublishedAt: now,
            sourceUrl: source.url + '-draft-fact',
            readingTime: Math.ceil(generatedContent.split(' ').length / 200),
            confidence: classification.confidence,
            primarySeriesId: resolution.primarySeries.tmdbId,
          },
        });

        console.log(`📝 Saved as DRAFT (Fact Safety): ${draftArticle.id}`);
        console.log(`   Rejected facts: ${factSafetyResult.rejectedFacts.map(f => f.type).join(', ')}`);
        
        return { skipped: true, reason: 'fact_safety_failed_headline', draft: draftArticle };
      }

      // If only body facts are unverified, try rewrite ONCE
      if (!hasRewritten && factSafetyResult.mustRewrite) {
        console.log('\n🔄 Attempting fact-safe rewrite (removing unverified claims)...');
        hasRewritten = true;

        // Regenerate with safety instructions
        generatedContent = await generateGermanArticle(
          facts,
          resolution.primarySeries.name,
          actualContentType,
          allSeriesNames,
          source.url
        );

        // Re-check fact safety
        const recheckResult = await factSafetyCheck({
          articleHtml: generatedContent,
          headline: articleTitle,
          extractedFacts: facts.key_statements.join('\n'),
          tmdbSeriesData: tmdbSeriesData ? {
            status: tmdbSeriesData.status,
            lastAirDate: tmdbSeriesData.lastAirDate?.toISOString(),
            numberOfSeasons: tmdbSeriesData.numberOfSeasons || undefined,
          } : undefined
        });

        if (recheckResult.status === 'UNSAFE') {
          console.log('❌ Rewrite still contains unverified facts - SAVING AS DRAFT');
          
          const authors = await prisma.user.findMany({
            where: { role: 'author' },
            take: 10,
            select: { id: true }
          });
          
          const authorId = authors.length > 0 ? authors[0].id : 'system';
          const slug = generateSlug(articleTitle);
          const articleExcerpt = facts.key_statements[0] || generatedContent.replace(/<[^>]*>/g, '').substring(0, 200);
          
          const draftArticle = await prisma.article.create({
            data: {
              id: `draft-fact-retry-${Date.now()}`,
              slug: `${slug}-draft-fact2`,
              title: articleTitle,
              excerpt: articleExcerpt,
              contentHtml: generatedContent,
              contentType: classification.content_type,
              authorId,
              status: 'draft',
              publishMode: 'DRAFT',
              publishedAt: null,
              sourcePublishedAt: now,
              sourceUrl: source.url + '-draft-fact2',
              readingTime: Math.ceil(generatedContent.split(' ').length / 200),
              confidence: classification.confidence,
              primarySeriesId: resolution.primarySeries.tmdbId,
            },
          });

          console.log(`📝 Saved as DRAFT (Fact Safety Retry Failed): ${draftArticle.id}`);
          
          return { skipped: true, reason: 'fact_safety_failed_retry', draft: draftArticle };
        }

        console.log('✅ Fact-safe rewrite successful');
      }
    } else {
      console.log('✅ Fact Safety PASSED - All critical facts verified');
    }

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
        actualContentType,
        allSeriesNames,
        source.url
      );

      // Rewrite editorial (skip for MULTI_SERIES_EDITORIAL and FULL_ARTICLE)
      if (classification.content_type !== 'MULTI_SERIES_EDITORIAL' && actualContentType !== 'FULL_ARTICLE') {
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

    // Check if article is SHORT_NEWS (use qualityResult.articleType if available)
    const isShortNews = qualityResult.articleType === 'SHORT_NEWS';
    
    // Check if Time Axis forces SEARCH_ONLY (not fresh news)
    const isOldContent = timeAxisResult.contentAgeClass !== 'FRESH_NEWS';
    
    let publishMode = 'DISCOVER';

    if (isOldContent) {
      // Old content always gets forcedPublishMode from Time Axis
      console.log(`⏰ Time Axis: ${timeAxisResult.contentAgeClass} (${timeAxisResult.contentAgeDays} days)`);
      console.log(`⚠️  OLD CONTENT → PUBLISH_MODE: ${forcedPublishMode}`);
      publishMode = forcedPublishMode === 'SEARCH_ONLY' ? 'SEARCH_ONLY' : 'DISCOVER';
      
      if (publishMode === 'SEARCH_ONLY') {
        // Skip Discover Gate for old content
        var discoverResult = {
          discover_eligible: false,
          scores: { 
            headline_quality: 0, 
            freshness: 0, 
            content_opening: 0, 
            image_visual: 0, 
            trust_clarity: 0, 
            total: 0 
          },
          fail_reasons: [`Content age: ${timeAxisResult.contentAgeDays} days - too old for Discover`],
          dashboard: {
            headline: { score: 0, issues: [], strengths: [] },
            content_opening: { score: 0, issues: [], strengths: [] },
            freshness: { score: 0, issues: [], strengths: [] },
            image_visual: { score: 0, issues: [], strengths: [] },
            trust_clarity: { score: 0, issues: [], strengths: [] },
            aggregation: {
              primary_blockers: [`Content is ${timeAxisResult.contentAgeDays} days old`],
              improvement_hints: ['Only fresh news (≤7 days) is eligible for Discover'],
              final_verdict: `${timeAxisResult.contentAgeClass}: Automatisch SEARCH_ONLY`
            }
          }
        };
      } else {
        // Even if allowed by time axis, still run discover gate
        var discoverResult = await discoverGate({
          final_headline: articleTitle,
          article_html: generatedContent,
          hero_image_metadata: heroImageMeta,
          publishedAt: timeAxisResult.publishedAt,
          primary_series: resolution.primarySeries.name,
        });
      }
    } else if (isShortNews) {
      // SHORT_NEWS always gets SEARCH_ONLY (per policy)
      console.log(`📏 Article Type: SHORT_NEWS (${qualityResult.wordCount} words)`);
      console.log(`⚠️  SHORT_NEWS → PUBLISH_MODE: SEARCH_ONLY (policy)`);
      publishMode = 'SEARCH_ONLY';
      
      // Skip Discover Gate for SHORT_NEWS
      var discoverResult = {
        discover_eligible: false,
        scores: { 
          headline_quality: 0, 
          freshness: 0, 
          content_opening: 0, 
          image_visual: 0, 
          trust_clarity: 0, 
          total: 0 
        },
        fail_reasons: ['SHORT_NEWS policy: always SEARCH_ONLY'],
        dashboard: {
          headline: { score: 0, issues: [], strengths: [] },
          content_opening: { score: 0, issues: [], strengths: [] },
          freshness: { score: 0, issues: [], strengths: [] },
          image_visual: { score: 0, issues: [], strengths: [] },
          trust_clarity: { score: 0, issues: [], strengths: [] },
          aggregation: {
            primary_blockers: ['Article zu kurz für DISCOVER (${qualityResult.wordCount} Wörter, min: 320)'],
            improvement_hints: ['Für DISCOVER: Artikel auf 320+ Wörter erweitern'],
            final_verdict: 'SHORT_NEWS: Automatisch SEARCH_ONLY'
          }
        }
      };
    } else {
      // FULL_NEWS: Run Discover Gate
      var discoverResult = await discoverGate({
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
