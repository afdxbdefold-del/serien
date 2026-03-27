/**
 * Google Trends Scraper for TV Series
 * Fetches trending TV-related searches in Germany
 */

import 'dotenv/config';
import { load as cheerioLoad } from 'cheerio';
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
  // Serien-Formate
  'serie', 'series', 'show', 'sendung',
  'tatort', 'polizeiruf', 'krimi', 'soap',
];

// Keywords für konkreten Serien-Anlass (MUSS vorhanden sein)
const EVENT_KEYWORDS = [
  // Staffeln & Folgen
  'staffel', 'season', 'folge', 'episode', 'finale', 'start',
  // Cast & Crew
  'cast', 'besetzung', 'darsteller', 'schauspieler', 'ausstieg', 'einstieg',
  'hauptrolle', 'rolle', 'ersetzt', 'verlässt', 'kehrt zurück',
  // Produktion
  'dreharbeiten', 'dreh', 'fortsetzung', 'spin-off', 'reboot', 'remake',
  'abgesetzt', 'cancelled', 'verlängert', 'renewed', 'bestätigt',
  // Streaming
  'netflix', 'prime', 'disney+', 'disney plus', 'amazon', 'streaming',
  'hbo', 'sky', 'paramount', 'apple tv', 'ard', 'zdf', 'mediathek',
  // Release
  'trailer', 'teaser', 'erscheint', 'startet', 'kommt', 'release',
  'neuheiten', 'neu bei', 'ab sofort',
];

const EXCLUDE_KEYWORDS = [
  'fußball', 'football', 'bundesliga', 'champions league', 'dfb', 'em 2024',
  'formel 1', 'f1', 'tennis', 'basketball', 'handball', 'olympia',
  'wetter', 'unwetter', 'sturm',
  'politik', 'bundestag', 'regierung', 'minister', 'partei', 'wahl',
  'aktie', 'börse', 'dax', 'bitcoin', 'krypto',
  'unfall', 'polizei', 'festnahme', 'mord', 'prozess', 'gericht',
  'rezept', 'kochen', 'backen',
  'konzert', 'tour', 'album', 'song', 'musik',
];

// Cache for DB series names
let dbSeriesNames: string[] = [];
let dbSeriesLoaded = false;

/**
 * Load all series names from database
 */
async function loadSeriesFromDB(): Promise<string[]> {
  if (dbSeriesLoaded) return dbSeriesNames;
  
  try {
    const series = await prisma.series.findMany({
      select: { name: true, title: true },
    });
    
    dbSeriesNames = series.flatMap(s => {
      const names: string[] = [];
      if (s.name) names.push(s.name.toLowerCase());
      if (s.title && s.title !== s.name) names.push(s.title.toLowerCase());
      return names;
    }).filter(n => n.length > 3); // Skip very short names
    
    dbSeriesLoaded = true;
    console.log(`   📺 ${dbSeriesNames.length} Serien aus DB geladen`);
    
  } catch (error) {
    console.error('   ⚠️ Konnte Serien nicht aus DB laden');
  }
  
  return dbSeriesNames;
}

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
      const $ = cheerioLoad(xml, { xmlMode: true });
      
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
 * Filter trends to only include TV series related topics WITH a concrete event
 * Must have: Series reference + Event keyword (new season, cast change, etc.)
 */
async function filterSeriesTrends(trends: string[]): Promise<string[]> {
  // Load series from DB
  const dbSeries = await loadSeriesFromDB();
  
  return trends.filter(trend => {
    const lower = trend.toLowerCase();
    
    // Exclude non-entertainment topics
    if (EXCLUDE_KEYWORDS.some(kw => lower.includes(kw))) {
      return false;
    }
    
    // MUST have an event keyword (staffel, cast, start, etc.)
    const hasEventKeyword = EVENT_KEYWORDS.some(kw => lower.includes(kw));
    
    if (!hasEventKeyword) {
      return false; // No concrete series event = skip
    }
    
    // Check if it's about a known series
    const isKnownSeries = dbSeries.some(series => {
      // Series name must be in trend (not just partial match)
      const seriesWords = series.split(' ');
      return seriesWords.some(word => word.length > 3 && lower.includes(word));
    });
    
    // Or contains a series keyword
    const hasSeriesKeyword = SERIES_KEYWORDS.some(kw => lower.includes(kw));
    
    return isKnownSeries || hasSeriesKeyword;
  });
}

/**
 * Check if a trend is related to TV via TMDB search
 * Returns true ONLY if we find a strong TMDB match with ID
 */
async function checkTMDBForSeries(trend: string): Promise<{ isSeries: boolean; tmdbId?: number; name?: string }> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return { isSeries: false };
  
  const lower = trend.toLowerCase();
  
  // Skip very short or generic terms
  if (trend.length < 4 || ['teams', 'news', 'live', 'app', 'video', 'mario', 'merz', 'abba'].includes(lower)) {
    return { isSeries: false };
  }
  
  // Exclude obvious non-series terms
  const nonSeriesKeywords = ['politik', 'wahl', 'partei', 'cdu', 'spd', 'afd', 'grüne', 'bundestag', 
                             'fußball', 'bundesliga', 'champions', 'wm ', 'em ', 'dfb',
                             'wetter', 'börse', 'aktie', 'dax', 'bitcoin'];
  if (nonSeriesKeywords.some(kw => lower.includes(kw))) {
    return { isSeries: false };
  }
  
  try {
    // Remove event keywords to get series name
    let searchTerm = trend;
    for (const kw of EVENT_KEYWORDS) {
      searchTerm = searchTerm.replace(new RegExp(kw, 'gi'), '').trim();
    }
    
    if (searchTerm.length < 3) return { isSeries: false };
    
    const url = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(searchTerm)}&language=de-DE`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const series = data.results[0];
      const trendLower = searchTerm.toLowerCase();
      const seriesLower = series.name.toLowerCase();
      
      // Check for strong match (must be close to exact)
      const isStrongMatch = seriesLower.startsWith(trendLower) || 
                            trendLower.startsWith(seriesLower) ||
                            (seriesLower.includes(trendLower) && trendLower.length > 5);
      
      const firstWord = seriesLower.split(' ')[0];
      const isPopularMatch = series.vote_count > 500 && trendLower.includes(firstWord) && firstWord.length > 3;
      
      if (isStrongMatch || isPopularMatch) {
        return { isSeries: true, tmdbId: series.id, name: series.name };
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return { isSeries: false };
}

/**
 * Enhanced filter that also checks TMDB
 */
async function filterSeriesTrendsEnhanced(trends: string[]): Promise<string[]> {
  const basicFiltered = await filterSeriesTrends(trends);
  const results: string[] = [...basicFiltered];
  
  // For trends that didn't pass basic filter, check TMDB
  const unchecked = trends.filter(t => !basicFiltered.includes(t));
  
  for (const trend of unchecked.slice(0, 10)) { // Limit API calls
    const tmdbCheck = await checkTMDBForSeries(trend);
    if (tmdbCheck.isSeries) {
      console.log(`   ✓ TMDB match: "${trend}" → ${tmdbCheck.name}`);
      results.push(trend);
    }
  }
  
  return results;
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
    const $ = cheerioLoad(html);
    
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
 * Save trending topics to database - ONLY with verified TMDB ID
 */
async function saveTrendingTopics(trends: string[]): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (const trend of trends) {
    try {
      // TMDB-Validierung: Nur Trends mit bestätigter Serie speichern
      const tmdbCheck = await checkTMDBForSeries(trend);
      
      if (!tmdbCheck.isSeries || !tmdbCheck.tmdbId) {
        console.log(`   ⏭️ Übersprungen (keine TMDB-ID): ${trend}`);
        continue;
      }
      
      console.log(`   ✅ Speichere: ${trend} → ${tmdbCheck.name} (TMDB: ${tmdbCheck.tmdbId})`);
      
      await prisma.trending_topics.upsert({
        where: {
          query_date: {
            query: trend,
            date: today,
          }
        },
        update: {
          fetchedAt: new Date(),
          tmdbId: tmdbCheck.tmdbId,
        },
        create: {
          query: trend,
          title: trend,
          category: 'series',
          growth: 'trending',
          tmdbId: tmdbCheck.tmdbId,
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
  
  // Filter for series-related (basic + TMDB check)
  const seriesTrends = await filterSeriesTrendsEnhanced(rssTrends);
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
    await new Promise(r => setTimeout(r, 500));
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
