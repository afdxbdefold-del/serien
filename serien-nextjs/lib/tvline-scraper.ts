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
    
    // Extract articles (first page only, no pagination)
    const articles: TVLineArticle[] = [];
    
    // TVLine uses article tags with specific classes
    // Match article blocks: <article class="post-...">
    const articleRegex = /<article[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    const articleMatches = Array.from(html.matchAll(articleRegex));
    
    console.log(`   Found ${articleMatches.length} articles on first page`);
    
    for (const match of articleMatches) {
      const articleHtml = match[1];
      
      // Extract URL from <a href="..." class="post-title-link">
      const urlMatch = articleHtml.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*post-title-link[^"]*"/i);
      
      // Extract title from <h2 class="post-title">
      const titleMatch = articleHtml.match(/<h2[^>]*class="[^"]*post-title[^"]*"[^>]*>(.*?)<\/h2>/i);
      
      // Extract date from <time datetime="...">
      const dateMatch = articleHtml.match(/<time[^>]*datetime="([^"]+)"/i);
      
      if (urlMatch && titleMatch) {
        const url = urlMatch[1];
        const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
        const date = dateMatch ? dateMatch[1] : new Date().toISOString();
        
        // Only add TV series articles (skip movie-only posts)
        if (!url.includes('/movie/') && !url.includes('/box-office/')) {
          articles.push({
            url,
            title,
            date,
          });
        }
      }
    }
    
    // Sort by date (newest first)
    articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Limit to first 15 articles (freshest news)
    const freshArticles = articles.slice(0, 15);
    
    console.log(`✅ Scraped ${freshArticles.length} fresh articles from TVLine`);
    console.log('   Newest:', freshArticles[0]?.title.substring(0, 60) + '...');
    console.log('   Oldest:', freshArticles[freshArticles.length - 1]?.title.substring(0, 60) + '...');
    
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
