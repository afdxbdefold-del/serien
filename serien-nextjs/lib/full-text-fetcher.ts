/**
 * FULL TEXT FETCHER (Serverless Version)
 * 
 * Holt den vollständigen Artikel-Text von der Quelle
 * Verwendet fetch + cheerio (KEIN Playwright - funktioniert nicht auf Vercel)
 * Fallback: Jina AI Reader API
 */

import * as cheerio from 'cheerio';

export interface FullTextResult {
  fullText: string;
  wordCount: number;
  sourceDomain: string;
  title: string;
  headline: string;
  publishDate?: Date;
  rawText?: string;
}

// Site-specific selectors
const SITE_SELECTORS: Record<string, { content: string[]; title: string[]; remove: string[] }> = {
  'screenrant.com': {
    content: ['.article-body', '.content-block-regular', '[data-content]', '.w-article', 'article'],
    title: ['h1.display-card-title', 'h1[class*="title"]', 'h1'],
    remove: ['.author-bio', '.author-info', '.w-read-next', '.read-next', '.trending', '.valnet-group'],
  },
  'collider.com': {
    content: ['.article-body', '.content-block-regular', '[data-content]', 'article'],
    title: ['h1.display-card-title', 'h1[class*="title"]', 'h1'],
    remove: ['.author-bio', '.w-read-next', '.read-next', '.trending'],
  },
  'thecinemaholic.com': {
    content: ['.entry-content', '.post-content', 'article .content', 'article'],
    title: ['h1.entry-title', 'h1'],
    remove: ['.author-box', '.related-posts'],
  },
  'deadline.com': {
    content: ['.entry-content', '.article__content', 'article'],
    title: ['h1.post-title', 'h1'],
    remove: ['.author-bio', '.related'],
  },
  'variety.com': {
    content: ['.c-content', '.article-body', 'article'],
    title: ['h1.c-title', 'h1'],
    remove: ['.c-author', '.related'],
  },
};

const DEFAULT_SELECTORS = {
  content: ['article', '[itemprop="articleBody"]', '.article-content', '.post-content', '.entry-content', 'main', '.content'],
  title: ['h1', '[itemprop="headline"]', '.post-title', '.entry-title'],
  remove: ['script', 'style', 'iframe', 'nav', 'header', 'footer', 'aside', '.ad', '.advertisement', '.social-share', '.comments', '.related-posts', 'button', 'form', '.newsletter', '.subscribe', '.promo', '.sponsored'],
};

/**
 * Fetch and parse article using cheerio (serverless-compatible)
 */
async function fetchWithCheerio(url: string): Promise<FullTextResult | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.log(`   ⚠️ HTTP ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Get domain
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    
    // Get site-specific or default selectors
    const selectors = SITE_SELECTORS[domain] || DEFAULT_SELECTORS;
    
    // Remove unwanted elements
    const removeSelectors = [...DEFAULT_SELECTORS.remove, ...(selectors.remove || [])];
    $(removeSelectors.join(', ')).remove();
    
    // Find content element
    let $content: cheerio.Cheerio<cheerio.Element> | null = null;
    for (const selector of selectors.content) {
      const $el = $(selector);
      if ($el.length > 0 && $el.text().trim().length > 100) {
        $content = $el;
        break;
      }
    }
    
    if (!$content) {
      $content = $('body');
    }
    
    // Extract paragraphs
    const textParts: string[] = [];
    $content.find('p, h2, h3, h4, blockquote, li').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 30) {
        textParts.push(text);
      }
    });
    
    const fullText = textParts.join('\n\n');
    
    // Find title
    let title = '';
    for (const selector of selectors.title) {
      const $title = $(selector).first();
      if ($title.length > 0) {
        title = $title.text().trim();
        break;
      }
    }
    
    // Fallback: og:title or <title>
    if (!title) {
      title = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || '';
    }
    
    // Clean title (remove site name suffix)
    title = title.replace(/\s*[\|\-–]\s*(Screen\s*Rant|Collider|The\s*Cinemaholic|Deadline|Variety).*$/i, '').trim();
    
    const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;
    
    return {
      fullText,
      wordCount,
      sourceDomain: domain,
      title,
      headline: title,
      rawText: fullText,
    };
    
  } catch (error: any) {
    console.log(`   ⚠️ Cheerio fetch failed: ${error.message}`);
    return null;
  }
}

/**
 * Fetch article using Jina AI Reader (fallback)
 */
async function fetchWithJina(url: string): Promise<FullTextResult | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    
    // Parse Jina response (markdown format)
    const lines = text.split('\n');
    let title = '';
    let fullText = '';
    
    // First line is usually the title
    for (const line of lines) {
      if (line.startsWith('# ')) {
        title = line.replace(/^#\s*/, '').trim();
        break;
      }
      if (line.startsWith('Title:')) {
        title = line.replace(/^Title:\s*/, '').trim();
        break;
      }
    }
    
    // Rest is content
    fullText = lines
      .filter(line => !line.startsWith('Title:') && !line.startsWith('URL:') && !line.startsWith('Markdown Content:'))
      .join('\n')
      .trim();
    
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;
    
    return {
      fullText,
      wordCount,
      sourceDomain: domain,
      title: title || 'Article',
      headline: title || 'Article',
      rawText: fullText,
    };
    
  } catch (error: any) {
    console.log(`   ⚠️ Jina fetch failed: ${error.message}`);
    return null;
  }
}

/**
 * Main export: Fetch full article text (serverless-compatible)
 */
export async function fetchFullArticleText(url: string): Promise<FullTextResult> {
  console.log(`📄 Fetching full article text from: ${url.substring(0, 60)}...`);
  
  const domain = new URL(url).hostname.replace('www.', '');
  
  // Try cheerio first (fastest, most reliable for static sites)
  const cheerioResult = await fetchWithCheerio(url);
  
  if (cheerioResult && cheerioResult.wordCount > 100) {
    console.log(`   ✅ Cheerio: ${cheerioResult.wordCount} words`);
    console.log(`   Title: ${cheerioResult.title.substring(0, 60)}...`);
    return cheerioResult;
  }
  
  // Fallback: Jina Reader (better for JS-heavy sites)
  console.log(`   🔄 Trying Jina Reader fallback...`);
  const jinaResult = await fetchWithJina(url);
  
  if (jinaResult && jinaResult.wordCount > 50) {
    console.log(`   ✅ Jina: ${jinaResult.wordCount} words`);
    console.log(`   Title: ${jinaResult.title.substring(0, 60)}...`);
    return jinaResult;
  }
  
  // Return empty result if all methods failed
  console.log(`   ❌ All fetch methods failed`);
  return {
    fullText: '',
    wordCount: 0,
    sourceDomain: domain,
    title: '',
    headline: '',
    rawText: '',
  };
}
