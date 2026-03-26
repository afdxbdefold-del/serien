/**
 * P4-YT PIPELINE
 * 
 * YouTube-Kanal-basierte Artikel-Generierung
 * 
 * Features:
 * - Folgt YouTube-Kanälen (Netflix, Prime, Disney+ etc.)
 * - Erkennt neue Videos automatisch via RSS Feed
 * - Generiert Artikel basierend auf Video-Titel & Beschreibung
 * - Bettet YouTube-Video direkt im Artikel ein
 * - Verknüpft mit TMDB-Serien wenn möglich
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { generateStructuredContent } from '../lib/structured-content-generator';
import { linkCharactersInMarkdown, linkStreamersInMarkdown } from '../lib/character-linking-markdown';
import { linkCastInMarkdown } from '../lib/cast-linking-markdown';
import { markdownToHtml } from '../lib/markdown-to-html';
import { generateSeriesSlug } from '../lib/slug-utils';
import { extractFacts } from '../lib/fact-extractor';
import { antiAiFilter } from '../lib/anti-ai-filter';
import { qualityCheck } from '../lib/quality-checker';
import { factSafetyCheck } from '../lib/fact-safety-layer';
import { generateInternalLinks, validateInternalLinks } from '../lib/internal-linking-engine';
import { downloadYouTubeTrailer } from '../lib/trailer-downloader';
import { PipelineLogger } from '../lib/pipeline-logger';
import { importSeriesCharacters } from './import-characters';
import { importSeriesCast } from '../lib/cast-importer';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════════════════════
// PREDEFINED CHANNELS TO FOLLOW
// ══════════════════════════════════════════════════════════════════════════
const DEFAULT_CHANNELS = [
  {
    channelId: 'UCZqgRlLcvO3Fnx_npQJygcQ', // Netflix Deutschland, Österreich und Schweiz
    name: 'Netflix DACH',
    url: 'https://www.youtube.com/@Netflixdach',
  },
  {
    channelId: 'UCWOA1ZGywLbqmigxE4Qlvuw', // Netflix (Global)
    name: 'Netflix',
    url: 'https://www.youtube.com/@Netflix',
  },
  {
    channelId: 'UCNJwYVhTNX23AULBnfwnc9A', // Prime Video DE
    name: 'Prime Video DE',
    url: 'https://www.youtube.com/@PrimeVideoDE',
  },
  {
    channelId: 'UCOJJq47ie4y0HC5hH4JSQ6w', // Disney+ Deutschland
    name: 'Disney+ DE',
    url: 'https://www.youtube.com/@DisneyPlusDE',
  },
  {
    channelId: 'UCx-KWLTKlB83hDI6UKECtJQ', // Max (Stream On Max)
    name: 'Max',
    url: 'https://www.youtube.com/@StreamOnMax',
  },
  {
    channelId: 'UC1Myj674wRVXB9I4c6Hm5zA', // Apple TV
    name: 'Apple TV',
    url: 'https://www.youtube.com/@AppleTV',
  },
];

// ══════════════════════════════════════════════════════════════════════════
// AUTHOR ROTATION
// ══════════════════════════════════════════════════════════════════════════
const EDITORIAL_AUTHORS = [
  'author_001', 'author_003', 'author_004', 'author_005',
  'author_006', 'author_007', 'author_008', 'author_009',
  'author_010', 'author_011', 'author_012', 'author-julia'
];

function getRandomAuthor(): string {
  return EDITORIAL_AUTHORS[Math.floor(Math.random() * EDITORIAL_AUTHORS.length)];
}

// ══════════════════════════════════════════════════════════════════════════
// SLUG GENERATOR
// ══════════════════════════════════════════════════════════════════════════
function generateSlug(title: string): string {
  if (!title) return 'untitled';
  return title
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

// ══════════════════════════════════════════════════════════════════════════
// SERIES NEWS FILTER - NUR echte Trailer/Teaser/Ankündigungen
// ══════════════════════════════════════════════════════════════════════════
function isSeriesNews(title: string, description: string): { valid: boolean; reason: string } {
  const titleLower = title.toLowerCase();
  
  // ✅ WHITELIST: Nur diese Muster sind erlaubt (NUR echte Trailer/Teaser)
  
  // Pattern 1: "Name | Trailer | Netflix" oder "Name | Teaser | Streamer"
  const trailerPattern = /\|\s*(offiziell(er|e)?|official)?\s*(trailer|teaser)/i;
  
  // Pattern 2: "Name | Ankündigung | Netflix" (aber NUR mit "Staffel" oder "Season")
  const announcementPattern = /\|\s*(offizielle?|official)?\s*(ankündigung|announcement)/i;
  const hasSeasonInTitle = /(staffel|season)\s*\d/i.test(title);
  
  // Pattern 3: "Name: Staffel X | Trailer/Teaser" (Staffel NUR mit Trailer/Teaser)
  const seasonWithTrailerPattern = /(staffel|season)\s*\d.*\|\s*(offiziell)?\s*(trailer|teaser|ankündigung)/i;
  
  // Pattern 4: "Name | Sneak Peek | ..."
  const sneakPeekPattern = /\|\s*sneak\s*peek/i;
  
  // Pattern 5: "Name — Official Teaser/Trailer"
  const dashPattern = /—\s*(official\s*)?(trailer|teaser)/i;
  
  // ❌ ENTFERNT: "Jetzt streamen" und "Neu & exklusiv" - diese können alte Serien sein!
  // Pattern 6 und 7 wurden absichtlich entfernt weil sie Halluzinationen verursachen
  
  // Prüfe ob MINDESTENS ein Whitelist-Pattern matched
  const isTrailer = trailerPattern.test(title);
  const isAnnouncement = announcementPattern.test(title) && hasSeasonInTitle; // Ankündigung NUR mit Staffel!
  const isSeasonTrailer = seasonWithTrailerPattern.test(title);
  const isSneakPeek = sneakPeekPattern.test(title);
  const isDashFormat = dashPattern.test(title);
  
  const isValid = isTrailer || isAnnouncement || isSeasonTrailer || isSneakPeek || isDashFormat;
  
  if (!isValid) {
    return { valid: false, reason: 'Kein Trailer/Teaser-Format (nur echte Trailer erlaubt)' };
  }
  
  // ❌ BLACKLIST: Trotzdem ausschließen
  const excludePatterns = [
    /podcast/i,
    /episode\s*\d+\s*preview/i,
    /live\s*(stream|event|concert|on\s*netflix)/i,
    /behind the scenes|making of/i,
    /best of|compilation|recap|zusammenfassung/i,
    /interview|q&a/i,
    /bloopers|gag reel|outtakes/i,
    /community\s*(post|video)/i,
    /soundtrack|ost|lyric|music\s*video/i,
    /krassesten|lustigsten|besten\s+momente/i,  // "Die krassesten Lacher"
    /anniversary|jubiläum/i,  // Jubiläums-Specials
  ];
  
  for (const pattern of excludePatterns) {
    if (pattern.test(titleLower)) {
      return { valid: false, reason: `Blacklist: ${pattern.toString()}` };
    }
  }
  
  // ❌ Filme ausschließen
  if (/\b(der film|the movie|kinofilm|im kino)\b/i.test(titleLower)) {
    return { valid: false, reason: 'Film, keine Serie' };
  }
  
  return { valid: true, reason: 'Serien-Trailer/Ankündigung' };
}

// ══════════════════════════════════════════════════════════════════════════
// YOUTUBE RSS FEED FETCHER
// ══════════════════════════════════════════════════════════════════════════
interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: Date;
  channelId: string;
  channelName: string;
}

async function fetchChannelVideos(channelId: string): Promise<YouTubeVideo[]> {
  const videos: YouTubeVideo[] = [];
  
  try {
    // YouTube RSS Feed - no API key needed!
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      console.log(`   ⚠️ RSS Feed nicht verfügbar: ${response.status}`);
      return videos;
    }
    
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    // Get channel name from feed
    const channelName = $('feed > title').text() || 'Unknown Channel';
    
    $('entry').each((i, el) => {
      if (i >= 15) return; // Max 15 videos per channel
      
      const videoId = $(el).find('yt\\:videoId, videoId').text();
      const title = $(el).find('title').text();
      const published = $(el).find('published').text();
      const description = $(el).find('media\\:description, description').text() || '';
      
      // Get thumbnail (try different qualities)
      const thumbnailUrl = $(el).find('media\\:thumbnail').attr('url') ||
                          `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      
      if (videoId && title) {
        videos.push({
          videoId,
          title,
          description: (description || '').substring(0, 2000), // Limit description length
          thumbnailUrl,
          publishedAt: new Date(published),
          channelId,
          channelName,
        });
      }
    });
    
    console.log(`   ✓ ${videos.length} Videos von ${channelName}`);
    
  } catch (error) {
    console.error(`   ❌ Fehler beim Laden des Feeds:`, error instanceof Error ? error.message : error);
  }
  
  return videos;
}

// ══════════════════════════════════════════════════════════════════════════
// INITIALIZE CHANNELS IN DATABASE
// ══════════════════════════════════════════════════════════════════════════
export async function initializeChannels(): Promise<void> {
  console.log('\n📺 Initialisiere YouTube-Kanäle...');
  
  for (const channel of DEFAULT_CHANNELS) {
    const existing = await prisma.youtube_channels.findUnique({
      where: { channelId: channel.channelId }
    });
    
    if (!existing) {
      await prisma.youtube_channels.create({
        data: {
          channelId: channel.channelId,
          name: channel.name,
          url: channel.url,
          isActive: true,
        }
      });
      console.log(`   ✓ Kanal hinzugefügt: ${channel.name}`);
    } else {
      console.log(`   ℹ️ Kanal existiert: ${channel.name}`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// CHECK FOR NEW VIDEOS
// ══════════════════════════════════════════════════════════════════════════
export async function checkForNewVideos(): Promise<YouTubeVideo[]> {
  console.log('\n🔍 Prüfe auf neue Videos...');
  
  const newVideos: YouTubeVideo[] = [];
  
  // Get all active channels
  const channels = await prisma.youtube_channels.findMany({
    where: { isActive: true }
  });
  
  if (channels.length === 0) {
    console.log('   ⚠️ Keine aktiven Kanäle gefunden. Initialisiere...');
    await initializeChannels();
    return checkForNewVideos();
  }
  
  for (const channel of channels) {
    console.log(`\n📡 Prüfe: ${channel.name}`);
    
    const videos = await fetchChannelVideos(channel.channelId);
    
    for (const video of videos) {
      // Check if video already exists
      const existing = await prisma.youtube_videos.findUnique({
        where: { videoId: video.videoId }
      });
      
      if (!existing) {
        // Filter: Nur Serien-News
        const filterResult = isSeriesNews(video.title, video.description);
        
        if (!filterResult.valid) {
          console.log(`   ⏭️ Übersprungen: ${(video.title || '').substring(0, 40)}... (${filterResult.reason})`);
          continue;
        }
        
        // New video! Save to database
        await prisma.youtube_videos.create({
          data: {
            videoId: video.videoId,
            channelId: video.channelId,
            title: video.title,
            description: video.description,
            thumbnailUrl: video.thumbnailUrl,
            publishedAt: video.publishedAt,
            processed: false,
          }
        });
        
        newVideos.push(video);
        console.log(`   🆕 Serien-News: ${(video.title || '').substring(0, 50)}...`);
      }
    }
    
    // Update last checked timestamp
    await prisma.youtube_channels.update({
      where: { channelId: channel.channelId },
      data: { lastCheckedAt: new Date() }
    });
  }
  
  console.log(`\n📊 ${newVideos.length} neue Videos gefunden`);
  return newVideos;
}

// ══════════════════════════════════════════════════════════════════════════
// EXTRACT SERIES NAME FROM VIDEO TITLE
// ══════════════════════════════════════════════════════════════════════════
function extractSeriesFromTitle(title: string): string | null {
  // Common patterns in trailer/announcement titles:
  // "Squid Game: Staffel 2 | Offizieller Trailer | Netflix"
  // "Wednesday Staffel 2 | Teaser | Netflix"
  // "ADOLESCENCE | Offizieller Trailer | Netflix"
  // "Scrubs - Neu & exklusiv auf Disney+"
  
  // Remove common suffixes
  let cleaned = title
    // Remove platform announcements
    .replace(/\s*[-–]\s*(Neu\s*(&|und)\s*)?(exklusiv\s*)?(auf|bei)\s*(Disney\+?|Netflix|Prime Video|Amazon|Apple TV\+?|WOW|RTL\+?|Paramount\+?|Joyn).*$/i, '')
    .replace(/\s*[-–]\s*jetzt\s*(auf|bei|streamen).*$/i, '')
    .replace(/\s*[-–]\s*ab\s*(sofort|jetzt).*$/i, '')
    // Remove trailer/teaser suffixes
    .replace(/\s*\|\s*(Offizieller\s*)?(Trailer|Teaser|Ankündigung|Clip|Sneak Peek).*$/i, '')
    .replace(/\s*-\s*(Offizieller\s*)?(Trailer|Teaser|Ankündigung).*$/i, '')
    // Remove season info
    .replace(/\s*:\s*Staffel\s*\d+.*$/i, '')
    .replace(/\s+Staffel\s*\d+.*$/i, '')
    // Remove parentheses
    .replace(/\s*\(.*?\)\s*$/g, '')
    .trim();
  
  // If still too long, take first part before | or :
  if (cleaned.length > 50) {
    const parts = cleaned.split(/[|:]/);
    cleaned = parts[0].trim();
  }
  
  return cleaned.length > 2 ? cleaned : null;
}

// ══════════════════════════════════════════════════════════════════════════
// SEARCH TMDB FOR SERIES
// ══════════════════════════════════════════════════════════════════════════
async function findTmdbSeries(seriesName: string): Promise<{
  tmdbId: number;
  name: string;
  backdropPath: string | null;
  posterPath: string | null;
  overview: string;
  status: string;
  firstAirDate: string | null;
} | null> {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return null;
    
    const url = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(seriesName)}&language=de-DE`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const series = data.results[0];
      
      // Get detailed info for status
      let status = 'Unknown';
      try {
        const detailUrl = `https://api.themoviedb.org/3/tv/${series.id}?api_key=${apiKey}&language=de-DE`;
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json();
        status = detailData.status || 'Unknown';
      } catch {}
      
      return {
        tmdbId: series.id,
        name: series.name,
        backdropPath: series.backdrop_path,
        posterPath: series.poster_path,
        overview: series.overview || '',
        status,
        firstAirDate: series.first_air_date || null,
      };
    }
  } catch (error) {
    console.log(`   ⚠️ TMDB Suche fehlgeschlagen: ${error instanceof Error ? error.message : ''}`);
  }
  
  return null;
}

// ══════════════════════════════════════════════════════════════════════════
// GENERATE ARTICLE FROM YOUTUBE VIDEO
// ══════════════════════════════════════════════════════════════════════════
export interface YTArticleResult {
  success: boolean;
  articleId?: string;
  slug?: string;
  title?: string;
  videoId: string;
  error?: string;
}

export async function generateArticleFromVideo(
  video: YouTubeVideo, 
  trigger: 'cron' | 'manual' | 'api' = 'manual'
): Promise<YTArticleResult> {
  // Initialize logger
  const logger = new PipelineLogger('p4-youtube', trigger);
  await logger.start({
    inputVideoId: video.videoId,
    inputQuery: video.title,
    inputSource: video.channelName,
  });

  console.log('\n' + '═'.repeat(70));
  console.log('🎬 P4-YT: ARTIKEL AUS VIDEO GENERIEREN');
  console.log('═'.repeat(70));
  console.log(`📺 Video: "${video.title}"`);
  console.log(`🆔 Video-ID: ${video.videoId}`);
  console.log(`📡 Kanal: ${video.channelName}\n`);
  
  logger.log(`Video: ${video.title}`);
  logger.log(`Kanal: ${video.channelName}`);
  logger.addMetadata('videoId', video.videoId);
  logger.addMetadata('channelName', video.channelName);
  
  const now = new Date();
  
  try {
    // ========== STEP 1: EXTRACT SERIES NAME ==========
    console.log('━'.repeat(60));
    console.log('STEP 1: SERIE EXTRAHIEREN');
    console.log('━'.repeat(60));
    
    const seriesName = extractSeriesFromTitle(video.title);
    console.log(`   📺 Extrahierter Serienname: ${seriesName || '(nicht erkannt)'}`);
    logger.log(`Serie extrahiert: ${seriesName || 'nicht erkannt'}`);
    logger.addMetadata('seriesName', seriesName);
    
    // ========== STEP 2: FIND TMDB SERIES ==========
    let tmdbData: { tmdbId: number; name: string; backdropPath: string | null; posterPath?: string | null; overview?: string; status?: string; firstAirDate?: string } | null = null;
    let dbSeries: any = null;
    
    if (seriesName) {
      console.log('\n━'.repeat(60));
      console.log('STEP 2: TMDB SUCHE & SERIE ERSTELLEN');
      console.log('━'.repeat(60));
      
      tmdbData = await findTmdbSeries(seriesName);
      
      if (tmdbData) {
        console.log(`   ✓ TMDB: ${tmdbData.name} (ID: ${tmdbData.tmdbId})`);
        
        // Check if series exists in DB
        dbSeries = await prisma.series.findUnique({
          where: { tmdbId: tmdbData.tmdbId }
        });
        
        if (!dbSeries) {
          // Create series - same as p3-trends
          console.log('   📺 Erstelle neue Serie...');
          try {
            dbSeries = await prisma.series.create({
              data: {
                tmdbId: tmdbData.tmdbId,
                name: tmdbData.name,
                title: tmdbData.name,
                slug: generateSeriesSlug(tmdbData.name, tmdbData.tmdbId),
                posterPath: tmdbData.posterPath || null,
                backdropPath: tmdbData.backdropPath || null,
                overview: tmdbData.overview || '',
                status: tmdbData.status || 'Unknown',
                firstAirDate: tmdbData.firstAirDate ? new Date(tmdbData.firstAirDate) : null,
                updatedAt: now,
              }
            });
            console.log(`   ✓ Serie erstellt: ${dbSeries.name}`);
            
            // Import characters and cast in parallel - same as p3-trends
            try {
              await Promise.all([
                importSeriesCharacters(tmdbData.tmdbId),
                importSeriesCast(tmdbData.tmdbId)
              ]);
              console.log(`   ✓ Characters & Cast importiert`);
            } catch (e) {
              console.log('   ⚠️ Character/Cast Import fehlgeschlagen');
            }
          } catch (createError: any) {
            console.log(`   ⚠️ Serie erstellen fehlgeschlagen: ${createError.message}`);
          }
        } else {
          console.log(`   ✓ Serie existiert bereits: ${dbSeries.name}`);
        }
        
        logger.addMetadata('tmdbId', tmdbData.tmdbId);
        logger.addMetadata('seriesDbId', dbSeries?.id);
        
        // Check if series is still active (not ended years ago)
        const seriesStatus = tmdbData.status?.toLowerCase() || '';
        const isEnded = seriesStatus === 'ended' || seriesStatus === 'canceled';
        
        if (isEnded) {
          // Check if it ended more than 2 years ago (allow revivals)
          const lastAirDate = dbSeries?.lastAirDate || tmdbData.lastAirDate;
          if (lastAirDate) {
            const endedDate = new Date(lastAirDate);
            const twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
            
            if (endedDate < twoYearsAgo) {
              console.log(`   ⚠️ Serie beendet vor >2 Jahren - überspringe`);
              await logger.fail('Serie bereits beendet (keine aktuelle News)', 'tmdb-check');
              return { success: false, error: 'Serie bereits beendet' };
            }
          }
        }
      } else {
        console.log(`   ⚠️ Keine TMDB-Serie gefunden`);
        // Require TMDB match for quality
        await logger.fail('Keine TMDB-Serie gefunden', 'tmdb-resolution');
        return { success: false, error: 'Keine TMDB-Serie gefunden' };
      }
    }
    
    // ========== STEP 3: GATHER ADDITIONAL SOURCES ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 3: ZUSÄTZLICHE QUELLEN SUCHEN');
    console.log('━'.repeat(60));
    
    // Import the source gathering function from p3-trends
    const searchQuery = `${seriesName || video.title} ${video.channelName} 2024 2025 2026`;
    console.log(`   🔍 Suche: "${searchQuery}"`);
    
    let additionalSources = '';
    let totalWordCount = 0;
    
    try {
      // Search DuckDuckGo for additional sources - same as p3-trends
      const { gatherInfoForTrend } = await import('./p3-trends');
      const sourceInfo = await gatherInfoForTrend(seriesName || video.title);
      
      if (sourceInfo.totalWordCount > 100 && sourceInfo.articles.length > 0) {
        // Extract content from articles (same format as p3-trends)
        additionalSources = sourceInfo.articles
          .filter((a: any) => a.content && a.content.length > 50)
          .map((a: any) => `[Quelle: ${a.source}]\n${a.content}`)
          .join('\n\n---\n\n');
        totalWordCount = sourceInfo.totalWordCount;
        console.log(`   ✓ ${sourceInfo.articles.length} Quellen gefunden (${totalWordCount} Wörter)`);
      } else {
        console.log(`   ⚠️ Wenig zusätzliche Quellen gefunden`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ Quellensuche fehlgeschlagen: ${error.message}`);
    }
    
    // ========== STEP 4: GENERATE CONTENT ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 4: CONTENT GENERIEREN');
    console.log('━'.repeat(60));
    
    // Combine video info + additional sources as source text
    const sourceText = `
VIDEO-TITEL: ${video.title}
KANAL: ${video.channelName}
VERÖFFENTLICHT: ${video.publishedAt.toLocaleDateString('de-DE')}

VIDEO-BESCHREIBUNG:
${video.description || 'Keine Beschreibung verfügbar.'}

${additionalSources ? `
═══════════════════════════════════════════════════════════
ZUSÄTZLICHE QUELLEN (für Kontext und Fakten):
═══════════════════════════════════════════════════════════
${additionalSources}
` : ''}
    `.trim();
    
    const sourceWordCount = sourceText.split(/\s+/).length;
    console.log(`   📊 Gesamter Quelltext: ${sourceWordCount} Wörter`);
    logger.log(`Quelltext: ${sourceWordCount} Wörter (davon ${totalWordCount} aus externen Quellen)`);
    await logger.update({ wordsCollected: sourceWordCount, sourcesFound: additionalSources ? 1 : 0 });
    
    // Extract facts from video info
    console.log('   📊 Extrahiere Fakten...');
    const facts = await extractFacts(
      seriesName || video.title,
      sourceText
    );
    const factCount = facts.key_statements?.length || 0;
    console.log(`   ✓ ${factCount} Statements extrahiert`);
    logger.log(`Fakten extrahiert: ${factCount}`);
    await logger.update({ factsExtracted: factCount });
    
    // Determine content type from video title
    let contentType: 'NEWS' | 'ENDING_EXPLAINED' | 'RANKING' = 'NEWS';
    const titleLower = video.title.toLowerCase();
    if (titleLower.includes('trailer') || titleLower.includes('teaser') || titleLower.includes('ankündigung')) {
      contentType = 'NEWS';
    }
    
    // Generate article - same word count target as v2
    console.log('   🤖 Generiere Artikel via LLM...');
    logger.log('LLM Content-Generierung gestartet');
    
    // Word count target like v2: based on source content
    const wordCountTarget = sourceWordCount > 0 
      ? Math.min(Math.max(sourceWordCount * 1.2, 500), 1000) 
      : 600;
    
    const structuredContent = await generateStructuredContent({
      facts,
      seriesName: tmdbData?.name || seriesName || video.title,
      originalHeadline: video.title,
      sourceText,
      contentType,
      wordCountTarget,
    });
    
    if (!structuredContent || !structuredContent.markdown) {
      console.log('❌ Content-Generierung fehlgeschlagen');
      logger.log('LLM Content-Generierung fehlgeschlagen', 'error');
      await logger.fail('LLM konnte keinen Content generieren', 'llm-generation');
      return { success: false, videoId: video.videoId, error: 'LLM Fehler' };
    }
    
    console.log(`   ✓ Headline: ${structuredContent.headline}`);
    logger.log(`Headline generiert: ${structuredContent.headline}`);
    
    // ========== STEP 4: VIDEO DOWNLOAD ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 4: VIDEO DOWNLOAD');
    console.log('━'.repeat(60));
    
    let localVideoPath: string | null = null;
    let videoEmbed = '';
    
    // Download video from YouTube via RapidAPI
    console.log(`   📥 Lade Video herunter: ${video.videoId}`);
    
    try {
      const downloadResult = await downloadYouTubeTrailer(
        video.videoId,
        seriesName || video.title
      );
      
      if (downloadResult.success && downloadResult.localPath) {
        localVideoPath = downloadResult.localPath;
        console.log(`   ✅ Video heruntergeladen: ${localVideoPath}`);
        
        // Create video player for local video
        videoEmbed = `
<div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1.5rem 0; border-radius: 12px;">
  <video 
    controls 
    preload="metadata"
    poster="${video.thumbnailUrl}"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 12px;"
  >
    <source src="${localVideoPath}" type="video/mp4">
    Dein Browser unterstützt das Video-Tag nicht.
  </video>
</div>
`;
      } else {
        console.log(`   ⚠️ Download fehlgeschlagen: ${downloadResult.error}`);
        console.log(`   ↳ Fallback: YouTube Embed`);
      }
    } catch (downloadError: any) {
      console.log(`   ⚠️ Download-Fehler: ${downloadError.message}`);
      console.log(`   ↳ Fallback: YouTube Embed`);
    }
    
    // Fallback: YouTube embed if download failed
    if (!localVideoPath) {
      videoEmbed = `
<div class="youtube-embed" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1.5rem 0; border-radius: 12px;">
  <iframe 
    src="https://www.youtube.com/embed/${video.videoId}" 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 12px;" 
    frameborder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
    allowfullscreen>
  </iframe>
</div>
`;
    }
    
    // ========== STEP 5: LINK CHARACTERS & STREAMERS ==========
    let processedMarkdown = structuredContent.markdown;
    
    if (dbSeries) {
      try {
        const charResult = await linkCharactersInMarkdown(processedMarkdown, dbSeries.tmdbId);
        processedMarkdown = charResult.linkedMarkdown;
        
        const castResult = await linkCastInMarkdown(processedMarkdown, dbSeries.tmdbId);
        processedMarkdown = castResult.linkedMarkdown;
      } catch (e) {
        // Linking failed, continue without
      }
    }
    
    const streamerResult = linkStreamersInMarkdown(processedMarkdown);
    processedMarkdown = streamerResult.linkedMarkdown;
    console.log(`   ✓ Video eingebettet, Streamer verlinkt`);
    
    // ========== STEP 6: CONVERT TO HTML ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 6: HTML KONVERTIERUNG');
    console.log('━'.repeat(60));
    
    let htmlContent = markdownToHtml(processedMarkdown);
    
    // Add video embed after first paragraph
    const firstParagraphEnd = htmlContent.indexOf('</p>');
    if (firstParagraphEnd !== -1) {
      htmlContent = htmlContent.slice(0, firstParagraphEnd + 4) + videoEmbed + htmlContent.slice(firstParagraphEnd + 4);
    } else {
      htmlContent = videoEmbed + htmlContent;
    }
    
    console.log(`   ✓ HTML: ${htmlContent.length} Zeichen`);
    
    // ========== STEP 6.5: QUALITY GATES (like v2) ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 6.5: QUALITY GATES');
    console.log('━'.repeat(60));
    
    let antiAiScore = 0;
    
    // Quality Check
    try {
      const qualityResult = await qualityCheck({
        generatedArticleHtml: processedMarkdown,
        originalHeadline: video.title,
        generatedHeadline: structuredContent.headline,
      });
      console.log(`   ✅ Quality check: ${qualityResult.passed ? 'Passed' : 'Warnings'}`);
    } catch (error: any) {
      console.log(`   ⚠️ Quality check skipped: ${error.message}`);
    }
    
    // Anti-AI Filter
    try {
      const antiAiResult = antiAiFilter({
        articleHtml: htmlContent,
        headline: structuredContent.headline,
        seriesName: tmdbData?.name || seriesName || video.title,
      });
      antiAiScore = antiAiResult.antiAiScore;
      console.log(`   📊 Anti-AI Score: ${antiAiScore}/100 (${antiAiResult.status})`);
      logger.log(`Anti-AI Score: ${antiAiScore}/100`);
      await logger.update({ antiAiScore });
    } catch (error: any) {
      console.log(`   ⚠️ Anti-AI check skipped: ${error.message}`);
    }
    
    // Fact Safety Check
    try {
      const factSafetyResult = await factSafetyCheck({
        articleHtml: processedMarkdown,
        headline: structuredContent.headline,
        extractedFacts: JSON.stringify(facts),
      });
      console.log(`   ✅ Fact safety: ${factSafetyResult.status === 'SAFE' ? 'Passed' : 'Warnings'}`);
    } catch (error: any) {
      console.log(`   ⚠️ Fact safety skipped: ${error.message}`);
    }
    
    // ========== STEP 7: INTERNAL LINKING (like v2) ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 7: INTERNAL LINKING');
    console.log('━'.repeat(60));
    
    const articleId = `yt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      const internalLinksResult = await generateInternalLinks({
        articleId,
        contentHtml: htmlContent,
        primarySeriesId: dbSeries?.tmdbId || null,
        primarySeriesName: dbSeries?.name || dbSeries?.title || seriesName || '',
        primarySeriesSlug: dbSeries?.slug || '',
        publishedAt: null,
      });
      
      htmlContent = internalLinksResult.updatedContentHtml;
      
      console.log(`   ✅ Internal Links:`);
      console.log(`      Hub Link: ${internalLinksResult.hubLink ? 'Yes' : 'No'}`);
      console.log(`      Related Articles: ${internalLinksResult.relatedArticles.length}`);
      
      // Validate links
      const linkValidation = validateInternalLinks(htmlContent, dbSeries?.name || seriesName || '');
      if (!linkValidation.valid) {
        console.log(`   ⚠️ Link Validation Warnings`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ Internal linking skipped: ${error.message}`);
    }
    
    // ========== STEP 8: SAVE ARTICLE ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 8: ARTIKEL SPEICHERN');
    console.log('━'.repeat(60));
    
    const slug = generateSlug(structuredContent.headline);
    
    // Check for duplicate
    const existing = await prisma.articles.findFirst({
      where: { slug }
    });
    
    if (existing) {
      console.log('⚠️ Artikel existiert bereits');
      logger.log('Artikel existiert bereits - übersprungen', 'warn');
      
      // Update video as processed
      await prisma.youtube_videos.update({
        where: { videoId: video.videoId },
        data: {
          processed: true,
          processedAt: now,
          articleId: existing.id,
          articleSlug: existing.slug,
        }
      });
      
      await logger.partial({
        articleId: existing.id,
        articleSlug: existing.slug,
        articleTitle: existing.title,
        errorMessage: 'Artikel existierte bereits'
      });
      
      return {
        success: true,
        videoId: video.videoId,
        articleId: existing.id,
        slug: existing.slug,
        title: existing.title
      };
    }
    
    // Only set primarySeriesId if series exists in DB (foreign key constraint)
    // primarySeriesId uses the DB id (not tmdbId)
    const seriesIdForArticle = dbSeries ? dbSeries.id : null;
    
    const article = await prisma.articles.create({
      data: {
        id: articleId,
        title: structuredContent.headline,
        slug,
        excerpt: structuredContent.metaDescription,
        contentHtml: htmlContent,
        metaDescription: structuredContent.metaDescription,
        category: 'neue-videos',
        status: 'published',
        authorId: getRandomAuthor(),
        sourceUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
        primarySeriesId: seriesIdForArticle,
        tmdbId: tmdbData?.tmdbId || null,
        heroImageUrl: video.thumbnailUrl,
        heroVideoUrl: localVideoPath || `https://www.youtube.com/watch?v=${video.videoId}`,
        isTrending: false,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      }
    });
    
    // Update video as processed
    await prisma.youtube_videos.update({
      where: { videoId: video.videoId },
      data: {
        processed: true,
        processedAt: now,
        articleId: article.id,
        articleSlug: article.slug,
      }
    });
    
    console.log(`   ✓ Artikel gespeichert: ${article.slug}`);
    logger.log(`Artikel gespeichert: ${article.slug}`);
    
    console.log('\n' + '═'.repeat(70));
    console.log('✅ P4-YT PIPELINE ERFOLGREICH');
    console.log('═'.repeat(70));
    console.log(`📰 Artikel: ${article.title}`);
    console.log(`🔗 URL: /${article.slug}`);
    console.log(`🎬 Video: https://www.youtube.com/watch?v=${video.videoId}`);
    console.log('═'.repeat(70) + '\n');
    
    // Log success
    await logger.success({
      articleId: article.id,
      articleSlug: article.slug,
      articleTitle: article.title,
      sourcesFound: 1,
    });
    
    return {
      success: true,
      videoId: video.videoId,
      articleId: article.id,
      slug: article.slug,
      title: article.title
    };
    
  } catch (error) {
    console.error('❌ Pipeline Fehler:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logger.fail(errorMessage, 'unknown');
    return {
      success: false,
      videoId: video.videoId,
      error: errorMessage
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PROCESS UNPROCESSED VIDEOS
// ══════════════════════════════════════════════════════════════════════════
export async function processUnprocessedVideos(limit: number = 5): Promise<YTArticleResult[]> {
  console.log('\n🎬 Verarbeite unverarbeitete Videos...\n');
  
  const unprocessedVideos = await prisma.youtube_videos.findMany({
    where: { processed: false },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    include: { channel: true }
  });
  
  if (unprocessedVideos.length === 0) {
    console.log('Keine unverarbeiteten Videos gefunden.');
    return [];
  }
  
  console.log(`📊 ${unprocessedVideos.length} Videos zu verarbeiten\n`);
  
  const results: YTArticleResult[] = [];
  
  for (const video of unprocessedVideos) {
    const result = await generateArticleFromVideo({
      videoId: video.videoId,
      title: video.title,
      description: video.description || '',
      thumbnailUrl: video.thumbnailUrl || '',
      publishedAt: video.publishedAt,
      channelId: video.channelId,
      channelName: video.channel.name,
    });
    
    results.push(result);
    
    // Delay between articles
    await new Promise(r => setTimeout(r, 2000));
  }
  
  return results;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN: CHECK AND PROCESS
// ══════════════════════════════════════════════════════════════════════════
export async function runP4YTPipeline(): Promise<{
  newVideos: number;
  processed: number;
  results: YTArticleResult[];
}> {
  console.log('\n' + '═'.repeat(70));
  console.log('🚀 P4-YT PIPELINE START');
  console.log('═'.repeat(70));
  
  // Step 1: Check for new videos
  const newVideos = await checkForNewVideos();
  
  // Step 2: Process unprocessed videos
  const results = await processUnprocessedVideos(5);
  
  const successful = results.filter(r => r.success).length;
  
  console.log('\n' + '═'.repeat(70));
  console.log('📊 P4-YT ZUSAMMENFASSUNG');
  console.log('═'.repeat(70));
  console.log(`   🆕 Neue Videos gefunden: ${newVideos.length}`);
  console.log(`   ✅ Artikel generiert: ${successful}`);
  console.log(`   ❌ Fehlgeschlagen: ${results.length - successful}`);
  console.log('═'.repeat(70) + '\n');
  
  return {
    newVideos: newVideos.length,
    processed: successful,
    results
  };
}

// ══════════════════════════════════════════════════════════════════════════
// CLI EXECUTION
// ══════════════════════════════════════════════════════════════════════════
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'init') {
    // Initialize channels only
    initializeChannels()
      .then(() => console.log('\n✅ Kanäle initialisiert'))
      .catch(console.error)
      .finally(() => prisma.$disconnect());
  } else if (args[0] === 'check') {
    // Check for new videos only
    checkForNewVideos()
      .then(videos => console.log(`\n✅ ${videos.length} neue Videos`))
      .catch(console.error)
      .finally(() => prisma.$disconnect());
  } else if (args[0] === 'video' && args[1]) {
    // Process specific video ID
    const videoId = args[1];
    prisma.youtube_videos.findUnique({
      where: { videoId },
      include: { channel: true }
    })
      .then(async (video) => {
        if (!video) {
          console.log(`Video ${videoId} nicht gefunden`);
          return;
        }
        const result = await generateArticleFromVideo({
          videoId: video.videoId,
          title: video.title,
          description: video.description || '',
          thumbnailUrl: video.thumbnailUrl || '',
          publishedAt: video.publishedAt,
          channelId: video.channelId,
          channelName: video.channel.name,
        });
        console.log('\nErgebnis:', JSON.stringify(result, null, 2));
      })
      .catch(console.error)
      .finally(() => prisma.$disconnect());
  } else {
    // Run full pipeline
    runP4YTPipeline()
      .then(result => {
        console.log('\nErgebnis:', JSON.stringify(result, null, 2));
        process.exit(0);
      })
      .catch(err => {
        console.error(err);
        process.exit(1);
      })
      .finally(() => prisma.$disconnect());
  }
}
