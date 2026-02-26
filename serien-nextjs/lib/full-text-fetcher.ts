/**
 * FULL TEXT FETCHER
 * 
 * Holt den vollständigen Artikel-Text von der Quelle
 * Verwendet Readability + Fallback-Selektoren
 */

import { chromium } from 'playwright';

export interface FullTextResult {
  fullText: string;
  wordCount: number;
  sourceDomain: string;
  title: string;
  publishDate?: Date;
}

export async function fetchFullArticleText(url: string): Promise<FullTextResult> {
  console.log(`📄 Fetching full article text from: ${url.substring(0, 60)}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);

    // Extract full content
    const result = await page.evaluate(() => {
      // Try multiple selectors
      const selectors = [
        'article',
        '[itemprop="articleBody"]',
        '.article-content',
        '.post-content',
        '.entry-content',
        'main article',
        '.content'
      ];

      let contentElement: Element | null = null;

      for (const selector of selectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
      }

      if (!contentElement) {
        contentElement = document.querySelector('body');
      }

      if (!contentElement) {
        return { fullText: '', title: '', sourceDomain: '' };
      }

      // Remove unwanted elements
      contentElement.querySelectorAll(
        'script, style, iframe, nav, header, footer, aside, .ad, .advertisement, ' +
        '.social-share, .comments, .related-posts, button, form'
      ).forEach(el => el.remove());

      // Get all paragraphs
      const paragraphs = contentElement.querySelectorAll('p, h2, h3, h4, blockquote, ul, ol');
      
      const textContent: string[] = [];
      paragraphs.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 30) { // Only substantial content
          textContent.push(text);
        }
      });

      // Get title
      const titleElement = 
        document.querySelector('h1.entry-title') ||
        document.querySelector('h1') ||
        document.querySelector('.post-title') ||
        document.querySelector('[itemprop="headline"]');
      
      const title = titleElement?.textContent?.trim() || '';

      // Get domain
      const sourceDomain = window.location.hostname.replace('www.', '');

      return {
        fullText: textContent.join('\n\n'),
        title,
        sourceDomain
      };
    });

    await browser.close();

    const wordCount = result.fullText.split(/\s+/).filter(w => w.length > 0).length;

    console.log(`   ✅ Fetched: ${wordCount} words`);
    console.log(`   Title: ${result.title}`);
    console.log(`   Domain: ${result.sourceDomain}`);

    return {
      fullText: result.fullText,
      wordCount,
      sourceDomain: result.sourceDomain,
      title: result.title
    };

  } catch (error) {
    console.error('   ❌ Failed to fetch full text:', error);
    await browser.close();
    
    // Return minimal result
    const domain = new URL(url).hostname.replace('www.', '');
    return {
      fullText: '',
      wordCount: 0,
      sourceDomain: domain,
      title: ''
    };
  }
}
