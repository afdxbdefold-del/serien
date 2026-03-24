/**
 * Screenrant TV News Scraper (Serverless Version)
 * 
 * Uses fetch + cheerio instead of Playwright
 * Works on Vercel and other serverless platforms
 */

import * as cheerio from 'cheerio';
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
 * Check if article is less than 24 hours old based on timeAgo string
 */
function isWithin24Hours(timeAgo: string): boolean {
  if (!timeAgo) return true;
  
  const timeLower = timeAgo.toLowerCase().trim();
  
  // "X hours ago" - include if less than 24
  const hoursMatch = timeLower.match(/(\d+)\s*(?:hour|hr|h)/);
  if (hoursMatch) {
    return parseInt(hoursMatch[1]) <= 24;
  }
  
  // "X minutes ago" - always include
  if (timeLower.includes('minute') || timeLower.includes('min')) {
    return true;
  }
  
  // "just now", "now" - always include
  if (timeLower.includes('just') || timeLower === 'now') {
    return true;
  }
  
  // "X days ago" - only include if 1 day
  const daysMatch = timeLower.match(/(\d+)\s*day/);
  if (daysMatch) {
    return parseInt(daysMatch[1]) <= 1;
  }
  
  // "yesterday" - include
  if (timeLower.includes('yesterday')) {
    return true;
  }
  
  // Anything with "week", "month", "year" - skip
  if (timeLower.includes('week') || timeLower.includes('month') || timeLower.includes('year')) {
    return false;
  }
  
  return true;
}

function isRelevantArticle(article: NewsArticle): boolean {
  const titleLower = article.title.toLowerCase();
  
  // FIRST: Check if article is within 24 hours
  if (!isWithin24Hours(article.timeAgo)) {
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
  const $ = cheerio.load(html);
  
  const results: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  
  // Strategy 1: Find article cards with headlines
  $('article, .display-card, .sentinel-listing-page-list li').each((_, element) => {
    const $el = $(element);
    const $link = $el.find('a[href*="screenrant.com"]').first();
    const $headline = $el.find('h3, h5, h2, .display-card-title').first();
    
    let href = $link.attr('href') || '';
    const title = $headline.text().trim() || $link.text().trim();
    
    // Make sure URL is absolute
    if (href && !href.startsWith('http')) {
      href = `https://screenrant.com${href}`;
    }
    
    // Find time element
    const timeText = $el.find('time, .display-card-date, [class*="date"]').first().text().trim();
    
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
    
    // Find parent for time
    const $parent = $link.closest('article, li, div');
    const timeText = $parent.find('time, [class*="date"]').first().text().trim();
    
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
  const existing = await prisma.articles.findFirst({
    where: { sourceUrl: url },
    select: { id: true }
  });
  return !!existing;
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
      
      if (dryRun) {
        console.log('   [DRY RUN - skipping pipeline]');
        stats.processed++;
        continue;
      }
      
      try {
        await runPipelineV2(article.url, { dryRun: false });
        stats.processed++;
        console.log('   ✅ SUCCESS');
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
