/**
 * Google Trends Scraper for TV Series
 * Fetches trending TV-related searches in Germany
 */

import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TrendingTopic {
  title: string;
  query: string;
  growth: string; // e.g., "+650%", "Ausreißer"
  category: 'series' | 'film' | 'other';
  relatedQueries: string[];
}

// Google Trends RSS feed for Germany - Entertainment category
const TRENDS_URLS = [
  'https://trends.google.de/trending/rss?geo=DE',
  'https://trends.google.com/trends/trendingsearches/daily/rss?geo=DE',
];

// Keywords to identify TV series content
const SERIES_KEYWORDS = [
  'serie', 'series', 'staffel', 'season', 'folge', 'episode',
  'netflix', 'prime', 'disney+', 'amazon', 'streaming',
  'fernsehserie', 'tv-serie', 'show'
];

const EXCLUDE_KEYWORDS = [
  'fußball', 'football', 'bundesliga', 'champions league',
  'wetter', 'politik', 'aktie', 'börse', 'news'
];

/**
 * Fetch Google Trends RSS feed
 */
async function fetchTrendsRSS(): Promise<string[]> {
  const allTrends: string[] = [];
  
  for (const url of TRENDS_URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        }
      });
      
      if (!response.ok) continue;
      
      const xml = await response.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      
      $('item title').each((_, el) => {
        const title = $(el).text().trim();
        if (title && !allTrends.includes(title)) {
          allTrends.push(title);
        }
      });
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
    }
  }
  
  return allTrends;
}

/**
 * Scrape Google Trends Explore page for TV series
 */
async function scrapeTrendsExplore(): Promise<TrendingTopic[]> {
  const topics: TrendingTopic[] = [];
  
  try {
    // Scrape the TV Series category trends
    const url = 'https://trends.google.de/trends/explore?cat=3&geo=DE&hl=de';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9',
      }
    });
    
    if (!response.ok) {
      console.log('   Could not fetch Trends Explore page');
      return topics;
    }
    
    // Note: Google Trends uses client-side rendering, so we can't scrape directly
    // We'll use the RSS feed and filter for series-related content
    
  } catch (error) {
    console.error('Error scraping Trends Explore:', error);
  }
  
  return topics;
}

/**
 * Filter trends to only include TV series related topics
 */
function filterSeriesTrends(trends: string[]): string[] {
  return trends.filter(trend => {
    const lower = trend.toLowerCase();
    
    // Exclude non-entertainment topics
    if (EXCLUDE_KEYWORDS.some(kw => lower.includes(kw))) {
      return false;
    }
    
    // Include if contains series keywords
    if (SERIES_KEYWORDS.some(kw => lower.includes(kw))) {
      return true;
    }
    
    // Include if looks like a show title (capitalized words, no numbers at start)
    if (/^[A-ZÄÖÜ][a-zäöüß]+ /.test(trend) && !trend.match(/^\d/)) {
      return true;
    }
    
    return false;
  });
}

/**
 * Search for news articles about a trending topic
 */
async function findNewsForTrend(trend: string): Promise<string[]> {
  const newsUrls: string[] = [];
  const searchQuery = encodeURIComponent(`${trend} serie site:screenrant.com OR site:thecinemaholic.com OR site:tvline.com`);
  
  try {
    // Use Google search to find relevant articles
    const response = await fetch(`https://www.google.com/search?q=${searchQuery}&tbm=nws`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    });
    
    if (!response.ok) return newsUrls;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract URLs from search results
    $('a[href*="screenrant.com"], a[href*="thecinemaholic.com"], a[href*="tvline.com"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !newsUrls.includes(href)) {
        // Extract actual URL from Google redirect
        const match = href.match(/url=([^&]+)/);
        const url = match ? decodeURIComponent(match[1]) : href;
        if (url.startsWith('http') && !newsUrls.includes(url)) {
          newsUrls.push(url);
        }
      }
    });
    
  } catch (error) {
    console.error(`Error searching news for "${trend}":`, error);
  }
  
  return newsUrls.slice(0, 3); // Max 3 articles per trend
}

/**
 * Save trending topics to database
 */
async function saveTrendingTopics(trends: string[]): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (const trend of trends) {
    try {
      await prisma.trending_topics.upsert({
        where: {
          query_date: {
            query: trend,
            date: today,
          }
        },
        update: {
          fetchedAt: new Date(),
        },
        create: {
          query: trend,
          title: trend,
          category: 'series',
          growth: 'trending',
          date: today,
          fetchedAt: new Date(),
        }
      });
    } catch (error) {
      // Table might not exist yet - that's ok
      console.log(`   Could not save trend: ${trend}`);
    }
  }
}

/**
 * Main function to fetch and process trends
 */
export async function fetchGoogleTrends(): Promise<{
  trends: string[];
  newsUrls: Map<string, string[]>;
}> {
  console.log('🔍 Fetching Google Trends for Germany...\n');
  
  // Fetch from RSS
  const rssTrends = await fetchTrendsRSS();
  console.log(`   Found ${rssTrends.length} trends from RSS`);
  
  // Filter for series-related
  const seriesTrends = filterSeriesTrends(rssTrends);
  console.log(`   ${seriesTrends.length} are series-related`);
  
  // Find news for each trend
  const newsUrls = new Map<string, string[]>();
  
  for (const trend of seriesTrends.slice(0, 10)) { // Limit to top 10
    console.log(`\n   📰 Searching news for: ${trend}`);
    const urls = await findNewsForTrend(trend);
    if (urls.length > 0) {
      newsUrls.set(trend, urls);
      console.log(`      Found ${urls.length} articles`);
    }
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Save to DB
  await saveTrendingTopics(seriesTrends);
  
  return {
    trends: seriesTrends,
    newsUrls,
  };
}

// CLI
if (require.main === module) {
  fetchGoogleTrends()
    .then(({ trends, newsUrls }) => {
      console.log('\n' + '='.repeat(60));
      console.log('TRENDING SERIEN');
      console.log('='.repeat(60));
      trends.forEach((t, i) => {
        console.log(`${i + 1}. ${t}`);
        const urls = newsUrls.get(t);
        if (urls) {
          urls.forEach(u => console.log(`   → ${u}`));
        }
      });
    })
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
