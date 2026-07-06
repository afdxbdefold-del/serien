/**
 * PIPELINE V2 - OPTIMIZED
 * 
 * Key improvements over v1:
 * 1. Single LLM call for content + H2s + meta + Q&A
 * 2. Character linking BEFORE HTML conversion
 * 3. Parallelized post-processing
 * 4. Faster, cleaner, more reliable
 * 5. URL Dedup: Prevents re-processing same source URL within 24h (saves LLM costs)
 * 6. Auto-Retry: Re-generates content with lower temperature if Discover Score < 60
 */

import { PrismaClient } from '@prisma/client';
import { generateStructuredContent } from '../lib/structured-content-generator';
import { translateFaithful } from '../lib/faithful-translator';
import { fetchNotebookFacts } from '../lib/reporters-notebook';
import { linkCharactersInMarkdown, linkStreamersInMarkdown } from '../lib/character-linking-markdown';
import { linkCastInMarkdown } from '../lib/cast-linking-markdown';
import { markdownToHtml } from '../lib/markdown-to-html';
import { injectSourceEmbeds } from '../lib/source-embeds';
import { classifyContent, shouldSkipArticle } from '../lib/content-classifier';
import { blockReasonForSource, blockReasonForTmdbId } from '../lib/series-blocklist';
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
import { generateWasBedeutetDas, generateDarumRelevant, generateBisherigerStand } from '../lib/was-bedeutet-das';
import { uploadSeriesImages } from '../lib/blob-uploader';
import { fetchTopBackdrops, selectBackdropForArticle } from '../lib/tmdb-backdrops';
import { getStreamerFallbackImage } from '../lib/streamer-fallback-images';
import { factSafetyCheck } from '../lib/fact-safety-layer';
import { classifyContentAge, shouldPublishBasedOnAge, neutralizeOldContentHeadline } from '../lib/time-axis-correction';
import { generateSeriesSlug } from '../lib/slug-utils';
import { shouldSkipByGenre } from '../lib/genre-filter';
import { checkDachAvailability } from '../lib/dach-availability';
import { PipelineLogger, type TriggerType } from '../lib/pipeline-logger';
import { checkForDuplicate, quickTitleSimilarityCheck, preFilterDuplicate, normalizeCoreEvent } from '../lib/duplicate-checker';
import { computeStoryFingerprint } from '../lib/story-fingerprint';
import { indexNewArticle } from '../lib/google-indexing';
import { indexNowArticle } from '../lib/indexnow';
import { postArticleToFacebook } from '../lib/facebook-poster';
import { getBoolSetting, SETTINGS } from '../lib/app-settings';

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
  /**
   * Discovery channel — wo wurde dieser Artikel ENTDECKT? (Feb 2026)
   *   - 'rss-direct'        : direkter RSS-Feed (Screenrant, Collider, Cinemaholic, …)
   *   - 'googlenews'        : Google News RSS Wrapper-URL (post-decode)
   *   - 'tudum'             : Netflix Tudum HTML-Scraper
   *   - 'streamer-aggregator': /neue-serien Source (TMDB-Releases pro Streamer)
   *   - 'admin-manual'      : manueller Trigger via Admin-UI / CLI
   *   - 'replay'            : Replay-Job (already-rejected sources retry)
   *   - 'trends'            : trends-processor
   *   - 'screenrant-deep'   : screenrant deep-scraper
   *   - 'tvline-deep'       : tvline deep-scraper
   * Wert wird in `pipeline_runs.metadata.discoveryChannel` persistiert.
   */
  discoveryChannel?: string;
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
  if (source.discoveryChannel) {
    logger.addMetadata('discoveryChannel', source.discoveryChannel);
  }

  // ════════════════════════════════════════════════════════════════════════
  // SERIES BLOCKLIST (earliest gate — saves LLM cost + TMDB calls)
  // ════════════════════════════════════════════════════════════════════════
  {
    const blocked = await blockReasonForSource(source.title, source.url);
    if (blocked) {
      console.log(`⛔ BLOCKED: "${blocked.label}" matched via URL/Title`);
      await logger.fail(`Blocklist: ${blocked.label}`, 'blocklist-source');
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // WEAK-SOURCE HOSTS — pre-LLM block
  // Hosts whose articles historically deliver high volume but weak DACH
  // Discover performance. Sources removed from the default RSS list in
  // news-scraper.ts; this is the second line of defence for cases where
  // Google News / Trends surfaces a URL pointing to one of them.
  // ════════════════════════════════════════════════════════════════════════
  {
    const WEAK_HOSTS = [
      'screenrant.com',
      'collider.com',
      'whats-on-netflix.com',
      // tvinsider.com (Juni 2026, Anti-HCU): Cloudflare-JS-Challenge verhindert
      // verlässliches Full-Text-Scraping — Original-Titel werden mit „Just a
      // moment..." statt echter Headlines geliefert. Heißt die Pipeline läuft
      // mit minimalem Snippet ins LLM-Generation und produziert dadurch
      // überdurchschnittlich viele Buzz/Halluzinations-Headlines. 11 von 30
      // jüngsten Artikeln stammen von hier → strukturelles Trust-Risiko.
      'tvinsider.com',
    ];
    try {
      const host = new URL(source.url).host.replace(/^www\./, '').toLowerCase();
      if (WEAK_HOSTS.includes(host)) {
        console.log(`⛔ BLOCKED weak source host: ${host}`);
        await logger.fail(`Weak source host: ${host}`, 'blocklist-source-weak');
        return null;
      }
    } catch { /* malformed URL — let the rest of the pipeline handle it */ }
  }

  // ════════════════════════════════════════════════════════════════════════
  // GATE A — DAILY VOLUME CAP
  // Caps how many articles we publish per UTC-day. 5/day picked as conservative
  // Anti-HCU-Pass (Juni 2026, nach SpamBrain-Throttling). Vorher 15/Tag — aber
  // ein gedrosseltes Crawl-Budget verträgt nur dünnen, hochwertigen Output.
  // Sobald Discover/Search-Sichtbarkeit nachweisbar erholt ist, wieder anheben.
  //
  // Manual runs (--trigger=manual) bypass the cap so editorial overrides
  // always work. Bot/scheduled runs respect it.
  // ════════════════════════════════════════════════════════════════════════
  const DAILY_CAP = 10;
  if (source.trigger !== 'manual') {
    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
    const todayCount = await prisma.articles.count({
      where: { status: 'published', publishedAt: { gte: startOfDay } },
    });
    if (todayCount >= DAILY_CAP) {
      console.log(`⛔ DAILY-CAP reached: ${todayCount} ≥ ${DAILY_CAP}`);
      await logger.fail(`Daily-cap reached (${todayCount}/${DAILY_CAP})`, 'daily-cap');
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // GATE C ENTFERNT (Juni 2026): tvinsider.com Daily-Throttle ist obsolet,
  // seit der Host komplett in WEAK_HOSTS steht und vor diesem Gate geblockt
  // wird (siehe oben). Bei Bedarf via --trigger=manual+--tvinsider explizit
  // freischaltbar.
  // ════════════════════════════════════════════════════════════════════════

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
    // ========== STEP 0: URL DEDUP (vor allen LLM-Calls!) ==========
    const trigger = source.trigger || 'manual';
    
    if (trigger !== 'manual') {
      // Nur SUCCESSFUL Runs der letzten 24h blockieren — gescheiterte Runs
      // (z.B. Classifier-Timeout → UNKNOWN) dürfen neu versucht werden,
      // sonst altern Artikel aus dem Relevanzfenster und gehen verloren.
      const recentRun = await prisma.pipeline_runs.findFirst({
        where: {
          inputSource: source.url,
          status: 'success',
          startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          id: { not: logger.getRunId() || '' },
        },
        select: { id: true, status: true, startedAt: true },
        orderBy: { startedAt: 'desc' },
      });

      if (recentRun) {
        console.log(`⏭️  URL bereits erfolgreich verarbeitet (${new Date(recentRun.startedAt).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' })})`);
        console.log(`   → Überspringe. Manuelle Trigger umgehen diesen Check.`);
        await logger.fail('URL bereits verarbeitet (Dedup)', 'url-dedup');
        return null;
      }
    }

    // ========== STEP 1: FULL TEXT FETCH ==========
    logStep('1_full_text_fetch');
    console.log('━'.repeat(70));
    console.log('STEP 1: FULL TEXT FETCH');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 1: Full Text Fetch');
    
    let fullSourceText = source.text || source.sourceText || '';
    let sourceWordCount = 0;
    let sourceYoutubeVideoIds: string[] = [];
    let sourceInstagramPermalinks: string[] = [];
    let sourceTwitterStatusUrls: string[] = [];
    
    if (source.useFullTextMode) {
      const fullTextResult = await fetchFullArticleText(source.url);
      
      if (fullTextResult.wordCount > 100) {
        fullSourceText = fullTextResult.fullText;
        sourceWordCount = fullTextResult.wordCount;
        sourceYoutubeVideoIds = fullTextResult.youtubeVideoIds || [];
        sourceInstagramPermalinks = fullTextResult.instagramPermalinks || [];
        sourceTwitterStatusUrls = fullTextResult.twitterStatusUrls || [];
        
        if (fullTextResult.title && fullTextResult.title.length > 5) {
          source.title = fullTextResult.title;
        }
        
        console.log(`✅ Full text: ${sourceWordCount} words`);
        if (sourceYoutubeVideoIds.length > 0) {
          console.log(`🎬 YouTube videos found: ${sourceYoutubeVideoIds.length}`);
        }
        logger.log(`Volltext: ${sourceWordCount} Wörter`);
        await logger.update({ wordsCollected: sourceWordCount });
      }
    }
    console.timeEnd('⏱️  STEP 1: Full Text Fetch');
    
    // ========== THEMA-ALTER CHECK (6 Stunden Maximum) ==========
    // Pipeline-V2 verarbeitet einzelne News-Artikel - das Artikel-Datum IST das Thema-Datum
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

    // ══════════════════════════════════════════════════════════════════════
    // TOPIC OUT-OF-SCOPE GATE (Phase B Feb 2026, **VOR LLM** seit Phase C)
    //   Deterministischer Block für US-Talkshow-/Boulevard-Klatsch (SNL,
    //   Met-Gala-Outfits, Late-Show-Interviews ohne News-Substanz). Diese
    //   Artikel haben null DACH-Discover-Wert und kosten E-E-A-T.
    //
    //   Vorgezogen vor Step 2 (Classification), damit kein LLM-Token mehr für
    //   Late-Night-Smalltalk verbrannt wird. checkTopicOutOfScope nutzt nur
    //   Title + erste 800 Zeichen — alles bereits nach Step 1 verfügbar.
    // ══════════════════════════════════════════════════════════════════════
    {
      const { checkTopicOutOfScope } = await import('../lib/topic-out-of-scope');
      const leadSample = (fullSourceText || '').slice(0, 800);
      const topicCheck = checkTopicOutOfScope(source.title, leadSample);
      if (topicCheck.skip) {
        console.log(`⚠️  TOPIC-OUT-OF-SCOPE (pre-LLM): "${source.title.slice(0, 80)}"`);
        console.log(`   Grund: ${topicCheck.reason} (Treffer: "${topicCheck.hit}")`);
        await logger.fail(
          `Topic out-of-scope (pre-LLM): ${topicCheck.reason} — "${topicCheck.hit}"`,
          'topic-out-of-scope',
        );
        return null;
      }
    }

    logStep('2_classification');

    // ══════════════════════════════════════════════════════════════════════
    // URL-PATTERN SHORT-CIRCUIT (Phase B+ Feb 2026)
    // Bevor wir teures LLM-Classification zahlen, prüfen wir URL + Titel
    // gegen kurze Pattern-Liste, die strukturell nie TV-Serien-News sein
    // können (Sport-Live-Guides, Wahlen, Wetter, Börse, Listicles über Filme).
    // Alle diese fallen eh später durch den Classifier — wir sparen Tokens.
    // ══════════════════════════════════════════════════════════════════════
    {
      const urlLc = (source.url || '').toLowerCase();
      const titleLc = (source.title || '').toLowerCase();
      const combined = `${urlLc} ${titleLc}`;
      const NON_TV_URL_PATTERNS: Array<{ re: RegExp; label: string }> = [
        { re: /\bwhere[\s-]*to[\s-]*watch[\s-]*(?:the[\s-]*)?(?:f1|formula[\s-]*one|nfl|nba|nhl|mlb|ufc|boxing|golf|tennis|nascar|indycar|motogp|premier[\s-]*league|super[\s-]*bowl|wrestlemania|ncaa|college[\s-]*(?:football|basketball)|world[\s-]*cup|olympics?|grand[\s-]*prix)\b/i, label: 'sports-where-to-watch' },
        { re: /\b(?:f1|formula[\s-]*one)[\s-]*(?:miami|monaco|bahrain|silverstone|spa|monza|austin|sao[\s-]*paulo|abu[\s-]*dhabi)[\s-]*grand[\s-]*prix/i, label: 'f1-race' },
        { re: /\b(?:how|where)[\s-]*to[\s-]*watch[\s-]*(?:the[\s-]*)?(?:kentucky[\s-]*derby|preakness|belmont|triple[\s-]*crown|breeders[\s-]*cup|indy[\s-]*500|daytona[\s-]*500|nascar)/i, label: 'horse-racing-motorsport' },
        { re: /\belection[\s-]*(?:results|night|coverage)\b/i, label: 'election-news' },
        { re: /\b(?:weather|hurricane|storm|tornado|wildfire)[\s-]*(?:forecast|warning|coverage)/i, label: 'weather-news' },
        { re: /\b(?:stock|market|nasdaq|dow[\s-]*jones|s&p[\s-]*500|crypto|bitcoin|ethereum)[\s-]*(?:report|close|today)/i, label: 'finance-markets' },
        { re: /\b(?:best|top[\s-]*\d+)[\s-]*(?:comedies?|movies?|films?|musicals?)[\s-]*on[\s-]*(?:amazon[\s-]*prime|netflix|hulu|disney|paramount|hbo|max|apple|peacock|starz)/i, label: 'movie-listicle' },
        { re: /\b(?:best|top[\s-]*\d+)[\s-]*(?:rewatch|rewatchable|feel[\s-]*good|underrated|forgotten)[\s-]*movies?\b/i, label: 'movie-listicle' },
        // Ratings / Einschaltquoten — for DACH readers this is US-Nielsen
        // noise that adds no value AND risks Discover penalties because
        // the article body inevitably trends toward US-only context.
        { re: /\b(?:tv|television|cable|broadcast|streaming|primetime|weekly|nightly|sunday|monday|tuesday|wednesday|thursday|friday|saturday)[\s-]*ratings\b/i, label: 'tv-ratings' },
        { re: /\bratings[\s-]*(?:report|recap|roundup|winner|loser|drop|jump|surge|slide|breakdown|wrap|race|war|battle|king|queen|crown|champion|hit|dud|disaster|flop|update|day|news|tracker|tracker)/i, label: 'tv-ratings' },
        { re: /\b(?:live[\s-]*\+[\s-]*[37]|l\+sd|l\+3|l\+7|live[\s-]*plus[\s-]*(?:three|seven)|nielsen|household[\s-]*ratings?|key[\s-]*demo|adults?[\s-]*18[\s-]*-[\s-]*49|18[\s-]*-[\s-]*49[\s-]*demo|demo[\s-]*ratings?|total[\s-]*viewers?)\b/i, label: 'nielsen-ratings' },
        { re: /\b(?:einschaltquot|tv-quote|tv[\s-]*bilanz|quotensieger|quotenrekord|quoten[\s-]*(?:hit|flop|sieg|bombe|krone|krise|könig|king|queen|erfolg)|marktanteil)/i, label: 'de-einschaltquoten' },
        { re: /\b(?:tops?[\s-]+and[\s-]+flops?|top[\s-]+rated|rating[\s-]*report|how[\s-]*[a-z\s-]{1,30}[\s-]*performed[\s-]*(?:on|with|in)[\s-]*(?:tv|its[\s-]*premiere|the[\s-]*ratings))/i, label: 'tv-ratings' },
      ];
      for (const { re, label } of NON_TV_URL_PATTERNS) {
        const m = combined.match(re);
        if (m) {
          console.log(`⚠️  URL-Pattern-Block: "${source.title.slice(0,70)}"`);
          console.log(`   Typ: ${label} — Treffer: "${m[0]}"`);
          await logger.fail(
            `URL-Pattern blockt (${label}): "${m[0]}" — "${source.title}"`,
            'blocklist-source',
          );
          return null;
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // SAMMEL-RECAP GATE (Feb 2026)
    //   TVInsider/Decider Multi-Show-Roundups ("Show1, Show2 & Show3 Season
    //   Finales") werden vom LLM-Classifier oft als SINGLE_SERIES_NEWS
    //   geroutet, weil die letzte/prominenteste Serie als primary_series
    //   gewählt wird → MULTI_SERIES_EDITORIAL-Filter mit DEATH/PLATFORM/
    //   AWARD-Override greift NICHT mehr. Frühe deterministische Sperre
    //   am URL+Titel spart LLM-Tokens und schließt das Bypass-Loch.
    // ══════════════════════════════════════════════════════════════════════
    {
      const { detectSammelRecap } = await import('../lib/sammel-recap-detector');
      const recap = detectSammelRecap(source.title || '', source.url || '');
      if (recap.isSammelRecap) {
        console.log(`⛔ SAMMEL-RECAP SKIP: "${source.title.slice(0, 80)}"`);
        console.log(`   Grund: ${recap.reason} (Treffer: "${recap.hit}")`);
        await logger.fail(
          `Sammel-Recap: ${recap.reason} — "${recap.hit}"`,
          'sammel-recap',
        );
        return null;
      }
    }

    // ========== STEP 2: CLASSIFICATION ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 2: CLASSIFICATION');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 2: Classification');

    // ═══════════════════════════════════════════════════════════════════
    // US-INDUSTRY-EVENT PRE-FILTER (deterministic, kein LLM-Call)
    // Blockt AAFCA/PGA/DGA/SAG/WGA/GLAAD/etc. Award-News die für DACH-
    // Publikum irrelevant sind. Läuft VOR dem Classifier → spart LLM-
    // Budget auf offensichtlich irrelevantem Content. Emmy/Golden Globes
    // sind bewusst NICHT gefiltert (haben DACH-Awareness).
    // ═══════════════════════════════════════════════════════════════════
    try {
      const { checkUsIndustryEvent } = await import('../lib/us-industry-event-filter');
      const usEventCheck = checkUsIndustryEvent({
        headline: source.title,
        sourceTitle: source.title,
      });
      if (usEventCheck.blocked) {
        console.log(`⛔ US-INDUSTRY-EVENT SKIP: "${source.title.slice(0, 80)}"`);
        console.log(`   Grund: ${usEventCheck.reason}`);
        logger.addMetadata('usIndustryEventSignals', usEventCheck.signals);
        await logger.fail(usEventCheck.reason || 'US-Industry-Event', 'us-industry-event');
        console.timeEnd('⏱️  STEP 2: Classification');
        return null;
      }
    } catch (error: any) {
      console.log(`⚠️  US-Industry-Event check skipped: ${error.message}`);
    }

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
    logger.log(`Klassifiziert als: ${classification.content_type} | ${(classification.reasoning || '').slice(0, 200)}`);
    logger.addMetadata('contentType', classification.content_type);
    logger.addMetadata('classifierReasoning', classification.reasoning || null);
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
    // EXCEPTION: URLs that explicitly signal an ENDING_EXPLAINED essay (e.g.
    // "*-ending-explained" on Cinemaholic) are routed through the dedicated
    // ENDING_EXPLAINED pipeline below, NOT skipped. The classifier may call
    // these FEATURE_ESSAY because they lack a news hook, but they are a
    // distinct, valuable content type for serien.de.
    if (classification.content_type === 'FEATURE_ESSAY') {
      const isEndingExplainedUrlOverride = /ending-explained/i.test(source.url || '') ||
        /ending[\s-]?explained|das[\s-]?ende[\s-]?erkl/i.test(source.title || '');
      if (isEndingExplainedUrlOverride) {
        console.log('   📝 FEATURE_ESSAY → reclassified as ENDING_EXPLAINED (URL/title signal)');
        classification.content_type = 'ENDING_EXPLAINED' as any;
      } else {
        console.log('⚠️  Article skipped: Feature/Essay ohne aktuelle Nachricht');
        console.log(`   Grund: ${classification.reasoning || 'Keine neue Meldung, nur Analyse/Retrospektive'}`);
        await logger.fail('Feature/Essay - keine News', 'classification');
        return null;
      }
    }
    
    // REJECT Movie and Mixed content
    if (classification.content_type === 'MOVIE' || classification.content_type === 'MIXED') {
      console.log(`⚠️  Article skipped: ${classification.content_type}`);
      await logger.fail(`${classification.content_type} - nur Serien erlaubt`, 'classification');
      return null;
    }

    // ══════════════════════════════════════════════════════════════════════
    // REJECT PERSONALITY_NEWS (Juni 2026, Anti-HCU)
    //
    // Vor dem Anti-HCU-Pass wurden Stories vom PERSÖNLICHEN Leben des Stars
    // (Memoiren, Übergriffe, Krankheits-Updates, Klagen, Beziehungen) als
    // Serien-News verkauft („Jeremy Clarkson krebsfrei nach Staffel 5",
    // „Moshe Kasher (The Pitt) …" usw.). Sie bringen:
    //   – schwache DACH-Discover-Performance (deutsche User wollen Serien-,
    //     keine US-Celebrity-Storys)
    //   – maximales Halluzinations-Risiko bei der Serien-Zuschreibung
    //   – Buzz-Headline-Druck (alle Beispiele aus den letzten 30 Variety-Titeln)
    //
    // Wenn der Star-Bezug WIRKLICH eine Serien-News auslöst (Cast-Exit, neuer
    // Showrunner, Rückkehr nach Staffel X), klassifiziert der LLM-Classifier
    // den Artikel als SINGLE_SERIES_NEWS — Personality-News bedeutet explizit
    // „Story ohne Serien-Event-Anker". Manual-Trigger erlaubt Override.
    // ══════════════════════════════════════════════════════════════════════
    if (classification.content_type === 'PERSONALITY_NEWS' && source.trigger !== 'manual') {
      console.log(`⚠️  Article skipped: PERSONALITY_NEWS — kein Serien-Event-Anker`);
      console.log(`   Grund: ${classification.reasoning || 'Star-/Celebrity-Story ohne Streaming-Bezug'}`);
      await logger.fail(
        `PERSONALITY_NEWS abgelehnt (keine Serien-News): ${(classification.reasoning || '').slice(0, 120)}`,
        'classification-personality-news',
      );
      return null;
    }

    // ══════════════════════════════════════════════════════════════════════
    // HALLUCINATION GUARD — primary_series muss im Artikel vorkommen
    //
    // Der Classifier halluziniert gelegentlich eine primary_series, die im
    // Original-Artikel gar nicht erwähnt wird. Beispiel:
    //   Titel: „Ryan Gosling landet als Astronaut auf Prime Video"
    //   Classifier: primary_series = „Snoopy in Space"
    //     (LLM assoziiert Astronaut + Prime + Space fälschlich mit Snoopy)
    // Ergebnis: Artikel wurde unter Snoopy in Space publiziert — 100 %
    // Falschzuordnung, hoher Discover-Trust-Schaden.
    //
    // Fix: mindestens EIN nicht-triviales Token der primary_series muss
    // als Substring in Titel oder erste ~800 Zeichen des Bodys auftauchen.
    // Sonst → Hard-Skip als Halluzination. Manual-Trigger erlaubt Override.
    // ══════════════════════════════════════════════════════════════════════
    if (
      classification.primary_series &&
      classification.content_type === 'SINGLE_SERIES_NEWS' &&
      source.trigger !== 'manual'
    ) {
      // Stopwords aus dem Series-Titel raus (Artikel/Präpositionen/…)
      const STOPWORDS = new Set([
        'the', 'a', 'an', 'and', 'of', 'in', 'on', 'to', 'for', 'with',
        'die', 'der', 'das', 'ein', 'eine', 'und', 'oder', 'auf', 'im', 'am',
        'im', 'am', 'zu', 'von', 'aus', 'bei',
      ]);
      const seriesTokens = classification.primary_series
        .toLowerCase()
        .split(/[^a-z0-9äöüß]+/i)
        .filter((t) => t.length >= 3 && !STOPWORDS.has(t));

      // Serie mit z.B. nur Zahlen/Kürzeln (9-1-1, CSI, ER): skip Check
      // um False-Positives zu vermeiden.
      if (seriesTokens.length > 0) {
        const scanText = (
          source.title + ' ' + (fullSourceText || '').slice(0, 800)
        ).toLowerCase();
        const hits = seriesTokens.filter((t) => scanText.includes(t));

        if (hits.length === 0) {
          console.log(
            `⛔ HALLUCINATION-GUARD: primary_series="${classification.primary_series}" ` +
              `nicht im Artikel-Titel/Body erwähnt (Tokens gesucht: ${seriesTokens.join(', ')})`,
          );
          logger.addMetadata('hallucinationGuard', {
            primarySeries: classification.primary_series,
            seriesTokens,
            scannedChars: scanText.length,
          });
          await logger.fail(
            `Classifier-Halluzination: "${classification.primary_series}" nicht im Artikel`,
            'classifier-hallucination',
          );
          return null;
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // TOPIC-OUT-OF-SCOPE wurde nach **vor** Step 2 verschoben (Phase C).
    // Der Pre-LLM-Gate sitzt direkt nach dem Thema-Alter-Check und spart die
    // Classification-Tokens für Talkshow-/Boulevard-Themen.
    // ══════════════════════════════════════════════════════════════════════

    // ══════════════════════════════════════════════════════════════════════
    // MULTI-SERIES EDITORIAL FILTER
    //
    // Skip multi-series roundups by default (they're Discover-weak and highly
    // prone to mis-tagging). Allow through only if one of 3 concrete single-
    // event triggers is detected: DEATH, PLATFORM event, or AWARD ceremony.
    // When allowed, the article is forced to SEARCH_ONLY — never news-sitemap.
    // ══════════════════════════════════════════════════════════════════════
    let multiSeriesException: { allowed: true; trigger: string; matchedPhrase: string } | null = null;
    if (classification.content_type === 'MULTI_SERIES_EDITORIAL') {
      const { detectMultiSeriesException } = await import('../lib/multi-series-exception');
      const res = detectMultiSeriesException({
        title: source.title || '',
        content: fullSourceText,
      });
      if (!res.allowed) {
        console.log(`⚠️  Article skipped: MULTI_SERIES_EDITORIAL ohne Ausnahme-Trigger`);
        console.log(`   Discover-schwach + Mis-Tag-Risiko — konfigurierbar via lib/multi-series-exception.ts`);
        await logger.fail('Multi-Series-Roundup — kein Exception-Trigger', 'multi-series-skip');
        return null;
      }
      multiSeriesException = { allowed: true, trigger: res.trigger, matchedPhrase: res.matchedPhrase };
      const willForceSearch = res.trigger === 'AWARD';
      console.log(`✅ Multi-Series durchgelassen: Trigger=${res.trigger} (Phrase: "${res.matchedPhrase}")`);
      if (willForceSearch) {
        console.log(`   → AWARD-Artikel: publishMode wird auf SEARCH_ONLY gezwungen`);
      } else {
        console.log(`   → ${res.trigger}-Artikel: durchläuft normalen Discover-Gate (Quality entscheidet)`);
      }
      logger.addMetadata('multiSeriesException', multiSeriesException);
    }

    // Map to our internal type.
    // URL-based ENDING_EXPLAINED detection: any `/ending-explained/` slug on
    // any source (Cinemaholic, Decider etc.) is treated as recap-content and
    // routed through the dedicated generator + headline format enforcement.
    const isEndingExplainedUrl = /ending-explained/i.test(source.url || '') ||
      /ending\s+explained/i.test(source.title || '');
    // URL/Source-based TRUE_STORY detection. Triggers: "true story", "real
    // story", "where are they now", "wahre geschichte", "basiert auf einer
    // wahren". Eigene Pflicht-Headline-Patterns ("Die wahre Geschichte hinter
    // X. Wie ging es weiter?" / "Basiert X auf einer wahren Geschichte? Wie
    // ging es weiter?"), Routing wie ENDING_EXPLAINED.
    const { isTrueStorySource, assessTrueStoryCertainty } = await import('../lib/true-story-format');
    const isTrueStoryUrl = !isEndingExplainedUrl && isTrueStorySource(source.url, source.title);
    let trueStoryCertainty: 'confirmed' | 'uncertain' = 'uncertain';
    if (isTrueStoryUrl) {
      trueStoryCertainty = assessTrueStoryCertainty(source.title, fullSourceText, []);
    }
    const contentType = isEndingExplainedUrl
      ? 'ENDING_EXPLAINED'
      : isTrueStoryUrl
        ? 'TRUE_STORY'
        : (classification.content_type === 'SINGLE_SERIES_NEWS' || classification.content_type === 'PERSONALITY_NEWS') ? 'NEWS' : 'RANKING';
    if (isEndingExplainedUrl) {
      console.log(`   📝 ENDING_EXPLAINED pipeline aktiv (URL-Signal: "ending-explained")`);
      logger.addMetadata('contentType', 'ENDING_EXPLAINED');
    } else if (isTrueStoryUrl) {
      console.log(`   📝 TRUE_STORY pipeline aktiv (Signal: ${trueStoryCertainty}-Variante)`);
      logger.addMetadata('contentType', 'TRUE_STORY');
      logger.addMetadata('trueStoryCertainty', trueStoryCertainty);
    }

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

      // ═══════════════════════════════════════════════════════════════════
      // HARD SAFETY GUARD — classifier named a specific primary_series
      // but TMDB couldn't find it. Do NOT fall back to scanning the whole
      // text for random series mentions — that leads to articles about
      // brand-new shows (e.g. "Ring By Spring Break") being published under
      // whatever popular series happens to be mentioned in a sidebar
      // (e.g. "Wednesday"). Instead: skip the article cleanly.
      // ═══════════════════════════════════════════════════════════════════
      if (classification.primary_series) {
        const primaryCandidate = classification.primary_series.trim();
        const exactMatch = await prisma.series.findFirst({
          where: {
            OR: [
              { title: { equals: primaryCandidate, mode: 'insensitive' } },
              { name: { equals: primaryCandidate, mode: 'insensitive' } },
              // EN-originaltitel-Fallback: Cinemaholic & andere internationale
              // Quellen schreiben über deutsche Releases (z.B. "Achtsam Morden")
              // unter dem englischen Originaltitel ("Murder Mindfully"). Ohne
              // diesen Fallback fällt Step 3 hier und der Artikel wird verworfen.
              { originalName: { equals: primaryCandidate, mode: 'insensitive' } },
            ],
          },
          select: { tmdbId: true, name: true, title: true },
        });
        if (exactMatch) {
          console.log(`✅ DB Exact Match (classifier primary): "${exactMatch.name}"`);
          searchResult = {
            tmdbId: exactMatch.tmdbId,
            name: exactMatch.name || exactMatch.title,
            confidence: 0.85,
            matchMethod: 'db-exact-classifier-primary',
          };
        } else {
          console.log(`❌ Primary series "${primaryCandidate}" not in TMDB or DB — skipping`);
          console.log('   (No fallback to text-scanned series to avoid mis-tagging)');
          await logger.fail(
            `Primary series "${primaryCandidate}" unknown — no safe fallback`,
            'primary-series-unresolvable',
          );
          console.timeEnd('⏱️  STEP 3: TMDB Resolution');
          return null;
        }
      } else {
        // No primary_series hint from classifier — legacy behavior: try extracted candidates
        const candidates = extractSeriesNameCandidates(source.title, fullSourceText);
        let dbMatch = null;

        console.log(`   📋 Trying exact DB match for candidates: ${candidates.join(', ')}`);

        for (const candidate of candidates) {
          dbMatch = await prisma.series.findFirst({
            where: {
              OR: [
                { title: { equals: candidate, mode: 'insensitive' } },
                { name: { equals: candidate, mode: 'insensitive' } },
                // EN-Originaltitel-Fallback (siehe Begründung oben).
                { originalName: { equals: candidate, mode: 'insensitive' } },
              ],
            },
            select: { tmdbId: true, name: true, title: true, backdropPath: true, trailers: true },
          });

          if (dbMatch) {
            console.log(`✅ DB Exact Match: Found "${dbMatch.name}" for "${candidate}"`);
            searchResult = {
              tmdbId: dbMatch.tmdbId,
              name: dbMatch.name || dbMatch.title,
              confidence: 0.85,
              matchMethod: 'db-exact-match',
            };
            break;
          }
        }
      }
      
      if (!searchResult || searchResult.confidence < DRAFT_THRESHOLD) {
        // Komplett keine Zuordnung möglich -> Als Draft speichern
        console.log('❌ No match found in TMDB or DB');
        console.log('   → Artikel wird als DRAFT gespeichert (keine Serie gefunden)');
        saveAsDraft = true;
        draftReason = `Keine Serie gefunden (TMDB: ${searchResult ? `${searchResult.name ?? '?'} ${(searchResult.confidence * 100).toFixed(0)}%` : 'null'})`;

        // Verwende eine Fallback-Serie oder null
        if (!searchResult) {
          // Kein Match - kein sinnvoller Artikel möglich ohne Serie → sauber überspringen
          await logger.log(`Draft: ${draftReason}`);
          await logger.fail(
            'Keine TMDB-Serie gefunden (Serie nicht in TMDB, kein DB-Match)',
            'tmdb-no-match',
          );
          console.timeEnd('⏱️  STEP 3: TMDB Resolution');
          return null;
        }
      }
    }
    
    // Prüfe ob Confidence für Veröffentlichung reicht.
    // ENDING_EXPLAINED hat bereits URL-Level-Certainty (-ending-explained + TMDB-Match),
    // deshalb lockerer Schwellwert: 50% reicht für Publish.
    const publishThreshold = contentType === 'ENDING_EXPLAINED' ? 0.5 : PUBLISH_THRESHOLD;
    if (searchResult && searchResult.confidence < publishThreshold && !saveAsDraft) {
      console.log(`⚠️ Confidence below publish threshold (${(searchResult.confidence * 100).toFixed(0)}% < ${(publishThreshold * 100).toFixed(0)}%)`);
      console.log(`   → Artikel wird als DRAFT gespeichert (unsichere Zuordnung)`);
      saveAsDraft = true;
      draftReason = `Unsichere Zuordnung: ${searchResult.name} (${(searchResult.confidence * 100).toFixed(0)}%)`;
      logger.log(`Draft: ${draftReason}`);
    }
    
    if (searchResult && !saveAsDraft) {
      console.log(`✅ TMDB Match accepted: ${searchResult.name} (${(searchResult.confidence * 100).toFixed(1)}%)`);
    }
    
    // If no searchResult at all (new/unknown series), skip rest cleanly instead of crashing
    if (!searchResult) {
      await logger.fail('Keine TMDB-Serie gefunden (Serie möglicherweise noch nicht in TMDB)', 'tmdb-no-match');
      return null;
    }
    
    logger.log(`Serie: ${searchResult.name} (TMDB: ${searchResult.tmdbId})`);
    logger.addMetadata('seriesName', searchResult.name);
    logger.addMetadata('tmdbId', searchResult.tmdbId);
    
    console.log(`✅ Series: ${searchResult.name} (ID: ${searchResult.tmdbId})`);
    console.log(`   Confidence: ${(searchResult.confidence * 100).toFixed(1)}%`);
    console.log(`   Method: ${searchResult.matchMethod}`);

    // ══════════════════════════════════════════════════════════════════════
    // PRIMARY-SERIES SANITY CHECK
    //
    // If the classifier named a primary series (e.g. "Ring By Spring Break")
    // but TMDB resolved to something with a completely different name (e.g.
    // "Wednesday"), that's almost certainly wrong — a popular series name
    // matched as a fuzzy fallback. Skip to protect the feed.
    // ══════════════════════════════════════════════════════════════════════
    if (classification.primary_series && searchResult.name) {
      const primaryLc = classification.primary_series.toLowerCase().trim();
      const resolvedLc = (searchResult.name as string).toLowerCase().trim();
      // Share at least one 4+ letter token to consider them related
      const primaryTokens = new Set(
        primaryLc.split(/[^a-z0-9äöüß]+/i).filter((t) => t.length >= 4),
      );
      const resolvedTokens = (resolvedLc as string).split(/[^a-z0-9äöüß]+/i);
      const overlap = resolvedTokens.some((t) => t.length >= 4 && primaryTokens.has(t));
      // Allow if a 4+ letter token overlaps, or primary contains resolved / vice versa
      const substringMatch =
        primaryLc.length >= 4 &&
        (primaryLc.includes(resolvedLc) || resolvedLc.includes(primaryLc));
      if (!overlap && !substringMatch) {
        // ENDING_EXPLAINED: URL-Signal + TMDB-Match sind ausreichend. Englischer
        // Titel aus der Cinemaholic-Quelle ("Envious") vs. Originaltitel in TMDB
        // ("Envidiosa") würde sonst zuschlagen, obwohl es dieselbe Serie ist.
        if (contentType === 'ENDING_EXPLAINED') {
          console.log(
            `   ⚠️ Primary-Series-Mismatch ignoriert für ENDING_EXPLAINED: ` +
            `classifier="${classification.primary_series}" vs TMDB="${searchResult.name}" — URL-Signal gewinnt.`,
          );
        } else {
          console.log(
            `⛔ PRIMARY-SERIES MISMATCH: classifier="${classification.primary_series}" vs TMDB="${searchResult.name}" — skipping to avoid mis-tagging.`,
          );
          await logger.fail(
            `Primary mismatch: "${classification.primary_series}" vs "${searchResult.name}"`,
            'primary-series-mismatch',
          );
          console.timeEnd('⏱️  STEP 3: TMDB Resolution');
          return null;
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // BLOCKLIST SAFETY NET (post-TMDB — catches cases URL/title missed)
    // ══════════════════════════════════════════════════════════════════════
    {
      const blocked = await blockReasonForTmdbId(searchResult.tmdbId);
      if (blocked) {
        console.log(`⛔ BLOCKED: "${blocked.label}" matched via TMDB-ID ${searchResult.tmdbId}`);
        await logger.fail(`Blocklist (TMDB): ${blocked.label}`, 'blocklist-tmdb');
        return null;
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // GATE B — PER-SERIES MONTHLY CAP
    // Caps how many articles we publish per series per rolling 30-day window.
    // Over-coverage (currently 30 series have >5 articles/month, summing to
    // 334 articles = 27% of total volume) gives diminishing returns — extra
    // articles cannibalise each other in Discover and SERP. 5/month is the
    // sweet spot: covers all major story beats (renewal, finale, casting,
    // streaming-arrival, ending-explained) without dilution.
    //
    // Manual runs bypass — editorial overrides always work.
    // ══════════════════════════════════════════════════════════════════════
    const PER_SERIES_MONTHLY_CAP = 5;
    if (source.trigger !== 'manual') {
      const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const seriesCount = await prisma.articles.count({
        where: {
          status: 'published',
          primarySeriesId: searchResult.tmdbId,
          publishedAt: { gte: since30 },
        },
      });
      if (seriesCount >= PER_SERIES_MONTHLY_CAP) {
        console.log(`⛔ PER-SERIES CAP reached: ${seriesCount} ≥ ${PER_SERIES_MONTHLY_CAP} for tmdb:${searchResult.tmdbId}`);
        await logger.fail(`Per-series cap (${seriesCount}/${PER_SERIES_MONTHLY_CAP}) for tmdb:${searchResult.tmdbId}`, 'per-series-cap');
        console.timeEnd('⏱️  STEP 3: TMDB Resolution');
        return null;
      }
    }
    
    // Check if series exists in DB
    let dbSeries = await prisma.series.findUnique({
      where: { tmdbId: searchResult.tmdbId },
      select: { tmdbId: true, name: true, title: true, backdropPath: true, trailers: true, genres: true, numberOfSeasons: true, networks: true }
    });
    
    if (!dbSeries) {
      // Create new series
      console.log('📚 Creating new series record...');
      const completeDetails = await getTvDetailsComplete(searchResult.tmdbId, 'de-DE');
      
      if (!completeDetails) {
        console.log('❌ Failed to fetch series details');
        return null;
      }
      
      // Create series (upsert to handle slug conflicts)
      const desiredSlug = generateSeriesSlug(completeDetails.name, searchResult.tmdbId);
      // Check if slug already taken by another series
      const existingSlug = await prisma.series.findFirst({
        where: { slug: desiredSlug, tmdbId: { not: searchResult.tmdbId } },
        select: { tmdbId: true },
      });
      const finalSlug = existingSlug ? `${desiredSlug}-${searchResult.tmdbId}` : desiredSlug;
      
      dbSeries = await prisma.series.upsert({
        where: { tmdbId: searchResult.tmdbId },
        update: {
          name: completeDetails.name,
          title: completeDetails.name,
          overview: completeDetails.overview || undefined,
          status: completeDetails.status,
          firstAirDate: completeDetails.firstAirDate ? new Date(completeDetails.firstAirDate) : undefined,
          updatedAt: new Date(),
        },
        create: {
          tmdbId: searchResult.tmdbId,
          name: completeDetails.name,
          title: completeDetails.name,
          slug: finalSlug,
          posterPath: completeDetails.posterPath,
          backdropPath: completeDetails.backdropPath,
          overview: completeDetails.overview || '',
          status: completeDetails.status,
          firstAirDate: completeDetails.firstAirDate ? new Date(completeDetails.firstAirDate) : null,
          trailers: completeDetails.trailers || [],
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
      
      // ✅ Download trailer to R2 immediately for new series
      (async () => {
        try {
          let trailerId = findTrailerYouTubeId(completeDetails.trailers || []);
          
          // Fallback: YouTube-Suche wenn kein TMDB-Trailer
          if (!trailerId) {
            console.log(`   🔍 Searching YouTube for trailer...`);
            trailerId = await searchYouTubeTrailerViaAPI(completeDetails.name, 'de');
            if (!trailerId) {
              trailerId = await searchYouTubeTrailerViaAPI(completeDetails.name, 'en');
            }
          }
          
          if (trailerId) {
            console.log(`   📥 Downloading trailer to R2...`);
            const downloadResult = await downloadYouTubeTrailer(trailerId, completeDetails.name);
            
            if (downloadResult.success && downloadResult.localPath) {
              await prisma.series.update({
                where: { tmdbId: searchResult.tmdbId },
                data: { localTrailerPath: downloadResult.localPath }
              });
              console.log(`   ✅ Trailer saved to R2: ${downloadResult.localPath}`);
            }
          }
        } catch (e: any) {
          console.log(`   ⚠️ Trailer download failed: ${e.message}`);
        }
      })();
      
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

    // ══════════════════════════════════════════════════════════════════════
    // EXTENDED OVERVIEW HOOK (Feb 2026)
    //
    // Series-Pages rendern `extendedOverview` (eigener LLM-Text via Wikipedia
    // + TMDB) vor dem TMDB-`overview`. Wenn die Serie hier zum ersten Mal
    // resolved wurde, hat sie noch keinen — und der manuelle Bulk-Job hat
    // sie auch nie gesehen. Hook erledigt das automatisch.
    //
    // Fire-and-forget: blockiert die Pipeline NICHT (4–8 s LLM-Call), läuft
    // im Hintergrund. Bei Fehler nur loggen.
    // ══════════════════════════════════════════════════════════════════════
    if (dbSeries.tmdbId) {
      void (async () => {
        try {
          // Re-query with the full set of fields the generator needs;
          // the upstream select() only covers the pipeline-critical columns.
          const full = await prisma.series.findUnique({
            where: { tmdbId: dbSeries!.tmdbId },
            select: {
              extendedOverview: true, name: true, title: true,
              originalName: true, overview: true, genres: true,
              firstAirDate: true, numberOfSeasons: true, status: true,
              cast: true, crew: true, networks: true,
            },
          });
          if (!full || full.extendedOverview) return;

          const { generateSeriesExtendedOverview } = await import('../lib/series-overview-generator');
          const cast = (full.cast as any[]) || [];
          const crew = (full.crew as any[]) || [];
          const creators = crew
            .filter((c: any) => c.job === 'Creator' || c.job === 'Executive Producer')
            .slice(0, 3)
            .map((c: any) => c.name);
          const generated = await generateSeriesExtendedOverview({
            seriesName: full.name || full.title || '',
            originalTitle: full.originalName ?? undefined,
            originalOverview: full.overview || '',
            genres: (full.genres as string[]) || [],
            firstAirYear: full.firstAirDate ? new Date(full.firstAirDate).getFullYear() : null,
            numberOfSeasons: full.numberOfSeasons,
            status: full.status,
            cast: cast.slice(0, 5),
            creators,
            networks: (full.networks as string[]) || [],
          });
          if (generated && generated.length > 200) {
            await prisma.series.update({
              where: { tmdbId: dbSeries!.tmdbId },
              data: { extendedOverview: generated, updatedAt: new Date() },
            });
            console.log(`   🪶 extendedOverview generated (${generated.length} chars) for "${full.name}"`);
          }
        } catch (e: any) {
          console.log(`   ⚠️ extendedOverview hook failed: ${e?.message}`);
        }
      })();
    }

    // ══════════════════════════════════════════════════════════════════════
    // GENRE SAFETY NET — skip US late-night / talk / game / reality shows
    // BEFORE any LLM spend. Source: TVInsider/Variety/Deadline RSS-noise.
    // ══════════════════════════════════════════════════════════════════════
    {
      // Prefer DB genres; fall back to an on-the-fly TMDB fetch so we
      // still catch shows whose DB record is stale (e.g. empty genres[]).
      let genresForCheck: string[] = dbSeries.genres || [];
      let seasonsForCheck: number | null | undefined = dbSeries.numberOfSeasons;
      if (!genresForCheck || genresForCheck.length === 0) {
        try {
          const details = await getTvDetailsComplete(searchResult.tmdbId, 'en-US');
          if (details) {
            const g = (details as any).genres;
            genresForCheck = Array.isArray(g)
              ? g.map((x: any) => (typeof x === 'string' ? x : x?.name)).filter(Boolean)
              : [];
            seasonsForCheck = (details as any).numberOfSeasons ?? seasonsForCheck;
          }
        } catch {}
      }
      const skipCheck = shouldSkipByGenre(genresForCheck, seasonsForCheck, {
        title: dbSeries.title,
        originalName: dbSeries.originalName,
      });
      if (skipCheck.skip) {
        console.log(`⛔ GENRE SKIP: ${skipCheck.reason}`);
        await logger.fail(`Genre out-of-scope: ${skipCheck.reason}`, 'genre-out-of-scope');
        return null;
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // DACH-AVAILABILITY GATE — skip US/UK linear-only series with no
    // German distribution. We rely on series.networks[] (TMDB names) and
    // fall back to source URL/title when networks is empty.
    // ══════════════════════════════════════════════════════════════════════
    {
      let networksForCheck: string[] = (dbSeries.networks as string[] | null) || [];
      if (networksForCheck.length === 0) {
        try {
          const details = await getTvDetailsComplete(searchResult.tmdbId, 'en-US');
          if (details && Array.isArray((details as any).networks)) {
            networksForCheck = (details as any).networks
              .map((x: any) => (typeof x === 'string' ? x : x?.name))
              .filter(Boolean);
            // Persist for next time
            if (networksForCheck.length > 0) {
              prisma.series.update({
                where: { tmdbId: searchResult.tmdbId },
                data: { networks: networksForCheck },
              }).catch(() => {});
            }
          }
        } catch {}
      }
      const dachCheck = checkDachAvailability(
        networksForCheck,
        source.url,
        source.title,
      );
      if (!dachCheck.available) {
        console.log(`⛔ DACH SKIP: ${dachCheck.reason}`);
        await logger.fail(`DACH-unavailable: ${dachCheck.reason}`, 'dach-availability');
        return null;
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // US-DAYTIME/LATE-NIGHT/SNL BRAND CHECK — fängt Series-Name-basiert
    // alles was TMDB mit leeren Genres und NBC/ABC/CBS-Networks durchwinkt:
    // Today franchise, GMA, The View, Tonight Show, SNL, Daily Show etc.
    // ══════════════════════════════════════════════════════════════════════
    {
      const { checkUsDaytimeTalkBrand } = await import('../lib/us-daytime-talk-brands');
      const brandCheck = checkUsDaytimeTalkBrand(
        dbSeries.title,
        (dbSeries as any).originalName,
      );
      if (brandCheck.blocked) {
        console.log(`⛔ DAYTIME-BRAND SKIP: ${brandCheck.reason}`);
        await logger.fail(`US-Daytime/Late-Night-Brand: ${brandCheck.reason}`, 'us-daytime-talk-brand');
        return null;
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // SHOW-AGE CUTOFF — skip Ended/Canceled series whose lastAirDate is
    // older than 10 years, unless source contains Reboot/Revival/Death/
    // Reunion-Premiere keywords. Catches Boulevard-Gossip on retired US
    // sitcoms (Happy Days, Cheers, Frasier, Seinfeld …).
    // ══════════════════════════════════════════════════════════════════════
    {
      const { checkShowAgeCutoff } = await import('../lib/show-age-cutoff');
      const ageCheck = checkShowAgeCutoff(
        {
          name: dbSeries.title || dbSeries.originalName,
          lastAirDate: (dbSeries as any).lastAirDate,
          firstAirDate: (dbSeries as any).firstAirDate,
          status: (dbSeries as any).status,
          inProduction: (dbSeries as any).inProduction,
        },
        source.title,
        (fullSourceText || '').slice(0, 800),
      );
      if (ageCheck.skip) {
        console.log(`⛔ AGE-CUTOFF SKIP: ${ageCheck.reason}`);
        await logger.fail(`Show-Age-Cutoff: ${ageCheck.reason}`, 'show-age-cutoff');
        return null;
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // UNRELEASED-PROJECT FILTER — skip TMDB stubs ("Untitled <X> Series",
    // "Untitled <X> Project") that have no firstAirDate and a planned/null
    // status. Such placeholders generate unsearchable headlines like
    // "Was viele über Oscar Isaac nicht wussten, bevor Untitled Las Vegas
    // Casino Series kam" and waste LLM tokens on industry-trade gossip.
    // Whitelist: status="In Production" (working title is real).
    // Override: source explicitly announces the official title.
    // ══════════════════════════════════════════════════════════════════════
    {
      const { checkUnreleasedProject } = await import('../lib/unreleased-project-filter');
      const projectCheck = checkUnreleasedProject(
        {
          name: dbSeries.name,
          title: dbSeries.title,
          originalName: (dbSeries as any).originalName,
          status: (dbSeries as any).status,
          firstAirDate: (dbSeries as any).firstAirDate,
          inProduction: (dbSeries as any).inProduction,
        },
        source.title,
        (fullSourceText || '').slice(0, 800),
      );
      if (projectCheck.skip) {
        console.log(`⛔ UNRELEASED-PROJECT SKIP: ${projectCheck.reason}`);
        console.log(`   Treffer: ${projectCheck.hit}`);
        await logger.fail(
          `Unreleased-Project: ${projectCheck.reason} — ${projectCheck.hit}`,
          'unreleased-project',
        );
        return null;
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // GERMAN-ANGLE COVERAGE GATE — skip if a real German publisher
    // (moviepilot, filmstarts, serienjunkies, quotenmeter, spiegel, bild …)
    // already covered the SPECIFIC story-angle in the last 14 days. Saves
    // LLM-Spend on stories that have no Discover/SEO first-mover advantage
    // for serien.de. Auto-translated IMDb/ČSFD pages are filtered out.
    // ══════════════════════════════════════════════════════════════════════
    {
      const { checkGermanAngleCoverage } = await import('../lib/google-news-de-coverage-check');
      const angleCov = await checkGermanAngleCoverage(
        dbSeries.title || dbSeries.originalName || '',
        source.title || '',
        14,
        1,
      );
      if (angleCov.stale) {
        console.log(`⛔ GERMAN-ANGLE-COVERAGE SKIP: ${angleCov.staleReason}`);
        await logger.fail(`German-Angle-Coverage: ${angleCov.staleReason}`, 'german-angle-coverage');
        return null;
      }
      if (angleCov.angles.length > 0) {
        const summary = angleCov.angles.map((a) => `${a.entity} (${a.deWhitelistedHits.length}/${a.deTotalHits})`).join(' · ');
        console.log(`   ✅ Story-Angle frei: ${summary}`);
        logger.addMetadata('germanAngleCheck', { angles: summary, stale: false });
      }
    }

    // ========== STEP 3.5: DUPLICATE CHECK ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 3.5: DUPLICATE CHECK 🔍');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 3.5: Duplicate Check');
    logger.log('Prüfe auf Duplikate...');

    // HARD URL DEDUPE: If this exact sourceUrl already exists, skip immediately.
    // Prevents unique-constraint crash at step 8 when the same RSS item is
    // reprocessed (e.g. cron overlap, manual retry of a published article).
    if (source.url) {
      const existingByUrl = await prisma.articles.findUnique({
        where: { sourceUrl: source.url },
        select: { slug: true, status: true },
      });
      if (existingByUrl) {
        console.log(`⛔ URL-DUPLIKAT: bereits als "${existingByUrl.slug}" (${existingByUrl.status}) vorhanden`);
        logger.log(`URL bereits als "${existingByUrl.slug}" vorhanden`);
        await logger.fail(`URL-Duplikat: /${existingByUrl.slug}`, 'url-duplicate');
        console.timeEnd('⏱️  STEP 3.5: Duplicate Check');
        return null;
      }
    }

    // STAGE A: Jaccard title + core-event pre-filter (0 LLM calls)
    // Catches ~80% of "same story, different publisher" hits before we burn
    // an LLM call on them.
    const preFilterHit = await preFilterDuplicate({
      newTitle: source.title,
      seriesTmdbIds: [dbSeries.tmdbId],
      storyFingerprint: null, // facts not yet extracted
    });
    if (preFilterHit) {
      console.log(`\n⛔ PRE-FILTER DUPLIKAT (${preFilterHit.stage}):`);
      console.log(`   Match: "${preFilterHit.matchedTitle}"`);
      console.log(`   Slug: /${preFilterHit.matchedSlug}`);
      console.log(`   Similarity: ${(preFilterHit.similarity * 100).toFixed(0)}%`);
      logger.log(`Pre-Filter-Duplikat (${preFilterHit.stage}): /${preFilterHit.matchedSlug}`);
      await logger.fail(
        `Duplikat (${preFilterHit.stage}): /${preFilterHit.matchedSlug}`,
        `duplicate-${preFilterHit.stage}`,
      );
      console.timeEnd('⏱️  STEP 3.5: Duplicate Check');
      return null;
    }

    // STAGE B: LLM semantic check (bestehend, aber fail-closed)
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
      await logger.fail(`Duplikat: ${duplicateResult.coreEvent}`, 'duplicate-llm');
      console.timeEnd('⏱️  STEP 3.5: Duplicate Check');
      return null;
    }

    // Persist the normalized core-event for downstream pre-filters on future articles
    const coreEventNormalizedValue = normalizeCoreEvent(duplicateResult.coreEvent);

    console.log(`✅ Kein Duplikat - Thema ist neu: "${duplicateResult.coreEvent}"`);
    logger.log(`Thema OK: ${duplicateResult.topicCategory} - ${duplicateResult.coreEvent}`);
    logger.addMetadata('topicCategory', duplicateResult.topicCategory);
    logger.addMetadata('coreEventNormalized', coreEventNormalizedValue);
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

    // ========== STEP 4.5: STORY FINGERPRINT GATE ==========
    // Hash over structured facts → catches "same story, different publisher"
    // even when titles differ. Runs BEFORE content generation (cheapest stop).
    logStep('4.5_fingerprint_gate');
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4.5: STORY FINGERPRINT GATE 🧬');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 4.5: Fingerprint Gate');

    const fingerprintBundle = computeStoryFingerprint(facts);
    let storyFingerprintValue: string | null = null;

    if (!fingerprintBundle) {
      console.log('   ⚠️  Zu wenige Fact-Signale für Fingerprint (skip gate)');
      logger.log('Fingerprint-Gate: skipped (low signal)');
    } else {
      storyFingerprintValue = fingerprintBundle.fingerprint;
      console.log(`   🧬 Fingerprint: ${fingerprintBundle.fingerprint.slice(0, 12)}…`);

      const fingerprintHit = await preFilterDuplicate({
        newTitle: source.title,
        seriesTmdbIds: [dbSeries.tmdbId],
        storyFingerprint: fingerprintBundle.fingerprint,
      });

      if (fingerprintHit?.stage === 'fingerprint') {
        console.log(`\n⛔ FINGERPRINT-DUPLIKAT:`);
        console.log(`   Match: "${fingerprintHit.matchedTitle}"`);
        console.log(`   Slug: /${fingerprintHit.matchedSlug}`);
        logger.log(`Fingerprint-Duplikat: /${fingerprintHit.matchedSlug}`);
        await logger.fail(
          `Duplikat (fingerprint): /${fingerprintHit.matchedSlug}`,
          'duplicate-fingerprint',
        );
        console.timeEnd('⏱️  STEP 4.5: Fingerprint Gate');
        return null;
      }
      console.log('   ✅ Fingerprint ist neu');
      logger.addMetadata('storyFingerprint', fingerprintBundle.fingerprint);
    }
    console.timeEnd('⏱️  STEP 4.5: Fingerprint Gate');

    // ========== STEP 4.6: DACH LOCALIZATION CONTEXT ==========
    // Phase B Feb 2026: TMDB /watch/providers (region=DE) liefert konkrete
    // DACH-Streamer für die Serie. Fallback: Network-Mapping. Wenn beides
    // leer: explizit "Deutsche Ausstrahlung steht aus".
    // Damit hat Claude im Content-Generation-Prompt einen DACH-Anker und
    // schreibt nicht über CBS/NBC/ABC, sondern über Disney+/Paramount+/Sky.
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4.6: DACH LOCALIZATION CONTEXT 🇩🇪');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 4.6: DACH Localization');
    let dachContext: { dachStreamers: string[]; dachExpectation: string | null; originalNetworks: string[] } = {
      dachStreamers: [],
      dachExpectation: null,
      originalNetworks: Array.isArray((dbSeries as any).networks) ? (dbSeries as any).networks : [],
    };
    try {
      if (dbSeries.tmdbId) {
        const { getTVWatchProviders, getProviderDisplayName } = await import('../lib/tmdb-watch-providers');
        const providers = await getTVWatchProviders(dbSeries.tmdbId);
        const flatrate = (providers?.flatrate || []).map(p => getProviderDisplayName(p.provider_name));
        const free = (providers?.free || []).map(p => getProviderDisplayName(p.provider_name));
        const ads = (providers?.ads || []).map(p => getProviderDisplayName(p.provider_name));
        // Priorität: flatrate vor free vor ads. Dedupe + max 4.
        const uniq = Array.from(new Set([...flatrate, ...free, ...ads])).slice(0, 4);
        dachContext.dachStreamers = uniq;
      }
      if (dachContext.dachStreamers.length === 0) {
        const { mapNetworksToDach } = await import('../lib/dach-network-mapping');
        const expectation = mapNetworksToDach(dachContext.originalNetworks);
        if (expectation) {
          dachContext.dachExpectation = expectation.hedge;
        }
      }
      console.log(`   🇩🇪 DACH-Streamer: ${dachContext.dachStreamers.length > 0 ? dachContext.dachStreamers.join(', ') : '(keine in TMDB)'}`);
      if (dachContext.dachExpectation) console.log(`   🔮 DACH-Erwartung: ${dachContext.dachExpectation}`);
      if (dachContext.originalNetworks.length > 0) console.log(`   📺 Original-Networks: ${dachContext.originalNetworks.join(', ')}`);
      logger.addMetadata('dachContext', dachContext);
    } catch (e: any) {
      console.log(`   ⚠️ DACH-Localization fehlgeschlagen: ${e.message} — Generator bekommt nur Original-Networks`);
    }
    console.timeEnd('⏱️  STEP 4.6: DACH Localization');

    logStep('5_content_generation');
    // ========== STEP 5: STRUCTURED CONTENT GENERATION (ONE CALL!) ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5: STRUCTURED CONTENT GENERATION ⚡');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 5: Content Generation');
    
    // ── Re-assess True-Story certainty mit TMDB-Genres (genauer als nur Source) ──
    if (isTrueStoryUrl) {
      const seriesGenresForCert = (dbSeries as any).genres as string[] | null | undefined;
      trueStoryCertainty = (await import('../lib/true-story-format')).assessTrueStoryCertainty(
        source.title,
        fullSourceText,
        seriesGenresForCert,
      );
      logger.addMetadata('trueStoryCertaintyFinal', trueStoryCertainty);
    }

    // -------- FAITHFUL TRANSLATION (Path A) --------
    // For NEWS-type content with enough source text we attempt a faithful
    // 1:1 translation that preserves the original journalist's sentence
    // rhythm, paragraph structure and (most importantly) direct quotes.
    // Falls back transparently to the rebuilt-from-facts path below on any
    // failure (short source, JSON parse, too-short output, LLM error).
    let structuredContent: any = null;
    // Faithful Translator deactivated by default — it copied source-text
    // aggregator boilerplate (Collider/TVInsider quizzes, AI-summary widgets,
    // watch-cards, "You are a..." quiz answers) 1:1 into the German body,
    // triggering Helpful-Content / Discover penalties. Pipeline now falls back
    // to the legacy Rebuild-from-Facts generator which uses the full source
    // text as CONTEXT only and writes an independent DE article.
    // Re-enable via env `ENABLE_FAITHFUL=true` once the boilerplate filter in
    // lib/full-text-fetcher.ts is hardened.
    const FAITHFUL_OK_CONTENT_TYPES: string[] =
      process.env.ENABLE_FAITHFUL === 'true' ? ['NEWS'] : [];
    const sourceLen = (fullSourceText || '').trim().length;
    const faithfulCandidate = FAITHFUL_OK_CONTENT_TYPES.includes(contentType) && sourceLen >= 600;

    if (faithfulCandidate) {
      try {
        console.log(`🌐 Attempting Faithful Translation (source: ${sourceLen}c, type: ${contentType})`);
        // Fetch TMDB-based fact-grounding (no visible block, only used by the
        // LLM to detect hallucinations in the source text).
        const grounding = await fetchNotebookFacts(dbSeries.tmdbId);
        const t = await translateFaithful({
          sourceText: fullSourceText,
          sourceHeadline: source.title,
          sourceUrl: source.url,
          seriesName: dbSeries.name || dbSeries.title,
          dach: {
            streamersDE: grounding?.streamersDE?.length
              ? grounding.streamersDE
              : (dachContext?.dachStreamers || []).map((s: any) => s.name || s).filter(Boolean),
            seriesNameDE: dbSeries.name || dbSeries.title,
            todayIso: new Date().toISOString().slice(0, 10),
            seriesStatusDE: grounding?.status || null,
            lastEpisodeDate: grounding?.lastAirDate || null,
            nextEpisodeDate: grounding?.nextEpisodeDate || null,
            numberOfSeasons: grounding?.numberOfSeasons || null,
          },
        });

        if (t.wordCount >= 250) {
          // Map FaithfulArticle → structuredContent shape so the rest of the
          // pipeline (sanitizer, USD-converter, etc.) keeps working unchanged.
          const paragraphs = t.contentHtml
            .split(/(?=<h2|<\/h2>)/i)
            .map((s) => s.trim())
            .filter(Boolean);
          // Faithful output keeps H2 inline; convert to one-section-per-H2
          // layout matching the legacy generator. If no H2 → single section.
          const sections: Array<{ heading: string; paragraphs: string[] }> = [];
          let currentHeading = '';
          let currentParas: string[] = [];
          // Match <p>, <p class="...">, <h2>, <h2 class="...">  etc.
          const pBlocks = t.contentHtml.match(/<(p|h2)\b[^>]*>[\s\S]*?<\/\1>/gi) || [];
          for (const block of pBlocks) {
            if (/^<h2\b/i.test(block)) {
              if (currentParas.length > 0 || currentHeading) {
                sections.push({ heading: currentHeading, paragraphs: currentParas });
              }
              currentHeading = block.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i, '$1').trim();
              currentParas = [];
            } else {
              const text = block.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/i, '$1').trim();
              if (text) currentParas.push(text);
            }
          }
          if (currentParas.length > 0 || currentHeading) {
            sections.push({ heading: currentHeading, paragraphs: currentParas });
          }
          if (sections.length === 0) {
            sections.push({ heading: '', paragraphs: [t.leadParagraph] });
          }

          // Build the markdown body the downstream Step 7 expects.
          // We re-emit our HTML as markdown so markdownToHtml() can rebuild
          // it with all the standard pipeline tooling (anchor links, etc).
          const markdownLines: string[] = [];
          for (const sec of sections) {
            if (sec.heading) markdownLines.push(`\n## ${sec.heading}\n`);
            for (const para of sec.paragraphs) {
              // Convert any inline <a href> back to markdown so footer links
              // survive Step 7's markdown→HTML round-trip.
              const md = para.replace(
                /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
                '[$2]($1)'
              );
              markdownLines.push(`${md}\n`);
            }
          }
          const faithfulMarkdown = markdownLines.join('\n').trim();

          structuredContent = {
            headline: t.headline,
            metaDescription: t.metaDescription,
            lead: t.leadParagraph,
            markdown: faithfulMarkdown,
            sections,
            qa: [], // post-processing STEP 10 generates Q&A separately
            _usedFaithful: true,
          };
          logger.addMetadata('generator', 'faithful');
          logger.addMetadata('faithfulWordCount', t.wordCount);
          logger.addMetadata('faithfulQuotesPreserved', t.quotesPreserved);
          console.log(`✅ Faithful: ${t.wordCount}w, ${t.paragraphCount}p, ${t.quotesPreserved} quotes preserved`);
        } else {
          console.log(`⚠️  Faithful output too short (${t.wordCount} < 250w) — falling back`);
        }
      } catch (e: any) {
        console.log(`⚠️  Faithful translation failed: ${e.message} — falling back to rebuilt generator`);
      }
    } else {
      console.log(`⊘ Skipping Faithful (type=${contentType}, sourceLen=${sourceLen}c)`);
    }

    // -------- REBUILT-FROM-FACTS (Path B, legacy + non-NEWS types) --------
    if (!structuredContent) {
      structuredContent = await generateStructuredContent({
      facts,
      seriesName: dbSeries.name || dbSeries.title,
      originalHeadline: source.title,
      sourceText: fullSourceText,
      sourceUrl: source.url,
      contentType,
      dachContext,
      trueStoryCertainty: contentType === 'TRUE_STORY' ? trueStoryCertainty : undefined,
      // GOOGLE DISCOVER Qualität - Minimum 1500 Wörter
      wordCountTarget: contentType === 'RANKING' 
        ? Math.max(1500, Math.min(sourceWordCount * 1.5, 2500)) 
        : contentType === 'ENDING_EXPLAINED'
          ? Math.max(700, Math.min(sourceWordCount * 1.2, 1100))
          : contentType === 'TRUE_STORY'
            ? Math.max(600, Math.min(sourceWordCount * 1.2, 1000))
            : Math.max(1500, Math.min(sourceWordCount * 1.5, 2000)),
      });
      logger.addMetadata('generator', structuredContent._usedFaithful ? 'faithful' : 'rebuilt');
    }
    
    console.log(`✅ Generated:`);
    console.log(`   Headline: "${structuredContent.headline}"`);
    console.log(`   Sections: ${structuredContent.sections.length} with H2s`);
    console.log(`   Q&A: ${structuredContent.qa.length} pairs`);
    logger.log(`Headline: ${structuredContent.headline}`);
    console.timeEnd('⏱️  STEP 5: Content Generation');

    // ========== STEP 5.05: US-PACKAGING SANITIZER ==========
    // Defensive Schicht: säubert generierten Content von US-Sender-Mentions,
    // Nielsen-Zahlen, Primetime-Slang, Wochentag-Slot-Angaben — selbst wenn
    // Claude trotz Prompt-Hardening US-Verpackung übernommen hat.
    // Bei ≥2 Treffern im Lead → Warning loggen (Indiz für schwache Generation).
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5.05: US-PACKAGING SANITIZER 🇺🇸→🇩🇪');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 5.05: Sanitizer');
    try {
      const { sanitizeArticle } = await import('../lib/us-packaging-sanitizer');
      // Build joined body from sections (sections are { heading, paragraphs[] }).
      const bodyJoined = (structuredContent.sections || [])
        .map((s: any) => `<h2>${s.heading || ''}</h2>${(s.paragraphs || []).map((p: string) => `<p>${p}</p>`).join('')}`)
        .join('');
      const result = sanitizeArticle({
        headline: structuredContent.headline,
        metaDescription: structuredContent.metaDescription,
        lead: structuredContent.lead,
        bodyHtml: bodyJoined,
      });

      if (result.report.total > 0) {
        console.log(`   🧹 Entfernt: ${result.report.total} US-Phrasen total`);
        console.log(`      Sender=${result.report.removedNetworkMentions} Nielsen=${result.report.removedNielsen} Primetime=${result.report.removedPrimetime} Wochentag=${result.report.removedWeekdaySlots}`);
        console.log(`      Lead-Treffer: ${result.leadHits}`);
        if (result.leadHits >= 2) {
          console.log(`   ⚠️  HOHER LEAD-HIT-COUNT (${result.leadHits}) — Content-Prompt sollte schärfer formulieren.`);
          logger.log(`Sanitizer: ${result.leadHits} US-Hits im Lead — Generation-Quality-Warning`);
        }
        // Apply cleaned values back. Lead/Headline werden direkt übernommen,
        // Body wird via Section-Re-Splitting NICHT zurückgeschrieben (zu fragil
        // mit Section-Struktur) — wir säubern nur Headline/Lead/Meta hart, der
        // Body wurde Fließtext-säubernd inplace verändert via sections (s.u.).
        structuredContent.headline = result.clean.headline;
        if (result.clean.metaDescription) structuredContent.metaDescription = result.clean.metaDescription;
        if (result.clean.lead) structuredContent.lead = result.clean.lead;

        // Säuberung der einzelnen Section-Paragraphs (separat, damit die
        // Section-Struktur erhalten bleibt).
        const { sanitizeUsPackaging } = await import('../lib/us-packaging-sanitizer');
        for (const sec of structuredContent.sections || []) {
          if (sec.heading) sec.heading = sanitizeUsPackaging(sec.heading).clean;
          if (Array.isArray(sec.paragraphs)) {
            sec.paragraphs = sec.paragraphs.map((p: string) => sanitizeUsPackaging(p).clean);
          }
        }
        // Q&A auch säubern
        for (const qa of structuredContent.qa || []) {
          if (qa.question) qa.question = sanitizeUsPackaging(qa.question).clean;
          if (qa.answer) qa.answer = sanitizeUsPackaging(qa.answer).clean;
        }
        logger.addMetadata('sanitizerReport', result.report);
      } else {
        console.log(`   ✓ Saubere Generation (keine US-Phrasen erkannt)`);
      }
    } catch (e: any) {
      console.log(`   ⚠️  Sanitizer-Fehler: ${e.message} — Content geht ungesäubert weiter`);
    }
    console.timeEnd('⏱️  STEP 5.05: Sanitizer');

    // ========== STEP 5.06: USD → EUR CONVERTER ==========
    // Defensive Schicht: alle Dollar-Beträge im generierten Content werden
    // deterministisch in Euro umgerechnet (Wechselkurs ≈ 0,92, nice-rounding).
    // Greift auch wenn Claude die Prompt-Regel ignoriert. Idempotent.
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5.06: USD → EUR CONVERTER 💵→💶');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 5.06: USD-to-EUR');
    try {
      const { convertUsdMentions } = await import('../lib/usd-to-eur-converter');
      let totalConv = 0;
      const headRes = convertUsdMentions(structuredContent.headline);
      structuredContent.headline = headRes.clean;
      totalConv += headRes.report.conversions;
      if (structuredContent.metaDescription) {
        const r = convertUsdMentions(structuredContent.metaDescription);
        structuredContent.metaDescription = r.clean;
        totalConv += r.report.conversions;
      }
      if (structuredContent.lead) {
        const r = convertUsdMentions(structuredContent.lead);
        structuredContent.lead = r.clean;
        totalConv += r.report.conversions;
      }
      for (const sec of structuredContent.sections || []) {
        if (sec.heading) {
          const r = convertUsdMentions(sec.heading);
          sec.heading = r.clean;
          totalConv += r.report.conversions;
        }
        if (Array.isArray(sec.paragraphs)) {
          sec.paragraphs = sec.paragraphs.map((p: string) => {
            const r = convertUsdMentions(p);
            totalConv += r.report.conversions;
            return r.clean;
          });
        }
      }
      for (const qa of structuredContent.qa || []) {
        if (qa.question) {
          const r = convertUsdMentions(qa.question);
          qa.question = r.clean;
          totalConv += r.report.conversions;
        }
        if (qa.answer) {
          const r = convertUsdMentions(qa.answer);
          qa.answer = r.clean;
          totalConv += r.report.conversions;
        }
      }
      if (totalConv > 0) {
        console.log(`   💶 ${totalConv} Dollar-Mention(s) → Euro umgerechnet`);
        logger.addMetadata('usdEurConversions', totalConv);
      } else {
        console.log(`   ✓ Keine Dollar-Beträge im Content`);
      }
    } catch (e: any) {
      console.log(`   ⚠️  USD-Converter-Fehler: ${e.message}`);
    }
    console.timeEnd('⏱️  STEP 5.06: USD-to-EUR');

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
      // Anti-AI Filter (async — must be awaited; otherwise score remains undefined → null in DB)
      const antiAiResult = await antiAiFilter({
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

    // Plagiarism / near-duplicate gate (TF-Cosine over 14-day published corpus).
    // Catches re-writes of our own old articles that `duplicate-llm` would miss
    // (LLM judges by event semantics; this gate catches lexical overlap that
    // Google would treat as self-cannibalization regardless of intent).
    try {
      const { findSimilarArticles } = await import('../lib/article-similarity');
      const similar = await findSimilarArticles(structuredContent.markdown || '', {
        windowDays: 14,
        topK: 3,
        minTokens: 80,
      });
      const top = similar[0];
      if (top && top.similarity >= 0.75) {
        logger.log(`Plagiat-Gate: ${(top.similarity * 100).toFixed(0)}% Ähnlichkeit zu /${top.slug}`, 'warn');
        logger.addMetadata('plagiarismCheck', {
          similarity: top.similarity,
          matchSlug: top.slug,
          matchTitle: top.title,
          others: similar.slice(1, 3).map((s) => ({ slug: s.slug, sim: s.similarity })),
        });
        await logger.fail(
          `Plagiat-Verdacht: ${(top.similarity * 100).toFixed(0)}% Ähnlichkeit zu /${top.slug}`,
          'plagiarism-similar-article',
        );
        return null;
      }
      if (top) {
        logger.log(`Plagiat-Gate: max ${(top.similarity * 100).toFixed(0)}% Ähnlichkeit (OK, unter Schwellenwert 75%)`);
      }
    } catch (error: any) {
      console.log(`⚠️  Plagiat-Check skipped: ${error.message}`);
    }
    // US-only streaming gate (deterministic). Headline + US provider + DACH
    // mention only as side-note → block. Catches the "Das Boot streamt in
    // den USA bei MHz Choice" class of articles that pass the LLM-based
    // german-angle filter via a perfunctory "in Deutschland bei Netflix
    // verfügbar" side-note.
    try {
      const { checkUsOnlyStreaming } = await import('../lib/us-only-streaming-filter');
      const usCheck = checkUsOnlyStreaming({
        headline: structuredContent.headline || '',
        body: structuredContent.markdown || '',
        sourceTitle: source.title || '',
      });
      if (usCheck.blocked) {
        logger.addMetadata('usOnlyCheck', usCheck.signals);
        await logger.fail(usCheck.reason, 'us-streaming-only');
        return null;
      }
    } catch (error: any) {
      console.log(`⚠️  US-only-streaming check skipped: ${error.message}`);
    }
    console.timeEnd('⏱️  STEP 5.1: Quality Gates');

    // ========== STEP 5.2: AUTO-RETRY BEI NIEDRIGER QUALITÄT ==========
    logStep('5.2_auto_retry');
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 5.2: AUTO-RETRY CHECK');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 5.2: Auto-Retry');

    try {
      // Quick Discover-Score auf dem Markdown berechnen
      const tempHtml = markdownToHtml(structuredContent.markdown || '');
      const preScore = await discoverGate({
        final_headline: structuredContent.headline || '',
        article_html: tempHtml,
        hero_image_metadata: { url: '', width: 1920, height: 1080, source: 'TMDB_BACKDROP' as const },
        publishedAt: new Date(),
        primary_series: dbSeries.name || dbSeries.title || '',
      });

      const firstScore = preScore.scores.total;
      console.log(`   📊 Erster Discover Score: ${firstScore}/100`);

      if (firstScore < 60) {
        console.log(`   ⚠️ Score unter 60 → Retry mit Temperature 0.5`);
        logger.log(`Auto-Retry: Score ${firstScore}/100 < 60`);

        const retryContent = await generateStructuredContent({
          facts,
          seriesName: dbSeries.name || dbSeries.title,
          originalHeadline: source.title,
          sourceText: fullSourceText,
          sourceUrl: source.url,
          contentType,
          trueStoryCertainty: contentType === 'TRUE_STORY' ? trueStoryCertainty : undefined,
          wordCountTarget: contentType === 'RANKING'
            ? Math.max(1500, Math.min(sourceWordCount * 1.5, 2500))
            : contentType === 'TRUE_STORY'
              ? Math.max(600, Math.min(sourceWordCount * 1.2, 1000))
              : Math.max(1500, Math.min(sourceWordCount * 1.5, 2000)),
          temperature: 0.5,
        });

        const retryHtml = markdownToHtml(retryContent.markdown || '');
        const retryScore = await discoverGate({
          final_headline: retryContent.headline || '',
          article_html: retryHtml,
          hero_image_metadata: { url: '', width: 1920, height: 1080, source: 'TMDB_BACKDROP' as const },
          publishedAt: new Date(),
          primary_series: dbSeries.name || dbSeries.title || '',
        });

        const secondScore = retryScore.scores.total;
        console.log(`   📊 Retry Discover Score: ${secondScore}/100`);

        if (secondScore > firstScore) {
          console.log(`   ✅ Retry besser (${secondScore} > ${firstScore}) → übernommen`);
          structuredContent.headline = retryContent.headline;
          structuredContent.metaDescription = retryContent.metaDescription;
          structuredContent.lead = retryContent.lead;
          structuredContent.sections = retryContent.sections;
          structuredContent.qa = retryContent.qa;
          structuredContent.markdown = retryContent.markdown;
          logger.log(`Auto-Retry erfolgreich: ${firstScore} → ${secondScore}`);
        } else {
          console.log(`   ℹ️ Original besser (${firstScore} >= ${secondScore}) → beibehalten`);
          logger.log(`Auto-Retry: Original behalten (${firstScore} >= ${secondScore})`);
        }
      } else {
        console.log(`   ✅ Score OK (${firstScore}/100) → kein Retry nötig`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ Auto-Retry Check übersprungen: ${error.message}`);
    }
    console.timeEnd('⏱️  STEP 5.2: Auto-Retry');

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
    
    // Import cast BEFORE linking (must exist in DB for linkCastInMarkdown)
    console.time('⏱️  STEP 6a2: Import Cast');
    await importSeriesCast(dbSeries.tmdbId, dbSeries.tmdbId);
    console.timeEnd('⏱️  STEP 6a2: Import Cast');
    
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
    
    let contentHtml = markdownToHtml(structuredContent.markdown || '');

    // STEP 7.0a: inject one primary social embed (Instagram > Twitter > YouTube-Lite)
    // discovered in the source article. Placed after the first H2/<p> section
    // so the embed acts as visual evidence for the news event. The frontend's
    // existing Instagram/Twitter loaders + the YouTube Lite-Facade handle the
    // actual rendering. Only one embed per article to keep CWV/Discover lean.
    contentHtml = injectSourceEmbeds(contentHtml, {
      instagramPermalinks: sourceInstagramPermalinks,
      twitterStatusUrls: sourceTwitterStatusUrls,
      youtubeVideoIds: sourceYoutubeVideoIds,
    });
    
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
      primarySeriesSlug: dbSeries.slug || dbSeries.tmdbId?.toString() || '',
      publishedAt: null,
    });
    
    const finalContentHtml = internalLinksResult.updatedContentHtml;
    
    // ========== STEP 7.6: YOUTUBE EMBED (OBSOLETE) ==========
    // Disabled 2026-05-25: this step injected an auto-loading <iframe> for
    // the source YouTube video, which (a) duplicated the embed already
    // placed by STEP 7.0a `injectSourceEmbeds()` as a Lite-Facade, and
    // (b) violated the "no auto-loading iframes" rule. The Lite-Facade
    // in STEP 7.0a is now the single source of truth for YouTube embeds.
    const finalContentWithVideo = finalContentHtml;
    
    console.log(`✅ Internal Links injected:`);
    console.log(`   Hub Link: ${internalLinksResult.hubLink ? 'Yes' : 'No'}`);
    console.log(`   Related Articles: ${internalLinksResult.relatedArticles.length}`);
    console.log(`   Total Links: ${internalLinksResult.totalInternalLinks}`);
    
    // Validate links
    const linkValidation = validateInternalLinks(finalContentWithVideo, dbSeries.name || dbSeries.title || '');
    if (!linkValidation.valid) {
      console.log(`\n⚠️  Link Validation Warnings:`);
      linkValidation.errors.forEach(err => console.log(`   - ${err}`));
    }
    console.timeEnd('⏱️  STEP 7.5: Internal Linking');

    // ========== STEP 7.6: HEADLINE ENGINE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 7.6: HEADLINE ENGINE');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 7.6: Headline Engine');
    
    let finalHeadline = structuredContent.headline; // Fallback: Arbeits-Headline vom Content-LLM
    let headlineVariants: any[] = [];
    let headlineTop3: any[] = [];

    // ENDING_EXPLAINED: Headline-Format ist heilig ("Das Ende von X erklärt: …").
    // Headline-Engine + Rewrite-Loop würden das Präfix zerstören → komplett überspringen.
    // TRUE_STORY: gleicher Mechanismus für die zwei Pflicht-Patterns (siehe lib/true-story-format).
    if (contentType === 'ENDING_EXPLAINED' || contentType === 'TRUE_STORY') {
      console.log(`   📐 ${contentType}: Headline-Engine + Rewrite-Loop übersprungen (Pflicht-Format bleibt)`);
      logger.log(`Headline-Engine/Rewrite: skipped for ${contentType}`);
    } else {
    try {
      const { generateHeadlines } = await import('../lib/headline-engine');
      
      const headlineResult = await generateHeadlines({
        originalHeadline: source.title || '',
        articleContent: structuredContent.markdown,
        seriesName: dbSeries.name || dbSeries.title || '',
        entities: {
          persons: facts?.people_names || [],
          events: facts?.key_statements?.slice(0, 3) || [],
          keywords: [
            ...(facts?.series_names || []),
            ...(facts?.networks_platforms || []),
          ],
        },
        explorationMode: true, // Exploration ON by default
        preserveOriginalStyle: (source.url || '').includes('thecinemaholic.com'),
        contentClassification: classification.content_type,
      });
      
      if (headlineResult.winner && headlineResult.winner.score > 0) {
        finalHeadline = headlineResult.winner.text;
        headlineVariants = headlineResult.allVariants;
        headlineTop3 = headlineResult.top3;
        console.log(`   ✅ Headline Engine: "${finalHeadline}" (Score: ${headlineResult.winner.score})`);
        console.log(`   ⏱️  ${headlineResult.generationTime}ms für ${headlineResult.allVariants.length} Varianten`);
        console.log(`   🏆 Top 3: ${headlineResult.top3.map(v => `"${v.text}" (${v.score})`).join(' | ')}`);
        logger.log(`Headline Engine: "${finalHeadline}" (${headlineResult.winner.score}/100, ${headlineResult.winner.type})`);
      } else {
        console.log(`   ⚠️ Headline Engine: Keine gute Variante, nutze Arbeits-Headline`);
        logger.log(`Headline Engine: Fallback auf Content-Headline`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ Headline Engine fehlgeschlagen: ${error.message}`);
      console.log(`   → Nutze Arbeits-Headline: "${finalHeadline}"`);
      logger.log(`Headline Engine Error: ${error.message}`);
    }
    
    console.timeEnd('⏱️  STEP 7.6: Headline Engine');

    // ========== STEP 7.61: STREAMER-CLAIM VERIFIER ==========
    // Sanity-check before we ship: if the headline says "…auf Netflix" but
    // TMDB doesn't list Netflix as a DE provider for this series, we strip
    // the streamer from the headline. Prevents Handmaid's-Tale-style
    // mismatches where the US source's premise doesn't hold for DACH
    // readers. See lib/streamer-claim-verifier.ts for the heuristic.
    try {
      const { verifyHeadlineClaim } = await import('../lib/streamer-claim-verifier');
      const watchProviders = (dbSeries.watchProviders as any) || {};
      const deFlat = watchProviders?.results?.DE?.flatrate
        ?? watchProviders?.DE?.flatrate
        ?? [];
      const deProviderNames: string[] = Array.isArray(deFlat)
        ? deFlat.map((p: any) => p?.provider_name).filter(Boolean)
        : [];
      const verdict = verifyHeadlineClaim(finalHeadline, deProviderNames);
      if (verdict.kind === 'unverified') {
        console.log(`   🚦 Streamer-Claim UNVERIFIED: "${verdict.claimedStreamer}" claimed, DE-Providers laut TMDB: [${verdict.actualDeProviders.join(', ')}]`);
        console.log(`   → Rewrite: "${finalHeadline}"`);
        console.log(`        →    "${verdict.rewrittenHeadline}"`);
        logger.log(`Streamer-Claim REJECTED — claimed=${verdict.claimedStreamer}, actual=[${verdict.actualDeProviders.join(',')}], rewritten=${verdict.rewrittenHeadline}`);
        finalHeadline = verdict.rewrittenHeadline;
      } else if (verdict.kind === 'verified') {
        console.log(`   ✅ Streamer-Claim verified: "${verdict.streamer}" stimmt mit DE-Providers überein`);
        logger.log(`Streamer-Claim OK — ${verdict.streamer}`);
      } else if (verdict.kind === 'unknown') {
        // TMDB has no DE-Provider data yet — don't strip, could be a fresh release.
        // The body-prompt-guard catches the inverse case (LLM hallucinating "not in DE").
        console.log(`   ⚠️ Streamer-Claim UNKNOWN: "${verdict.claimedStreamer}" — TMDB hat keine DE-Daten. Headline bleibt.`);
        logger.log(`Streamer-Claim UNKNOWN — ${verdict.claimedStreamer} (TMDB data missing)`);
      } else {
        // no-claim — nothing to do
      }
    } catch (err: any) {
      console.log(`   ⚠️ Streamer-Claim-Verifier-Fehler: ${err.message}`);
      logger.log(`Streamer-Claim-Verifier-Error: ${err.message}`);
    }

    // ========== STEP 7.65: HEADLINE REWRITE LOOP ==========
    // Turn Performance-scorer from gatekeeper into coach: if headline
    // underperforms, ask Claude to fix the specific failed checks.
    //
    // Phase-A Stop-Loss (Feb 2026): gated via HEADLINE_REWRITE_LOOP=true.
    // Default AUS. Begründung: der Loop konvergiert gegen Warum/Darum-
    // Monokultur (100% der letzten 25 Headlines). 7-Tage-Test mit rohen
    // Source-Headlines + GSC-CTR-Messung, bevor wieder aktiviert.
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 7.65: HEADLINE REWRITE LOOP 🎯');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 7.65: Rewrite Loop');
    let rewriteOutcome: any = null;
    if (process.env.HEADLINE_REWRITE_LOOP !== 'true') {
      console.log('   ⏭️  SKIPPED — HEADLINE_REWRITE_LOOP != "true" (Phase-A Stop-Loss)');
      console.timeEnd('⏱️  STEP 7.65: Rewrite Loop');
    } else {
    try {
      // Cheap probe: score CURRENT headline for performance only
      const { discoverGate } = await import('../lib/discover-gate');
      const { rewriteHeadlineIfWeak } = await import('../lib/headline-rewrite-loop');

      const probe = await discoverGate({
        final_headline: finalHeadline,
        article_html: structuredContent.markdown,
        hero_image_metadata: { url: '', width: 1920, height: 1080, source: 'TMDB_BACKDROP' as const },
        publishedAt: new Date(),
        primary_series: dbSeries.name || dbSeries.title || '',
      });

      const perfScore = probe.dashboard.headline_performance.score;
      const perfReasons = probe.dashboard.headline_performance.reasons;
      const hygScore = probe.dashboard.headline.score;
      const hygReasons = probe.dashboard.headline.reasons;
      console.log(`   Score vorher: Hygiene ${hygScore}/30 + Performance ${perfScore}/30 = ${hygScore + perfScore}/60`);

      const rewrite = await rewriteHeadlineIfWeak({
        originalHeadline: finalHeadline,
        seriesName: dbSeries.name || dbSeries.title || '',
        articleContent: structuredContent.markdown,
        beforeScore: perfScore,
        beforeReasons: perfReasons,
        beforeHygieneScore: hygScore,
        beforeHygieneReasons: hygReasons,
        beforePerformanceScore: perfScore,
        beforePerformanceReasons: perfReasons,
      });

      if (rewrite.attempted) {
        const iters = rewrite.iterations?.length || 0;
        console.log(`   🔄 Rewrite versucht (${iters} Iteration${iters === 1 ? '' : 'en'}, ${rewrite.durationMs}ms)`);
        if (rewrite.applied) {
          console.log(`   ✅ Verbesserung: ${rewrite.beforeCombined ?? rewrite.beforePerformance} → ${rewrite.afterCombined ?? rewrite.afterPerformance} (+${rewrite.gain}P)`);
          console.log(`   📝 Alt:  "${rewrite.originalHeadline}"`);
          console.log(`   📝 Neu:  "${rewrite.finalHeadline}"`);
          finalHeadline = rewrite.finalHeadline;
          logger.log(`Rewrite: ${rewrite.beforeCombined ?? rewrite.beforePerformance}→${rewrite.afterCombined ?? rewrite.afterPerformance}P, new headline: "${rewrite.finalHeadline}"`);
        } else {
          console.log(`   ⚠️ Keine Verbesserung möglich, behalte Original`);
          if (rewrite.errorMessage) console.log(`   Error: ${rewrite.errorMessage}`);
          logger.log(`Rewrite no-op (${rewrite.errorMessage || 'no gain'})`);
        }
        rewriteOutcome = {
          attempted: rewrite.attempted,
          applied: rewrite.applied,
          beforePerformance: rewrite.beforePerformance,
          afterPerformance: rewrite.afterPerformance,
          beforeHygiene: rewrite.beforeHygiene,
          afterHygiene: rewrite.afterHygiene,
          beforeCombined: rewrite.beforeCombined,
          afterCombined: rewrite.afterCombined,
          gain: rewrite.gain,
          originalHeadline: rewrite.originalHeadline,
          finalHeadline: rewrite.finalHeadline,
          candidates: rewrite.candidates,
          iterations: rewrite.iterations,
          durationMs: rewrite.durationMs,
        };
        logger.addMetadata('headlineRewrite', rewriteOutcome);
      } else {
        console.log(`   ✅ Headline bereits stark (${hygScore + perfScore}/60) — kein Rewrite nötig`);
      }
    } catch (rewriteErr: any) {
      console.log(`   ⚠️ Rewrite-Loop-Fehler: ${rewriteErr.message}`);
      logger.log(`Rewrite error: ${rewriteErr.message}`);
    }
    console.timeEnd('⏱️  STEP 7.65: Rewrite Loop');
    } // end: else (HEADLINE_REWRITE_LOOP enabled)
    } // end: if (contentType !== 'ENDING_EXPLAINED')

    // ══════════════════════════════════════════════════════════════════════
    // STEP 7.66: NEWS-VALUE + METAPHOR + US-CONTEXT CHECK (v5.6 + Phase B)
    //   - Metapher-Verben (stirbt/explodiert/bricht ein/zerstört/eskaliert):
    //     BLEIBT Hard-Reject — Clickbait-Schutz.
    //   - US-Kontext (Phase B Feb 2026): Headlines mit US-Quoten-Talk
    //     (Nielsen, X Mio US-Zuschauer, Sweeps, Upfronts) ODER mit US-/UK-
    //     Sender (CBS/NBC/ABC/FOX/CW/BBC One/Hulu/HBO/AMC) ohne paralleles
    //     DACH-Streamer-Mention werden als "us-context-only" verworfen —
    //     sie bringen DACH-Discover null Lift und kosten E-E-A-T.
    //   - News-Value (Event/Development/Messbares):
    //     SOFT-SCORE statt Hard-Reject. Bleibt im Discover-Gate (10 Pkt).
    //   - ENDING_EXPLAINED bleibt ausgenommen.
    // ══════════════════════════════════════════════════════════════════════
    if (contentType !== 'ENDING_EXPLAINED') {
      const { hasNewsValue, containsBannedMetaphor } = await import('../lib/discover-gate');
      const { checkHeadlineUsContext } = await import('../lib/dach-network-mapping');

      if (containsBannedMetaphor(finalHeadline)) {
        console.log(`   ⛔ BANNED-METAPHOR-REJECT: "${finalHeadline}"`);
        console.log(`      Headline enthält gesperrtes Metapher-Verb (stirbt/explodiert/bricht ein/zerstört/eskaliert).`);
        await logger.fail(
          `Headline enthält gesperrtes Metapher-Verb: "${finalHeadline}"`,
          'headline-banned-metaphor',
        );
        return null;
      }

      const usCheck = checkHeadlineUsContext(finalHeadline);
      if (!usCheck.ok) {
        console.log(`   ⛔ US-CONTEXT-ONLY-REJECT: "${finalHeadline}"`);
        console.log(`      Grund: ${usCheck.reason} (Treffer: "${usCheck.hit}")`);
        await logger.fail(
          `Headline mit US-Kontext ohne DACH-Anker: "${finalHeadline}" — ${usCheck.reason}`,
          'us-context-only',
        );
        return null;
      }

      // Soft-Log statt Reject: News-Value wird weiterhin im Discover-Gate
      // scored (10 Pkt), aber blockiert die Publikation nicht mehr.
      if (!hasNewsValue(finalHeadline)) {
        console.log(`   ⚠️  NEWS-VALUE soft-fail: "${finalHeadline}" — publiziert trotzdem, Score wird im Discover-Gate gedrückt.`);
        logger.log(`News-Value soft-fail for "${finalHeadline}"`);
      }
    }

    // ========== STEP 7.7: INTRO ENGINE ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 7.7: INTRO ENGINE');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 7.7: Intro Engine');

    let finalIntro = structuredContent.lead; // Fallback
    let introVariants: any[] = [];

    try {
      const { generateIntroVariants } = await import('../lib/intro-engine');

      const factsText = facts?.key_statements?.slice(0, 5).join('. ') || '';
      const introResult = await generateIntroVariants({
        headline: finalHeadline,
        headlineType: headlineTop3[0]?.type,
        seriesName: dbSeries.name || dbSeries.title || '',
        facts: factsText,
        articleContent: structuredContent.markdown?.substring(0, 800),
      });

      if (introResult.winner && introResult.winner.score >= 50 && introResult.winner.text) {
        finalIntro = introResult.winner.text;
        introVariants = introResult.allVariants;
        console.log(`   ✅ Intro Engine: Score ${introResult.winner.score}, Type: ${introResult.winner.type}`);
        logger.log(`Intro Engine: "${finalIntro.substring(0, 60)}..." (${introResult.winner.score}/100, ${introResult.winner.type})`);
      } else {
        console.log(`   ⚠️ Intro Engine: Kein gutes Intro, nutze Content-Lead`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ Intro Engine fehlgeschlagen: ${error.message}`);
    }

    console.timeEnd('⏱️  STEP 7.7: Intro Engine');

    // Strip any leftover markdown emphasis from the excerpt — it is rendered
    // as plain text in the article header and so cannot contain raw `**`.
    if (typeof finalIntro === 'string') {
      finalIntro = finalIntro
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    }

    logStep('8_publish');
    // ========== STEP 8: PUBLISH ==========
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 8: PUBLISH');
    console.log('━'.repeat(70));
    console.time('⏱️  STEP 8: Publish');
    
    const slug = generateSlug(finalHeadline);
    // articleId already generated in Step 7.5
    
    // ✅ BACKDROP COOLDOWN (7 Tage pro Bild — keine Wiederholung kurz hintereinander)
    // 1. Lade alle in den letzten 7 Tagen verwendeten Hero-Bilder (serie + global)
    // 2. Filtere topBackdrops auf "nicht kürzlich genutzt"
    // 3. Bei Exhaustion (alle im Cooldown) → nimm den am längsten nicht genutzten
    let selectedBackdrop = dbSeries.backdropPath;
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const recentArticles = await prisma.articles.findMany({
        where: {
          primarySeriesId: dbSeries.tmdbId,
          publishedAt: { gte: sevenDaysAgo },
          heroImageUrl: { not: null },
        },
        select: { heroImageUrl: true, publishedAt: true },
        orderBy: { publishedAt: 'desc' },
      });
      // Extract backdrop paths from recent hero URLs (e.g. /p/original/abc123.jpg → abc123.jpg)
      const recentPaths = new Set<string>();
      for (const a of recentArticles) {
        const m = (a.heroImageUrl || '').match(/\/(?:original|w\d+)(\/[^?]+)$/);
        if (m) recentPaths.add(m[1]);
      }

      const topBackdrops = await fetchTopBackdrops('tv', dbSeries.tmdbId, 50);
      if (topBackdrops.length > 0) {
        const available = topBackdrops.filter((b) => b?.path && !recentPaths.has(b.path));
        if (available.length > 0) {
          // Deterministic pick from unused pool: most popular untouched first
          selectedBackdrop = available[0].path;
          console.log(`🖼️  Backdrop: ${available.length}/${topBackdrops.length} verfügbar (${recentPaths.size} im 7d-Cooldown) → Pfad ${selectedBackdrop}`);
        } else {
          // Exhaustion → fall back to least-recently-used. Last article's image is least desirable.
          const lruPath = [...recentPaths][recentPaths.size - 1]; // oldest of the recent set
          const inGallery = topBackdrops.find((b) => b?.path === lruPath);
          selectedBackdrop = (inGallery?.path) || topBackdrops[0]?.path || dbSeries.backdropPath;
          console.log(`⚠️  Alle ${topBackdrops.length} Backdrops im 7d-Cooldown — nehme ältesten (${selectedBackdrop})`);
        }
      }
    } catch (e) {
      console.log('   ⚠️ Backdrop-Rotation fehlgeschlagen, nutze Standard:', (e as Error).message);
    }
    
    // Determine final status based on confidence
    const finalStatus = saveAsDraft ? 'draft' : 'published';
    const finalPublishedAt = saveAsDraft ? null : now;
    
    // ══════════════════════════════════════════════════════════════════════
    // HERO IMAGE RESOLUTION
    //   1) TMDB backdrop   → best case, use as-is
    //   2) Nano Banana AI  → deterministic cinematic 16:9, cached in Blob
    //                         per (tmdbId, category). Skipped if LLM key missing.
    //   3) Composite hero  → branded 1920×1080 with headline + series backdrop/poster
    //                         blurred behind. Used for articles where we don't have
    //                         a clean backdrop (new shows, movies, creator stories).
    //                         Stored in Vercel Blob with deterministic URL.
    //   4) Streamer logo   → last resort static Netflix/Prime/etc. logo (rare).
    // ══════════════════════════════════════════════════════════════════════
    let heroImageUrl: string;
    if (selectedBackdrop) {
      heroImageUrl = `https://image.tmdb.org/t/p/original${selectedBackdrop}`;
    } else {
      const networks = dbSeries.networks || facts?.networks_platforms || [];
      const category = duplicateResult?.topicCategory
        ? duplicateResult.topicCategory.charAt(0) + duplicateResult.topicCategory.slice(1).toLowerCase() + '-News'
        : 'News';

      // Tier 2: Nano Banana AI (Gemini) — cached per (tmdbId|nameHash, category).
      let nanoUrl: string | null = null;
      try {
        const seriesName = dbSeries.name || dbSeries.title || '';
        if (!seriesName) {
          console.log(`   ⚠️ Nano Banana skip: kein Series-Name (dbSeries.name + .title leer)`);
        } else {
          console.log(`   🎨 Nano Banana versucht: tmdbId=${dbSeries.tmdbId || 'null'} name="${seriesName}" slot=${category}`);
          const { generateNanoBananaHero } = await import('../lib/nano-banana-hero');
          nanoUrl = await generateNanoBananaHero({
            tmdbId: dbSeries.tmdbId,
            seriesName,
            slot: category,
            category,
            networks,
          });
        }
      } catch (e: any) {
        console.log(`   ⚠️ Nano Banana hero failed: ${e?.message ?? e}`);
      }

      if (nanoUrl) {
        heroImageUrl = nanoUrl;
        console.log(`   🎨 Nano Banana hero generated: ${heroImageUrl}`);
        logger.addMetadata('heroSource', 'nano-banana');
      } else {
        // Tier 3: Sharp composite.
        const { composeAndStoreArticleHero } = await import('../lib/compose-article-hero');
        const composed = await composeAndStoreArticleHero(articleId, {
          headline: finalHeadline,
          seriesName: dbSeries.name || dbSeries.title || '',
          backdropPath: dbSeries.backdropPath || null,
          posterPath: (dbSeries as any).posterPath || null,
          network: networks[0] || null,
          category,
        });
        heroImageUrl = composed || getStreamerFallbackImage(networks);
        if (composed) {
          console.log(`   🎨 Composite hero generated: ${heroImageUrl}`);
          logger.addMetadata('heroSource', 'composite');
        } else {
          console.log(`   🖼️  Fallback streamer-logo hero used`);
          logger.addMetadata('heroSource', 'streamer-fallback');
        }
      }
    }

    try {
      await prisma.articles.create({
        data: {
          id: articleId,
          title: finalHeadline,
          slug,
          contentHtml: finalContentWithVideo,
          excerpt: finalIntro,
          metaDescription: structuredContent.metaDescription,
          heroImageUrl,
          tmdbId: dbSeries.tmdbId,
          primarySeriesId: dbSeries.tmdbId,
          tmdbType: 'tv',
          authorId: getRandomAuthor(),
          status: finalStatus,
          publishedAt: finalPublishedAt,
          createdAt: now,
          updatedAt: now,
          sourceUrl: source.url,
          // Draft reason logged in debugLog, not stored in metadata
          confidence: saveAsDraft ? (searchResult?.confidence || 0) : null,
          // Duplicate-prevention fingerprints
          coreEventNormalized: coreEventNormalizedValue || null,
          storyFingerprint: storyFingerprintValue,
        },
      });
    } catch (err: any) {
      // Race condition: parallel cron runs can hit the same URL after the
      // upfront dedupe check. Catch the unique-constraint violation gracefully.
      const msg = err?.message || String(err);
      const isUniqueConstraint =
        err?.code === 'P2002' ||
        /Unique constraint failed/i.test(msg) ||
        /sourceUrl/.test(msg);
      if (isUniqueConstraint) {
        console.log(`⛔ Unique-Constraint hit at publish (race) — URL already exists, skipping`);
        logger.log(`URL-Duplikat (race): ${source.url}`);
        await logger.fail(`URL-Duplikat (race condition bei paralleler Pipeline)`, 'url-duplicate-race');
        console.timeEnd('⏱️  STEP 8: Publish');
        return null;
      }
      throw err;
    }

    // Store headline variants with full v4 data
    if (headlineVariants.length > 0) {
      try {
        await prisma.articles.update({
          where: { id: articleId },
          data: {
            metadata: {
              headlineEngine: {
                version: 4,
                explorationMode: true,
                selectionMethod: 'weighted_random',
                selectedRank: headlineTop3.findIndex(v => v.selected) + 1 || 1,
              },
              headlineTop3: headlineTop3.map(v => ({
                text: v.text,
                type: v.type,
                score: v.score,
                riskScore: v.breakdown?.riskScore || 0,
                outlierBoost: v.breakdown?.outlierBoost || 0,
                contrastBoost: v.breakdown?.contrastBoost || 0,
                ctrPrediction: v.breakdown?.ctrPrediction || 0,
                selected: v.selected || false,
                wasOutlier: v.meta?.wasOutlier || false,
                hadContrast: v.meta?.hadContrast || false,
                hadGenericPenalty: v.meta?.hadGenericPenalty || false,
                impressions: 0,
                clicks: 0,
                ctr: 0,
              })),
              headlineVariants: headlineVariants.map(v => ({
                text: v.text,
                type: v.type,
                score: v.score,
                riskScore: v.breakdown?.riskScore || 0,
                outlierBoost: v.breakdown?.outlierBoost || 0,
                contrastBoost: v.breakdown?.contrastBoost || 0,
                ctrPrediction: v.breakdown?.ctrPrediction || 0,
                selected: v.selected || false,
                wasOutlier: v.meta?.wasOutlier || false,
                hadContrast: v.meta?.hadContrast || false,
                hadGenericPenalty: v.meta?.hadGenericPenalty || false,
                impressions: 0,
                clicks: 0,
                ctr: 0,
              })),
              // Intro variants
              introVariants: introVariants.map((v: any) => ({
                type: v.type,
                text: v.text,
                score: v.score,
                selected: v.selected || false,
              })),
            } as any,
          },
        });
      } catch (e) {
        // metadata field might not accept JSON — variants logged in console
      }
    }
    
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

    // Invalidate cache for the new article so it's immediately visible with links
    try {
      const { revalidatePath, revalidateTag } = await import('next/cache');
      revalidatePath(`/${slug}`);
      revalidateTag(`article-${slug}`);
      revalidateTag('article');
      console.log('🔄 Cache invalidated for:', slug);
    } catch {
      // revalidatePath only works in Next.js server context, not in standalone scripts
      console.log('ℹ️  Cache revalidation skipped (not in server context)');
    }

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
      
      // Cast already imported in Step 6a2
      (async () => {
        console.log(`   ✅ Cast already imported in Step 6`);
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
          const wasBedeutetDasText = await generateWasBedeutetDas({
            headline: finalHeadline,
            articleHtml: finalContentWithVideo,
            seriesName: dbSeries.name || dbSeries.title || '',
            contentType: contentType || 'SINGLE_SERIES_NEWS',
            extractedFacts: JSON.stringify(facts).substring(0, 500),
          });
          
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

      // Generate "Darum ist das relevant" section
      (async () => {
        try {
          const darumRelevantText = await generateDarumRelevant({
            articleHtml: finalContentWithVideo,
            headline: finalHeadline,
            seriesName: dbSeries.name || dbSeries.title || '',
            extractedFacts: JSON.stringify(facts).substring(0, 500),
          });
          
          if (darumRelevantText) {
            await prisma.articles.update({
              where: { id: articleId },
              data: { darumRelevantText }
            });
            console.log(`   ✅ "Darum ist das relevant" generated`);
          }
        } catch (error: any) {
          console.log(`   ⚠️  "Darum relevant" generation failed: ${error.message}`);
        }
      })(),

      // Generate "Bisheriger Stand zur Serie" section
      (async () => {
        try {
          const bisherigerStandText = await generateBisherigerStand({
            seriesName: dbSeries.name || dbSeries.title || '',
            seriesOverview: dbSeries.overview || null,
            seriesStatus: dbSeries.status || null,
            seriesSeasons: dbSeries.seasons || null,
            headline: finalHeadline,
            extractedFacts: JSON.stringify(facts).substring(0, 500),
          });
          
          if (bisherigerStandText) {
            await prisma.articles.update({
              where: { id: articleId },
              data: { bisherigerStandText }
            });
            console.log(`   ✅ "Bisheriger Stand" generated`);
          }
        } catch (error: any) {
          console.log(`   ⚠️  "Bisheriger Stand" generation failed: ${error.message}`);
        }
      })(),
      
      // Discover Gate - Score berechnen und speichern
      (async () => {
        try {
          // v5.7 BODY FACT-VERIFIER:
          // Before computing the Discover-Score, scan the body for streamer
          // mentions and verify each against TMDB's DE provider list. If we
          // find a hallucinated availability claim (e.g. body says "läuft auf
          // Netflix" but TMDB DE doesn't list Netflix), the article must NOT
          // go into Discover — that's the Handmaid's-Tale failure mode.
          let bodyFactsOk = true;
          let bodyFactReason = '';
          try {
            const { verifyBodyClaims } = await import('../lib/streamer-claim-verifier');
            const watchProvidersForBody = (dbSeries.watchProviders as any) || {};
            const deProvidersForBody: string[] = (
              watchProvidersForBody?.results?.DE?.flatrate
              ?? watchProvidersForBody?.DE?.flatrate
              ?? []
            )
              .map((p: any) => p?.provider_name)
              .filter(Boolean);
            const bv = verifyBodyClaims(finalContentWithVideo || '', deProvidersForBody);
            if (!bv.ok) {
              bodyFactsOk = false;
              // Log hallucinations for the admin Watch widget so editors can
              // spot patterns (which source URLs systematically mislead).
              const sourceHost = (() => {
                try { return source.url ? new URL(source.url).host : null; } catch { return null; }
              })();
              if (bv.negativeDeClaimMismatch) {
                bodyFactReason = `body claims "nicht in DE / US-only" but TMDB lists [${bv.negativeDeClaimMismatch.actualDeProviders.join(', ')}]`;
                console.log(`   🚨 Body-Fact-Verifier: NEGATIVE-DE-Halluzination`);
                console.log(`      excerpt: "${bv.negativeDeClaimMismatch.excerpt.slice(0, 160)}…"`);
                console.log(`      actual DE-providers: [${bv.negativeDeClaimMismatch.actualDeProviders.join(', ')}]`);
                try {
                  await prisma.hallucination_log.create({
                    data: {
                      articleId: articleId,
                      articleSlug: structuredContent.headline ? null : null,
                      articleTitle: finalHeadline,
                      sourceUrl: source.url || null,
                      sourceHost,
                      kind: 'negative_de_claim',
                      actualDeProviders: bv.negativeDeClaimMismatch.actualDeProviders,
                      excerpt: bv.negativeDeClaimMismatch.excerpt.slice(0, 500),
                    },
                  });
                } catch { /* logging is best-effort */ }
              } else if (bv.unverifiedClaims.length > 0) {
                const first = bv.unverifiedClaims[0];
                bodyFactReason = `body claims "${first.streamer}" but DE-providers=[${first.actualDeProviders.join(', ')}]`;
                console.log(`   🚨 Body-Fact-Verifier: ${bv.unverifiedClaims.length} hallucinated streamer claim(s)`);
                bv.unverifiedClaims.slice(0, 3).forEach(c =>
                  console.log(`      ❌ "${c.streamer}" claim → DE actual: [${c.actualDeProviders.join(', ')}] | "${c.excerpt.slice(0, 100)}…"`),
                );
                try {
                  for (const claim of bv.unverifiedClaims.slice(0, 3)) {
                    await prisma.hallucination_log.create({
                      data: {
                        articleId: articleId,
                        articleTitle: finalHeadline,
                        sourceUrl: source.url || null,
                        sourceHost,
                        kind: 'positive_claim',
                        claimedStreamer: claim.streamer,
                        actualDeProviders: claim.actualDeProviders,
                        excerpt: claim.excerpt.slice(0, 500),
                      },
                    });
                  }
                } catch { /* best-effort */ }
              }
            } else if (bv.totalClaims > 0) {
              console.log(`   ✅ Body-Fact-Verifier: ${bv.verifiedClaims}/${bv.totalClaims} streamer claims verified`);
            }
          } catch (e: any) {
            console.log(`   ⚠️ Body-Fact-Verifier-Fehler (non-fatal): ${e.message}`);
          }

          const gateResult = await discoverGate({
            final_headline: finalHeadline,
            article_html: finalContentWithVideo || '',
            hero_image_metadata: {
              url: selectedBackdrop ? `https://image.tmdb.org/t/p/original${selectedBackdrop}` : '',
              width: 1920,
              height: 1080,
              source: 'TMDB_BACKDROP' as const
            },
            publishedAt: new Date(),
            primary_series: dbSeries.name || dbSeries.title || '',
            // Source-Reputation Greylist: hosts with ≥3 hallucinations in
            // the last 7 days lose -10 trust points. Self-tuning feedback
            // loop on top of the hallucination_log writes above.
            source_reputation_penalty: await (async () => {
              try {
                const host = (() => {
                  try { return source.url ? new URL(source.url).host : null; } catch { return null; }
                })();
                if (!host) return 0;
                // Whitelist: premium trade outlets are exempt from the
                // self-tuning greylist, even if a temporary hallucination
                // cluster appears in the 7-day window.
                const { isSourceHostWhitelisted } = await import('../lib/source-policy');
                if (isSourceHostWhitelisted(host)) return 0;
                const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
                const halluciCount = await prisma.hallucination_log.count({
                  where: { sourceHost: host, createdAt: { gte: since } },
                });
                if (halluciCount >= 3) {
                  console.log(`   🚨 Source-Greylist: "${host}" hat ${halluciCount} Halluzinationen in 7T → −10 Punkte Trust`);
                  return 10;
                }
                return 0;
              } catch { return 0; }
            })(),
          });

          // v5.7 Per-Series-Quote: Avoid Discover-feed spam if 5 sources
          // covered the same news item. Max 3 DISCOVER articles per series
          // in a rolling 24h window. Further articles still publish — they
          // just go straight to SEARCH_ONLY.
          let seriesQuotaReached = false;
          if (dbSeries.tmdbId) {
            const recentSeriesDiscoverCount = await prisma.articles.count({
              where: {
                primarySeriesId: dbSeries.tmdbId,
                publishMode: 'DISCOVER',
                publishedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
                id: { not: articleId },
              },
            });
            if (recentSeriesDiscoverCount >= 3) {
              seriesQuotaReached = true;
              console.log(`   📊 Per-Series-Quote erreicht: ${recentSeriesDiscoverCount} DISCOVER-Artikel zu "${dbSeries.name}" in den letzten 24h → SEARCH_ONLY`);
            }
          }
          
          // Save to discover_score_dashboards
          await prisma.discover_score_dashboards.create({
            data: {
              id: crypto.randomUUID(),
              articleId: articleId,
              timestamp: new Date(),
              finalVerdict: (gateResult.discover_eligible && bodyFactsOk && !seriesQuotaReached) ? 'DISCOVER_OK' : 'SEARCH_ONLY',
              discoverScore: gateResult.scores.total,
              // Nest performance inside headlineMetrics to avoid schema migration
              headlineMetrics: {
                ...(gateResult.dashboard.headline as any),
                performance: gateResult.dashboard.headline_performance,
              } as any,
              freshnessMetrics: gateResult.dashboard.freshness as any,
              contentMetrics: gateResult.dashboard.content_opening as any,
              imageMetrics: gateResult.dashboard.image_visual as any,
              trustMetrics: gateResult.dashboard.trust_clarity as any,
            }
          });
          
          // Update article publishMode based on score — with special handling
          // for multi-series exceptions:
          //   AWARD        → forced SEARCH_ONLY (listicle-like, too diffuse for Discover)
          //   DEATH/PLATFORM → normal Discover-Gate (single clear event, news-worthy)
          const forceSearchOnly = multiSeriesException?.trigger === 'AWARD' || !bodyFactsOk || seriesQuotaReached;
          const publishMode = forceSearchOnly
            ? 'SEARCH_ONLY'
            : gateResult.discover_eligible
              ? 'DISCOVER'
              : 'SEARCH_ONLY';
          await prisma.articles.update({
            where: { id: articleId },
            data: { publishMode }
          });

          if (!bodyFactsOk) {
            console.log(`   🚨 Body-Fact-Verifier FAIL → publishMode=SEARCH_ONLY erzwungen (${bodyFactReason})`);
            logger.log(`Body-Fact-Verifier FAIL — ${bodyFactReason}`);
          } else if (seriesQuotaReached) {
            console.log(`   📊 Per-Series-Quote-Limit → publishMode=SEARCH_ONLY erzwungen`);
          } else if (forceSearchOnly) {
            console.log(`   🔒 AWARD-Multi-Series → publishMode=SEARCH_ONLY erzwungen (Score: ${gateResult.scores.total}/130, Phrase: "${multiSeriesException.matchedPhrase}")`);
          } else if (multiSeriesException) {
            console.log(`   ✅ Discover Gate (${multiSeriesException.trigger}-Multi): ${gateResult.scores.total}/130 → ${publishMode}`);
          } else {
            console.log(`   ✅ Discover Gate: ${gateResult.scores.total}/130 → ${publishMode}`);
          }
        } catch (error: any) {
          console.log(`   ⚠️  Discover Gate failed: ${error.message}`);
        }
      })(),
      
      // Google Indexing API - Sofortige Indexierung bei Google
      (async () => {
        if (!saveAsDraft) {
          try {
            await indexNewArticle(slug, articleId);
          } catch (error: any) {
            console.log(`   ⚠️  Google Indexing failed: ${error.message}`);
          }
        }
      })(),
      // IndexNow - Sofortige Benachrichtigung an Bing, Yandex etc.
      (async () => {
        if (!saveAsDraft) {
          try {
            await indexNowArticle(slug);
          } catch (error: any) {
            console.log(`   ⚠️  IndexNow failed: ${error.message}`);
          }
        }
      })(),
      // Facebook Auto-Posting auf Page (nur wenn Toggle aktiv)
      (async () => {
        if (!saveAsDraft) {
          try {
            const enabled = await getBoolSetting(SETTINGS.FACEBOOK_AUTOPOST_ENABLED, false);
            if (enabled) {
              await postArticleToFacebook(slug, 'auto');
            }
          } catch (error: any) {
            console.log(`   ⚠️  Facebook Auto-Post failed: ${error.message}`);
          }
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
