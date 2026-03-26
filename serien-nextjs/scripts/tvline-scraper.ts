/**
 * TVLine Streaming News Scraper
 * 
 * Scrapes https://www.tvline.com/category/streaming/
 * for the latest streaming TV news
 */

import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { runPipelineV2 } from './pipeline-v2';

const prisma = new PrismaClient();

interface NewsArticle {
  title: string;
  url: string;
  category?: string;
}

// Keywords to filter relevant streaming articles
const RELEVANT_KEYWORDS = [
  'netflix', 'prime', 'disney', 'hbo', 'max', 'apple tv',
  'amazon', 'paramount', 'peacock', 'hulu',
  'season', 'renewed', 'cancelled', 'canceled',
  'trailer', 'release', 'premiere', 'finale',
  'cast', 'first look', 'ending explained',
  'stranger things', 'wednesday', 'squid game', 'bridgerton',
  'house of the dragon', 'rings of power', 'mandalorian',
  'daredevil', 'marvel', 'star wars', 'the bear',
  'severance', 'white lotus', 'last of us', 'invincible',
  'yellowstone', 'cobra kai', 'outer banks', 'you',
  'one piece', 'avatar', 'the witcher', 'arcane', 'fallout',
  'shogun', 'slow horses', 'true detective', 'fargo',
  'reacher', 'jack ryan', 'the boys', 'gen v',
];

// Keywords to SKIP
const SKIP_KEYWORDS = [
  'box office', 'theater', 'theatre', 'cinema', 'oscars',
  'emmy', 'golden globe', 'interview', 'behind the scenes',
  'real housewives', 'bachelor', 'bachelorette', 'survivor',
  'big brother', 'american idol', 'the voice', 'dancing with',
  'late night', 'talk show', 'snl', 'saturday night live',
  'daytime', 'soap opera', 'general hospital', 'days of our lives',
  'what to watch', 'guide to', 'best of', 'ranking',
];

function isRelevantArticle(article: NewsArticle): boolean {
  const titleLower = article.title.toLowerCase();
  
  // Skip if contains skip keywords
  for (const skip of SKIP_KEYWORDS) {
    if (titleLower.includes(skip)) {
      return false;
    }
  }
  
  // Include if contains relevant keywords
  for (const keyword of RELEVANT_KEYWORDS) {
    if (titleLower.includes(keyword)) {
      return true;
    }
  }
  
  // Default: include streaming category articles
  return true;
}

async function scrapeTVLineNews(): Promise<NewsArticle[]> {
  console.log('🔍 Scraping TVLine Streaming News...\n');
  
  const response = await fetch('https://www.tvline.com/category/streaming/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch TVLine: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  const results: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  
  // Find article items
  $('.article-item h3 a, .article-block h3 a').each((_, element) => {
    const $link = $(element);
    let href = $link.attr('href') || '';
    const title = $link.text().trim();
    
    // Make sure URL is absolute
    if (href && !href.startsWith('http')) {
      href = `https://www.tvline.com${href}`;
    }
    
    if (href && title && 
        title.length > 15 && 
        !seenUrls.has(href) &&
        !href.includes('/category/') &&
        !href.includes('/lists/') &&
        !href.includes('/author/')) {
      
      seenUrls.add(href);
      results.push({
        title,
        url: href,
      });
    }
  });
  
  console.log(`📰 Found ${results.length} total articles\n`);
  
  // Filter for relevant articles
  const relevant = results.filter(isRelevantArticle);
  console.log(`✅ ${relevant.length} relevant streaming articles\n`);
  
  return relevant;
}

async function isArticleAlreadyProcessed(url: string): Promise<boolean> {
  const existing = await prisma.articles.findFirst({
    where: { sourceUrl: url },
    select: { id: true }
  });
  return !!existing;
}

export async function processTVLineNews(options: {
  limit?: number;
  dryRun?: boolean;
  onlyNew?: boolean;
} = {}): Promise<void> {
  const { limit = 5, dryRun = false, onlyNew = true } = options;
  
  console.log('═'.repeat(60));
  console.log('TVLINE STREAMING NEWS PROCESSOR');
  console.log('═'.repeat(60));
  console.log(`Options: limit=${limit}, dryRun=${dryRun}, onlyNew=${onlyNew}\n`);
  
  try {
    const articles = await scrapeTVLineNews();
    
    if (articles.length === 0) {
      console.log('No articles found.');
      return;
    }
    
    let processed = 0;
    let skipped = 0;
    
    for (const article of articles) {
      if (processed >= limit) break;
      
      // Check if already processed
      if (onlyNew) {
        const exists = await isArticleAlreadyProcessed(article.url);
        if (exists) {
          console.log(`⏭️  Already processed: ${article.title.substring(0, 50)}...`);
          skipped++;
          continue;
        }
      }
      
      console.log(`\n📄 Processing: ${article.title}`);
      console.log(`   URL: ${article.url}`);
      
      if (dryRun) {
        console.log('   [DRY RUN - Skipping pipeline]');
        processed++;
        continue;
      }
      
      try {
        // Run through V2 pipeline
        const result = await runPipelineV2({
          title: article.title,
          url: article.url,
          text: '', // Will be fetched by pipeline
          useFullTextMode: true,
          trigger: 'cron',
        });
        
        if (result) {
          console.log(`   ✅ Article created: ${result.slug}`);
          processed++;
        } else {
          console.log(`   ❌ Pipeline returned null`);
        }
      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
      }
      
      // Delay between articles
      await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log(`COMPLETE: ${processed} processed, ${skipped} skipped`);
    console.log('═'.repeat(60));
    
  } catch (error: any) {
    console.error('TVLine scraper error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '5');
  
  processTVLineNews({ limit, dryRun, onlyNew: true })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
