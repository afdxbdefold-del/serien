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
import { generateInternalLinks } from '../lib/internal-linking-engine';
import { generateSeriesSlug } from '../lib/slug-utils';
import { extractFacts } from '../lib/fact-extractor';
import { antiAiFilter } from '../lib/anti-ai-filter';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════════════════════
// NEWS SOURCES - Bekannte Serien-News-Seiten
// ══════════════════════════════════════════════════════════════════════════
const NEWS_SOURCES = [
  { 
    domain: 'screenrant.com',
    name: 'Screen Rant',
    selectors: {
      title: 'h1',
      content: '.article-body p, .content-block p',
      date: 'time'
    }
  },
  { 
    domain: 'collider.com',
    name: 'Collider',
    selectors: {
      title: 'h1',
      content: '.article-body p, .content p',
      date: 'time'
    }
  },
  { 
    domain: 'tvline.com',
    name: 'TVLine',
    selectors: {
      title: 'h1',
      content: '.entry-content p, article p',
      date: 'time'
    }
  },
  {
    domain: 'deadline.com',
    name: 'Deadline',
    selectors: {
      title: 'h1',
      content: '.entry-content p, .post-content p',
      date: 'time'
    }
  },
  {
    domain: 'variety.com',
    name: 'Variety',
    selectors: {
      title: 'h1',
      content: '.c-content p, article p',
      date: 'time'
    }
  },
  {
    domain: 'ew.com',
    name: 'Entertainment Weekly',
    selectors: {
      title: 'h1',
      content: '.article-body-content p, .content p',
      date: 'time'
    }
  }
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
${markdown.substring(0, 3000)}

Schreibe den Text um, behebe die Probleme. Antworte NUR mit dem verbesserten Markdown:`;

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.EMERGENT_LLM_KEY,
      baseURL: 'http://localhost:8002/v1',
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
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
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

// ══════════════════════════════════════════════════════════════════════════
// WEB SEARCH: DuckDuckGo HTML
// ══════════════════════════════════════════════════════════════════════════
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

async function searchWeb(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  
  console.log(`   🔍 Suche: "${query}"`);
  
  try {
    // Method 1: Google News RSS (most reliable)
    console.log('   📡 Google News RSS...');
    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' serie')}&hl=de&gl=DE&ceid=DE:de`;
    
    let response = await fetch(googleNewsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      signal: AbortSignal.timeout(15000)
    }).catch(() => null);
    
    if (response?.ok) {
      const xml = await response.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      
      $('item').each((i, el) => {
        if (i >= 10) return;
        const title = $(el).find('title').text().trim();
        const link = $(el).find('link').text().trim();
        const description = $(el).find('description').text().trim();
        const pubDate = $(el).find('pubDate').text().trim();
        
        // Extract source from title (usually format: "Title - Source")
        const sourceMatch = title.match(/ - ([^-]+)$/);
        const sourceName = sourceMatch ? sourceMatch[1].trim() : 'News';
        
        // Clean description (remove HTML tags)
        const cleanDesc = description
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .trim();
        
        if (title && link) {
          results.push({
            title: title.replace(/ - [^-]+$/, '').trim(), // Remove source from title
            url: link,
            snippet: cleanDesc || `Veröffentlicht: ${pubDate}`,
            source: sourceName
          });
        }
      });
      
      console.log(`      ✓ ${results.length} News gefunden`);
    }
    
    // Method 2: DuckDuckGo (if Google News fails)
    if (results.length === 0) {
      console.log('   📡 DuckDuckGo...');
      const sourceDomains = NEWS_SOURCES.map(s => `site:${s.domain}`).join(' OR ');
      const searchQuery = `${query} serie (${sourceDomains})`;
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
      
      response = await fetch(ddgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(15000)
      }).catch(() => null);
      
      if (response?.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        
        $('.result, .web-result').each((i, el) => {
          if (i >= 10) return;
          
          const $el = $(el);
          const linkEl = $el.find('a.result__a, a.result__url').first();
          let href = linkEl.attr('href') || '';
          const title = $el.find('.result__title, h2').text().trim();
          const snippet = $el.find('.result__snippet').text().trim();
          
          if (href.includes('uddg=')) {
            const match = href.match(/uddg=([^&]+)/);
            if (match) href = decodeURIComponent(match[1]);
          }
          
          const source = NEWS_SOURCES.find(s => href.includes(s.domain));
          
          if (href && title) {
            results.push({ 
              title, 
              url: href, 
              snippet, 
              source: source?.name || 'Web' 
            });
          }
        });
        
        console.log(`      ✓ ${results.length} Ergebnisse`);
      }
    }
    
    console.log(`   📰 ${results.length} News-Quellen gefunden`);
    
  } catch (error) {
    console.error('   ❌ Suchfehler:', error instanceof Error ? error.message : error);
  }
  
  return results;
}

// ══════════════════════════════════════════════════════════════════════════
// ARTICLE SCRAPER: Extrahiert Volltext von News-Seite
// ══════════════════════════════════════════════════════════════════════════
interface ScrapedArticle {
  title: string;
  content: string;
  url: string;
  source: string;
  wordCount: number;
}

async function scrapeArticle(url: string): Promise<ScrapedArticle | null> {
  try {
    const source = NEWS_SOURCES.find(s => url.includes(s.domain));
    if (!source) return null;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, nav, footer, aside, .ad, .advertisement, .related-articles, .comments').remove();
    
    // Extract title
    const title = $(source.selectors.title).first().text().trim();
    
    // Extract content paragraphs
    const paragraphs: string[] = [];
    $(source.selectors.content).each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50) { // Skip short paragraphs
        paragraphs.push(text);
      }
    });
    
    const content = paragraphs.join('\n\n');
    const wordCount = content.split(/\s+/).length;
    
    if (wordCount < 100) return null;
    
    return {
      title,
      content,
      url,
      source: source.name,
      wordCount
    };
    
  } catch (error) {
    return null;
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

async function gatherInfoForTrend(searchTerm: string): Promise<GatheredInfo> {
  console.log('\n' + '─'.repeat(60));
  console.log(`📊 Sammle Infos für: "${searchTerm}"`);
  console.log('─'.repeat(60));
  
  const info: GatheredInfo = {
    searchTerm,
    articles: [],
    totalWordCount: 0
  };
  
  // Step 1: Web Search
  const searchResults = await searchWeb(searchTerm);
  
  // Step 2: Try to scrape articles, but also collect snippets as backup
  console.log('   📄 Scrape Artikel...');
  const snippetContent: string[] = [];
  
  for (const result of searchResults.slice(0, 8)) {
    // Always save the snippet
    if (result.snippet && result.snippet.length > 20) {
      snippetContent.push(`${result.title}\n${result.snippet}`);
    }
    
    // Try to scrape the full article
    const article = await scrapeArticle(result.url);
    if (article) {
      info.articles.push(article);
      info.totalWordCount += article.wordCount;
      console.log(`      ✓ ${article.source}: ${article.wordCount} Wörter`);
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  // If no articles could be scraped, use snippets as content
  if (info.articles.length === 0 && snippetContent.length > 0) {
    console.log('   📋 Verwende News-Snippets als Quelle...');
    const combinedSnippets = snippetContent.join('\n\n');
    info.articles.push({
      title: searchTerm,
      content: combinedSnippets,
      url: searchResults[0]?.url || '',
      source: 'Google News',
      wordCount: combinedSnippets.split(/\s+/).length
    });
    info.totalWordCount = info.articles[0].wordCount;
    console.log(`      ✓ ${info.totalWordCount} Wörter aus ${snippetContent.length} Snippets`);
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
  searchTerm: string
): Promise<TrendArticleResult> {
  console.log('\n' + '═'.repeat(70));
  console.log('🔥 P3-TRENDS PIPELINE');
  console.log('═'.repeat(70));
  console.log(`📌 Trend: "${searchTerm}"`);
  console.log(`🆔 Trend-ID: ${trendId}\n`);
  
  const now = new Date();
  
  try {
    // ========== STEP 1: GATHER INFO ==========
    const info = await gatherInfoForTrend(searchTerm);
    
    if (info.articles.length === 0) {
      console.log('❌ Keine Artikel gefunden - überspringe');
      return { success: false, trendId, error: 'Keine Quellen gefunden' };
    }
    
    if (info.totalWordCount < 100) {
      console.log('❌ Zu wenig Content - überspringe');
      return { success: false, trendId, error: 'Zu wenig Quellmaterial' };
    }
    
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
    const facts = await extractFacts(searchTerm, combinedSourceText || 'Keine Details verfügbar');
    console.log(`   ✓ Fakten: ${facts.key_statements?.length || 0} Statements`);
    
    // Step 3b: Classify content type (use simple classification since we don't have URL)
    let contentType = 'NEWS';
    if (searchTerm.toLowerCase().includes('staffel') || searchTerm.toLowerCase().includes('season')) {
      contentType = 'NEWS';
    } else if (searchTerm.toLowerCase().includes('erklär') || searchTerm.toLowerCase().includes('ende')) {
      contentType = 'ANALYSIS';
    }
    console.log(`   ✓ Content-Typ: ${contentType}`);
    
    // Step 3c: Generate structured content
    console.log('   🤖 Generiere Artikel via LLM...');
    
    const structuredContent = await generateStructuredContent({
      facts,
      seriesName: info.seriesName || searchTerm,
      originalHeadline: searchTerm,
      sourceText: combinedSourceText || searchTerm,
      contentType: contentType === 'SKIP' ? 'NEWS' : contentType,
      wordCountTarget: 800, // Ausführlicher Artikel
    });
    
    if (!structuredContent || !structuredContent.markdown) {
      console.log('❌ Content-Generierung fehlgeschlagen');
      return { success: false, trendId, error: 'LLM Fehler' };
    }
    
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
        const { markdown: charLinked } = await linkCharactersInMarkdown(
          processedMarkdown,
          dbSeries.tmdbId,
          { maxLinks: 5, skipHeadings: true }
        );
        processedMarkdown = charLinked;
        
        const { markdown: castLinked } = await linkCastInMarkdown(
          processedMarkdown,
          dbSeries.tmdbId,
          { maxLinks: 5, skipHeadings: true }
        );
        processedMarkdown = castLinked;
        
        console.log('   ✓ Character & Cast verlinkt');
      } catch (e) {
        console.log('   ⚠️ Linking fehlgeschlagen');
      }
    }
    
    // Link streamers
    processedMarkdown = linkStreamersInMarkdown(processedMarkdown);
    
    // ========== STEP 5: INTERNAL LINKS ==========
    if (dbSeries) {
      try {
        const { markdown: internalLinked } = await generateInternalLinks(processedMarkdown, {
          primarySeriesSlug: dbSeries.slug || undefined,
          maxLinks: 8
        });
        processedMarkdown = internalLinked;
        console.log('   ✓ Interne Links hinzugefügt');
      } catch (e) {
        console.log('   ⚠️ Internal Linking fehlgeschlagen');
      }
    }
    
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
    
    // ========== STEP 7: ANTI-AI FILTER (Check only) ==========
    console.log('\n' + '━'.repeat(60));
    console.log('STEP 7: ANTI-AI CHECK');
    console.log('━'.repeat(60));
    
    const antiAiResult = await antiAiFilter({
      articleHtml: htmlContent,
      headline: structuredContent.headline,
      seriesName: info.seriesName || searchTerm,
    });
    
    console.log(`   📊 Anti-AI Score: ${antiAiResult.antiAiScore}/100`);
    console.log(`   ${antiAiResult.status === 'PASS' ? '✅' : '⚠️'} Status: ${antiAiResult.status}`);
    
    if (antiAiResult.failReasons.length > 0) {
      console.log(`   Hinweise: ${antiAiResult.failReasons.slice(0, 2).join(', ')}`);
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
      return { 
        success: true, 
        trendId, 
        articleId: existing.id, 
        slug: existing.slug,
        title: existing.title
      };
    }
    
    const articleId = `trend-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
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
        // Series connection - only set if we found a valid series
        primarySeriesId: dbSeries?.tmdbId || info.tmdbData?.tmdbId || null,
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
    
    // ========== STEP 9: UPDATE TREND ==========
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
    
    return {
      success: true,
      trendId,
      articleId: article.id,
      slug: article.slug,
      title: article.title
    };
    
  } catch (error) {
    console.error('❌ Pipeline Fehler:', error);
    return { 
      success: false, 
      trendId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
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
