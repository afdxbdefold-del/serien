/**
 * PIPELINE_V2: RANKING/LISTICLE PIPELINE
 * Specialized pipeline for ranking/list articles with chunked processing
 * 
 * Features:
 * - TMDB Resolution
 * - Chunked content generation (5 items/batch)
 * - SEO optimization (Meta Description)
 * - Relaxed quality checks
 * - Database save
 */

import { PrismaClient } from '@prisma/client';
import { createLLMClient, LLM_CONFIG } from './llm-config';
import { classifyContent } from './content-classifier';
import { resolveSingleSeries } from './tmdb-resolver';
import { extractFacts } from './fact-extractor';
import { generateMetaDescription } from './meta-description-generator';
import { storeHeroImage } from './image-storage';
import { findTrailerYouTubeId, downloadYouTubeTrailer, searchYouTubeTrailerViaAPI } from './trailer-downloader';
import { v4 as uuidv4 } from 'uuid';
import { smartTruncate } from './smart-truncate';

const prisma = new PrismaClient();

interface RankingPipelineInput {
  sourceTitle: string;
  sourceUrl: string;
  sourceText: string;
  itemCount: number;
  primarySeriesId?: number;
  primarySeriesName?: string;
}

const RANKING_INTRO_PROMPT = `Schreibe eine Einleitung (2-3 Absätze, 120-180 Wörter) für ein Serien-Ranking.

Absatz 1: Serie, Plattform, kurzer Kontext. Absatz 2: Was wird gerankt, nach welchen Kriterien? Absatz 3 (optional): Warum jetzt relevant?

Sachlich-enthusiastisch, faktenbasiert. Jede Einleitung muss unique und spezifisch für diesen Artikel sein. Reiner Text.`;

const RANKING_BATCH_PROMPT = `Schreibe Beschreibungen für Ranking-Items. Exakte HTML-Struktur pro Item:

<h2>{Platz}. {Titel}</h2>
<p><strong>Staffel/Episode:</strong> [Info oder "Unbekannt"]</p>
<p><strong>Kontext:</strong> [2-4 Sätze: Handlungsbogen, Situation]</p>
<p><strong>Highlight:</strong> [3-4 Sätze: Konkrete Szenen/Momente]</p>
<p><strong>Warum Top:</strong> [2-3 Sätze: Begründung]</p>

120-180 Wörter pro Item (N<=10), 80-140 (N>10). Konkret mit Plot-Details, sachlich. Keine Inline-Labels außerhalb von <strong>-Tags.`;


/**
 * Generate ranking intro
 */
async function generateRankingIntro(
  seriesName: string,
  platform: string,
  itemCount: number,
  facts: string[]
): Promise<string> {
  const client = createLLMClient();
  
  const userPrompt = `
Serie: ${seriesName}
Plattform: ${platform || 'Streaming'}
Anzahl Items im Ranking: ${itemCount}

Fakten zur Serie:
${facts.slice(0, 5).map((f, i) => `${i + 1}. ${f}`).join('\n')}

Schreibe jetzt die Einleitung (120-180 Wörter).
`.trim();
  
  const response = await client.chat.completions.create({
    model: LLM_CONFIG.model,
    messages: [
      { role: 'system', content: RANKING_INTRO_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_completion_tokens: 400,
  });
  
  const intro = response.choices[0]?.message?.content?.trim() || '';
  
  // QUALITY CHECK: Reject generic phrases
  const forbiddenPhrases = [
    'aktuelle entwicklungen zu',
    'neue informationen zu',
    'offiziell bekannt und verständlich zusammengefasst',
    'offiziell bekannt und zusammengefasst',
    'verständlich zusammengefasst'
  ];
  
  const introLower = intro.toLowerCase();
  for (const phrase of forbiddenPhrases) {
    if (introLower.includes(phrase)) {
      console.error(`❌ Intro contains forbidden phrase: "${phrase}"`);
      throw new Error(`Intro quality check failed: Contains forbidden phrase "${phrase}"`);
    }
  }
  
  console.log(`✅ Intro quality check passed`);
  return intro;
}

/**
 * Generate a batch of ranking items
 */
async function generateRankingBatch(
  seriesName: string,
  batchItems: Array<{ rank: number; title: string; context: string }>,
  facts: string[]
): Promise<string> {
  const client = createLLMClient();
  
  const itemsDescription = batchItems.map(item => 
    `Platz ${item.rank}: ${item.title} - ${item.context}`
  ).join('\n');
  
  const userPrompt = `
Serie: ${seriesName}
Batch-Items (${batchItems.length} Stück):
${itemsDescription}

Zusätzliche Fakten:
${facts.slice(0, 10).map((f, i) => `${i + 1}. ${f}`).join('\n')}

Schreibe jetzt die Beschreibungen für alle ${batchItems.length} Items (je 80-140 Wörter pro Item).
`.trim();
  
  const response = await client.chat.completions.create({
    model: LLM_CONFIG.model,
    messages: [
      { role: 'system', content: RANKING_BATCH_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_completion_tokens: Math.min(2000, batchItems.length * 300),
  });
  
  return response.choices[0]?.message?.content?.trim() || '';
}

/**
 * Extract items from source text
 */
function extractRankingItems(sourceText: string, itemCount: number): Array<{ rank: number; title: string; context: string }> {
  const items: Array<{ rank: number; title: string; context: string }> = [];
  
  // Try to extract from H2/H3 headings
  const headingRegex = /<h[23][^>]*>(.*?)<\/h[23]>/gi;
  const headings = Array.from(sourceText.matchAll(headingRegex));
  
  if (headings.length >= itemCount) {
    headings.slice(0, itemCount).forEach((match, i) => {
      const title = match[1].replace(/<[^>]*>/g, '').trim();
      const rank = i + 1;
      
      // Extract some context after the heading (next 200 chars)
      const startIndex = match.index! + match[0].length;
      const context = sourceText.substring(startIndex, startIndex + 200).replace(/<[^>]*>/g, ' ').trim();
      
      items.push({ rank, title, context });
    });
  } else {
    // Fallback: Generate generic items
    for (let i = 1; i <= itemCount; i++) {
      items.push({
        rank: i,
        title: `Episode/Item ${i}`,
        context: 'Weitere Details zur Episode',
      });
    }
  }
  
  return items;
}

/**
 * Main PIPELINE_V2 function
 */
export async function runRankingPipeline(input: RankingPipelineInput): Promise<any> {
  console.log('\n' + '='.repeat(70));
  console.log('🎯 PIPELINE_V2: RANKING/LISTICLE PIPELINE');
  console.log('='.repeat(70));
  console.log(`📄 Title: ${input.sourceTitle}`);
  console.log(`📊 Item Count: ${input.itemCount}`);
  console.log(`🔗 URL: ${input.sourceUrl}`);
  console.log('');
  
  try {
    // ========== STEP 1: CLASSIFY & RESOLVE SERIES ==========
    console.log('━'.repeat(70));
    console.log('STEP 1: SERIES CLASSIFICATION & TMDB RESOLUTION');
    console.log('━'.repeat(70));
    
    const classification = await classifyContent(input.sourceTitle, input.sourceUrl, input.sourceText);
    console.log(`📊 Classification: ${classification.content_type}`);
    console.log(`   Confidence: ${classification.confidence}%`);
    
    if (classification.content_type !== 'SINGLE_SERIES_NEWS' && 
        classification.content_type !== 'SINGLE_SERIES_EDITORIAL') {
      console.log('⚠️  Multi-series rankings not yet supported');
      return { skipped: true, reason: 'multi_series_ranking' };
    }
    
    // Extract series name from classification or title
    const seriesName = (classification.series_found && classification.series_found[0]) 
      || input.primarySeriesName 
      || input.sourceTitle
          .split(':')[0]  // Take part before colon
          .replace(/\b(top|best|worst|ranked|ranking|episodes?|staffel|die besten|greatest)\b/gi, '') // Remove ranking keywords
          .replace(/['']s?\s+\d+/g, '') // Remove possessive + numbers
          .trim();
      
    console.log(`🔍 Resolving series: ${seriesName}`);
    
    const resolvedSeries = await resolveSingleSeries(seriesName);
    
    if (!resolvedSeries) {
      console.log('❌ Could not resolve primary series');
      return { skipped: true, reason: 'series_not_found' };
    }
    
    console.log(`✅ Primary Series: ${seriesName} (TMDB: ${resolvedSeries.tmdbId})`);
    
    // Fetch full series details from DB
    const primarySeries = await prisma.series.findUnique({
      where: { tmdbId: resolvedSeries.tmdbId },
    });
    
    if (!primarySeries) {
      console.log('❌ Series not found in database');
      return { skipped: true, reason: 'series_not_in_db' };
    }
    
    // Update input with resolved series
    input.primarySeriesName = primarySeries.name || primarySeries.title;
    input.primarySeriesId = primarySeries.tmdbId;
    
    // ========== STEP 2: EXTRACT FACTS ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 2: FACT EXTRACTION');
    console.log('━'.repeat(70));
    
    const facts = await extractFacts(input.sourceTitle, input.sourceText);
    console.log(`✅ Facts extracted:`);
    console.log(`   Series: ${facts.series_names?.length || 0}`);
    console.log(`   People: ${facts.people_names?.length || 0}`);
    console.log(`   Key statements: ${facts.key_statements?.length || 0}`);
    
    // ========== STEP 3: EXTRACT ITEMS ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 3: EXTRACT RANKING ITEMS');
    console.log('━'.repeat(70));
    
    const items = extractRankingItems(input.sourceText, input.itemCount);
    console.log(`✅ Extracted ${items.length} items`);
    
    // ========== STEP 4: GENERATE INTRO ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4: GENERATE INTRO');
    console.log('━'.repeat(70));
    
    const intro = await generateRankingIntro(
      input.primarySeriesName!,
      primarySeries.networks?.[0] || 'Streaming',
      input.itemCount,
      facts.key_statements
    );
    
    console.log(`✅ Intro generated (${intro.length} chars)`);
    
    // ========== STEP 5: GENERATE ITEMS IN BATCHES ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5: GENERATE ITEMS (BATCHED)');
    console.log('━'.repeat(70));
    
    const batchSize = 5;
    const generatedItems: string[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, Math.min(i + batchSize, items.length));
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(items.length / batchSize);
      
      console.log(`\n🔄 Batch ${batchNum}/${totalBatches} (${batch.length} items)...`);
      
      const batchContent = await generateRankingBatch(
        input.primarySeriesName!,
        batch,
        facts.key_statements
      );
      
      generatedItems.push(batchContent);
      console.log(`✅ Batch ${batchNum} generated (${batchContent.length} chars)`);
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // ========== STEP 6: COMBINE CONTENT ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 6: COMBINE & FORMAT');
    console.log('━'.repeat(70));
    
    const fullContent = `
<p>${intro.split('\n\n').join('</p>\n\n<p>')}</p>

${generatedItems.join('\n\n')}

<p>Diese Auswahl zeigt, warum ${input.primarySeriesName} zu den besten Serien ihrer Art gehört und ein Muss für alle Fans des Genres ist.</p>
    `.trim();
    
    const wordCount = fullContent.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
    
    console.log(`✅ Combined content`);
    console.log(`   Word count: ${wordCount}`);
    console.log(`   Target: 900-1800 words`);
    
    if (wordCount < 900) {
      console.log(`⚠️  Below target (${wordCount} < 900)`);
    } else if (wordCount > 1800) {
      console.log(`⚠️  Above target (${wordCount} > 1800)`);
    } else {
      console.log(`✅ Within target range!`);
    }
    
    // ========== STEP 7: GENERATE META DESCRIPTION ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 7: META DESCRIPTION');
    console.log('━'.repeat(70));
    
    const metaDescription = await generateMetaDescription({
      content: fullContent,
      title: input.sourceTitle,
      seriesName: input.primarySeriesName!,
    });
    
    console.log(`✅ Meta description generated (${metaDescription.length} chars)`);
    
    // ========== STEP 8: TRANSLATE HEADLINE (PRESERVE ORIGINAL) ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 8: HEADLINE TRANSLATION');
    console.log('━'.repeat(70));
    
    // For rankings, translate to German but preserve original wording/intent
    const isEnglish = /[a-z]/i.test(input.sourceTitle) && !/[äöüß]/i.test(input.sourceTitle);
    
    let finalHeadline = input.sourceTitle;
    
    if (isEnglish) {
      // Simple translation mapping for rankings
      finalHeadline = input.sourceTitle
        .replace(/Best Episodes/gi, 'Beste Episoden')
        .replace(/Top Episodes/gi, 'Top-Episoden')
        .replace(/Ranked/gi, '')
        .replace(/Episodes/gi, 'Episoden')
        .replace(/Must-Watch/gi, 'Muss man sehen')
        .replace(/Greatest/gi, 'Größte')
        .replace(/Worst/gi, 'Schlechteste')
        .replace(/\s*,\s*$/,'') // Remove trailing comma
        .trim()
        .replace(/\s+/g, ' ');
      
      console.log(`   Original: ${input.sourceTitle}`);
      console.log(`   Translated: ${finalHeadline}`);
      console.log(`   Mode: TRANSLATED_PRESERVED`);
    } else {
      console.log(`   Already German: ${finalHeadline}`);
    }
    
    // Fallback if translation failed
    if (!finalHeadline || finalHeadline.length < 10) {
      finalHeadline = input.sourceTitle;
      console.log(`   ⚠️  Translation failed, using original`);
    }
    
    console.log(`✅ Final Headline: ${finalHeadline}`);
    
    // ========== STEP 9: PROCESS IMAGES ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 9: IMAGE PROCESSING');
    console.log('━'.repeat(70));
    
    // Fetch series hero image from TMDB
    let heroImagePath = null;
    
    if (primarySeries.backdropPath) {
      try {
        const imageUrl = `https://image.tmdb.org/t/p/original${primarySeries.backdropPath}`;
        console.log(`📥 Fetching hero image from TMDB...`);
        const storedPath = await storeHeroImage(imageUrl, 'series', primarySeries.tmdbId);
        heroImagePath = storedPath;
        console.log(`✅ Hero image stored: ${storedPath}`);
      } catch (error: any) {
        console.log(`⚠️  Hero image failed: ${error.message}`);
      }
    } else {
      console.log('⚠️  No backdrop image available for series');
    }
    
    // ========== STEP 10: SAVE TO DATABASE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 10: DATABASE SAVE');
    console.log('━'.repeat(70));
    
    // Select random author from database
    const authors = await prisma.users.findMany({
      where: {
        email: {
          contains: '@serien.de',
        },
        NOT: {
          OR: [
            { email: 'redaktion@serien.de' },
            { email: 'admin@serien.de' },
          ],
        },
      },
      select: { id: true, email: true, name: true },
    });
    
    // Filter to only real authors (author_XXX IDs)
    const realAuthors = authors.filter(a => 
      a.id.startsWith('author_') || a.id === 'author-julia'
    );
    
    const selectedAuthor = realAuthors.length > 0
      ? realAuthors[Math.floor(Math.random() * realAuthors.length)]
      : authors[0]; // Fallback to first author
    
    console.log(`✍️  Selected author: ${selectedAuthor.name || selectedAuthor.email}`);
    
    // ========== STEP: TRAILER DOWNLOAD ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP: TRAILER DOWNLOAD');
    console.log('━'.repeat(70));
    
    let trailerLocalPath: string | null = null;
    
    try {
      // Step A: re-use any existing per-article trailer for this series
      const existingTrailer = await prisma.articles.findFirst({
        where: {
          primarySeriesId: primarySeries.tmdbId,
          trailerLocalUrl: { not: null }
        },
        select: { 
          trailerLocalUrl: true,
          title: true
        }
      });
      
      if (existingTrailer?.trailerLocalUrl) {
        console.log(`✅ Reusing existing trailer from DB`);
        console.log(`   Source: "${existingTrailer.title}"`);
        console.log(`   Path: ${existingTrailer.trailerLocalUrl}`);
        trailerLocalPath = existingTrailer.trailerLocalUrl;
      } else {
        // Step B: re-use the series-level localTrailerPath if we have one already
        const seriesRow = await prisma.series.findUnique({
          where: { tmdbId: primarySeries.tmdbId },
          select: { localTrailerPath: true, trailers: true, name: true, title: true },
        });

        const usableSeriesPath =
          seriesRow?.localTrailerPath &&
          seriesRow.localTrailerPath !== 'unavailable' &&
          seriesRow.localTrailerPath !== 'SKIP' &&
          seriesRow.localTrailerPath.startsWith('http')
            ? seriesRow.localTrailerPath
            : null;

        if (usableSeriesPath) {
          console.log(`✅ Reusing series-level trailer: ${usableSeriesPath}`);
          trailerLocalPath = usableSeriesPath;
        } else {
          // Step C: actively try to fetch & download (TMDB → YouTube search → yt-dlp → R2)
          console.log('⊘  No existing trailer in DB or series, attempting fresh download...');
          const seriesName = seriesRow?.title || seriesRow?.name || primarySeries.name || '';

          let trailerId = findTrailerYouTubeId(seriesRow?.trailers ?? null);
          if (!trailerId && seriesName) {
            console.log(`   🔍 Searching YouTube for "${seriesName}"...`);
            trailerId = await searchYouTubeTrailerViaAPI(seriesName, 'de');
            if (!trailerId) trailerId = await searchYouTubeTrailerViaAPI(seriesName, 'en');
          }

          if (trailerId && seriesName) {
            console.log(`   📥 Downloading trailer ${trailerId}...`);
            const downloadResult = await downloadYouTubeTrailer(trailerId, seriesName);
            if (downloadResult.success && downloadResult.localPath) {
              trailerLocalPath = downloadResult.localPath;
              // Persist on series so subsequent articles inherit it
              await prisma.series.update({
                where: { tmdbId: primarySeries.tmdbId },
                data: { localTrailerPath: downloadResult.localPath },
              });
              console.log(`   ✅ Trailer saved: ${downloadResult.localPath}`);
            } else {
              console.log(`   ⚠️  Trailer download failed: ${downloadResult.error}`);
            }
          } else {
            console.log('   ⚠️  No trailer source found (TMDB + YouTube)');
          }
        }
      }
    } catch (error: any) {
      console.log(`⚠️  Trailer step error: ${error.message}`);
      console.log('   → Continuing without trailer');
    }
    
    const slug = finalHeadline
      .toLowerCase()
      .replace(/[^a-z0-9äöüß]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
    
    const articleId = `ranking-${Date.now()}`;
    
    const article = await prisma.articles.create({
      data: {
        id: articleId,
        slug,
        title: finalHeadline,
        excerpt: smartTruncate(metaDescription, 200),
        metaDescription,
        contentHtml: fullContent,
        sourceUrl: input.sourceUrl,
        primarySeries: {
          connect: { tmdbId: primarySeries.tmdbId }
        },
        author: {
          connect: { id: selectedAuthor.id }
        },
        heroImagePath: heroImagePath,
        heroImageUrl: heroImagePath ? `/img/hero/article/${articleId}` : null,
        cardImageUrl: heroImagePath ? `/img/card/article/${articleId}` : null,
        ogImageUrl: heroImagePath ? `/img/og/article/${articleId}` : null,
        trailerLocalUrl: trailerLocalPath, // Add trailer support
        status: 'published',
        publishMode: wordCount >= 900 ? 'DISCOVER' : 'SEARCH_ONLY',
        publishedAt: new Date(),
        isRankingArticle: true, // Flag for ranking articles
      },
    });
    
    console.log(`✅ Article saved to database`);
    console.log(`   ID: ${article.id}`);
    console.log(`   Slug: ${article.slug}`);
    console.log(`   Status: ${article.status}`);
    console.log(`   Publish Mode: ${article.publishMode}`);
    
    // ========== SUCCESS ==========
    console.log('\n' + '='.repeat(70));
    console.log('🎉 PIPELINE_V2 COMPLETE: SUCCESS');
    console.log('='.repeat(70));
    
    return {
      success: true,
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        status: article.status,
        publishMode: article.publishMode,
        contentHtml: fullContent,
      },
      wordCount,
      headline: finalHeadline,
    };
    
  } catch (error: any) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ PIPELINE_V2 FAILED');
    console.error('='.repeat(70));
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    
    return {
      success: false,
      error: error.message,
    };
  }
}
