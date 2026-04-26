/**
 * Valnet TV News Scraper (ScreenRant + Collider)
 * 
 * Scrapes TV news from Valnet-powered sites (same HTML structure)
 * Works on Vercel and other serverless platforms
 */

import { load, type Cheerio, type Element } from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { runPipelineV2 } from './pipeline-v2';

const prisma = new PrismaClient();

// Supported news sources
export const NEWS_SOURCES = {
  screenrant: {
    name: 'ScreenRant',
    url: 'https://screenrant.com/tv-news/',
    domain: 'screenrant.com',
    type: 'valnet',
  },
  collider: {
    name: 'Collider',
    url: 'https://collider.com/tv-news/',
    domain: 'collider.com',
    type: 'valnet',
  },
  cinemaholic: {
    name: 'Cinemaholic',
    url: 'https://thecinemaholic.com/',
    domain: 'thecinemaholic.com',
    type: 'wordpress',
  },
  deadline: {
    name: 'Deadline TV',
    url: 'https://deadline.com/v/tv/feed/',
    domain: 'deadline.com',
    type: 'rss',
  },
  variety: {
    name: 'Variety TV',
    url: 'https://variety.com/v/tv/feed/',
    domain: 'variety.com',
    type: 'rss',
  },
  hollywoodreporter: {
    name: 'Hollywood Reporter TV',
    url: 'https://www.hollywoodreporter.com/c/tv/feed/',
    domain: 'hollywoodreporter.com',
    type: 'rss',
  },
  tvinsider: {
    name: 'TVInsider',
    url: 'https://www.tvinsider.com/feed/',
    domain: 'tvinsider.com',
    type: 'rss',
  },
} as const;

type SourceKey = keyof typeof NEWS_SOURCES;

interface NewsArticle {
  title: string;
  url: string;
  timeAgo: string;
  source: string;
  series?: string;
}

// Keywords to filter relevant articles (German market focus)
const RELEVANT_KEYWORDS = [
  'netflix', 'prime', 'disney', 'hbo', 'max', 'apple tv',
  'amazon', 'paramount', 'peacock', 'hulu',
  'season', 'episode', 'finale', 'premiere', 'renewed', 'cancelled', 'canceled',
  'cast', 'trailer', 'release date', 'first look', 'ending',
  'the pitt', 'last of us', 'stranger things', 'wednesday', 'squid game',
  'house of the dragon', 'rings of power', 'andor', 'mandalorian',
  'daredevil', 'marvel', 'star wars', 'game of thrones',
  'invincible', 'boys', 'yellowstone', 'severance', 'white lotus',
  'bridgerton', 'you', 'cobra kai', 'outer banks', 'elite',
  'money heist', 'dark', 'babylon berlin', '1899', 'tribes of europa',
  'one piece', 'avatar', 'the witcher', 'arcane', 'fallout',
  'shogun', 'slow horses', 'true detective', 'fargo', 'the bear',
  'abbott elementary', 'what we do in the shadows', 'reservation dogs',
  'for all mankind', 'foundation', 'silo', 'pachinko', 'ted lasso'
];

// Keywords to SKIP (not relevant for German streaming audience)
const SKIP_KEYWORDS = [
  'box office', 'theater', 'theatre', 'cinema', 'oscars', 'academy',
  'emmy', 'golden globe', 'interview', 'behind the scenes',
  'real housewives', 'bachelor', 'bachelorette', 'survivor', 'big brother',
  'american idol', 'the voice', 'dancing with the stars',
  'late night', 'talk show', 'snl', 'saturday night live',
  'news anchor', 'cable news', 'fox news', 'cnn', 'msnbc',
  // Skip movies - only series!
  'movie', 'film', 'mcu movie', 'dceu', 'box office',
  'theatrical', 'in theaters', 'coming to theaters'
];

/**
 * Check if article is less than 2 hours old based on timeAgo string
 */
function isWithin6Hours(timeAgo: string): boolean {
  if (!timeAgo) return false;
  
  const timeLower = timeAgo.toLowerCase().trim();
  
  // "X hours ago" - include if ≤ 12 hours (allows catch-up after outages/US nighttime)
  const hoursMatch = timeLower.match(/(\d+)\s*(?:hour|hr|h)/);
  if (hoursMatch) {
    return parseInt(hoursMatch[1]) <= 12;
  }
  
  // "X minutes ago" - always include
  if (timeLower.includes('minute') || timeLower.includes('min')) {
    return true;
  }
  
  // "just now", "now" - always include
  if (timeLower.includes('just') || timeLower === 'now') {
    return true;
  }
  
  // "X days ago" - never include (too old)
  if (timeLower.match(/(\d+)\s*day/)) {
    return false;
  }
  
  // "yesterday" - never include (too old)
  if (timeLower.includes('yesterday')) {
    return false;
  }
  
  // Anything with "week", "month", "year" - skip
  if (timeLower.includes('week') || timeLower.includes('month') || timeLower.includes('year')) {
    return false;
  }
  
  return false;
}

import { blockReasonForSource } from '../lib/series-blocklist';

async function isRelevantArticle(article: NewsArticle): Promise<boolean> {
  const titleLower = article.title.toLowerCase();

  // BLOCKLIST: skip globally-blocked series/topics
  if (await blockReasonForSource(article.title, article.url)) {
    return false;
  }
  
  // FIRST: Check if article is within 6 hours
  if (!isWithin6Hours(article.timeAgo)) {
    return false;
  }
  
  // Skip if contains any skip keywords
  for (const skip of SKIP_KEYWORDS) {
    if (titleLower.includes(skip.toLowerCase())) {
      return false;
    }
  }
  
  // Include if contains any relevant keywords
  for (const keyword of RELEVANT_KEYWORDS) {
    if (titleLower.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  // Default: include articles that look like TV content
  const tvPatterns = [
    /season\s*\d+/i,
    /episode\s*\d+/i,
    /renewed|canceled|cancelled/i,
    /trailer|teaser|first look/i,
    /release date|premiere/i,
    /showrunner|creator/i,
  ];
  
  return tvPatterns.some(pattern => pattern.test(titleLower));
}

/**
 * Scrape news from a Valnet-powered site
 */
async function scrapeValnetNews(sourceKey: SourceKey): Promise<NewsArticle[]> {
  const source = NEWS_SOURCES[sourceKey];
  console.log(`🔍 Scraping ${source.name} TV News...\n`);
  
  const response = await fetch(source.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.name}: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  const $ = load(html);
  
  const results: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  
  // Helper: Decode base64 time from Valnet's data-b64-ts attribute
  const decodeTimeFromB64 = ($el: Cheerio<Element>): string => {
    const b64Time = $el.find('[data-b64-ts]').first().attr('data-b64-ts');
    if (b64Time) {
      try {
        return Buffer.from(b64Time, 'base64').toString('utf-8');
      } catch {
        return '';
      }
    }
    return $el.find('time, .display-card-date, .pinned-article-date, [class*="date"]').first().text().trim();
  };

  // Strategy 1: Find article cards with headlines
  $('article, .display-card, .sentinel-listing-page-list li, .w-display-card-content').each((_, element) => {
    const $el = $(element);
    const $link = $el.find('a').first();
    const $headline = $el.find('h3, h5, h2, .display-card-title').first();
    
    let href = $link.attr('href') || $headline.find('a').attr('href') || '';
    const title = $headline.text().trim() || $link.text().trim();
    
    // Make sure URL is absolute
    if (href && !href.startsWith('http')) {
      href = `https://${source.domain}${href}`;
    }
    
    // Find time - check for base64 encoded time first
    const timeText = decodeTimeFromB64($el);
    
    if (href && title && 
        title.length > 15 && 
        !href.includes('/tv-news/') &&
        !href.includes('/author/') &&
        !href.includes('/tag/') &&
        !href.includes('/db/') &&
        !href.endsWith('/tv-news') &&
        !seenUrls.has(href)) {
      
      seenUrls.add(href);
      results.push({
        title,
        url: href,
        timeAgo: timeText,
        source: source.name,
        series: undefined
      });
    }
  });
  
  // Strategy 2: Direct headline links
  $('h3 a, h5 a, h2 a').each((_, element) => {
    const $link = $(element);
    let href = $link.attr('href') || '';
    const title = $link.text().trim();
    
    if (href && !href.startsWith('http')) {
      href = `https://${source.domain}${href}`;
    }
    
    // Find parent for time - use base64 decoder
    const $parent = $link.closest('article, li, div, .w-display-card-content');
    const timeText = decodeTimeFromB64($parent);
    
    if (href && title && 
        title.length > 15 && 
        href.includes(source.domain) &&
        !href.includes('/tv-news/') &&
        !href.includes('/author/') &&
        !href.includes('/tag/') &&
        !seenUrls.has(href)) {
      
      seenUrls.add(href);
      results.push({
        title,
        url: href,
        timeAgo: timeText,
        source: source.name,
        series: undefined
      });
    }
  });
  
  // Clean up - remove duplicates and filter
  const cleanArticles = results.filter((article, index, self) => 
    article.title && 
    article.url && 
    article.title.length > 20 &&
    self.findIndex(a => a.url === article.url) === index
  );
  
  console.log(`   Found ${cleanArticles.length} articles from ${source.name}`);
  
  // Log time values for debugging
  if (cleanArticles.length > 0) {
    cleanArticles.slice(0, 3).forEach(a => console.log(`     → "${a.title.substring(0, 40)}..." timeAgo="${a.timeAgo}"`));
  }
  
  // Filter for relevance
  const relevantFlags = await Promise.all(cleanArticles.map(isRelevantArticle));
  const relevantArticles = cleanArticles.filter((_, i) => relevantFlags[i]);
  console.log(`   ${relevantArticles.length} relevant (≤6h, TV content)`);
  
  return relevantArticles;
}

/**
 * Scrape news from WordPress-powered sites (Cinemaholic)
 */
async function scrapeWordPressNews(sourceKey: SourceKey): Promise<NewsArticle[]> {
  const source = NEWS_SOURCES[sourceKey];
  console.log(`🔍 Scraping ${source.name} TV News (WordPress)...\n`);
  
  const response = await fetch(source.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.name}: ${response.status}`);
  }
  
  const html = await response.text();
  const $ = load(html);
  
  const results: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  
  // WordPress pattern: Find article links with titles
  $('a[href*="thecinemaholic.com/"]').each((_, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const title = $link.attr('title') || $link.text().trim();
    
    // Skip navigation and utility links
    if (!href || !title || title.length < 20) return;
    if (href.includes('/category/') || href.includes('/about') || href.includes('/contact') ||
        href.includes('/privacy') || href.includes('/terms') || href.includes('/policy')) return;
    if (seenUrls.has(href)) return;
    
    seenUrls.add(href);
    results.push({
      title: title.trim(),
      url: href,
      timeAgo: '', // WordPress doesn't show time on listing pages - we'll accept all and filter in pipeline
      source: source.name,
      series: undefined
    });
  });
  
  // Dedupe
  const cleanArticles = results.filter((article, index, self) => 
    self.findIndex(a => a.url === article.url) === index
  );
  
  console.log(`   Found ${cleanArticles.length} articles from ${source.name}`);
  
  // For WordPress without time info, we check relevance by keywords only (time filter happens in pipeline)
  const _flags = await Promise.all(cleanArticles.map(async (article) => {
    const titleLower = article.title.toLowerCase();

    // Blocklist (series/topic)
    if (await blockReasonForSource(article.title, article.url)) return false;

    // Skip unwanted
    for (const skip of SKIP_KEYWORDS) {
      if (titleLower.includes(skip.toLowerCase())) return false;
    }

    // Include TV content
    for (const keyword of RELEVANT_KEYWORDS) {
      if (titleLower.includes(keyword.toLowerCase())) return true;
    }

    // TV patterns
    return /season\s*\d+|renewed|canceled|cancelled|trailer|premiere/i.test(titleLower);
  }));
  const relevantArticles = cleanArticles.filter((_, i) => _flags[i]);
  
  console.log(`   ${relevantArticles.length} relevant (TV content)`);
  
  return relevantArticles;
}

/**
 * Scrape news from a generic RSS feed (Deadline TV, etc.)
 */
async function scrapeRssNews(sourceKey: SourceKey): Promise<NewsArticle[]> {
  const source = NEWS_SOURCES[sourceKey];
  console.log(`🔍 Scraping ${source.name} (RSS)...\n`);

  const response = await fetch(source.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.name}: ${response.status}`);
  }

  const xml = await response.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const results: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

  for (const item of items) {
    const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkMatch = item.match(/<link>([^<]+)<\/link>/);
    const pubMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/);

    if (!titleMatch || !linkMatch) continue;

    const rawTitle = titleMatch[1].trim();
    // Decode HTML entities
    const title = rawTitle
      .replace(/&#8216;|&#8217;/g, "'")
      .replace(/&#8220;|&#8221;/g, '"')
      .replace(/&#038;/g, '&')
      .replace(/&#8211;|&#8212;/g, '–')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    const url = linkMatch[1].trim();
    if (seenUrls.has(url)) continue;

    // Only include items from the last 6h
    if (pubMatch) {
      const pubTime = new Date(pubMatch[1]).getTime();
      if (!Number.isFinite(pubTime) || pubTime < sixHoursAgo) continue;
    }

    seenUrls.add(url);
    results.push({
      title,
      url,
      timeAgo: pubMatch ? pubMatch[1] : '',
      source: source.name,
      series: undefined,
    });
  }

  console.log(`   ${results.length} relevant (≤6h, TV content)`);
  return results;
}

/**
 * Fetch news articles from a single source (for preview/listing)
 */
export async function fetchNewsFromSource(sourceKey: SourceKey): Promise<NewsArticle[]> {
  const source = NEWS_SOURCES[sourceKey];
  if (!source) {
    throw new Error(`Unknown source: ${sourceKey}`);
  }

  if (source.type === 'valnet') {
    return scrapeValnetNews(sourceKey);
  } else if (source.type === 'wordpress') {
    return scrapeWordPressNews(sourceKey);
  } else if (source.type === 'rss') {
    return scrapeRssNews(sourceKey);
  }

  throw new Error(`Unknown source type: ${source.type}`);
}

interface ProcessOptions {
  sources?: SourceKey[];
  limit?: number;
  dryRun?: boolean;
  onlyNew?: boolean;
}

interface ProcessStats {
  processed: number;
  failed: number;
  skipped: number;
  bySource: Record<string, number>;
}

/**
 * Process news from multiple sources
 */
export async function processAllNews(options: ProcessOptions = {}): Promise<ProcessStats> {
  const {
    sources = ['screenrant', 'collider', 'cinemaholic', 'deadline', 'variety', 'hollywoodreporter', 'tvinsider'],
    limit = 5,
    dryRun = false,
    onlyNew = true,
  } = options;

  console.log('\n' + '='.repeat(70));
  console.log('📰 NEWS SCRAPER (P2 Pipeline)');
  console.log('='.repeat(70));
  console.log(`   Sources: ${sources.join(', ')}`);
  console.log(`   Limit: ${limit} per source`);
  console.log(`   Dry run: ${dryRun}`);
  console.log(`   Only new: ${onlyNew}`);
  console.log('='.repeat(70) + '\n');

  const stats: ProcessStats = {
    processed: 0,
    failed: 0,
    skipped: 0,
    bySource: {},
  };

  try {
    // Scrape all sources
    let allArticles: NewsArticle[] = [];
    
    for (const sourceKey of sources) {
      try {
        const source = NEWS_SOURCES[sourceKey as SourceKey];
        let articles: NewsArticle[];
        
        // Use appropriate scraper based on source type
        if (source.type === 'wordpress') {
          articles = await scrapeWordPressNews(sourceKey as SourceKey);
        } else if (source.type === 'rss') {
          articles = await scrapeRssNews(sourceKey as SourceKey);
        } else {
          articles = await scrapeValnetNews(sourceKey as SourceKey);
        }
        
        allArticles = allArticles.concat(articles.slice(0, limit));
        stats.bySource[sourceKey] = articles.length;
      } catch (error: any) {
        console.error(`❌ Failed to scrape ${sourceKey}: ${error.message}`);
        stats.bySource[sourceKey] = 0;
      }
    }

    console.log(`\n📊 Total: ${allArticles.length} articles from ${sources.length} sources\n`);

    if (allArticles.length === 0) {
      console.log('ℹ️  No relevant articles found');
      return stats;
    }

    // Filter for new articles only
    let articlesToProcess = allArticles;
    
    if (onlyNew) {
      const newArticles: NewsArticle[] = [];
      
      for (const article of allArticles) {
        // Check 1: Published article exists
        const exists = await prisma.articles.findFirst({
          where: { sourceUrl: article.url },
          select: { id: true }
        });
        
        // Check 2: URL was successfully processed in last 24h.
        // Only SUCCESS counts as dedup — if a previous run FAILED (e.g.
        // classifier hiccup → UNKNOWN), we must retry, otherwise the URL
        // ages out of the 6h relevance window and the article is lost.
        const recentRun = !exists ? await prisma.pipeline_runs.findFirst({
          where: {
            inputSource: article.url,
            status: 'success',
            startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          select: { id: true }
        }) : null;
        
        if (!exists && !recentRun) {
          newArticles.push(article);
        } else {
          console.log(`⏭️  SKIP (exists): ${article.title.substring(0, 50)}...`);
          stats.skipped++;
        }
      }
      articlesToProcess = newArticles;
      console.log(`\n🆕 ${articlesToProcess.length} new articles to process\n`);
    }

    if (articlesToProcess.length === 0) {
      console.log('ℹ️  No new articles to import');
      return stats;
    }

    // Process articles
    console.log('='.repeat(70));
    console.log(`📝 Processing ${articlesToProcess.length} articles:`);
    console.log('='.repeat(70));

    for (const article of articlesToProcess) {
      console.log(`\n🔄 [${article.source}] ${article.title}`);
      console.log(`   ${article.url}`);
      console.log(`   ⏰ ${article.timeAgo || 'Unbekannt'}`);
      
      if (dryRun) {
        console.log('   [DRY RUN - skipping pipeline]');
        stats.processed++;
        continue;
      }
      
      try {
        await runPipelineV2({
          title: article.title,
          url: article.url,
          text: '',
          useFullTextMode: true,
          trigger: 'cron'
        });
        stats.processed++;
        console.log('   ✅ SUCCESS');
      } catch (error: any) {
        stats.failed++;
        console.log(`   ❌ FAILED: ${error.message}`);
      }
      
      // Delay between articles
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 IMPORT COMPLETE');
    console.log('='.repeat(70));
    console.log(`   Processed: ${stats.processed}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Skipped: ${stats.skipped}`);
    Object.entries(stats.bySource).forEach(([source, count]) => {
      console.log(`   ${source}: ${count} found`);
    });
    console.log('='.repeat(70));

    return stats;

  } catch (error: any) {
    console.error('❌ Scraper error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Backwards compatibility exports
export { scrapeValnetNews as scrapeScreenrantNews };
export { processAllNews as processScreenrantNews };

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '5');
  const dryRun = args.includes('--dry-run');
  const screenrantOnly = args.includes('--screenrant');
  const colliderOnly = args.includes('--collider');
  const cinemaholicOnly = args.includes('--cinemaholic');
  const deadlineOnly = args.includes('--deadline');
  
  let sources: SourceKey[] = ['screenrant', 'collider', 'cinemaholic', 'deadline', 'variety', 'hollywoodreporter', 'tvinsider'];
  if (screenrantOnly) sources = ['screenrant'];
  if (colliderOnly) sources = ['collider'];
  if (cinemaholicOnly) sources = ['cinemaholic'];
  if (deadlineOnly) sources = ['deadline'];
  
  processAllNews({ sources, limit, dryRun, onlyNew: true })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
