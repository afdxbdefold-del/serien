/**
 * P3-TRENDS PIPELINE
 * 
 * Automatische Artikel-Generierung basierend auf Google Trends
 * 
 * Unterschied zu pipeline-v2:
 * - Keine festen Quellen, sondern Web-Scraping basierend auf Suchbegriff
 * - Sammelt Infos von mehreren Serien-News-Seiten
 * - Erstellt ausführliche Artikel (1000+ Wörter)
 * - Vollautomatisch: Trend → Artikel → Veröffentlicht
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { generateStructuredContent } from '../lib/structured-content-generator';
import { linkCharactersInMarkdown, linkStreamersInMarkdown } from '../lib/character-linking-markdown';
import { linkCastInMarkdown } from '../lib/cast-linking-markdown';
import { markdownToHtml } from '../lib/markdown-to-html';
import { resolveTmdbSeries } from '../lib/tmdb-resolver';
import { searchTvEnhanced } from '../lib/tmdb-search-enhanced';
import { getTvDetailsComplete } from '../lib/tmdb';
import { importSeriesCharacters } from './import-characters';
import { importSeriesCast } from '../lib/cast-importer';
import { generateSeriesSlug } from '../lib/slug-utils';
import { extractFacts } from '../lib/fact-extractor';
import { antiAiFilter } from '../lib/anti-ai-filter';
import { qualityCheck } from '../lib/quality-checker';
import { factSafetyCheck } from '../lib/fact-safety-layer';
import { generateInternalLinks, validateInternalLinks } from '../lib/internal-linking-engine';
import { findTrailerYouTubeId, downloadYouTubeTrailer, searchYouTubeTrailer } from '../lib/trailer-downloader';
import { PipelineLogger, type TriggerType } from '../lib/pipeline-logger';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════════════════════
// JINA AI READER - Universal Web Scraper
// ══════════════════════════════════════════════════════════════════════════
const JINA_READER_URL = 'https://r.jina.ai/';

// Known sources for better logging (optional)
const KNOWN_SOURCES: Record<string, string> = {
  'screenrant.com': 'Screen Rant',
  'collider.com': 'Collider',
  'tvline.com': 'TVLine',
  'deadline.com': 'Deadline',
  'variety.com': 'Variety',
  'ew.com': 'Entertainment Weekly',
  'hollywoodreporter.com': 'Hollywood Reporter',
  'ign.com': 'IGN',
  'cbr.com': 'CBR',
  'gamesradar.com': 'GamesRadar',
  'digitalspy.com': 'Digital Spy',
  'denofgeek.com': 'Den of Geek',
  'indiewire.com': 'IndieWire',
  'thewrap.com': 'The Wrap',
  'cinemablend.com': 'CinemaBlend',
  'serienjunkies.de': 'Serienjunkies',
  'moviepilot.de': 'Moviepilot',
  'kino.de': 'Kino.de',
  'filmstarts.de': 'Filmstarts',
};

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
// LLM REWRITE FOR HUMAN TONE
// ══════════════════════════════════════════════════════════════════════════
async function rewriteForHumanTone(
  markdown: string,
  headline: string,
  seriesName: string,
  problems: string[]
): Promise<string | null> {
  console.log('   🔄 Rewrite für menschlicheren Ton...');
  
  const problemList = problems.slice(0, 5).join('\n- ');
  
  const systemPrompt = `Du bist ein erfahrener deutscher TV-Redakteur. Deine Aufgabe ist es, KI-generierte Texte menschlicher zu machen.

REGELN:
1. Variiere Satzanfänge - nie zwei gleiche hintereinander
2. Maximal 3 Sätze pro Absatz
3. Erster Absatz MUSS einen konkreten Fakt enthalten (Datum, Name, Zahl)
4. Keine Füllwörter: "Es ist wichtig", "Insgesamt", "Darüber hinaus"
5. Direkt und knapp schreiben
6. Behalte alle Links [Text](URL) exakt bei
7. Behalte die Markdown-Struktur (## Überschriften)

VERMEIDE:
- Generische Einleitungen
- "spannend", "aufregend", "interessant"
- Wiederholungen des Seriennamens (max 2x pro Absatz)`;

  const userPrompt = `HEADLINE: ${headline}
SERIE: ${seriesName}

PROBLEME IM TEXT:
- ${problemList}

ORIGINALER MARKDOWN:
${(markdown || '').substring(0, 3000)}

Schreibe den Text um, behebe die Probleme. Antworte NUR mit dem verbesserten Markdown:`;

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY,
      baseURL: 'https://api.openai.com/v1',
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_completion_tokens: 2000,
    });

    const rewritten = response.choices?.[0]?.message?.content;
    
    if (rewritten && rewritten.length > 500) {
      console.log('   ✅ Rewrite erfolgreich');
      return rewritten;
    }
    
    return null;
  } catch (error) {
    console.log('   ⚠️ Rewrite fehlgeschlagen:', error instanceof Error ? error.message : '');
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// SLUG GENERATOR
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
// WEB SEARCH: Google News RSS + DuckDuckGo
// ══════════════════════════════════════════════════════════════════════════
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

// Resolve Google News redirect to get actual article URL
async function resolveGoogleNewsUrl(gnUrl: string): Promise<string | null> {
  if (!gnUrl.includes('news.google.com')) return gnUrl;
  
  try {
    // Follow the redirect with a short timeout
    const response = await fetch(gnUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    
    const finalUrl = response.url;
    if (finalUrl && !finalUrl.includes('google.com')) {
      return finalUrl;
    }
  } catch {
    // If HEAD fails, try GET
    try {
      const response = await fetch(gnUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
      });
      const finalUrl = response.url;
      if (finalUrl && !finalUrl.includes('google.com')) {
        return finalUrl;
      }
    } catch {}
  }
  
  return null;
}

async function searchWeb(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const snippetResults: SearchResult[] = []; // Separate container for snippet-only results
  
  console.log(`   🔍 Suche: "${query}"`);
  
  try {
    // ══════════════════════════════════════════════════════════════════
    // STEP 1: DuckDuckGo (PRIORITÄT - liefert direkte URLs für Volltext)
    // ══════════════════════════════════════════════════════════════════
    console.log('   📡 DuckDuckGo (direkte URLs)...');
    
    // Multiple search queries for maximum coverage on trending topics
    const ddgQueries = [
      `${query} serie news`,
      `${query} staffel neuigkeiten`,
      `${query} TV series news`,
      `${query} start datum`,
      `${query} cast besetzung`,
      `${query} handlung inhalt`,
      `"${query}" 2025`, // Exact match with year
    ];
    
    for (const ddgQuery of ddgQueries) {
      if (results.length >= 20) break; // Increased limit for trends
      
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(ddgQuery)}`;
      
      const response = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(12000)
      }).catch(() => null);
      
      if (!response?.ok) continue;
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      $('.result, .web-result').each((i, el) => {
        if (results.length >= 25) return; // More results for trends
        
        const $el = $(el);
        const linkEl = $el.find('a.result__a, a.result__url').first();
        let href = linkEl.attr('href') || '';
        const title = $el.find('.result__title, h2').text().trim();
        const snippet = $el.find('.result__snippet').text().trim();
        
        // Decode DuckDuckGo redirect URL
        if (href.includes('uddg=')) {
          const match = href.match(/uddg=([^&]+)/);
          if (match) href = decodeURIComponent(match[1]);
        }
        
        // Filter: Only valid article URLs, no duplicates
        if (href && title && 
            href.startsWith('http') && 
            !href.includes('google.com') &&
            !href.includes('youtube.com') &&
            !href.includes('facebook.com') &&
            !href.includes('twitter.com') &&
            !href.includes('instagram.com') &&
            !href.includes('pinterest.') &&
            !href.includes('reddit.com') &&
            !results.some(r => r.url === href)) {
          results.push({ 
            title, 
            url: href, 
            snippet, 
            source: getSourceName(href)
          });
        }
      });
      
      // Small delay between queries
      await new Promise(r => setTimeout(r, 300));
    }
    
    console.log(`      ✓ ${results.length} direkte URLs gefunden`);
    
    // ══════════════════════════════════════════════════════════════════
    // STEP 2: Google News RSS (nur für Snippets/Fakten als Ergänzung)
    // ══════════════════════════════════════════════════════════════════
    console.log('   📡 Google News (Snippets)...');
    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' serie')}&hl=de&gl=DE&ceid=DE:de`;
    
    const gnResponse = await fetch(googleNewsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      signal: AbortSignal.timeout(10000)
    }).catch(() => null);
    
    if (gnResponse?.ok) {
      const xml = await gnResponse.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      
      $('item').each((i, el) => {
        if (i >= 10) return;
        
        const title = $(el).find('title').text().trim();
        const link = $(el).find('link').text().trim();
        const description = $(el).find('description').text().trim();
        
        const sourceMatch = title.match(/ - ([^-]+)$/);
        const sourceName = sourceMatch ? sourceMatch[1].trim() : 'News';
        
        const cleanDesc = description
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .trim();
        
        if (title && cleanDesc) {
          snippetResults.push({
            title: title.replace(/ - [^-]+$/, '').trim(),
            url: link, // Google News redirect - won't be scraped
            snippet: cleanDesc,
            source: sourceName
          });
        }
      });
      
      console.log(`      ✓ ${snippetResults.length} News-Snippets`);
    }
    
    // Add snippet results at the end (they have lower priority for scraping)
    // but their snippets will still be used for fact extraction
    for (const sr of snippetResults) {
      if (!results.some(r => r.title === sr.title)) {
        results.push(sr);
      }
    }
    
    console.log(`   📰 Gesamt: ${results.length} Quellen`);
    
  } catch (error) {
    console.error('   ❌ Suchfehler:', error instanceof Error ? error.message : error);
  }
  
  return results;
}

// ══════════════════════════════════════════════════════════════════════════
// ARTICLE SCRAPER: Jina AI Reader + Cheerio Fallback
// ══════════════════════════════════════════════════════════════════════════
interface ScrapedArticle {
  title: string;
  content: string;
  url: string;
  source: string;
  wordCount: number;
}

function getSourceName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return KNOWN_SOURCES[hostname] || hostname;
  } catch {
    return 'Web';
  }
}

// Direct cheerio scraper as fallback
async function scrapeWithCheerio(url: string): Promise<ScrapedArticle | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Remove noise
    $('script, style, nav, footer, aside, header, .ad, .advertisement, .sidebar, .comments, .related, .newsletter, [role="navigation"], [role="banner"]').remove();
    
    // Extract title
    const title = $('h1').first().text().trim() || 
                  $('meta[property="og:title"]').attr('content') || 
                  $('title').text().trim();
    
    // Universal content extraction - try multiple selectors
    const contentSelectors = [
      'article p',
      '.article-body p',
      '.entry-content p',
      '.post-content p',
      '.content p',
      'main p',
      '.story-body p',
      '[itemprop="articleBody"] p',
    ];
    
    const paragraphs: string[] = [];
    
    for (const selector of contentSelectors) {
      $(selector).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 40 && !paragraphs.includes(text)) {
          paragraphs.push(text);
        }
      });
      if (paragraphs.length >= 5) break; // Got enough content
    }
    
    const content = paragraphs.join('\n\n');
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    
    if (wordCount < 80) return null;
    
    return {
      title: title || 'Untitled',
      content,
      url,
      source: getSourceName(url),
      wordCount
    };
  } catch {
    return null;
  }
}

async function scrapeArticle(url: string): Promise<ScrapedArticle | null> {
  try {
    // Skip non-http URLs and Google redirect URLs
    if (!url.startsWith('http') || url.includes('google.com/url')) {
      return null;
    }
    
    // Try Jina Reader first (best quality)
    const jinaUrl = `${JINA_READER_URL}${url}`;
    
    const jinaResponse = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(12000)
    }).catch(() => null);
    
    if (jinaResponse?.ok) {
      const markdown = await jinaResponse.text();
      
      // Extract title
      let title = '';
      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        title = titleMatch[1].trim();
      } else {
        const firstLine = markdown.split('\n')[0];
        title = firstLine.replace(/^[#\s]+/, '').trim();
      }
      
      // Clean content
      let content = markdown
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/(\n\s*){3,}/g, '\n\n')
        .trim();
      
      // Remove noise
      const noisePatterns = [
        /^(Menu|Navigation|Search|Advertisement|Subscribe|Newsletter|Follow us|Share|Related|Tags|Categories).*$/gim,
        /^(Copyright|©|All rights reserved).*$/gim,
        /^Read more:.*$/gim,
      ];
      
      for (const pattern of noisePatterns) {
        content = content.replace(pattern, '');
      }
      
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      
      if (wordCount >= 100) {
        return {
          title: title || 'Untitled',
          content,
          url,
          source: getSourceName(url),
          wordCount
        };
      }
    }
    
    // Fallback: Direct cheerio scraping
    console.log(`      ↳ Fallback: Cheerio für ${getSourceName(url)}`);
    return await scrapeWithCheerio(url);
    
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown';
    if (!msg.includes('timeout')) {
      console.log(`      ⚠️ Scrape Fehler: ${msg}`);
    }
    // Try fallback on error
    return await scrapeWithCheerio(url);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// GATHER ALL INFO: Sammelt Infos von mehreren Quellen
// ══════════════════════════════════════════════════════════════════════════
interface GatheredInfo {
  searchTerm: string;
  articles: ScrapedArticle[];
  totalWordCount: number;
  seriesName?: string;
  tmdbData?: any;
}

export async function gatherInfoForTrend(searchTerm: string): Promise<GatheredInfo> {
  console.log('\n' + '─'.repeat(60));
  console.log(`📊 Sammle Infos für: "${searchTerm}"`);
  console.log('─'.repeat(60));
  
  const info: GatheredInfo = {
    searchTerm,
    articles: [],
    totalWordCount: 0
  };
  
  // Step 1: Web Search (DuckDuckGo URLs first, then Google News snippets)
  const searchResults = await searchWeb(searchTerm);
  
  // Step 2: Separate direct URLs from Google News (snippets only)
  const directUrls = searchResults.filter(r => !r.url.includes('news.google.com'));
  const snippetOnlyResults = searchResults.filter(r => r.url.includes('news.google.com'));
  
  console.log(`   📄 Scrape ${directUrls.length} direkte URLs...`);
  
  // Collect all snippets for backup
  const allSnippets: string[] = searchResults
    .filter(r => r.snippet && r.snippet.length > 30)
    .map(r => `[${r.source}] ${r.title}\n${r.snippet}`);
  
  // Step 3: Scrape ALL direct URLs in parallel batches of 4 (more aggressive for trends)
  for (let i = 0; i < Math.min(directUrls.length, 20); i += 4) {
    const batch = directUrls.slice(i, i + 4);
    
    const scraped = await Promise.all(
      batch.map(async (result) => {
        const article = await scrapeArticle(result.url);
        return { result, article };
      })
    );
    
    for (const { result, article } of scraped) {
      if (article && article.wordCount >= 80) { // Lower threshold for trends
        info.articles.push(article);
        info.totalWordCount += article.wordCount;
        console.log(`      ✓ ${article.source}: ${article.wordCount} Wörter`);
      }
    }
    
    // For trends: Don't stop early - scrape ALL available URLs
    // Only stop if we have a LOT of content (3000+ words)
    if (info.totalWordCount >= 3000) {
      console.log(`      ✓ Genug Content (${info.totalWordCount} Wörter)`);
      break;
    }
  }
  
  // Step 4: ALWAYS add snippets for trends (they contain fresh info)
  if (allSnippets.length > 0) {
    console.log('   📋 Kombiniere mit News-Snippets...');
    const allSnippetsText = allSnippets.join('\n\n');
    info.articles.push({
      title: 'Aktuelle News-Zusammenfassung',
      content: allSnippetsText,
      url: '',
      source: 'News Aggregation',
      wordCount: allSnippetsText.split(/\s+/).length
    });
    info.totalWordCount += info.articles[info.articles.length - 1].wordCount;
    console.log(`      ✓ +${info.articles[info.articles.length - 1].wordCount} Wörter aus ${allSnippets.length} Snippets`);
  }
  
  // Step 5: If NO articles could be scraped, use only snippets
  if (info.articles.length === 1 && info.articles[0].source === 'News Aggregation') {
    console.log('   ⚠️ Nur Snippets verfügbar (keine Volltext-Quellen)');
  }
  
  // Step 3: Try to resolve TMDB series with direct API call
  console.log('   🎬 Suche TMDB Serie...');
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (apiKey) {
      // Strategy 1: Search for known series keywords in the search term
      const seriesKeywords = ['tatort', 'polizeiruf', 'krimi', 'serie', 'show'];
      let seriesName = '';
      
      for (const keyword of seriesKeywords) {
        if (searchTerm.toLowerCase().includes(keyword)) {
          seriesName = keyword;
          break;
        }
      }
      
      // Strategy 2: Extract series name (remove person names, staffel numbers)
      if (!seriesName) {
        seriesName = searchTerm
          .replace(/staffel\s*\d+/gi, '')
          .replace(/season\s*\d+/gi, '')
          .replace(/netflix|prime|disney|amazon|hbo|sky|ard|zdf/gi, '')
          .trim();
      }
      
      // Strategy 3: Try multiple searches
      const searchTerms = [
        seriesName,
        searchTerm.split(' ').slice(-1)[0], // Last word (often the series name)
        searchTerm.replace(/\s+/g, ' ').trim()
      ].filter(t => t.length > 2);
      
      for (const term of searchTerms) {
        const tmdbUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(term)}&language=de-DE`;
        const response = await fetch(tmdbUrl);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          const series = data.results[0];
          info.seriesName = series.name;
          info.tmdbData = {
            tmdbId: series.id,
            name: series.name,
            overview: series.overview,
            posterPath: series.poster_path,
            backdropPath: series.backdrop_path,
            firstAirDate: series.first_air_date,
            voteAverage: series.vote_average,
          };
          console.log(`      ✓ TMDB: ${info.seriesName} (ID: ${series.id})`);
          break;
        }
      }
    }
  } catch (error) {
    console.log('      ⚠️ TMDB Suche fehlgeschlagen:', error instanceof Error ? error.message : '');
  }
  
  console.log(`   📊 Gesamt: ${info.articles.length} Quellen, ${info.totalWordCount} Wörter`);
  
  return info;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PIPELINE: Generiert Artikel aus gesammelten Infos
// ══════════════════════════════════════════════════════════════════════════
export interface TrendArticleResult {
  success: boolean;
  articleId?: string;
  slug?: string;
  title?: string;
  trendId: string;
  error?: string;
}

export async function runP3TrendsPipeline(
  trendId: string,
  searchTerm: string,
  trigger: TriggerType = 'manual'
): Promise<TrendArticleResult> {
  console.log('\n' + '═'.repeat(70));
  console.log('🔥 P3-TRENDS PIPELINE');
  console.log('═'.repeat(70));
  console.log(`📌 Trend: "${searchTerm}"`);
  console.log(`🆔 Trend-ID: ${trendId}\n`);
  
  // Initialize pipeline logger
  const logger = new PipelineLogger('p3-trends', trigger);
  await logger.start({
    inputQuery: searchTerm,
    inputSource: `trend-${trendId}`,
  });
  
  logger.log(`Trend: "${searchTerm}"`);
  logger.addMetadata('trendId', trendId);
  
  const now = new Date();
  
  try {
    // ========== STEP 1: GATHER INFO ==========
    logger.log('Schritt 1: Sammle Informationen...');
    const info = await gatherInfoForTrend(searchTerm);
    
    if (info.articles.length === 0) {
      console.log('❌ Keine Artikel gefunden - überspringe');
      await logger.fail('Keine Quellen gefunden', 'gather-info');
      return { success: false, trendId, error: 'Keine Quellen gefunden' };
    }
    
    if (info.totalWordCount < 100) {
      console.log('❌ Zu wenig Content - überspringe');
      await logger.fail('Zu wenig Quellmaterial', 'gather-info');
      return { success: false, trendId, error: 'Zu wenig Quellmaterial' };
    }
    
    logger.log(`${info.articles.length} Quellen gefunden (${info.totalWordCount} Wörter)`);
    await logger.update({ 
      sourcesFound: info.articles.length, 
      wordsCollected: info.totalWordCount 
    });
    
    // ========== STEP 2: RESOLVE SERIES ==========
    console.log('\n' + '━'.repeat(60));
    console.log('STEP 2: SERIE AUFLÖSEN');
    console.log('━'.repeat(60));
    
    let dbSeries = null;
    
    if (info.tmdbData) {
      // Check if series exists in DB
      dbSeries = await prisma.series.findFirst({
        where: { tmdbId: info.tmdbData.tmdbId }
      });
      
      if (!dbSeries) {
        // Create series
        console.log('   📺 Erstelle neue Serie...');
        dbSeries = await prisma.series.create({
          data: {
            tmdbId: info.tmdbData.tmdbId,
            name: info.tmdbData.name,
            title: info.tmdbData.name,
            slug: generateSeriesSlug(info.tmdbData.name, info.tmdbData.tmdbId),
            posterPath: info.tmdbData.posterPath,
            backdropPath: info.tmdbData.backdropPath,
            overview: info.tmdbData.overview || '',
            status: info.tmdbData.status || 'Unknown',
            firstAirDate: info.tmdbData.firstAirDate ? new Date(info.tmdbData.firstAirDate) : null,
            updatedAt: now,
          }
        });
        console.log(`   ✓ Serie erstellt: ${dbSeries.name}`);
        
        // Import characters and cast in parallel
        try {
          await Promise.all([
            importSeriesCharacters(info.tmdbData.tmdbId),
            importSeriesCast(info.tmdbData.tmdbId)
          ]);
        } catch (e) {
          console.log('   ⚠️ Character/Cast Import fehlgeschlagen');
        }
      } else {
        console.log(`   ✓ Serie existiert: ${dbSeries.name}`);
      }
    }
    
    // ========== STEP 3: GENERATE CONTENT ==========
    console.log('\n' + '━'.repeat(60));
    console.log('STEP 3: CONTENT GENERIEREN');
    console.log('━'.repeat(60));
    
    // Combine all source texts
    const combinedSourceText = info.articles
      .map(a => `[Quelle: ${a.source}]\n${a.content}`)
      .join('\n\n---\n\n');
    
    // Step 3a: Extract facts from source text
    console.log('   📊 Extrahiere Fakten...');
    logger.log('Extrahiere Fakten aus Quellen...');
    const facts = await extractFacts(searchTerm, combinedSourceText || 'Keine Details verfügbar');
    const factCount = facts.key_statements?.length || 0;
    console.log(`   ✓ Fakten: ${factCount} Statements`);
    logger.log(`${factCount} Fakten extrahiert`);
    await logger.update({ factsExtracted: factCount });
    
    // Step 3b: Classify content type
    let contentType: 'NEWS' | 'ENDING_EXPLAINED' | 'RANKING' = 'NEWS';
    if (searchTerm.toLowerCase().includes('staffel') || searchTerm.toLowerCase().includes('season')) {
      contentType = 'NEWS';
    } else if (searchTerm.toLowerCase().includes('erklär') || searchTerm.toLowerCase().includes('ende')) {
      contentType = 'ENDING_EXPLAINED';
    } else if (searchTerm.toLowerCase().includes('beste') || searchTerm.toLowerCase().includes('top')) {
      contentType = 'RANKING';
    }
    console.log(`   ✓ Content-Typ: ${contentType}`);
    logger.addMetadata('contentType', contentType);
    
    // Step 3c: Generate structured content
    console.log('   🤖 Generiere Artikel via LLM...');
    logger.log('LLM Content-Generierung gestartet');
    
    const structuredContent = await generateStructuredContent({
      facts,
      seriesName: info.seriesName || searchTerm,
      originalHeadline: searchTerm,
      sourceText: combinedSourceText || searchTerm,
      contentType: contentType,
      wordCountTarget: 800, // Ausführlicher Artikel
    });
    
    if (!structuredContent || !structuredContent.markdown) {
      console.log('❌ Content-Generierung fehlgeschlagen');
      await logger.fail('LLM konnte keinen Content generieren', 'llm-generation');
      return { success: false, trendId, error: 'LLM Fehler' };
    }
    
    logger.log(`Headline: ${structuredContent.headline}`);
    
    console.log(`   ✓ Headline: ${structuredContent.headline}`);
    console.log(`   ✓ Sections: ${structuredContent.sections?.length || 0}`);
    console.log(`   ✓ Q&A: ${structuredContent.qa?.length || 0}`);
    
    // ========== STEP 4: LINK CHARACTERS & CAST ==========
    console.log('\n' + '━'.repeat(60));
    console.log('STEP 4: CHARACTER & CAST LINKING');
    console.log('━'.repeat(60));
    
    let processedMarkdown = structuredContent.markdown;
    
    if (dbSeries) {
      try {
        // Character linking - returns { linkedMarkdown, charactersLinked }
        const charResult = await linkCharactersInMarkdown(
          processedMarkdown,
          dbSeries.tmdbId
        );
        processedMarkdown = charResult.linkedMarkdown;
        console.log(`   ✓ ${charResult.charactersLinked} Characters verlinkt`);
        
        // Cast linking - returns { linkedMarkdown, castLinked }
        const castResult = await linkCastInMarkdown(
          processedMarkdown,
          dbSeries.tmdbId
        );
        processedMarkdown = castResult.linkedMarkdown;
        console.log(`   ✓ ${castResult.castLinked} Cast verlinkt`);
      } catch (e) {
        console.log('   ⚠️ Linking fehlgeschlagen:', e instanceof Error ? e.message : '');
      }
    }
    
    // Link streamers - returns { linkedMarkdown, streamersLinked }
    const streamerResult = linkStreamersInMarkdown(processedMarkdown);
    processedMarkdown = streamerResult.linkedMarkdown;
    if (streamerResult.streamersLinked.length > 0) {
      console.log(`   ✓ Streamer verlinkt: ${streamerResult.streamersLinked.join(', ')}`);
    }
    
    // ========== STEP 5: INTERNAL LINKS ==========
    // Note: Internal linking requires article ID and full config - skip for now
    // The article will get internal links on next page view via middleware
    
    // ========== STEP 6: CONVERT TO HTML ==========
    console.log('\n' + '━'.repeat(60));
    console.log('STEP 6: HTML KONVERTIERUNG');
    console.log('━'.repeat(60));
    
    // Ensure processedMarkdown is a string
    let markdownString = typeof processedMarkdown === 'string' 
      ? processedMarkdown 
      : (structuredContent.markdown || '');
    
    let htmlContent = markdownToHtml(markdownString);
    console.log(`   ✓ HTML: ${htmlContent.length} Zeichen`);
    
    // ========== STEP 7: QUALITY GATES (like v2) ==========
    console.log('\n' + '━'.repeat(60));
    console.log('STEP 7: QUALITY GATES');
    console.log('━'.repeat(60));
    
    let antiAiScore = 0;
    
    // Quality Check
    try {
      const qualityResult = await qualityCheck({
        generatedArticleHtml: markdownString,
        originalHeadline: searchTerm,
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
        seriesName: info.seriesName || searchTerm,
      });
      antiAiScore = antiAiResult.antiAiScore;
      console.log(`   📊 Anti-AI Score: ${antiAiScore}/100 (${antiAiResult.status})`);
      logger.log(`Anti-AI Score: ${antiAiScore}/100 (${antiAiResult.status})`);
      await logger.update({ antiAiScore });
      
      if (antiAiResult.failReasons.length > 0) {
        console.log(`   Hinweise: ${antiAiResult.failReasons.slice(0, 2).join(', ')}`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ Anti-AI check skipped: ${error.message}`);
    }
    
    // Fact Safety Check
    try {
      const factSafetyResult = await factSafetyCheck({
        articleHtml: markdownString,
        headline: structuredContent.headline,
        extractedFacts: JSON.stringify(facts),
      });
      console.log(`   ✅ Fact safety: ${factSafetyResult.status === 'SAFE' ? 'Passed' : 'Warnings'}`);
    } catch (error: any) {
      console.log(`   ⚠️ Fact safety skipped: ${error.message}`);
    }
    
    // ========== STEP 7.5: INTERNAL LINKING (like v2) ==========
    console.log('\n' + '━'.repeat(60));
    console.log('STEP 7.5: INTERNAL LINKING');
    console.log('━'.repeat(60));
    
    const articleId = `trend-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      const internalLinksResult = await generateInternalLinks({
        articleId,
        contentHtml: htmlContent,
        primarySeriesId: dbSeries?.tmdbId || info.tmdbData?.tmdbId || null,
        primarySeriesName: dbSeries?.name || dbSeries?.title || info.seriesName || '',
        primarySeriesSlug: dbSeries?.slug || '',
        publishedAt: null,
      });
      
      htmlContent = internalLinksResult.updatedContentHtml;
      
      console.log(`   ✅ Internal Links:`);
      console.log(`      Hub Link: ${internalLinksResult.hubLink ? 'Yes' : 'No'}`);
      console.log(`      Related Articles: ${internalLinksResult.relatedArticles.length}`);
      
      // Validate links
      const linkValidation = validateInternalLinks(htmlContent, dbSeries?.name || info.seriesName || '');
      if (!linkValidation.valid) {
        console.log(`   ⚠️ Link Validation Warnings`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ Internal linking skipped: ${error.message}`);
    }
    
    // ========== STEP 8: SAVE ARTICLE ==========
    console.log('\n' + '━'.repeat(60));
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
      await logger.partial({
        articleId: existing.id,
        articleSlug: existing.slug,
        articleTitle: existing.title,
        errorMessage: 'Artikel existiert bereits'
      });
      return { 
        success: true, 
        trendId, 
        articleId: existing.id, 
        slug: existing.slug,
        title: existing.title
      };
    }
    
    // articleId already defined in Step 7.5 for internal linking
    
    // Generate unique source URL to avoid unique constraint
    const uniqueSourceUrl = info.articles[0]?.url 
      ? `${info.articles[0].url}#trend-${Date.now()}`
      : `https://serien.de/trending/${slug}`;
    
    const article = await prisma.articles.create({
      data: {
        id: articleId,
        title: structuredContent.headline,
        slug,
        excerpt: structuredContent.metaDescription,
        contentHtml: htmlContent,
        metaDescription: structuredContent.metaDescription,
        category: 'trending',
        status: 'published',
        authorId: getRandomAuthor(),
        sourceUrl: uniqueSourceUrl,
        // Series connection - use DB id (not tmdbId) for foreign key
        primarySeriesId: dbSeries?.id || null,
        tmdbId: dbSeries?.tmdbId || info.tmdbData?.tmdbId || null,
        heroImageUrl: dbSeries?.backdropPath 
          ? `https://image.tmdb.org/t/p/w1280${dbSeries.backdropPath}`
          : info.tmdbData?.backdropPath
            ? `https://image.tmdb.org/t/p/w1280${info.tmdbData.backdropPath}`
            : null,
        isTrending: true,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      }
    });
    
    console.log(`   ✓ Artikel gespeichert: ${article.slug}`);
    
    // ========== STEP 9: TRAILER DOWNLOAD ==========
    console.log('\n' + '━'.repeat(60));
    console.log('STEP 9: TRAILER DOWNLOAD');
    console.log('━'.repeat(60));
    
    if (dbSeries) {
      try {
        // Fetch series with trailers from DB using tmdbId
        const seriesWithTrailers = await prisma.series.findUnique({
          where: { tmdbId: dbSeries.tmdbId },
          select: { tmdbId: true, name: true, title: true, trailers: true }
        });
        
        if (seriesWithTrailers) {
          // Try to get trailer ID from TMDB trailers
          const trailerId = findTrailerYouTubeId(seriesWithTrailers.trailers);
          
          if (trailerId) {
            console.log(`   🎬 TMDB Trailer gefunden: ${trailerId}`);
            const downloadResult = await downloadYouTubeTrailer(
              trailerId,
              seriesWithTrailers.name || seriesWithTrailers.title || searchTerm
            );
            
            if (downloadResult.success && downloadResult.localPath) {
              await prisma.articles.update({
                where: { id: article.id },
                data: { heroVideoUrl: downloadResult.localPath }
              });
              console.log(`   ✅ Trailer heruntergeladen: ${downloadResult.localPath}`);
            } else {
              console.log(`   ⚠️ Trailer-Download fehlgeschlagen: ${downloadResult.error}`);
            }
          } else {
            // No TMDB trailer - search YouTube
            console.log(`   ℹ️ Kein TMDB-Trailer, suche auf YouTube...`);
            const seriesName = seriesWithTrailers.name || seriesWithTrailers.title || searchTerm;
            
            try {
              const youtubeId = await searchYouTubeTrailer(seriesName);
              
              if (youtubeId) {
                console.log(`   🔍 YouTube-Trailer gefunden: ${youtubeId}`);
                const downloadResult = await downloadYouTubeTrailer(youtubeId, seriesName);
                
                if (downloadResult.success && downloadResult.localPath) {
                  await prisma.articles.update({
                    where: { id: article.id },
                    data: { heroVideoUrl: downloadResult.localPath }
                  });
                  console.log(`   ✅ YouTube-Trailer gespeichert`);
                } else {
                  // Fallback: Save YouTube URL directly
                  const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
                  await prisma.articles.update({
                    where: { id: article.id },
                    data: { heroVideoUrl: youtubeUrl }
                  });
                  console.log(`   ✅ YouTube-URL gespeichert (kein Download)`);
                }
              } else {
                console.log(`   ⚠️ Kein Trailer gefunden für "${seriesName}"`);
              }
            } catch (searchError: any) {
              console.log(`   ⚠️ YouTube-Suche fehlgeschlagen: ${searchError.message}`);
            }
          }
        }
      } catch (trailerError: any) {
        console.log(`   ❌ Trailer-Verarbeitung fehlgeschlagen: ${trailerError.message}`);
      }
    } else {
      console.log(`   ℹ️ Keine Serie gefunden - überspringe Trailer`);
    }
    
    // ========== STEP 10: UPDATE TREND ==========
    // Only update if this is a real trend from the database
    if (!trendId.startsWith('manual-')) {
      try {
        await prisma.trending_topics.update({
          where: { id: trendId },
          data: {
            processed: true,
            articleId: article.id,
            processedAt: now
          }
        });
      } catch (e) {
        console.log('   ⚠️ Trend-Update übersprungen (nicht in DB)');
      }
    }
    
    console.log('\n' + '═'.repeat(70));
    console.log('✅ P3-TRENDS PIPELINE ERFOLGREICH');
    console.log('═'.repeat(70));
    console.log(`📰 Artikel: ${article.title}`);
    console.log(`🔗 URL: /${article.slug}`);
    console.log('═'.repeat(70) + '\n');
    
    logger.log(`Artikel gespeichert: ${article.slug}`);
    await logger.success({
      articleId: article.id,
      articleSlug: article.slug,
      articleTitle: article.title,
    });
    
    return {
      success: true,
      trendId,
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
      trendId, 
      error: errorMessage 
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PROCESS ALL UNPROCESSED TRENDS
// ══════════════════════════════════════════════════════════════════════════
export async function processAllTrends(): Promise<TrendArticleResult[]> {
  console.log('\n🔥 Verarbeite alle unverarbeiteten Trends...\n');
  
  const unprocessedTrends = await prisma.trending_topics.findMany({
    where: { processed: false },
    orderBy: { date: 'desc' },
    take: 5 // Max 5 at a time
  });
  
  if (unprocessedTrends.length === 0) {
    console.log('Keine unverarbeiteten Trends gefunden.');
    return [];
  }
  
  console.log(`📊 ${unprocessedTrends.length} Trends zu verarbeiten\n`);
  
  const results: TrendArticleResult[] = [];
  
  for (const trend of unprocessedTrends) {
    const result = await runP3TrendsPipeline(trend.id, trend.query);
    results.push(result);
    
    // Delay between articles
    await new Promise(r => setTimeout(r, 2000));
  }
  
  return results;
}

// ══════════════════════════════════════════════════════════════════════════
// CLI EXECUTION
// ══════════════════════════════════════════════════════════════════════════
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // Process specific search term
    const searchTerm = args.join(' ');
    runP3TrendsPipeline('manual-' + Date.now(), searchTerm)
      .then(result => {
        console.log('\nErgebnis:', JSON.stringify(result, null, 2));
        process.exit(result.success ? 0 : 1);
      })
      .catch(err => {
        console.error(err);
        process.exit(1);
      })
      .finally(() => prisma.$disconnect());
  } else {
    // Process all unprocessed trends
    processAllTrends()
      .then(results => {
        console.log('\n📊 Zusammenfassung:');
        console.log(`   Erfolgreich: ${results.filter(r => r.success).length}`);
        console.log(`   Fehlgeschlagen: ${results.filter(r => !r.success).length}`);
        process.exit(0);
      })
      .catch(err => {
        console.error(err);
        process.exit(1);
      })
      .finally(() => prisma.$disconnect());
  }
}
