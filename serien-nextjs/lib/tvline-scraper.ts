/**
 * TVLine Source Scraper
 * Scrapes fresh streaming news from TVLine (first page only)
 */

interface TVLineArticle {
  url: string;
  title: string;
  date: string;
  excerpt?: string;
}

/**
 * Scrape TVLine streaming category (first page only)
 */
export async function scrapeTVLineStreaming(): Promise<TVLineArticle[]> {
  const sourceUrl = 'https://www.tvline.com/category/streaming/';
  
  console.log('🔍 Scraping TVLine streaming news...');
  console.log(`   Source: ${sourceUrl}`);
  
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    if (!response.ok) {
      throw new Error(`TVLine fetch failed: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Extract articles using h3/h2 with article links
    const articles: TVLineArticle[] = [];
    
    // Pattern: <h3><a href="/path/">TITLE</a></h3>
    // The links are relative paths, we need to convert them to full URLs
    const titleRegex = /<h[23][^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
    const matches = Array.from(html.matchAll(titleRegex));
    
    console.log(`   Found ${matches.length} article links`);
    
    for (const match of matches) {
      let url = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      
      // Convert relative URLs to absolute
      if (url.startsWith('/')) {
        url = `https://tvline.com${url}`;
      }
      
      // Only include tvline.com URLs
      if (!url.includes('tvline.com')) {
        continue;
      }
      
      // Skip if URL contains movie/box-office
      if (url.includes('/movie/') || url.includes('/box-office/')) {
        continue;
      }
      
      // Extract date from surrounding context (if available)
      const date = new Date().toISOString();
      
      articles.push({
        url,
        title,
        date,
      });
    }
    
    // Remove duplicates by URL
    const uniqueArticles = Array.from(
      new Map(articles.map(a => [a.url, a])).values()
    );
    
    // Limit to first 15 articles (freshest news)
    const freshArticles = uniqueArticles.slice(0, 15);
    
    console.log(`✅ Scraped ${freshArticles.length} fresh articles from TVLine`);
    if (freshArticles.length > 0) {
      console.log('   Newest:', freshArticles[0]?.title.substring(0, 60) + '...');
      console.log('   Oldest:', freshArticles[freshArticles.length - 1]?.title.substring(0, 60) + '...');
    }
    
    return freshArticles;
    
  } catch (error) {
    console.error('❌ TVLine scraping failed:', error);
    return [];
  }
}

/**
 * Get next article to process from TVLine
 * Returns the first unprocessed article
 */
export async function getNextTVLineArticle(db: any): Promise<string | null> {
  const articles = await scrapeTVLineStreaming();
  
  if (articles.length === 0) {
    console.log('⚠️  No articles found on TVLine');
    return null;
  }
  
  // Check which articles are already in the database
  for (const article of articles) {
    // Extract slug from URL for duplicate check
    const urlParts = article.url.split('/');
    const possibleSlug = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
    
    // Check if article with similar slug exists
    const existing = await db.article.findFirst({
      where: {
        OR: [
          { slug: { contains: possibleSlug } },
          { title: article.title },
        ],
      },
      select: { id: true },
    });
    
    if (!existing) {
      console.log(`📰 Next article: ${article.title}`);
      return article.url;
    }
  }
  
  console.log('ℹ️  All TVLine articles already processed');
  return null;
}
