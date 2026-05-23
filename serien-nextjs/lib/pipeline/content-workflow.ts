/**
 * Content Workflow Module
 * Orchestrates the content generation, rewriting, and quality checking
 */

import { generateGermanArticle } from '../content-generator';
import { editorialRewrite } from '../editorial-rewriter';
import { qualityCheck } from '../quality-checker';
import { antiAiFilter } from '../anti-ai-filter';
import { discoverGate } from '../discover-gate';
import { factSafetyCheck } from '../fact-safety-layer';
import { generateDistinctLead } from '../distinct-lead-generator';
import { classifyContentAge, shouldPublishBasedOnAge, neutralizeOldContentHeadline } from '../time-axis-correction';
import { translateFaithful } from '../faithful-translator';

const FAITHFUL_MIN_SOURCE_CHARS = 600;
const FAITHFUL_MIN_OUTPUT_WORDS = 250;

export interface ContentGenerationInput {
  facts: string;
  sourceUrl: string;
  sourceDomain: string;
  targetWordCount: number;
  seriesName: string;
  sourceDate: Date;
  fullSourceText?: string;
}

export interface ContentGenerationResult {
  content: string;
  title: string;
  metaDescription: string;
  originalHeadline: string;
  antiAiResult: any;
  antiAiScoreBeforeRewrite: number;
  headlineWasRewrittenByAntiAi: boolean;
  discoverResult: any;
  publishMode: string;
  shouldSkip: boolean;
  skipReason?: string;
}

/**
 * Generate article content.
 *
 * Tries the FAITHFUL TRANSLATOR first if we have a usable full source text
 * — produces translation that preserves the original journalist's voice,
 * sentence rhythm, paragraph structure and (most importantly) quotes.
 *
 * Falls back to the legacy "rebuilt-from-facts" generator if:
 *   - no full source text available
 *   - source too short (< FAITHFUL_MIN_SOURCE_CHARS chars)
 *   - translator throws (LLM error, JSON parse, etc.)
 *   - translator output too short (< FAITHFUL_MIN_OUTPUT_WORDS words)
 *
 * The returned shape is identical in both paths so the rest of the pipeline
 * is unaware of which generator produced the article.
 */
async function generateContent(
  input: ContentGenerationInput
): Promise<{ content: string; title: string; metaDescription: string; usedFaithful: boolean }> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 3: CONTENT GENERATION');
  console.log('━'.repeat(70));

  // -------- Path A: Faithful Translation --------
  const sourceText = input.fullSourceText?.trim();
  if (sourceText && sourceText.length >= FAITHFUL_MIN_SOURCE_CHARS) {
    try {
      console.log(`🌐 Trying Faithful Translation (source: ${sourceText.length} chars)`);
      const t = await translateFaithful({
        sourceText,
        sourceHeadline: '', // not yet exposed via ContentGenerationInput; LLM derives from text
        sourceUrl: input.sourceUrl,
        seriesName: input.seriesName,
      });

      if (t.wordCount >= FAITHFUL_MIN_OUTPUT_WORDS) {
        console.log(`✅ Faithful translation OK (${t.wordCount}w, ${t.paragraphCount}p, ${t.quotesPreserved}q)`);
        console.log(`   Headline: ${t.headline}`);
        return {
          content: t.contentHtml,
          title: t.headline,
          metaDescription: t.metaDescription,
          usedFaithful: true,
        };
      }
      console.log(`⚠️  Faithful translation output too short (${t.wordCount} < ${FAITHFUL_MIN_OUTPUT_WORDS}w) — falling back`);
    } catch (e: any) {
      console.log(`⚠️  Faithful translation failed: ${e.message} — falling back to rebuilt generator`);
    }
  } else {
    const reason = !sourceText ? 'no source text' : `source too short (${sourceText.length} < ${FAITHFUL_MIN_SOURCE_CHARS}c)`;
    console.log(`⊘ Skipping Faithful Translation (${reason})`);
  }

  // -------- Path B: Legacy rebuilt-from-facts --------
  const generated = await generateGermanArticle(
    input.facts,
    input.sourceUrl,
    input.sourceDomain,
    input.targetWordCount,
    input.seriesName
  );

  console.log(`✅ Rebuilt-from-facts (${generated.wordCount} words)`);
  console.log(`📰 Title: ${generated.title}`);
  console.log(`📝 Meta Description: ${generated.metaDescription}`);

  return {
    content: generated.content,
    title: generated.title,
    metaDescription: generated.metaDescription,
    usedFaithful: false,
  };
}

/**
 * Apply editorial rewrite
 */
async function applyEditorialRewrite(
  content: string,
  title: string,
  seriesName: string,
  sourceUrl: string,
  fullSourceText?: string
): Promise<{ content: string; title: string }> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 4: EDITORIAL REWRITE');
  console.log('━'.repeat(70));
  
  const rewritten = await editorialRewrite(
    content,
    title,
    seriesName,
    sourceUrl,
    fullSourceText
  );
  
  if (rewritten.wasRewritten) {
    console.log('✅ Content rewritten by editorial layer');
    if (rewritten.title !== title) {
      console.log(`   New title: ${rewritten.title}`);
    }
  } else {
    console.log('⊘ Content passed without editorial changes');
  }
  
  return {
    content: rewritten.content,
    title: rewritten.title
  };
}

/**
 * Run quality check
 */
async function checkQuality(
  content: string,
  title: string,
  targetWordCount: number
): Promise<boolean> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 5: QUALITY CHECK');
  console.log('━'.repeat(70));
  
  const qualityResult = await qualityCheck(
    content,
    title,
    targetWordCount
  );
  
  if (qualityResult.passed) {
    console.log('✅ Quality Check PASSED');
  } else {
    console.log('❌ Quality Check FAILED');
    qualityResult.issues.forEach((issue: string) => {
      console.log(`   - ${issue}`);
    });
  }
  
  return qualityResult.passed;
}

/**
 * Check fact safety
 */
async function checkFactSafety(
  content: string,
  facts: string
): Promise<boolean> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 5.5: FACT SAFETY CHECK');
  console.log('━'.repeat(70));
  
  const factResult = await factSafetyCheck(content, facts);
  
  if (factResult.passed) {
    console.log('✅ Fact Safety PASSED');
  } else {
    console.log('❌ Fact Safety FAILED');
    factResult.criticalIssues?.forEach((issue: string) => {
      console.log(`   - ${issue}`);
    });
  }
  
  return factResult.passed;
}

/**
 * Apply anti-AI filter
 */
async function applyAntiAiFilter(
  content: string,
  title: string
): Promise<{
  title: string;
  antiAiResult: any;
  antiAiScoreBeforeRewrite: number;
  headlineWasRewrittenByAntiAi: boolean;
}> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 6: ANTI-AI FILTER');
  console.log('━'.repeat(70));
  
  const antiAiScoreBeforeRewrite = (await antiAiFilter(content, title)).antiAiScore;
  const antiAiResult = await antiAiFilter(content, title);
  
  let finalTitle = title;
  let headlineWasRewrittenByAntiAi = false;
  
  if (!antiAiResult.passed && antiAiResult.rewrittenHeadline) {
    console.log('🔄 Headline rewritten by Anti-AI filter');
    console.log(`   Old: ${title}`);
    console.log(`   New: ${antiAiResult.rewrittenHeadline}`);
    finalTitle = antiAiResult.rewrittenHeadline;
    headlineWasRewrittenByAntiAi = true;
  } else if (antiAiResult.passed) {
    console.log('✅ Anti-AI Filter PASSED');
  }
  
  return {
    title: finalTitle,
    antiAiResult,
    antiAiScoreBeforeRewrite,
    headlineWasRewrittenByAntiAi
  };
}

/**
 * Apply discover gate
 */
async function applyDiscoverGate(
  title: string,
  content: string,
  metaDescription: string,
  seriesName: string,
  sourceDate: Date
): Promise<{
  discoverResult: any;
  publishMode: string;
  metaDescription: string;
}> {
  console.log('\n' + '━'.repeat(70));
  console.log('STEP 7: DISCOVER GATE');
  console.log('━'.repeat(70));
  
  // Time-axis correction
  const contentAge = classifyContentAge(sourceDate);
  const shouldPublish = shouldPublishBasedOnAge(contentAge);
  
  let finalTitle = title;
  if (contentAge.category !== 'FRESH' && contentAge.category !== 'RECENT') {
    finalTitle = neutralizeOldContentHeadline(title);
  }
  
  const discoverResult = await discoverGate(
    finalTitle,
    content,
    metaDescription,
    seriesName,
    sourceDate
  );
  
  // Generate distinct lead if needed
  let finalMetaDescription = metaDescription;
  if (discoverResult.passed) {
    const distinctLead = await generateDistinctLead(finalTitle, content);
    if (distinctLead.leadQuality.passed) {
      finalMetaDescription = distinctLead.lead;
      console.log('✅ Distinct lead generated');
    }
  }
  
  console.log(`✅ Discover Gate: ${discoverResult.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`   Score: ${discoverResult.scores.total}/100`);
  console.log(`   Publish Mode: ${discoverResult.publishMode}`);
  
  return {
    discoverResult,
    publishMode: discoverResult.publishMode,
    metaDescription: finalMetaDescription
  };
}

/**
 * Run the complete content workflow
 */
export async function runContentWorkflow(
  input: ContentGenerationInput
): Promise<ContentGenerationResult> {
  // Step 1: Generate content (Faithful Translation preferred, falls back to rebuilt-from-facts)
  const { content: generatedContent, title, metaDescription, usedFaithful } = await generateContent(input);

  // Step 2: Editorial rewrite — SKIPPED when the faithful translator was used.
  // The whole point of the faithful path is to preserve the original
  // journalist's voice; running another paraphrasing pass would re-AI-ify
  // exactly the sentences we want to keep verbatim.
  let rewrittenContent = generatedContent;
  let rewrittenTitle = title;
  if (!usedFaithful) {
    const r = await applyEditorialRewrite(
      generatedContent,
      title,
      input.seriesName,
      input.sourceUrl,
      input.fullSourceText
    );
    rewrittenContent = r.content;
    rewrittenTitle = r.title;
  } else {
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4: EDITORIAL REWRITE  ⊘ skipped (faithful translation preserves voice)');
    console.log('━'.repeat(70));
  }
  
  // Step 3: Quality check
  const qualityPassed = await checkQuality(
    rewrittenContent,
    rewrittenTitle,
    input.targetWordCount
  );
  
  if (!qualityPassed) {
    return {
      content: '',
      title: '',
      metaDescription: '',
      originalHeadline: title,
      antiAiResult: null,
      antiAiScoreBeforeRewrite: 0,
      headlineWasRewrittenByAntiAi: false,
      discoverResult: null,
      publishMode: 'SKIP',
      shouldSkip: true,
      skipReason: 'Quality check failed'
    };
  }
  
  // Step 4: Fact safety check
  const factSafetyPassed = await checkFactSafety(rewrittenContent, input.facts);
  
  if (!factSafetyPassed) {
    return {
      content: '',
      title: '',
      metaDescription: '',
      originalHeadline: title,
      antiAiResult: null,
      antiAiScoreBeforeRewrite: 0,
      headlineWasRewrittenByAntiAi: false,
      discoverResult: null,
      publishMode: 'SKIP',
      shouldSkip: true,
      skipReason: 'Fact safety check failed'
    };
  }
  
  // Step 5: Anti-AI filter
  const {
    title: finalTitle,
    antiAiResult,
    antiAiScoreBeforeRewrite,
    headlineWasRewrittenByAntiAi
  } = await applyAntiAiFilter(rewrittenContent, rewrittenTitle);
  
  // Step 6: Discover gate
  const {
    discoverResult,
    publishMode,
    metaDescription: finalMetaDescription
  } = await applyDiscoverGate(
    finalTitle,
    rewrittenContent,
    metaDescription,
    input.seriesName,
    input.sourceDate
  );
  
  return {
    content: rewrittenContent,
    title: finalTitle,
    metaDescription: finalMetaDescription,
    originalHeadline: title,
    antiAiResult,
    antiAiScoreBeforeRewrite,
    headlineWasRewrittenByAntiAi,
    discoverResult,
    publishMode,
    shouldSkip: false
  };
}
