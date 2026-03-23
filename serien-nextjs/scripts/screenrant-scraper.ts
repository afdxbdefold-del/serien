/**
 * Screenrant TV News Scraper
 * 
 * Fetches latest TV news from screenrant.com/tv-news/
 * and runs them through pipeline-v2
 */

import { chromium } from 'playwright';
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
  'money heist', 'dark', 'babylon berlin', '1899', 'tribes of europa'
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
  if (!timeAgo) return true; // If no time, include it
  
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
  
  // Default: include if unsure
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
  
  // Also check if it has a series tag (from screenrant structure)
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
  console.log('🔍 Scraping Screenrant TV News...\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set a realistic user agent
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  try {
    await page.goto('https://screenrant.com/tv-news/', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    
    // Wait for content to load
    await page.waitForTimeout(3000);
    
    // Scroll to load more content
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(1000);
    
    // Extract articles using multiple strategies
    const articles = await page.evaluate(() => {
      const results: { title: string; url: string; timeAgo: string; series?: string }[] = [];
      const seenUrls = new Set<string>();
      
      // Strategy 1: Find all h3/h5 headlines with links
      document.querySelectorAll('h3 a, h5 a, h2 a').forEach(link => {
        const href = (link as HTMLAnchorElement).href;
        const title = link.textContent?.trim();
        
        if (href && title && title.length > 15 && 
            href.includes('screenrant.com/') && 
            !href.includes('/tv-news/') &&
            !href.includes('/author/') &&
            !href.includes('/tag/') &&
            !href.includes('/db/') &&
            !href.endsWith('/tv-news') &&
            !seenUrls.has(href)) {
          
          seenUrls.add(href);
          
          // Find parent container for metadata
          const card = link.closest('article, li, .valnet-content-card, [class*="card"]');
          const timeEl = card?.querySelector('time, [class*="date"], [class*="time"]');
          const seriesEl = card?.querySelector('a[href*="/db/tv-show/"]');
          
          results.push({
            title,
            url: href,
            timeAgo: timeEl?.textContent?.trim() || '',
            series: seriesEl?.textContent?.trim()
          });
        }
      });
      
      // Strategy 2: Find article cards by image + link pattern
      document.querySelectorAll('img[src*="srcdn.com"]').forEach(img => {
        const card = img.closest('a, article, li, div');
        const link = card?.querySelector('a[href*="screenrant.com/"]') || (card as HTMLAnchorElement);
        
        if (link && (link as HTMLAnchorElement).href) {
          const href = (link as HTMLAnchorElement).href;
          const titleEl = card?.querySelector('h3, h5, h2, [class*="title"]');
          const title = titleEl?.textContent?.trim() || link.textContent?.trim();
          
          if (href && title && title.length > 15 && 
              !href.includes('/tv-news/') &&
              !href.includes('/author/') &&
              !seenUrls.has(href)) {
            
            seenUrls.add(href);
            
            const timeEl = card?.querySelector('time, [class*="date"]');
            
            results.push({
              title,
              url: href,
              timeAgo: timeEl?.textContent?.trim() || '',
              series: undefined
            });
          }
        }
      });
      
      return results;
    });
    
    await browser.close();
    
    // Clean up results - remove duplicates and invalid entries
    const cleanArticles = articles.filter((article, index, self) => 
      article.title && 
      article.url && 
      article.title.length > 20 &&
      self.findIndex(a => a.url === article.url) === index
    );
    
    console.log(`📰 Found ${cleanArticles.length} articles total\n`);
    
    return cleanArticles;
    
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function checkIfArticleExists(url: string): Promise<boolean> {
  const existing = await prisma.articles.findFirst({
    where: { sourceUrl: url },
    select: { id: true }
  });
  return !!existing;
}

async function processScreenrantNews(options: { 
  limit?: number;
  dryRun?: boolean;
  onlyNew?: boolean;
} = {}) {
  const { limit = 5, dryRun = false, onlyNew = true } = options;
  
  console.log('='.repeat(70));
  console.log('🎬 SCREENRANT TV NEWS IMPORTER');
  console.log('='.repeat(70));
  console.log(`📋 Options: limit=${limit}, dryRun=${dryRun}, onlyNew=${onlyNew}\n`);
  
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
          console.log(`   ⏭️  Already exists: ${article.title.slice(0, 50)}...`);
        }
      }
      
      articlesToProcess = newArticles;
      console.log(`\n🆕 ${articlesToProcess.length} new articles to process\n`);
    }
    
    // Step 4: Limit articles
    const finalArticles = articlesToProcess.slice(0, limit);
    
    if (finalArticles.length === 0) {
      console.log('ℹ️  No new articles to process.');
      return { processed: 0, skipped: articlesToProcess.length };
    }
    
    // Step 5: Process each article
    console.log('━'.repeat(70));
    console.log(`Processing ${finalArticles.length} articles:`);
    console.log('━'.repeat(70));
    
    for (const article of finalArticles) {
      console.log(`\n📰 ${article.title}`);
      console.log(`   🔗 ${article.url}`);
      if (article.series) console.log(`   📺 Series: ${article.series}`);
      if (article.timeAgo) console.log(`   ⏰ ${article.timeAgo}`);
    }
    
    if (dryRun) {
      console.log('\n⚠️  DRY RUN - No articles will be processed.');
      return { processed: 0, skipped: finalArticles.length, dryRun: true };
    }
    
    console.log('\n' + '━'.repeat(70));
    console.log('Starting Pipeline Processing...');
    console.log('━'.repeat(70));
    
    let processed = 0;
    let failed = 0;
    
    for (let i = 0; i < finalArticles.length; i++) {
      const article = finalArticles[i];
      
      console.log(`\n[${i + 1}/${finalArticles.length}] Processing: ${article.title.slice(0, 60)}...`);
      
      try {
        await runPipelineV2({
          title: article.title,
          url: article.url,
          text: '',
          useFullTextMode: true
        });
        
        processed++;
        console.log(`   ✅ Success!`);
        
        // Small delay between articles to avoid rate limiting
        if (i < finalArticles.length - 1) {
          console.log('   ⏳ Waiting 5 seconds before next article...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
      } catch (error: any) {
        failed++;
        console.log(`   ❌ Failed: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 IMPORT COMPLETE');
    console.log('='.repeat(70));
    console.log(`✅ Processed: ${processed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped (existing): ${relevantArticles.length - finalArticles.length}`);
    
    return { processed, failed, skipped: relevantArticles.length - finalArticles.length };
    
  } catch (error: any) {
    console.error('❌ Scraper error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI runner
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const limit = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const all = args.includes('--all') || args.includes('-a');
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Screenrant TV News Importer

Usage: npx tsx scripts/screenrant-scraper.ts [options]

Options:
  --limit=N     Process max N articles (default: 5)
  --dry-run, -d Show articles but don't process them
  --all, -a     Process all articles (ignore existing check)
  --help, -h    Show this help

Examples:
  npx tsx scripts/screenrant-scraper.ts --dry-run
  npx tsx scripts/screenrant-scraper.ts --limit=10
  npx tsx scripts/screenrant-scraper.ts --limit=3 --all
`);
    process.exit(0);
  }
  
  processScreenrantNews({
    limit: limit ? parseInt(limit) : 5,
    dryRun,
    onlyNew: !all
  })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { processScreenrantNews, scrapeScreenrantNews };
