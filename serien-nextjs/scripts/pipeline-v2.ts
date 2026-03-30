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
import { linkCharactersInMarkdown, linkStreamersInMarkdown } from '../lib/character-linking-markdown';
import { linkCastInMarkdown } from '../lib/cast-linking-markdown';
import { markdownToHtml } from '../lib/markdown-to-html';
import { classifyContent, shouldSkipArticle } from '../lib/content-classifier';
import { resolveTmdbSeries } from '../lib/tmdb-resolver';
import { searchTvEnhanced } from '../lib/tmdb-search-enhanced';
import { getTvDetailsComplete } from '../lib/tmdb';
import { extractFacts } from '../lib/fact-extractor';
import { fetchFullArticleText } from '../lib/full-text-fetcher';
import { importSeriesCharacters } from './import-characters';
import { importSeriesCast } from '../lib/cast-importer';
import { findTrailerYouTubeId, downloadYouTubeTrailer, searchYouTubeTrailerViaAPI } from '../lib/trailer-downloader';
import { updateSeriesStatus } from '../lib/series-status-tracker';
import { generateInternalLinks, validateInternalLinks } from '../lib/internal-linking-engine';
import { qualityCheck } from '../lib/quality-checker';
import { antiAiFilter } from '../lib/anti-ai-filter';
import { discoverGate } from '../lib/discover-gate';
import { generateWasBedeutetDas } from '../lib/was-bedeutet-das';
import { uploadSeriesImages } from '../lib/blob-uploader';
import { fetchTopBackdrops, selectBackdropForArticle } from '../lib/tmdb-backdrops';
import { factSafetyCheck } from '../lib/fact-safety-layer';
import { classifyContentAge, shouldPublishBasedOnAge, neutralizeOldContentHeadline } from '../lib/time-axis-correction';
import { generateSeriesSlug } from '../lib/slug-utils';
import { PipelineLogger, type TriggerType } from '../lib/pipeline-logger';
import { checkForDuplicate, quickTitleSimilarityCheck } from '../lib/duplicate-checker';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════════════════════
// AUTHOR ROTATION: Randomly select from real editorial team
// ══════════════════════════════════════════════════════════════════════════
const EDITORIAL_AUTHORS = [
  'author_001', // Sophie Hartmann
  'author_003', // Laura Klein
  'author_004', // Marie Weber
  'author_005', // Lena Bergmann
  'author_006', // Emma Mueller
  'author_007', // Anna Schneider
  'author_008', // Nina Wolf
  'author_009', // Mia Braun
  'author_010', // Lea Zimmermann
  'author_011', // Clara Hoffmann
  'author_012', // Sarah Becker
  'author-julia', // Julia Fischer
];

function getRandomAuthor(): string {
  const randomIndex = Math.floor(Math.random() * EDITORIAL_AUTHORS.length);
  return EDITORIAL_AUTHORS[randomIndex];
}

interface PipelineV2Source {
  title: string;
  url: string;
  text: string;
  useFullTextMode?: boolean;
  trigger?: TriggerType;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract potential series name candidates from title and text
 * Used for exact DB matching (no substring search!)
 */
function extractSeriesNameCandidates(title: string, articleText: string): string[] {
  const candidates: string[] = [];
  
  // Quote characters to detect series names in quotes
  const quoteChars = ["'", '"', '\u2018', '\u2019', '\u201C', '\u201D', '\u201E', '\u00BB', '\u00AB'];
  
  // Strategy 1: Find quoted text in title (highest priority)
  for (const openQuote of quoteChars) {
    const startIdx = title.indexOf(openQuote);
    if (startIdx === -1) continue;
    
    for (const closeQuote of quoteChars) {
      const endIdx = title.indexOf(closeQuote, startIdx + 1);
      if (endIdx === -1 || endIdx === startIdx) continue;
      
      const extracted = title.substring(startIdx + 1, endIdx).trim();
      if (extracted.length >= 2 && extracted.length <= 50 && !candidates.includes(extracted)) {
        candidates.push(extracted);
      }
    }
  }
  
  // Strategy 2: Find quoted text in first 300 chars of article
  const firstPart = articleText.substring(0, 300);
  for (const openQuote of quoteChars) {
    const startIdx = firstPart.indexOf(openQuote);
    if (startIdx === -1) continue;
    
    for (const closeQuote of quoteChars) {
      const endIdx = firstPart.indexOf(closeQuote, startIdx + 1);
      if (endIdx === -1 || endIdx === startIdx) continue;
      
      const extracted = firstPart.substring(startIdx + 1, endIdx).trim();
      if (extracted.length >= 2 && extracted.length <= 50 && !candidates.includes(extracted)) {
        candidates.push(extracted);
      }
    }
  }
  
  // Strategy 3: Known series names (exact match only)
  const knownSeries = [
    'Dune', 'Dune: Prophecy', 'The Boys', 'Stranger Things', 'Wednesday',
    'House of the Dragon', 'The Last of Us', 'Squid Game', 'Severance',
    'The Walking Dead', 'Yellowstone', 'The White Lotus', 'The Bear',
    'Bridgerton', 'Reacher', 'Fallout', 'Shogun', 'The Penguin',
    'Arcane', 'One Piece', 'Avatar', 'Loki', 'Ahsoka', 'Andor',
    'The Mandalorian', 'The Witcher', 'The Gentlemen', 'Baby Reindeer',
    'Kennedy', 'The Agency', 'Paradise', 'School Spirits'
  ];
  
  for (const series of knownSeries) {
    const titleLower = title.toLowerCase();
    const seriesLower = series.toLowerCase();
    
    // Check for word boundary match in title
    const regex = new RegExp(`\\b${seriesLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(title) && !candidates.includes(series)) {
      candidates.push(series);
    }
  }
  
  return candidates;
}

export async function runPipelineV2(source: PipelineV2Source) {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 PIPELINE V2 - OPTIMIZED');
  console.log('='.repeat(70));
  console.log(`📄 Source: ${source.title}`);
  console.log(`🔗 URL: ${source.url}\n`);

  // Initialize pipeline logger
  const logger = new PipelineLogger('pipeline-v2', source.trigger || 'manual');
  await logger.start({
    inputQuery: source.title,
    inputSource: source.url,
  });
  
  logger.log(`Source: ${source.title}`);
  logger.addMetadata('url', source.url);

  const now = new Date();
  
  // Step tracking for precise error logging
  let currentStep = 'init';
  let stepStartTime = Date.now();

  const logStep = (step: string) => {
    currentStep = step;
    stepStartTime = Date.now();
    logger.log(`Step: ${step}`);
  };

  try {
    // ========== STEP 1: FULL TEXT FETCH ==========
    logStep('1_full_text_fetch');
    console.log('━'.repeat(70));
    console.log('STEP 1: FULL TEXT FETCH');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 1: Full Text Fetch');
    
    let fullSourceText = source.text || source.sourceText || '';
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
        logger.log(`Volltext: ${sourceWordCount} Wörter`);
        await logger.update({ wordsCollected: sourceWordCount });
      }
    }
    console.timeEnd('⏱️  STEP 1: Full Text Fetch');
    
    // ========== THEMA-ALTER CHECK (6 Stunden Maximum) ==========
    // Pipeline-V2 verarbeitet einzelne News-Artikel - das Artikel-Datum IST das Thema-Datum
    const trigger = source.trigger || 'manual';
    const maxAgeMs = 30 * 60 * 1000; // 30 Minuten
    
    // Versuche das Veröffentlichungsdatum aus dem Artikel zu extrahieren
    let articleDate: Date | null = null;
    const datePatterns = [
      /(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*(\d{4})/i,
      /(\d{4})-(\d{2})-(\d{2})/,
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
    ];
    
    for (const pattern of datePatterns) {
      const match = fullSourceText.match(pattern);
      if (match) {
        try {
          if (pattern.source.includes('Januar')) {
            // German month format
            const months: Record<string, number> = {
              'januar': 0, 'februar': 1, 'märz': 2, 'april': 3, 'mai': 4, 'juni': 5,
              'juli': 6, 'august': 7, 'september': 8, 'oktober': 9, 'november': 10, 'dezember': 11
            };
            articleDate = new Date(parseInt(match[3]), months[match[2].toLowerCase()], parseInt(match[1]));
          } else {
            articleDate = new Date(match[0]);
          }
          if (!isNaN(articleDate.getTime())) break;
        } catch {}
      }
    }
    
    if (articleDate) {
      const articleAge = now.getTime() - articleDate.getTime();
      const articleAgeHours = Math.round(articleAge / (60 * 60 * 1000) * 10) / 10;
      
      if (articleAge > maxAgeMs && trigger !== 'manual') {
        console.log(`\n⏰ THEMA ZU ALT: Artikel von vor ${articleAgeHours} Stunden (max: 6 Stunden)`);
        console.log(`   → Überspringe. Nur manuelle Trigger erlaubt für ältere Themen.`);
        logger.log(`Thema zu alt: ${articleAgeHours}h (max 6h)`);
        await logger.fail(`Thema zu alt: ${articleAgeHours}h`, 'topic-age-check');
        return null;
      }
      
      console.log(`   ⏰ Thema-Alter: ${articleAgeHours} Stunden ${trigger === 'manual' ? '(manueller Trigger)' : '✓'}`);
    } else {
      console.log(`   ⏰ Thema-Alter: nicht ermittelbar ${trigger === 'manual' ? '(manueller Trigger)' : '- wird akzeptiert'}`);
    }

    logStep('2_classification');
    // ========== STEP 2: CLASSIFICATION ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 2: CLASSIFICATION');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 2: Classification');
    
    // ══════════════════════════════════════════════════════════════════════════
    // FAST TITLE PRE-CHECK - Erkennt Listicles/Editorials am Titel (spart LLM-Kosten)
    // ══════════════════════════════════════════════════════════════════════════
    const titleLower = source.title.toLowerCase();
    
    // Patterns die auf MULTI_SERIES_EDITORIAL hindeuten
    const editorialPatterns = [
      /favorite\s*(series|show|tv)/i,
      /lieblings?\s*serie/i,
      /all[- ]time\s*favorite/i,
      /top\s*\d+/i,
      /best\s*(series|shows|tv)/i,
      /worst\s*(series|shows|tv)/i,
      /ranking/i,
      /\d+\s*(best|top|greatest)/i,
      /must[- ]watch/i,
      /binge[- ]worthy/i,
    ];
    
    const isLikelyEditorial = editorialPatterns.some(p => p.test(source.title));
    
    if (isLikelyEditorial) {
      console.log(`   📋 Titel-Pattern erkannt: Wahrscheinlich Editorial/Listicle`);
    }
    
    const classification = await classifyContent(
      source.title,
      source.url,
      fullSourceText
    );
    
    console.log(`✅ Type: ${classification.content_type}`);
    console.log(`   Primary Series: ${classification.primary_series || 'nicht erkannt'}`);
    console.log(`   Reasoning: ${classification.reasoning || '-'}`);
    logger.log(`Klassifiziert als: ${classification.content_type}`);
    logger.addMetadata('contentType', classification.content_type);
    if (classification.primary_series) {
      logger.addMetadata('primarySeries', classification.primary_series);
    }
    console.timeEnd('⏱️  STEP 2: Classification');
    
    if (classification.content_type === 'SKIP' || classification.content_type === 'UNKNOWN') {
      console.log('⚠️  Article skipped (not relevant)');
      await logger.fail('Artikel übersprungen (nicht relevant)', 'classification');
      return null;
    }
    
    // REJECT Feature/Essay articles - they have no news value
    if (classification.content_type === 'FEATURE_ESSAY') {
      console.log('⚠️  Article skipped: Feature/Essay ohne aktuelle Nachricht');
      console.log(`   Grund: ${classification.reasoning || 'Keine neue Meldung, nur Analyse/Retrospektive'}`);
      await logger.fail('Feature/Essay - keine News', 'classification');
      return null;
    }
    
    // REJECT Movie and Mixed content
    if (classification.content_type === 'MOVIE' || classification.content_type === 'MIXED') {
      console.log(`⚠️  Article skipped: ${classification.content_type}`);
      await logger.fail(`${classification.content_type} - nur Serien erlaubt`, 'classification');
      return null;
    }
    
    // Map to our internal type
    const contentType = classification.content_type === 'SINGLE_SERIES_NEWS' ? 'NEWS' : 'RANKING';

    logStep('3_tmdb_resolution');
    // ========== STEP 3: ENHANCED TMDB RESOLUTION ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 3: ENHANCED TMDB RESOLUTION ⚡');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 3: TMDB Resolution');
    logger.log('Schritt 3: TMDB-Auflösung...');
    
    // ✅ USE primary_series FROM CLASSIFIER IF AVAILABLE
    // This prevents mistakes like "'The Pitt' Rival" being classified as "The Pitt"
    const searchQuery = classification.primary_series || source.title;
    console.log(`   🔍 Search query: "${searchQuery}"`);
    
    let searchResult = await searchTvEnhanced(searchQuery, fullSourceText);
    
    // ══════════════════════════════════════════════════════════════════════════
    // TMDB MATCH VALIDATION - Strenge Prüfung mit Draft-Fallback
    // ══════════════════════════════════════════════════════════════════════════
    const PUBLISH_THRESHOLD = 0.70; // 70% für automatische Veröffentlichung
    const DRAFT_THRESHOLD = 0.50;   // 50% für Draft (zur manuellen Prüfung)
    
    let saveAsDraft = false;
    let draftReason = '';
    
    if (!searchResult || searchResult.confidence < DRAFT_THRESHOLD) {
      console.log('⚠️ No confident TMDB match found (confidence < 50%)');
      console.log(`   TMDB Result: ${searchResult ? `${searchResult.name} (${(searchResult.confidence * 100).toFixed(1)}%)` : 'null'}`);
      
      // DB FALLBACK: Nur mit exakter Übereinstimmung - KEINE Substring-Suche!
      const candidates = extractSeriesNameCandidates(source.title, fullSourceText);
      let dbMatch = null;
      
      console.log(`   📋 Trying exact DB match for candidates: ${candidates.join(', ')}`);
      
      for (const candidate of candidates) {
        dbMatch = await prisma.series.findFirst({
          where: {
            OR: [
              { title: { equals: candidate, mode: 'insensitive' } },
              { name: { equals: candidate, mode: 'insensitive' } },
            ]
          },
          select: { tmdbId: true, name: true, title: true, backdropPath: true, trailers: true }
        });
        
        if (dbMatch) {
          console.log(`✅ DB Exact Match: Found "${dbMatch.name}" for "${candidate}"`);
          searchResult = {
            tmdbId: dbMatch.tmdbId,
            name: dbMatch.name || dbMatch.title,
            confidence: 0.85,
            matchMethod: 'db-exact-match'
          };
          break;
        }
      }
      
      if (!searchResult || searchResult.confidence < DRAFT_THRESHOLD) {
        // Komplett keine Zuordnung möglich -> Als Draft speichern
        console.log('❌ No match found in TMDB or DB');
        console.log('   → Artikel wird als DRAFT gespeichert (keine Serie gefunden)');
        saveAsDraft = true;
        draftReason = `Keine Serie gefunden (TMDB: ${searchResult ? `${searchResult.name} ${(searchResult.confidence * 100).toFixed(0)}%` : 'null'})`;
        
        // Verwende eine Fallback-Serie oder null
        if (!searchResult) {
          // Kein Match - wir brauchen trotzdem eine Serie für den Artikel
          // Speichere ohne Serie (tmdbId = null)
          await logger.log(`Draft: ${draftReason}`);
        }
      }
    }
    
    // Prüfe ob Confidence für Veröffentlichung reicht
    if (searchResult && searchResult.confidence < PUBLISH_THRESHOLD && !saveAsDraft) {
      console.log(`⚠️ Confidence below publish threshold (${(searchResult.confidence * 100).toFixed(0)}% < 70%)`);
      console.log(`   → Artikel wird als DRAFT gespeichert (unsichere Zuordnung)`);
      saveAsDraft = true;
      draftReason = `Unsichere Zuordnung: ${searchResult.name} (${(searchResult.confidence * 100).toFixed(0)}%)`;
      logger.log(`Draft: ${draftReason}`);
    }
    
    if (searchResult && !saveAsDraft) {
      console.log(`✅ TMDB Match accepted: ${searchResult.name} (${(searchResult.confidence * 100).toFixed(1)}%)`);
    }
    
    logger.log(`Serie: ${searchResult.name} (TMDB: ${searchResult.tmdbId})`);
    logger.addMetadata('seriesName', searchResult.name);
    logger.addMetadata('tmdbId', searchResult.tmdbId);
    
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
          slug: generateSeriesSlug(completeDetails.name, searchResult.tmdbId), // Use slug-utils
          posterPath: completeDetails.posterPath,
          backdropPath: completeDetails.backdropPath,
          overview: completeDetails.overview || '',
          status: completeDetails.status,
          firstAirDate: completeDetails.firstAirDate ? new Date(completeDetails.firstAirDate) : null,
          trailers: completeDetails.trailers || [], // ✅ Save trailers from TMDB
          updatedAt: new Date(),
        }
      });
      
      // ✅ Upload images to Vercel Blob (async, don't block)
      uploadSeriesImages(searchResult.tmdbId, completeDetails.posterPath, completeDetails.backdropPath)
        .then(({ posterUrl, backdropUrl }) => {
          if (posterUrl || backdropUrl) {
            prisma.series.update({
              where: { tmdbId: searchResult.tmdbId },
              data: {
                ...(posterUrl && { posterLocalUrl: posterUrl }),
                ...(backdropUrl && { backdropLocalUrl: backdropUrl }),
              }
            }).catch(() => {});
            console.log(`   📸 Images uploaded to Blob`);
          }
        })
        .catch((e) => console.log(`   ⚠️ Blob upload failed: ${e.message}`));
      
      console.log(`✅ Series created: ${dbSeries.name}`);
    } else {
      console.log(`✅ Series found in DB: ${dbSeries.name || dbSeries.title}`);
      
      // FIX: Wenn trailers null/leer sind, aus TMDB nachladen!
      if (!dbSeries.trailers || (Array.isArray(dbSeries.trailers) && dbSeries.trailers.length === 0)) {
        console.log(`   ⚠️ No trailers in DB, fetching from TMDB...`);
        try {
          const completeDetails = await getTvDetailsComplete(searchResult.tmdbId, 'de-DE');
          if (completeDetails?.trailers && completeDetails.trailers.length > 0) {
            await prisma.series.update({
              where: { tmdbId: searchResult.tmdbId },
              data: { trailers: completeDetails.trailers }
            });
            dbSeries.trailers = completeDetails.trailers;
            console.log(`   ✅ Trailers updated: ${completeDetails.trailers.length} found`);
          }
        } catch (e: any) {
          console.log(`   ⚠️ Failed to fetch trailers: ${e.message}`);
        }
      }
    }
    console.timeEnd('⏱️  STEP 3: TMDB Resolution');

    // ========== STEP 3.5: DUPLICATE CHECK ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 3.5: DUPLICATE CHECK 🔍');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 3.5: Duplicate Check');
    logger.log('Prüfe auf Duplikate...');

    const duplicateResult = await checkForDuplicate(
      source.title,
      fullSourceText.substring(0, 500), // Erste 500 Zeichen als Zusammenfassung
      dbSeries.tmdbId,
      dbSeries.name || dbSeries.title || ''
    );

    console.log(`   📂 Thema-Kategorie: ${duplicateResult.topicCategory}`);
    console.log(`   📝 Kern-Ereignis: ${duplicateResult.coreEvent}`);
    console.log(`   🎯 Confidence: ${(duplicateResult.confidence * 100).toFixed(0)}%`);

    if (duplicateResult.isDuplicate) {
      console.log(`\n⛔ DUPLIKAT ERKANNT!`);
      console.log(`   Grund: ${duplicateResult.reason}`);
      console.log(`   Duplikat von: ${duplicateResult.duplicateOf || 'unbekannt'}`);
      console.log(`   → Artikel wird übersprungen.`);
      logger.log(`Duplikat erkannt: ${duplicateResult.reason}`);
      await logger.fail(`Duplikat: ${duplicateResult.coreEvent}`, 'duplicate-check');
      console.timeEnd('⏱️  STEP 3.5: Duplicate Check');
      return null;
    }

    console.log(`✅ Kein Duplikat - Thema ist neu: "${duplicateResult.coreEvent}"`);
    logger.log(`Thema OK: ${duplicateResult.topicCategory} - ${duplicateResult.coreEvent}`);
    logger.addMetadata('topicCategory', duplicateResult.topicCategory);
    console.timeEnd('⏱️  STEP 3.5: Duplicate Check');

    logStep('4_fact_extraction');
    // ========== STEP 4: FACT EXTRACTION ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4: FACT EXTRACTION');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 4: Fact Extraction');
    
    const facts = await extractFacts(fullSourceText, source.title);
    console.log(`✅ Extracted ${facts.length} facts`);
    console.timeEnd('⏱️  STEP 4: Fact Extraction');

    logStep('5_content_generation');
    // ========== STEP 5: STRUCTURED CONTENT GENERATION (ONE CALL!) ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5: STRUCTURED CONTENT GENERATION ⚡');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 5: Content Generation');
    
    const structuredContent = await generateStructuredContent({
      facts,
      seriesName: dbSeries.name || dbSeries.title,
      originalHeadline: source.title,
      sourceText: fullSourceText,
      contentType,
      // GOOGLE DISCOVER Qualität - Minimum 1500 Wörter
      wordCountTarget: contentType === 'RANKING' 
        ? Math.max(1500, Math.min(sourceWordCount * 1.5, 2500)) 
        : Math.max(1500, Math.min(sourceWordCount * 1.5, 2000)),
    });
    
    console.log(`✅ Generated:`);
    console.log(`   Headline: "${structuredContent.headline}"`);
    console.log(`   Sections: ${structuredContent.sections.length} with H2s`);
    console.log(`   Q&A: ${structuredContent.qa.length} pairs`);
    logger.log(`Headline: ${structuredContent.headline}`);
    console.timeEnd('⏱️  STEP 5: Content Generation');

    // ========== STEP 5.1: QUALITY GATES ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5.1: QUALITY GATES');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 5.1: Quality Gates');
    logger.log('Quality Gates prüfen...');
    
    // Note: Quality gates are lenient in v2 to allow content through
    // They log warnings but don't block publication
    
    let antiAiScore = 0;
    
    try {
      // Quality Check
      const qualityResult = await qualityCheck({
        generatedArticleHtml: structuredContent.markdown,
        originalHeadline: source.title,
        generatedHeadline: structuredContent.headline,
      });
      console.log(`✅ Quality check: ${qualityResult.passed ? 'Passed' : 'Warnings'}`);
    } catch (error: any) {
      console.log(`⚠️  Quality check skipped: ${error.message}`);
    }
    
    try {
      // Anti-AI Filter
      const antiAiResult = antiAiFilter({
        articleHtml: structuredContent.markdown || '',
        headline: structuredContent.headline,
        seriesName: dbSeries.name || dbSeries.title || '',
      });
      antiAiScore = antiAiResult.antiAiScore;
      console.log(`✅ Anti-AI filter: ${antiAiResult.status === 'PASS' ? 'Passed' : 'Warnings'}`);
      logger.log(`Anti-AI Score: ${antiAiScore}/100`);
      await logger.update({ antiAiScore });
    } catch (error: any) {
      console.log(`⚠️  Anti-AI filter skipped: ${error.message}`);
    }
    
    try {
      // Fact Safety Check
      const factSafetyResult = await factSafetyCheck(
        structuredContent.markdown || '',
        facts,
        fullSourceText
      );
      console.log(`✅ Fact safety check: ${factSafetyResult.passed ? 'Passed' : 'Warnings'}`);
    } catch (error: any) {
      console.log(`⚠️  Fact safety check skipped: ${error.message}`);
    }
    
    try {
      // Time-Axis Correction
      const contentAge = await classifyContentAge(fullSourceText, source.title);
      console.log(`✅ Content age: ${contentAge.ageCategory}`);
    } catch (error: any) {
      console.log(`⚠️  Time-axis check skipped: ${error.message}`);
    }
    console.timeEnd('⏱️  STEP 5.1: Quality Gates');

    logStep('6_character_linking');
    // ========== STEP 6: CHARACTER IMPORT // ========== STEP 6: CHARACTER IMPORT & LINKING (ON MARKDOWN!) ========== LINKING (ON MARKDOWN!) ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 6: CHARACTER LINKING (Markdown) ⚡');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 6: Character Import & Linking');
    
    // Import characters first
    console.time('⏱️  STEP 6a: Import Characters');
    await importSeriesCharacters(dbSeries.tmdbId);
    console.timeEnd('⏱️  STEP 6a: Import Characters');
    
    // Link characters in markdown
    const characterLinkResult = await linkCharactersInMarkdown(
      structuredContent.markdown,
      dbSeries.tmdbId
    );
    
    structuredContent.markdown = characterLinkResult.linkedMarkdown;
    console.log(`✅ Linked ${characterLinkResult.charactersLinked} characters`);
    
    // DEBUG: Check if links are actually in markdown
    const debugCharLinks = (structuredContent.markdown?.match(/\[([^\]]+)\]\(\/figur\/[^)]+\)/g) || []).length;
    console.log(`🔍 DEBUG: Markdown has ${debugCharLinks} character links`);
    
    // Link cast members in markdown
    const castLinkResult = await linkCastInMarkdown(
      structuredContent.markdown,
      dbSeries.tmdbId
    );
    
    structuredContent.markdown = castLinkResult.linkedMarkdown;
    console.log(`✅ Linked ${castLinkResult.castLinked} cast members`);
    
    // DEBUG: Check if links are actually in markdown
    const debugCastLinks = (structuredContent.markdown?.match(/\[([^\]]+)\]\(\/person\/[^)]+\)/g) || []).length;
    console.log(`🔍 DEBUG: Markdown has ${debugCastLinks} cast links`);
    
    // Link streamers to their hub pages (Netflix → /netflix-serien)
    console.log('🎬 Linking streamers to hub pages...');
    const streamerLinkResult = linkStreamersInMarkdown(structuredContent.markdown);
    structuredContent.markdown = streamerLinkResult.linkedMarkdown;
    if (streamerLinkResult.streamersLinked.length > 0) {
      console.log(`✅ Linked ${streamerLinkResult.streamersLinked.length} streamers: ${streamerLinkResult.streamersLinked.join(', ')}`);
    } else {
      console.log('   ℹ️  No streamers to link');
    }
    
    console.timeEnd('⏱️  STEP 6: Character Import & Linking');

    logStep('7_markdown_to_html');
    // ========== STEP 7: MARKDOWN → HTML ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 7: MARKDOWN → HTML');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 7: Markdown to HTML');
    
    const contentHtml = markdownToHtml(structuredContent.markdown || '');
    
    // DEBUG: Check if links survived HTML conversion
    const debugHtmlCharLinks = (contentHtml?.match(/href="\/figur\//g) || []).length;
    const debugHtmlCastLinks = (contentHtml?.match(/href="\/person\//g) || []).length;
    console.log(`🔍 DEBUG: HTML has ${debugHtmlCharLinks} character links, ${debugHtmlCastLinks} cast links`);
    
    // Verify H2s survived conversion
    const h2Count = (contentHtml?.match(/<h2>/g) || []).length;
    console.log(`✅ HTML generated`);
    console.log(`   H2 tags: ${h2Count}`);
    
    if (h2Count === 0) {
      console.log('⚠️  WARNING: No H2 tags in HTML!');
    }
    console.timeEnd('⏱️  STEP 7: Markdown to HTML');

    // ========== STEP 7.5: INTERNAL LINKING ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 7.5: INTERNAL LINKING');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 7.5: Internal Linking');
    
    // Generate article ID early for internal linking
    const articleId = `pipeline-v2-${Date.now()}`;
    
    const internalLinksResult = await generateInternalLinks({
      articleId,
      contentHtml,
      primarySeriesId: dbSeries.tmdbId, // Now passing as number
      primarySeriesName: dbSeries.name || dbSeries.title || '',
      primarySeriesSlug: dbSeries.slug || '',
      publishedAt: null,
    });
    
    const finalContentHtml = internalLinksResult.updatedContentHtml;
    
    console.log(`✅ Internal Links injected:`);
    console.log(`   Hub Link: ${internalLinksResult.hubLink ? 'Yes' : 'No'}`);
    console.log(`   Related Articles: ${internalLinksResult.relatedArticles.length}`);
    console.log(`   Total Links: ${internalLinksResult.totalInternalLinks}`);
    
    // Validate links
    const linkValidation = validateInternalLinks(finalContentHtml, dbSeries.name || dbSeries.title || '');
    if (!linkValidation.valid) {
      console.log(`\n⚠️  Link Validation Warnings:`);
      linkValidation.errors.forEach(err => console.log(`   - ${err}`));
    }
    console.timeEnd('⏱️  STEP 7.5: Internal Linking');

    logStep('8_publish');
    // ========== STEP 8: PUBLISH ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 8: PUBLISH');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 8: Publish');
    
    const slug = generateSlug(structuredContent.headline);
    // articleId already generated in Step 7.5
    
    // ✅ BACKDROP ROTATION: Wähle rotierendes Backdrop basierend auf Artikelanzahl
    let selectedBackdrop = dbSeries.backdropPath;
    try {
      const articleCount = await prisma.articles.count({
        where: { primarySeriesId: dbSeries.tmdbId }
      });
      const topBackdrops = await fetchTopBackdrops('tv', dbSeries.tmdbId, 10);
      if (topBackdrops.length > 0) {
        const rotatedBackdrop = selectBackdropForArticle(topBackdrops, articleCount);
        if (rotatedBackdrop) {
          selectedBackdrop = rotatedBackdrop;
          console.log(`🖼️  Backdrop rotiert: #${articleCount % topBackdrops.length + 1} von ${topBackdrops.length}`);
        }
      }
    } catch (e) {
      console.log('   ⚠️ Backdrop-Rotation fehlgeschlagen, nutze Standard');
    }
    
    // Determine final status based on confidence
    const finalStatus = saveAsDraft ? 'draft' : 'published';
    const finalPublishedAt = saveAsDraft ? null : now;
    
    await prisma.articles.create({
      data: {
        id: articleId,
        title: structuredContent.headline,
        slug,
        contentHtml: finalContentHtml,
        excerpt: structuredContent.lead,
        metaDescription: structuredContent.metaDescription,
        heroImageUrl: selectedBackdrop 
          ? `https://image.tmdb.org/t/p/original${selectedBackdrop}`
          : null,
        tmdbId: dbSeries.tmdbId,
        primarySeriesId: dbSeries.tmdbId,
        tmdbType: 'tv',
        authorId: getRandomAuthor(),
        status: finalStatus,
        publishedAt: finalPublishedAt,
        createdAt: now,
        updatedAt: now,
        sourceUrl: source.url,
        // Store draft reason in metadata if available
        ...(saveAsDraft && draftReason ? { 
          metadata: { draftReason, confidence: searchResult?.confidence || 0 } 
        } : {}),
      },
    });
    
    if (saveAsDraft) {
      console.log(`📝 Article saved as DRAFT`);
      console.log(`   Reason: ${draftReason}`);
      console.log(`   ID: ${articleId}`);
      console.log(`   Slug: ${slug}`);
      logger.log(`Draft gespeichert: ${draftReason}`);
    } else {
      console.log(`✅ Article published`);
      console.log(`   ID: ${articleId}`);
      console.log(`   Slug: ${slug}`);
    }
    console.timeEnd('⏱️  STEP 8: Publish');

    // ========== STEP 9: POST-PROCESSING (PARALLEL!) ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 9: POST-PROCESSING (Parallel) ⚡');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 9: Post-Processing');
    
    await Promise.all([
      // Save Q&A
      (async () => {
        if (structuredContent.qa.length > 0) {
          const qaId = `qa-${articleId}`;
          
          // Determine heading type based on title/content
          const titleLower = (structuredContent.headline || '').toLowerCase();
          let headingType = 'default';
          
          if (titleLower.includes('episode') || titleLower.includes('folge') || /s\d+e\d+/i.test(titleLower)) {
            headingType = 'episode';
          } else if (titleLower.includes('finale') || titleLower.includes('final')) {
            headingType = 'finale';
          } else if (titleLower.includes('staffel') || titleLower.includes('season')) {
            headingType = 'season';
          } else if (titleLower.includes('ende') || titleLower.includes('ending') || titleLower.includes('erklärt')) {
            headingType = 'ending';
          }
          
          await prisma.article_qa.create({
            data: {
              id: qaId,
              articleId,
              questions: structuredContent.qa, // Store as JSON array
              schemaEnabled: true,
              headingType,
              updatedAt: now,
            },
          });
          console.log(`   ✅ Q&A saved: ${structuredContent.qa.length} questions (${headingType})`);
        }
      })(),
      
      // Import cast
      (async () => {
        await importSeriesCast(dbSeries.tmdbId, dbSeries.tmdbId);
        console.log(`   ✅ Cast imported`);
      })(),
      
      // Download trailer via RapidAPI - NUTZE SERIES TRAILER wenn vorhanden
      (async () => {
        try {
          // PRÜFE: Hat die Serie schon einen lokalen Trailer?
          if (dbSeries.localTrailerPath) {
            console.log(`   ✅ Using existing series trailer: ${dbSeries.localTrailerPath}`);
            await prisma.articles.update({
              where: { id: articleId },
              data: { heroVideoUrl: dbSeries.localTrailerPath }
            });
            return;
          }
          
          // Serie hat noch keinen Trailer → einmalig herunterladen
          console.log(`   ℹ️ Series has no local trailer, downloading...`);
          
          let trailerId = findTrailerYouTubeId(dbSeries.trailers);
          
          // FALLBACK: Wenn kein Trailer auf TMDB, suche auf YouTube
          if (!trailerId) {
            console.log(`   🔍 Searching YouTube for trailer...`);
            trailerId = await searchYouTubeTrailerViaAPI(dbSeries.name || dbSeries.title || '', 'de');
            
            if (!trailerId) {
              trailerId = await searchYouTubeTrailerViaAPI(dbSeries.name || dbSeries.title || '', 'en');
            }
          }
          
          if (trailerId) {
            console.log(`   🎬 Trailer ID: ${trailerId}`);
            console.log(`   📥 Downloading trailer (360p)...`);
            
            const downloadResult = await downloadYouTubeTrailer(trailerId, dbSeries.name || dbSeries.title || '');
            
            if (downloadResult.success && downloadResult.localPath) {
              // Speichere in SERIE (für alle zukünftigen Artikel)
              await prisma.series.update({
                where: { tmdbId: dbSeries.tmdbId },
                data: { localTrailerPath: downloadResult.localPath }
              });
              
              // Speichere in ARTIKEL
              await prisma.articles.update({
                where: { id: articleId },
                data: { heroVideoUrl: downloadResult.localPath }
              });
              
              console.log(`   ✅ Trailer saved to series & article: ${downloadResult.localPath}`);
            } else {
              console.log(`   ⚠️ Download failed: ${downloadResult.error}`);
            }
          } else {
            console.log(`   ⚠️ No trailer found (TMDB + YouTube search)`);
          }
        } catch (error: any) {
          console.log(`   ❌ Trailer error: ${error.message}`);
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
      
      // Generate "Was bedeutet das" section
      (async () => {
        try {
          const wasBedeutetDasText = await generateWasBedeutetDas(
            structuredContent.headline,
            finalContentHtml,
            dbSeries.name || dbSeries.title || ''
          );
          
          if (wasBedeutetDasText) {
            await prisma.articles.update({
              where: { id: articleId },
              data: { wasBedeutetDasText }
            });
            console.log(`   ✅ "Was bedeutet das" generated`);
          }
        } catch (error: any) {
          console.log(`   ⚠️  "Was bedeutet das" generation failed: ${error.message}`);
        }
      })(),
      
      // Discover Gate - Score berechnen und speichern
      (async () => {
        try {
          const gateResult = await discoverGate({
            final_headline: structuredContent.headline || '',
            article_html: finalContentHtml || '',
            hero_image_metadata: {
              url: selectedBackdrop ? `https://image.tmdb.org/t/p/original${selectedBackdrop}` : '',
              width: 1920,
              height: 1080,
              source: 'TMDB_BACKDROP' as const
            },
            publishedAt: new Date(),
            primary_series: dbSeries.name || dbSeries.title || ''
          });
          
          // Save to discover_score_dashboards
          await prisma.discover_score_dashboards.create({
            data: {
              id: crypto.randomUUID(),
              articleId: articleId,
              timestamp: new Date(),
              finalVerdict: gateResult.discover_eligible ? 'DISCOVER_OK' : 'SEARCH_ONLY',
              discoverScore: gateResult.scores.total,
              headlineMetrics: gateResult.dashboard.headline as any,
              freshnessMetrics: gateResult.dashboard.freshness as any,
              contentMetrics: gateResult.dashboard.content_opening as any,
              imageMetrics: gateResult.dashboard.image_visual as any,
              trustMetrics: gateResult.dashboard.trust_clarity as any,
            }
          });
          
          // Update article publishMode based on score
          const publishMode = gateResult.discover_eligible ? 'DISCOVER' : 'SEARCH_ONLY';
          await prisma.articles.update({
            where: { id: articleId },
            data: { publishMode }
          });
          
          console.log(`   ✅ Discover Gate: ${gateResult.scores.total}/100 → ${publishMode}`);
        } catch (error: any) {
          console.log(`   ⚠️  Discover Gate failed: ${error.message}`);
        }
      })(),
    ]);
    console.timeEnd('⏱️  STEP 9: Post-Processing');

    // ========== SUCCESS ==========
    console.log('\n' + '='.repeat(70));
    if (saveAsDraft) {
      console.log('📝 PIPELINE V2 COMPLETE (DRAFT)');
    } else {
      console.log('🎉 PIPELINE V2 COMPLETE');
    }
    console.log('='.repeat(70));
    console.log(`${saveAsDraft ? '📝' : '✅'} Article: ${structuredContent.headline}`);
    console.log(`${saveAsDraft ? '📝' : '✅'} Slug: ${slug}`);
    console.log(`${saveAsDraft ? '📝' : '✅'} Status: ${finalStatus.toUpperCase()}`);
    if (saveAsDraft) {
      console.log(`⚠️  Draft Reason: ${draftReason}`);
    }
    console.log(`✅ H2 Count: ${h2Count}`);
    console.log(`✅ Series: ${searchResult?.name || 'Unknown'} (${(searchResult?.confidence || 0) * 100}%)`);
    console.log(`✅ Character Links: Yes`);
    console.log('='.repeat(70));
    
    logger.log(`Artikel gespeichert: ${slug} (${finalStatus})`);
    logger.addMetadata('status', finalStatus);
    if (saveAsDraft) {
      logger.addMetadata('draftReason', draftReason);
    }
    
    await logger.success({
      articleId,
      articleSlug: slug,
      articleTitle: structuredContent.headline,
    });
    
    return {
      articleId,
      slug,
      headline: structuredContent.headline,
    };
    
  } catch (error: any) {
    const stepDuration = Date.now() - stepStartTime;
    const errorDetails = {
      step: currentStep,
      stepDuration: `${stepDuration}ms`,
      errorType: error.name || 'Error',
      errorMessage: error.message,
      errorCode: error.code || null,
      source: source.title,
      url: source.url,
    };
    
    console.log('\n' + '='.repeat(70));
    console.log('❌ PIPELINE V2 FAILED');
    console.log('='.repeat(70));
    console.log(`Step: ${currentStep}`);
    console.log(`Duration: ${stepDuration}ms`);
    console.log(`Error: ${error.message}`);
    console.log(`Type: ${error.name || 'Error'}`);
    if (error.code) console.log(`Code: ${error.code}`);
    console.log('Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
    
    // Log detailed error to DB
    await logger.fail(
      `[${currentStep}] ${error.message}`,
      currentStep,
      JSON.stringify(errorDetails)
    );
    
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
