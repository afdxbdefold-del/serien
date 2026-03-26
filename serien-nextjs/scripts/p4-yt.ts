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
import { downloadYouTubeTrailer } from '../lib/trailer-downloader';
import { PipelineLogger } from '../lib/pipeline-logger';

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
  
  // ✅ WHITELIST: Nur diese Muster sind erlaubt
  
  // Pattern 1: "Name | Trailer | Netflix" oder "Name | Teaser | Streamer"
  const trailerPattern = /\|\s*(offiziell(er|e)?|official)?\s*(trailer|teaser)/i;
  
  // Pattern 2: "Name | Ankündigung | Netflix" oder "Name | Official Announcement"
  const announcementPattern = /\|\s*(offizielle?|official)?\s*(ankündigung|announcement)/i;
  
  // Pattern 3: "Name: Staffel X | Trailer/Teaser" (Staffel NUR mit Trailer/Teaser)
  const seasonWithTrailerPattern = /(staffel|season)\s*\d.*\|\s*(offiziell)?\s*(trailer|teaser|ankündigung)/i;
  
  // Pattern 4: "Name | Sneak Peek | ..."
  const sneakPeekPattern = /\|\s*sneak\s*peek/i;
  
  // Pattern 5: "Name — Official Teaser/Trailer"
  const dashPattern = /—\s*(official\s*)?(trailer|teaser)/i;
  
  // Pattern 6: "Jetzt streamen" mit Pipe-Format (Neustart-Ankündigungen)
  const streamingStartPattern = /\|\s*jetzt\s+(streamen|auf)/i;
  
  // Pattern 7: "Neu & exklusiv auf" (echte Neuankündigungen)
  const newExclusivePattern = /neu\s*&?\s*exklusiv\s+(auf|bei)/i;
  
  // Prüfe ob MINDESTENS ein Whitelist-Pattern matched
  const isTrailer = trailerPattern.test(title);
  const isAnnouncement = announcementPattern.test(title);
  const isSeasonTrailer = seasonWithTrailerPattern.test(title);
  const isSneakPeek = sneakPeekPattern.test(title);
  const isDashFormat = dashPattern.test(title);
  const isStreamingStart = streamingStartPattern.test(title);
  const isNewExclusive = newExclusivePattern.test(title);
  
  const isValid = isTrailer || isAnnouncement || isSeasonTrailer || 
                  isSneakPeek || isDashFormat || isStreamingStart || isNewExclusive;
  
  if (!isValid) {
    return { valid: false, reason: 'Kein Trailer/Teaser/Ankündigung-Format' };
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
          description: description.substring(0, 2000), // Limit description length
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
          console.log(`   ⏭️ Übersprungen: ${video.title.substring(0, 40)}... (${filterResult.reason})`);
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
        console.log(`   🆕 Serien-News: ${video.title.substring(0, 50)}...`);
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
  
  // Remove common suffixes
  let cleaned = title
    .replace(/\s*\|\s*(Offizieller\s*)?(Trailer|Teaser|Ankündigung|Clip|Sneak Peek).*$/i, '')
    .replace(/\s*-\s*(Offizieller\s*)?(Trailer|Teaser|Ankündigung).*$/i, '')
    .replace(/\s*:\s*Staffel\s*\d+.*$/i, '')
    .replace(/\s+Staffel\s*\d+.*$/i, '')
    .replace(/\s*\(.*?\)\s*$/g, '') // Remove parentheses at end
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
} | null> {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return null;
    
    const url = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(seriesName)}&language=de-DE`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const series = data.results[0];
      return {
        tmdbId: series.id,
        name: series.name,
        backdropPath: series.backdrop_path,
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
    let tmdbData: { tmdbId: number; name: string; backdropPath: string | null } | null = null;
    let dbSeries: any = null;
    
    if (seriesName) {
      console.log('\n━'.repeat(60));
      console.log('STEP 2: TMDB SUCHE');
      console.log('━'.repeat(60));
      
      tmdbData = await findTmdbSeries(seriesName);
      
      if (tmdbData) {
        console.log(`   ✓ TMDB: ${tmdbData.name} (ID: ${tmdbData.tmdbId})`);
        
        // Check if series exists in DB
        dbSeries = await prisma.series.findUnique({
          where: { tmdbId: tmdbData.tmdbId }
        });
        
        if (dbSeries) {
          console.log(`   ✓ Serie in DB gefunden`);
        }
      } else {
        console.log(`   ⚠️ Keine TMDB-Serie gefunden`);
      }
    }
    
    // ========== STEP 3: GENERATE CONTENT ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 3: CONTENT GENERIEREN');
    console.log('━'.repeat(60));
    
    // Combine video info as source text
    const sourceText = `
VIDEO-TITEL: ${video.title}
KANAL: ${video.channelName}
VERÖFFENTLICHT: ${video.publishedAt.toLocaleDateString('de-DE')}

VIDEO-BESCHREIBUNG:
${video.description || 'Keine Beschreibung verfügbar.'}
    `.trim();
    
    const sourceWordCount = sourceText.split(/\s+/).length;
    logger.log(`Quelltext: ${sourceWordCount} Wörter`);
    await logger.update({ wordsCollected: sourceWordCount });
    
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
    
    // Generate article
    console.log('   🤖 Generiere Artikel via LLM...');
    logger.log('LLM Content-Generierung gestartet');
    
    const structuredContent = await generateStructuredContent({
      facts,
      seriesName: tmdbData?.name || seriesName || video.title,
      originalHeadline: video.title,
      sourceText,
      contentType,
      wordCountTarget: 600,
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
    
    // ========== STEP 7: ANTI-AI CHECK ==========
    console.log('\n━'.repeat(60));
    console.log('STEP 7: ANTI-AI CHECK');
    console.log('━'.repeat(60));
    
    const antiAiResult = await antiAiFilter({
      articleHtml: htmlContent,
      headline: structuredContent.headline,
      seriesName: tmdbData?.name || seriesName || video.title,
    });
    
    console.log(`   📊 Anti-AI Score: ${antiAiResult.antiAiScore}/100`);
    console.log(`   ${antiAiResult.status === 'PASS' ? '✅' : '⚠️'} Status: ${antiAiResult.status}`);
    logger.log(`Anti-AI Score: ${antiAiResult.antiAiScore}/100 (${antiAiResult.status})`);
    await logger.update({ antiAiScore: antiAiResult.antiAiScore });
    
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
    
    const articleId = `yt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Only set primarySeriesId if series exists in DB (foreign key constraint)
    const seriesIdForArticle = dbSeries ? dbSeries.tmdbId : null;
    
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
