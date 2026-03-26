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
import { PipelineLogger, type TriggerType } from '../lib/pipeline-logger';
import { importSeriesCharacters } from './import-characters';
import { importSeriesCast } from '../lib/cast-importer';
import { generateWasBedeutetDas } from '../lib/was-bedeutet-das';
import { discoverGate } from '../lib/discover-gate';

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
      // Priority: maxresdefault > sddefault > hqdefault > default
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
// EXTRACT SERIES NAME FROM VIDEO TITLE - VERBESSERT
// ══════════════════════════════════════════════════════════════════════════
function extractSeriesFromTitle(title: string): string | null {
  if (!title) return null;
  
  // Common patterns in trailer/announcement titles:
  // "Squid Game: Staffel 2 | Offizieller Trailer | Netflix"
  // "Wednesday Staffel 2 | Teaser | Netflix"
  // "ADOLESCENCE | Offizieller Trailer | Netflix"
  // "Scrubs - Neu & exklusiv auf Disney+"
  // "Devil May Cry Staffel 2 startet im Mai"
  
  let cleaned = title;
  
  // Step 1: Remove everything after common delimiters first
  cleaned = cleaned
    .split(/\s*[|]\s*/)[0]  // Take part before first |
    .split(/\s*[-–—]\s*(?:Offiziell|Trailer|Teaser|Neu|Ab|Jetzt)/i)[0]  // Split at trailer markers
    .trim();
  
  // Step 2: Remove common suffixes and patterns
  cleaned = cleaned
    // Remove platform announcements
    .replace(/\s*[-–—]\s*(Neu\s*(&|und)\s*)?(exklusiv\s*)?(auf|bei)\s*(Disney\+?|Netflix|Prime Video|Amazon|Apple TV\+?|WOW|RTL\+?|Paramount\+?|Joyn|Sky).*$/i, '')
    .replace(/\s*[-–—]\s*jetzt\s*(auf|bei|streamen).*$/i, '')
    .replace(/\s*[-–—]\s*ab\s*(sofort|jetzt|\d).*$/i, '')
    // Remove trailer/teaser suffixes
    .replace(/\s*[-–—:]\s*(Offizieller?\s*)?(Haupt)?[- ]?(Trailer|Teaser|Ankündigung|Clip|Sneak Peek|Preview|Promo).*$/i, '')
    // Remove date announcements
    .replace(/\s+(startet|kommt|erscheint|ab)\s+(am|im|ab)?\s*\d.*$/i, '')
    .replace(/\s+im\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember).*$/i, '')
    // Remove season info but KEEP series name
    .replace(/\s*[:]\s*Staffel\s*\d+.*$/i, '')
    .replace(/\s+Staffel\s*\d+.*$/i, '')
    .replace(/\s+Season\s*\d+.*$/i, '')
    .replace(/\s+S\d+.*$/i, '')
    // Remove parentheses
    .replace(/\s*\(.*?\)\s*$/g, '')
    // Remove quotes
    .replace(/^["']|["']$/g, '')
    .trim();
  
  // Step 3: If still contains | take first meaningful part
  if (cleaned.includes('|')) {
    cleaned = cleaned.split('|')[0].trim();
  }
  
  // Step 4: If too long, might have extra text
  if (cleaned.length > 60) {
    // Try to find series name pattern (usually first 2-4 words)
    const words = cleaned.split(/\s+/);
    // Check if any word is a known delimiter
    for (let i = 0; i < words.length; i++) {
      if (/^(Staffel|Season|Trailer|Teil|Episode|Folge|Offiziell)$/i.test(words[i])) {
        cleaned = words.slice(0, i).join(' ');
        break;
      }
    }
  }
  
  // Step 5: Clean up any remaining artifacts
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/^[-–—:|\s]+|[-–—:|\s]+$/g, '')
    .trim();
  
  console.log(`   📝 Extrahiert: "${title}" → "${cleaned}"`);
  
  return cleaned.length > 2 ? cleaned : null;
}

// ══════════════════════════════════════════════════════════════════════════
// SEARCH TMDB FOR SERIES - VERBESSERTE MULTI-STRATEGIE SUCHE
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
    
    // Generate multiple search variants for better matching
    const searchVariants = generateSearchVariants(seriesName);
    console.log(`   🔍 TMDB Suche mit ${searchVariants.length} Varianten...`);
    
    for (const variant of searchVariants) {
      if (variant.length < 2) continue;
      
      // Search with German locale first, then English
      for (const lang of ['de-DE', 'en-US']) {
        const url = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(variant)}&language=${lang}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          // Find best match - prefer exact name match
          let bestMatch = data.results[0];
          
          for (const result of data.results) {
            const resultNameLower = (result.name || '').toLowerCase();
            const variantLower = variant.toLowerCase();
            
            // Exact match is best
            if (resultNameLower === variantLower) {
              bestMatch = result;
              break;
            }
            
            // Starts with variant is second best
            if (resultNameLower.startsWith(variantLower) || variantLower.startsWith(resultNameLower)) {
              bestMatch = result;
            }
          }
          
          const series = bestMatch;
          
          // Get detailed info for status
          let status = 'Unknown';
          let networks: string[] = [];
          try {
            const detailUrl = `https://api.themoviedb.org/3/tv/${series.id}?api_key=${apiKey}&language=de-DE`;
            const detailRes = await fetch(detailUrl);
            const detailData = await detailRes.json();
            status = detailData.status || 'Unknown';
            networks = (detailData.networks || []).map((n: any) => n.name);
          } catch {}
          
          console.log(`      ✓ Gefunden: "${series.name}" (ID: ${series.id}, Status: ${status})`);
          
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
      }
    }
    
    console.log(`      ⚠️ Keine TMDB-Ergebnisse für: ${seriesName}`);
  } catch (error) {
    console.log(`   ⚠️ TMDB Suche fehlgeschlagen: ${error instanceof Error ? error.message : ''}`);
  }
  
  return null;
}

// Generate search variants for better TMDB matching
function generateSearchVariants(seriesName: string): string[] {
  const variants: string[] = [];
  
  if (!seriesName) return variants;
  
  // Original name
  variants.push(seriesName);
  
  // Without special characters
  const cleaned = seriesName
    .replace(/[:\-–—|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned !== seriesName) variants.push(cleaned);
  
  // German umlauts to standard
  const noUmlauts = seriesName
    .replace(/ä/gi, 'a')
    .replace(/ö/gi, 'o')
    .replace(/ü/gi, 'u')
    .replace(/ß/gi, 'ss');
  if (noUmlauts !== seriesName) variants.push(noUmlauts);
  
  // First N words (for compound titles)
  const words = seriesName.split(/\s+/);
  if (words.length > 2) {
    variants.push(words.slice(0, 2).join(' ')); // First 2 words
    variants.push(words.slice(0, 3).join(' ')); // First 3 words
  }
  if (words.length > 3) {
    variants.push(words.slice(0, 4).join(' ')); // First 4 words
  }
  
  // Without "The" / "Der/Die/Das"
  const withoutArticle = seriesName.replace(/^(The|Der|Die|Das|Ein|Eine)\s+/i, '');
  if (withoutArticle !== seriesName) variants.push(withoutArticle);
  
  // Last word only (sometimes series name is last)
  if (words.length > 1) {
    const lastWord = words[words.length - 1];
    if (lastWord.length > 3) variants.push(lastWord);
  }
  
  // Remove duplicates and empty strings
  return [...new Set(variants)].filter(v => v.length > 1);
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
  
  // ========== SOURCE AGE CHECK (6 Stunden Maximum) ==========
  const videoAge = now.getTime() - video.publishedAt.getTime();
  const maxAgeMs = 6 * 60 * 60 * 1000; // 6 Stunden in Millisekunden
  const videoAgeHours = Math.round(videoAge / (60 * 60 * 1000) * 10) / 10;
  
  if (videoAge > maxAgeMs && trigger !== 'manual') {
    console.log(`\n⏰ VIDEO ZU ALT: ${videoAgeHours} Stunden (max: 6 Stunden)`);
    console.log(`   → Überspringe Video. Nur manuelle Trigger erlaubt für ältere Quellen.`);
    logger.log(`Video zu alt: ${videoAgeHours}h (max 6h)`);
    await logger.fail(`Video zu alt: ${videoAgeHours}h`, 'source-age-check');
    return { success: false, videoId: video.videoId, error: `Video zu alt: ${videoAgeHours}h` };
  }
  
  console.log(`   ⏰ Video-Alter: ${videoAgeHours} Stunden ${trigger === 'manual' ? '(manueller Trigger)' : '✓'}`);
  
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
    const searchQuery = `${seriesName || video.title} Serie News 2024 2025 2026`;
    console.log(`   🔍 Suche: "${searchQuery}"`);
    
    let additionalSources = '';
    let totalWordCount = 0;
    
    // PFLICHT: Mindestens 3 Quellen-Versuche für Google Discover Qualität
    const sourceAttempts: { query: string; type: string }[] = [
      { query: `${seriesName || video.title} Serie News 2024 2025 2026`, type: 'news' },
      { query: `${seriesName || video.title} Serie Handlung Cast Schauspieler`, type: 'background' },
      { query: `${seriesName || video.title} Staffel Kritik Review`, type: 'review' },
    ];
    
    for (const attempt of sourceAttempts) {
      if (totalWordCount >= 500) break; // Genug Quellen gefunden
      
      try {
        console.log(`   🔍 Suche: "${attempt.query}" (${attempt.type})`);
        const { gatherInfoForTrend } = await import('./p3-trends');
        const sourceInfo = await gatherInfoForTrend(attempt.query);
        
        if (sourceInfo.totalWordCount > 50 && sourceInfo.articles.length > 0) {
          const newContent = sourceInfo.articles
            .filter((a: any) => a.content && a.content.length > 50)
            .map((a: any) => `[${attempt.type === 'news' ? 'Quelle' : 'Hintergrund'}: ${a.source}]\n${a.content}`)
            .join('\n\n---\n\n');
          
          if (newContent) {
            additionalSources += (additionalSources ? '\n\n═══════════════════════════════════════════════════════════\n\n' : '') + newContent;
            totalWordCount += sourceInfo.totalWordCount;
            console.log(`   ✓ ${sourceInfo.articles.length} Quellen (${sourceInfo.totalWordCount} Wörter)`);
          }
        } else {
          console.log(`   ⚠️ Wenig Ergebnisse für: ${attempt.type}`);
        }
      } catch (error: any) {
        console.log(`   ⚠️ Suche fehlgeschlagen (${attempt.type}): ${(error.message || '').substring(0, 30)}`);
      }
    }
    
    // FALLBACK: Wenn immer noch zu wenig, nutze erweiterte TMDB-Daten
    if (totalWordCount < 200 && tmdbData) {
      console.log(`   📺 Erweitere mit TMDB-Details...`);
      
      // Hole Cast-Details für reichhaltigeren Content
      if (dbSeries) {
        try {
          const castMembers = await prisma.series_cast.findMany({
            where: { seriesId: dbSeries.tmdbId },
            include: { person: true },
            take: 10,
          });
          
          if (castMembers.length > 0) {
            const castInfo = castMembers
              .map((c: any) => `${c.person?.name || 'Unbekannt'} als ${c.character || 'unbekannte Rolle'}`)
              .join(', ');
            additionalSources += `\n\n═══════════════════════════════════════════════════════════\nCAST: ${castInfo}`;
            console.log(`   ✓ ${castMembers.length} Cast-Mitglieder aus DB`);
          }
        } catch (e) {
          // Ignore
        }
      }
    }
    
    console.log(`   📊 Gesamt: ${totalWordCount} Wörter aus externen Quellen`);
    
    // ========== STEP 4: GENERATE CONTENT ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 4: CONTENT GENERIEREN');
    console.log('━'.repeat(60));
    
    // Build series context from TMDB data
    let seriesContext = '';
    if (tmdbData) {
      seriesContext = `
═══════════════════════════════════════════════════════════
SERIEN-KONTEXT (aus TMDB - für Hintergrund-Informationen):
═══════════════════════════════════════════════════════════
SERIE: ${tmdbData.name}
${tmdbData.overview ? `BESCHREIBUNG: ${tmdbData.overview}` : ''}
${tmdbData.status ? `STATUS: ${tmdbData.status}` : ''}
${tmdbData.firstAirDate ? `ERSTAUSSTRAHLUNG: ${tmdbData.firstAirDate}` : ''}
`;
    }
    
    // Combine video info + series context + additional sources
    const sourceText = `
VIDEO-TITEL: ${video.title}
KANAL: ${video.channelName}
VERÖFFENTLICHT: ${video.publishedAt.toLocaleDateString('de-DE')}

VIDEO-BESCHREIBUNG:
${video.description || 'Keine Beschreibung verfügbar.'}
${seriesContext}
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
    
    // Generate article - GOOGLE DISCOVER QUALITÄT
    console.log('   🤖 Generiere Premium-Artikel via LLM...');
    logger.log('LLM Content-Generierung gestartet (Google Discover Qualität)');
    
    // Word count target: MINIMUM 1200, ideal 1500-2000 für Google Discover
    const wordCountTarget = Math.max(1500, Math.min(sourceWordCount * 2, 2500));
    
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
    
    // ========== QUALITY CHECK: Repetition Detection ==========
    const markdownLower = structuredContent.markdown.toLowerCase();
    const wordCount = structuredContent.markdown.split(/\s+/).length;
    
    // Check for excessive repetition (same phrase appearing more than 2x)
    const sentences = structuredContent.markdown.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const repetitionWarnings: string[] = [];
    
    // Check if key facts are repeated too often
    const factPatterns = [
      /12\.\s*mai/gi,
      /mai\s*2025|mai\s*2026/gi,
      /dante\s*und\s*vergil/gi,
      /studio\s*mir/gi,
    ];
    
    for (const pattern of factPatterns) {
      const matches = structuredContent.markdown.match(pattern);
      if (matches && matches.length > 2) {
        repetitionWarnings.push(`"${matches[0]}" appears ${matches.length}x`);
      }
    }
    
    if (repetitionWarnings.length > 0) {
      console.log(`   ⚠️ QUALITÄTS-WARNUNG: Repetitionen erkannt:`);
      repetitionWarnings.forEach(w => console.log(`      - ${w}`));
      logger.log(`Qualitätswarnung: ${repetitionWarnings.join(', ')}`, 'warning');
    }
    
    if (wordCount < 400) {
      console.log(`   ⚠️ QUALITÄTS-WARNUNG: Artikel zu kurz (${wordCount} Wörter)`);
      logger.log(`Qualitätswarnung: Nur ${wordCount} Wörter`, 'warning');
    }
    
    console.log(`   ✓ Headline: ${structuredContent.headline}`);
    console.log(`   ✓ Wörter: ${wordCount}`);
    logger.log(`Headline generiert: ${structuredContent.headline}`);
    
    // ========== STEP 5: VIDEO DOWNLOAD (für Hero) ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 5: VIDEO DOWNLOAD');
    console.log('━'.repeat(60));
    
    let localVideoPath: string | null = null;
    
    // Download video from YouTube via RapidAPI (wird als heroVideoUrl gespeichert)
    console.log(`   📥 Lade Video herunter: ${video.videoId}`);
    
    try {
      const downloadResult = await downloadYouTubeTrailer(
        video.videoId,
        seriesName || video.title
      );
      
      if (downloadResult.success && downloadResult.localPath) {
        localVideoPath = downloadResult.localPath;
        console.log(`   ✅ Video heruntergeladen: ${localVideoPath}`);
      } else {
        console.log(`   ⚠️ Download fehlgeschlagen: ${downloadResult.error}`);
        console.log(`   ↳ Fallback: YouTube URL wird als heroVideoUrl gespeichert`);
      }
    } catch (downloadError: any) {
      console.log(`   ⚠️ Download-Fehler: ${downloadError.message}`);
      console.log(`   ↳ Fallback: YouTube URL wird als heroVideoUrl gespeichert`);
    }
    
    // Video wird im Hero-Bereich angezeigt, kein Embed im Artikel-Content nötig
    
    // ========== STEP 5.5: CHARACTER & CAST IMPORT & LINKING (wie P2) ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 5.5: CHARACTER & CAST LINKING');
    console.log('━'.repeat(60));
    
    let processedMarkdown = structuredContent.markdown;
    
    if (dbSeries) {
      // Import characters first (like P2)
      console.log(`   📥 Importiere Characters für Serie ${dbSeries.tmdbId}...`);
      try {
        await importSeriesCharacters(dbSeries.tmdbId);
        console.log(`   ✓ Characters importiert`);
      } catch (e: any) {
        console.log(`   ⚠️ Character-Import fehlgeschlagen: ${(e.message || '').substring(0, 50)}`);
      }
      
      // Import cast (like P2)
      console.log(`   📥 Importiere Cast...`);
      try {
        await importSeriesCast(dbSeries.tmdbId);
        console.log(`   ✓ Cast importiert`);
      } catch (e: any) {
        console.log(`   ⚠️ Cast-Import fehlgeschlagen: ${(e.message || '').substring(0, 50)}`);
      }
      
      // Link characters in markdown
      try {
        const charResult = await linkCharactersInMarkdown(processedMarkdown, dbSeries.tmdbId);
        processedMarkdown = charResult.linkedMarkdown;
        console.log(`   ✓ ${charResult.charactersLinked} Characters verlinkt`);
        
        // Debug: Check actual links
        const charLinks = (processedMarkdown.match(/\[([^\]]+)\]\(\/figur\/[^)]+\)/g) || []).length;
        console.log(`   🔍 DEBUG: ${charLinks} Character-Links im Markdown`);
      } catch (e: any) {
        console.log(`   ⚠️ Character-Linking fehlgeschlagen: ${(e.message || '').substring(0, 50)}`);
      }
      
      // Link cast in markdown
      try {
        const castResult = await linkCastInMarkdown(processedMarkdown, dbSeries.tmdbId);
        processedMarkdown = castResult.linkedMarkdown;
        console.log(`   ✓ ${castResult.castLinked} Cast-Mitglieder verlinkt`);
        
        // Debug: Check actual links
        const castLinks = (processedMarkdown.match(/\[([^\]]+)\]\(\/person\/[^)]+\)/g) || []).length;
        console.log(`   🔍 DEBUG: ${castLinks} Cast-Links im Markdown`);
      } catch (e: any) {
        console.log(`   ⚠️ Cast-Linking fehlgeschlagen: ${(e.message || '').substring(0, 50)}`);
      }
    } else {
      console.log(`   ⚠️ Keine Serie - überspringe Character/Cast Linking`);
    }
    
    // Link streamers to hub pages
    console.log(`   🎬 Verlinke Streaming-Dienste...`);
    const streamerResult = linkStreamersInMarkdown(processedMarkdown);
    processedMarkdown = streamerResult.linkedMarkdown;
    if (streamerResult.streamersLinked.length > 0) {
      console.log(`   ✓ ${streamerResult.streamersLinked.length} Streamer verlinkt: ${streamerResult.streamersLinked.join(', ')}`);
    }
    
    // ========== STEP 6: CONVERT TO HTML ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 6: HTML KONVERTIERUNG');
    console.log('━'.repeat(60));
    
    let htmlContent = markdownToHtml(processedMarkdown);
    
    // Video wird im Hero-Bereich angezeigt (heroVideoUrl), kein Embed im Content nötig
    
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
    // primarySeriesId uses the tmdbId as the series ID (since tmdbId is the @id in schema)
    const seriesIdForArticle = dbSeries ? dbSeries.tmdbId : null;
    
    // DEBUG: Log series assignment
    console.log(`   📊 Serie für Artikel: ${dbSeries?.name || 'KEINE'} (ID: ${seriesIdForArticle || 'NULL'})`);
    
    // Select best hero image: TMDB Backdrop > YouTube Thumbnail
    // TMDB images are usually higher quality and more suitable for hero display
    let heroImageUrl = video.thumbnailUrl;
    
    if (tmdbData?.backdropPath) {
      // Use TMDB backdrop (1280px wide, cinematic)
      heroImageUrl = `https://image.tmdb.org/t/p/w1280${tmdbData.backdropPath}`;
      console.log(`   🖼️ Hero Image: TMDB Backdrop`);
    } else if (tmdbData?.posterPath) {
      // Fallback to poster if no backdrop
      heroImageUrl = `https://image.tmdb.org/t/p/w780${tmdbData.posterPath}`;
      console.log(`   🖼️ Hero Image: TMDB Poster`);
    } else if (video.thumbnailUrl) {
      // Use YouTube thumbnail as last resort
      // Try maxresdefault first, fallback to hqdefault
      heroImageUrl = video.thumbnailUrl.includes('maxresdefault') 
        ? video.thumbnailUrl 
        : `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
      console.log(`   🖼️ Hero Image: YouTube Thumbnail`);
    }
    
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
        heroImageUrl,
        heroVideoUrl: localVideoPath || null, // Nur lokales Video, KEIN YouTube-Embed
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
    
    // ========== STEP 9: POST-PROCESSING (wie P2) ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 9: POST-PROCESSING (parallel)');
    console.log('━'.repeat(60));
    
    await Promise.allSettled([
      // Save Q&A (wie P2!)
      (async () => {
        if (structuredContent.qa && structuredContent.qa.length > 0) {
          try {
            const qaId = `qa-${article.id}`;
            
            // Determine heading type based on title
            const titleLower = (structuredContent.headline || '').toLowerCase();
            let headingType = 'default';
            
            if (titleLower.includes('trailer')) {
              headingType = 'trailer';
            } else if (titleLower.includes('episode') || titleLower.includes('folge') || /s\d+e\d+/i.test(titleLower)) {
              headingType = 'episode';
            } else if (titleLower.includes('finale') || titleLower.includes('final')) {
              headingType = 'finale';
            } else if (titleLower.includes('staffel') || titleLower.includes('season')) {
              headingType = 'season';
            } else if (titleLower.includes('start') || titleLower.includes('release') || titleLower.includes('verfügbar')) {
              headingType = 'release';
            }
            
            await prisma.article_qa.create({
              data: {
                id: qaId,
                articleId: article.id,
                questions: structuredContent.qa,
                schemaEnabled: true,
                headingType,
                updatedAt: now,
              },
            });
            console.log(`   ✅ Q&A gespeichert: ${structuredContent.qa.length} Fragen (${headingType})`);
          } catch (error: any) {
            console.log(`   ⚠️ Q&A speichern fehlgeschlagen: ${(error.message || '').substring(0, 50)}`);
          }
        } else {
          console.log(`   ⚠️ Keine Q&A generiert`);
        }
      })(),
      
      // Generate "Was bedeutet das" section
      (async () => {
        try {
          const wasBedeutetDasText = await generateWasBedeutetDas(
            structuredContent.headline,
            htmlContent,
            dbSeries?.name || seriesName || ''
          );
          
          if (wasBedeutetDasText) {
            await prisma.articles.update({
              where: { id: article.id },
              data: { wasBedeutetDasText }
            });
            console.log(`   ✅ "Was bedeutet das" generiert`);
          }
        } catch (error: any) {
          console.log(`   ⚠️ "Was bedeutet das" fehlgeschlagen: ${(error.message || '').substring(0, 50)}`);
        }
      })(),
      
      // Discover Gate (Google Discover Tauglichkeit)
      (async () => {
        try {
          await discoverGate(article.id, structuredContent.headline, htmlContent);
          console.log(`   ✅ Discover Gate verarbeitet`);
        } catch (error: any) {
          console.log(`   ⚠️ Discover Gate fehlgeschlagen: ${(error.message || '').substring(0, 50)}`);
        }
      })(),
    ]);
    
    console.log('\n' + '═'.repeat(70));
    console.log('✅ P4-YT PIPELINE ERFOLGREICH');
    console.log('═'.repeat(70));
    console.log(`📰 Artikel: ${article.title}`);
    console.log(`🔗 URL: /${article.slug}`);
    console.log(`🎬 Video: https://www.youtube.com/watch?v=${video.videoId}`);
    console.log(`📊 Anti-AI Score: ${antiAiScore}/100`);
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
export async function processUnprocessedVideos(limit: number = 5, trigger: TriggerType = 'cron'): Promise<YTArticleResult[]> {
  console.log('\n🎬 Verarbeite unverarbeitete Videos...\n');
  console.log(`   Trigger: ${trigger} (${trigger === 'manual' ? 'Alterscheck deaktiviert' : 'max 6h alte Quellen'})`);
  
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
    }, trigger);
    
    results.push(result);
    
    // Delay between articles
    await new Promise(r => setTimeout(r, 2000));
  }
  
  return results;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN: CHECK AND PROCESS
// ══════════════════════════════════════════════════════════════════════════
// MAIN: P4 PIPELINE (für Admin Dashboard Trigger)
// ══════════════════════════════════════════════════════════════════════════
export async function runP4YTPipeline(trigger: TriggerType = 'cron'): Promise<{
  newVideos: number;
  processed: number;
  results: YTArticleResult[];
}> {
  console.log('\n' + '═'.repeat(70));
  console.log('🚀 P4-YT PIPELINE START');
  console.log(`   Trigger: ${trigger} (${trigger === 'manual' ? 'Alterscheck deaktiviert' : 'max 6h alte Quellen'})`);
  console.log('═'.repeat(70));
  
  // Step 1: Check for new videos
  const newVideos = await checkForNewVideos();
  
  // Step 2: Process unprocessed videos
  const results = await processUnprocessedVideos(5, trigger);
  
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
