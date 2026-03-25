/**
 * Trends-to-Articles Processor
 * 
 * 1. Fetches Google Trends for TV series
 * 2. Searches for relevant news articles
 * 3. Runs pipeline to create German articles
 */

import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import { runPipelineV2 } from './pipeline-v2';

const prisma = new PrismaClient();

// News sources to search
const NEWS_SOURCES = [
  { domain: 'screenrant.com', name: 'Screen Rant' },
  { domain: 'thecinemaholic.com', name: 'The Cinemaholic' },
  { domain: 'tvline.com', name: 'TVLine' },
  { domain: 'collider.com', name: 'Collider' },
];

// Series keywords for filtering
const SERIES_KEYWORDS = [
  'serie', 'series', 'season', 'staffel', 'episode', 'folge',
  'netflix', 'prime video', 'disney+', 'hbo', 'streaming',
  'finale', 'premiere', 'renewed', 'cancelled', 'cast', 'trailer'
];

/**
 * Fetch Google Trends daily searches RSS
 */
async function fetchDailyTrends(): Promise<string[]> {
  const trends: string[] = [];
  
  try {
    const response = await fetch('https://trends.google.de/trending/rss?geo=DE', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
      }
    });
    
    if (!response.ok) {
      console.log('   ⚠️ Could not fetch Google Trends RSS');
      return trends;
    }
    
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    $('item title').each((_, el) => {
      const title = $(el).text().trim();
      if (title) trends.push(title);
    });
    
    console.log(`   📊 Found ${trends.length} trending topics`);
  } catch (error) {
    console.error('Error fetching trends:', error);
  }
  
  return trends;
}

/**
 * Check if a trend is series-related
 */
function isSeriesRelated(trend: string): boolean {
  const lower = trend.toLowerCase();
  return SERIES_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Search Google for news articles about a topic
 */
async function searchNewsArticles(query: string): Promise<string[]> {
  const urls: string[] = [];
  const sourceDomains = NEWS_SOURCES.map(s => `site:${s.domain}`).join(' OR ');
  const searchQuery = `${query} serie (${sourceDomains})`;
  
  try {
    // Use DuckDuckGo HTML (more scraper-friendly than Google)
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
    
    const response = await fetch(ddgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    if (!response.ok) return urls;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract URLs from DuckDuckGo results
    $('a.result__url, a.result__a').each((_, el) => {
      let href = $(el).attr('href');
      if (!href) return;
      
      // Decode DuckDuckGo redirect URL
      if (href.includes('duckduckgo.com/l/?uddg=')) {
        const match = href.match(/uddg=([^&]+)/);
        if (match) {
          href = decodeURIComponent(match[1]);
        }
      }
      
      // Check if it's from our sources
      for (const source of NEWS_SOURCES) {
        if (href.includes(source.domain) && !urls.includes(href)) {
          if (href.startsWith('http')) {
            urls.push(href);
          }
        }
      }
    });
    
  } catch (error) {
    console.error(`Error searching for "${query}":`, error);
  }
  
  return urls.slice(0, 2); // Max 2 articles per trend
}

/**
 * Check if article URL was already processed
 */
async function isAlreadyProcessed(url: string): Promise<boolean> {
  const existing = await prisma.articles.findFirst({
    where: { sourceUrl: url },
    select: { id: true }
  });
  return !!existing;
}

/**
 * Main processor function
 */
export async function processTrendingTopics(options: {
  maxTrends?: number;
  maxArticlesPerTrend?: number;
  dryRun?: boolean;
} = {}) {
  const { maxTrends = 5, maxArticlesPerTrend = 2, dryRun = false } = options;
  
  console.log('='.repeat(70));
  console.log('🔥 TRENDING TOPICS TO ARTICLES PROCESSOR');
  console.log('='.repeat(70));
  console.log(`   Max trends: ${maxTrends}, Max articles/trend: ${maxArticlesPerTrend}, Dry run: ${dryRun}\n`);
  
  const stats = {
    trendsFound: 0,
    seriesRelated: 0,
    articlesFound: 0,
    articlesCreated: 0,
    articlesSkipped: 0,
    articlesFailed: 0,
  };
  
  try {
    // Step 1: Fetch trends
    console.log('📊 STEP 1: Fetching Google Trends...');
    const allTrends = await fetchDailyTrends();
    stats.trendsFound = allTrends.length;
    
    // Step 2: Filter for series-related
    console.log('\n🎬 STEP 2: Filtering series-related trends...');
    const seriesTrends = allTrends.filter(isSeriesRelated).slice(0, maxTrends);
    stats.seriesRelated = seriesTrends.length;
    console.log(`   ${seriesTrends.length} series-related trends found`);
    
    if (seriesTrends.length === 0) {
      // Fallback: Use all trends but search with "serie" keyword
      console.log('   Using general trends with "serie" search filter...');
      seriesTrends.push(...allTrends.slice(0, maxTrends));
    }
    
    // Step 3: Search for news articles
    console.log('\n🔍 STEP 3: Searching for news articles...');
    const trendArticles: Map<string, string[]> = new Map();
    
    for (const trend of seriesTrends) {
      console.log(`\n   📰 "${trend}"`);
      const urls = await searchNewsArticles(trend);
      stats.articlesFound += urls.length;
      
      if (urls.length > 0) {
        trendArticles.set(trend, urls.slice(0, maxArticlesPerTrend));
        urls.forEach(u => console.log(`      → ${u.substring(0, 60)}...`));
      } else {
        console.log('      No articles found');
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 1500));
    }
    
    // Step 4: Process articles through pipeline
    console.log('\n\n🚀 STEP 4: Processing articles through pipeline...');
    
    for (const [trend, urls] of trendArticles) {
      console.log(`\n   🔥 Trend: ${trend}`);
      
      for (const url of urls) {
        console.log(`\n      Processing: ${url.substring(0, 50)}...`);
        
        // Check if already exists
        const exists = await isAlreadyProcessed(url);
        if (exists) {
          console.log('      ⏭️  Already exists - skipping');
          stats.articlesSkipped++;
          continue;
        }
        
        if (dryRun) {
          console.log('      [DRY RUN] Would process this article');
          stats.articlesCreated++;
          continue;
        }
        
        try {
          await runPipelineV2(url, { dryRun: false });
          stats.articlesCreated++;
          console.log('      ✅ Article created');
          
          // Save trend to DB
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          await prisma.trending_topics.upsert({
            where: { query_date: { query: trend, date: today } },
            update: { processed: true, fetchedAt: new Date() },
            create: {
              query: trend,
              title: trend,
              category: 'series',
              date: today,
              processed: true,
            }
          });
          
        } catch (error: any) {
          console.log(`      ❌ Failed: ${error.message}`);
          stats.articlesFailed++;
        }
        
        // Rate limiting between articles
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    
    // Summary
    console.log('\n\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`   Trends found: ${stats.trendsFound}`);
    console.log(`   Series-related: ${stats.seriesRelated}`);
    console.log(`   News articles found: ${stats.articlesFound}`);
    console.log(`   Articles created: ${stats.articlesCreated}`);
    console.log(`   Articles skipped: ${stats.articlesSkipped}`);
    console.log(`   Articles failed: ${stats.articlesFailed}`);
    console.log('='.repeat(70));
    
    return stats;
    
  } catch (error: any) {
    console.error('❌ Processor error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const maxTrends = parseInt(args.find(a => a.startsWith('--max-trends='))?.split('=')[1] || '5');
  
  processTrendingTopics({ maxTrends, dryRun })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
