/**
 * Screenrant TV News Scraper (Serverless Version)
 * 
 * Uses fetch + cheerio instead of Playwright
 * Works on Vercel and other serverless platforms
 */

import { load as cheerioLoad, type Cheerio, type Element } from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { runPipelineV2 } from './pipeline-v2';

const prisma = new PrismaClient();

interface NewsArticle {
  title: string;
  url: string;
  timeAgo: string;
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
  'abbott elementary', 'what we do in the shadows', 'reservation dogs'
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
  if (!timeAgo) return false; // Ohne Zeitangabe = zu alt
  
  const timeLower = timeAgo.toLowerCase().trim();
  
  // "X hours ago" - include if less than 2
  const hoursMatch = timeLower.match(/(\d+)\s*(?:hour|hr|h)/);
  if (hoursMatch) {
    return parseInt(hoursMatch[1]) <= 2;
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
  const daysMatch = timeLower.match(/(\d+)\s*day/);
  if (daysMatch) {
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
  
  return false; // Default: zu alt
}

function isRelevantArticle(article: NewsArticle): boolean {
  const titleLower = article.title.toLowerCase();
  
  // FIRST: Check if article is within 6 hours
  if (!isWithin6Hours(article.timeAgo)) {
    return false;
  }
  
  // Skip if contains skip keywords (including movies)
  for (const skip of SKIP_KEYWORDS) {
    if (titleLower.includes(skip)) {
      return false;
    }
  }
  
  // Must be about TV SERIES - check for series indicators
  const seriesIndicators = [
    'season', 'episode', 'series', 'show', 'tv',
    'finale', 'premiere', 'renewed', 'cancelled', 'canceled',
    'netflix', 'prime', 'disney', 'hbo', 'max', 'apple tv',
    'amazon', 'paramount', 'peacock', 'hulu', 'streaming'
  ];
  
  const hasSeriesIndicator = seriesIndicators.some(indicator => 
    titleLower.includes(indicator)
  );
  
  // Check if contains relevant series names
  for (const keyword of RELEVANT_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      return true;
    }
  }
  
  // Also check if it has a series tag
  if (article.series) {
    return true;
  }
  
  // Must have a series indicator AND specific show reference (colon/quotes)
  if (hasSeriesIndicator && (titleLower.includes(':') || titleLower.includes('"') || titleLower.includes("'"))) {
    return true;
  }
  
  return false;
}

async function scrapeScreenrantNews(): Promise<NewsArticle[]> {
  console.log('🔍 Scraping Screenrant TV News (serverless)...\n');
  
  const response = await fetch('https://screenrant.com/tv-news/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  const $ = cheerioLoad(html);
  
  const results: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  
  // Helper: Decode base64 time from ScreenRant's data-b64-ts attribute
  const decodeTimeFromB64 = ($el: Cheerio<Element>): string => {
    const b64Time = $el.find('[data-b64-ts]').first().attr('data-b64-ts');
    if (b64Time) {
      try {
        return Buffer.from(b64Time, 'base64').toString('utf-8');
      } catch {
        return '';
      }
    }
    // Fallback: try text content
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
      href = `https://screenrant.com${href}`;
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
      href = `https://screenrant.com${href}`;
    }
    
    // Find parent for time - use base64 decoder
    const $parent = $link.closest('article, li, div, .w-display-card-content');
    const timeText = decodeTimeFromB64($parent);
    
    if (href && title && 
        title.length > 15 && 
        href.includes('screenrant.com/') &&
        !href.includes('/tv-news/') &&
        !href.includes('/author/') &&
        !href.includes('/tag/') &&
        !seenUrls.has(href)) {
      
      seenUrls.add(href);
      results.push({
        title,
        url: href,
        timeAgo: timeText,
        series: undefined
      });
    }
  });
  
  // Clean up - remove duplicates
  const cleanArticles = results.filter((article, index, self) => 
    article.title && 
    article.url && 
    article.title.length > 20 &&
    self.findIndex(a => a.url === article.url) === index
  );
  
  console.log(`📰 Found ${cleanArticles.length} articles total\n`);
  
  return cleanArticles;
}

async function checkIfArticleExists(url: string): Promise<boolean> {
  // Check 1: Published article exists
  const existing = await prisma.articles.findFirst({
    where: { sourceUrl: url },
    select: { id: true }
  });
  if (existing) return true;
  
  // Check 2: URL was already processed (success, duplicate, or any other result) in last 24h
  const recentRun = await prisma.pipeline_runs.findFirst({
    where: {
      inputSource: url,
      startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true }
  });
  return !!recentRun;
}

export async function processScreenrantNews(options: { 
  limit?: number;
  dryRun?: boolean;
  onlyNew?: boolean;
} = {}) {
  const { limit = 5, dryRun = false, onlyNew = true } = options;
  
  console.log('='.repeat(70));
  console.log('🎬 SCREENRANT TV NEWS IMPORTER (Serverless)');
  console.log('='.repeat(70));
  console.log(`📋 Options: limit=${limit}, dryRun=${dryRun}, onlyNew=${onlyNew}\n`);
  
  const stats = {
    processed: 0,
    failed: 0,
    skipped: 0,
  };
  
  try {
    // Step 1: Scrape news
    const allArticles = await scrapeScreenrantNews();
    
    // Step 2: Filter relevant articles
    const relevantArticles = allArticles.filter(isRelevantArticle);
    console.log(`✅ ${relevantArticles.length} relevant articles after filtering\n`);
    
    // Step 3: Check which articles are new
    let articlesToProcess = relevantArticles;
    
    if (onlyNew) {
      const newArticles: NewsArticle[] = [];
      for (const article of relevantArticles) {
        const exists = await checkIfArticleExists(article.url);
        if (!exists) {
          newArticles.push(article);
        } else {
          console.log(`⏭️  SKIP (exists): ${article.title.substring(0, 50)}...`);
          stats.skipped++;
        }
      }
      articlesToProcess = newArticles;
      console.log(`\n🆕 ${articlesToProcess.length} new articles to process\n`);
    }
    
    // Step 4: Limit
    const finalArticles = articlesToProcess.slice(0, limit);
    
    if (finalArticles.length === 0) {
      console.log('ℹ️  No new articles to import');
      return stats;
    }
    
    console.log('='.repeat(70));
    console.log(`📝 Processing ${finalArticles.length} articles:`);
    console.log('='.repeat(70));
    
    for (const article of finalArticles) {
      console.log(`\n🔄 ${article.title}`);
      console.log(`   ${article.url}`);
      console.log(`   ⏰ ${article.timeAgo || 'Unbekannt'}`);
      
      if (dryRun) {
        console.log('   [DRY RUN - skipping pipeline]');
        stats.processed++;
        continue;
      }
      
      try {
        // Pipeline V2 erwartet ein PipelineV2Source Objekt
        await runPipelineV2({
          title: article.title,
          url: article.url,
          text: '', // Wird von Pipeline via useFullTextMode geholt
          useFullTextMode: true,
          trigger: 'cron', // Automatischer Import = Altersfilter aktiv
          discoveryChannel: 'screenrant-deep',
        });
        stats.processed++;
        // Authoritative check: pipeline-v2 gibt bei Blocklist/Gate-Skips
        // `null` zurück statt zu throwen — "kein Fehler" ≠ "publiziert".
        // (Aug 2026: genau das hat den screenrant.com-WEAK_HOSTS-Block
        // wochenlang als "processed: 1" maskiert.)
        const landed = await prisma.articles.findFirst({
          where: { sourceUrl: article.url, status: 'published' },
          select: { id: true },
        });
        if (landed) {
          console.log('   ✅ PUBLISHED');
        } else {
          console.log('   ⚠️  ATTEMPTED (no publish — likely blocked, e.g. WEAK_HOSTS)');
        }
      } catch (error: any) {
        stats.failed++;
        console.log(`   ❌ FAILED: ${error.message}`);
      }
      
      // Small delay between articles
      await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 IMPORT COMPLETE');
    console.log('='.repeat(70));
    console.log(`   Processed: ${stats.processed}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Skipped: ${stats.skipped}`);
    console.log('='.repeat(70));
    
    return stats;
    
  } catch (error: any) {
    console.error('❌ Scraper error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '5');
  const dryRun = args.includes('--dry-run');
  
  processScreenrantNews({ limit, dryRun, onlyNew: true })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
