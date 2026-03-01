/**
 * CinemaHolic Auto-Pipeline
 * Automatically processes fresh articles from The CinemaHolic
 */

import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';
import { runContentPipeline } from './pipeline-v1.js';

const prisma = new PrismaClient();

interface Article {
  title: string;
  url: string;
  excerpt: string;
}

/**
 * Crawl CinemaHolic homepage for fresh articles
 */
async function crawlCinemaHolic(): Promise<Article[]> {
  console.log('🕷️  Crawling CinemaHolic homepage...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://thecinemaholic.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    await page.waitForTimeout(3000);

    const articles = await page.evaluate(() => {
      const articleElements = document.querySelectorAll('article, div[class*="post"]');
      const results: { title: string; url: string; excerpt: string }[] = [];

      articleElements.forEach((article) => {
        const titleElement = 
          article.querySelector('h2 a') || 
          article.querySelector('h3 a') || 
          article.querySelector('a[title]') ||
          article.querySelector('a');
        
        if (titleElement) {
          const title = (titleElement as HTMLElement).innerText || 
                       (titleElement as HTMLAnchorElement).title || '';
          const url = (titleElement as HTMLAnchorElement).href || '';
          
          const excerptElement = article.querySelector('p, div[class*="excerpt"]');
          const excerpt = excerptElement ? (excerptElement as HTMLElement).innerText : '';

          if (title && url) {
            results.push({ title, url, excerpt });
          }
        }
      });

      return results;
    });

    await browser.close();
    
    // Filter for TV series news
    const filtered = articles.filter(article => {
      const lowerTitle = article.title.toLowerCase();
      const lowerExcerpt = article.excerpt.toLowerCase();
      
      const tvKeywords = [
        'season', 'episode', 'series', 'show', 'tv', 'streaming',
        'netflix', 'hbo', 'amazon', 'apple tv', 'hulu', 'paramount',
        'staffel', 'folge', 'serie'
      ];
      
      return tvKeywords.some(keyword => 
        lowerTitle.includes(keyword) || lowerExcerpt.includes(keyword)
      );
    });

    console.log(`✅ Found ${articles.length} total articles, ${filtered.length} TV-related`);
    return filtered;

  } catch (error) {
    await browser.close();
    throw error;
  }
}

/**
 * Main auto-pipeline function
 */
async function processCinemaHolicArticles() {
  console.log('🚀 CinemaHolic Auto-Pipeline Starting...\n');
  console.log('━'.repeat(70));
  
  try {
    // Get fresh articles
    const articles = await crawlCinemaHolic();
    
    if (articles.length === 0) {
      console.log('⚠️  No TV-related articles found. Exiting.');
      return;
    }
    
    console.log(`\n📊 Found ${articles.length} TV-related articles`);
    console.log('━'.repeat(70));
    
    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    // Process each article
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      
      console.log(`\n[${i + 1}/${articles.length}] ${article.title}`);
      console.log(`URL: ${article.url}`);
      
      // Check if already processed
      const urlParts = article.url.split('/');
      const possibleSlug = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
      
      const existing = await prisma.articles.findFirst({
        where: {
          OR: [
            { slug: { contains: possibleSlug.substring(0, 30) } },
            { sourceUrl: article.url },
            { title: { contains: article.title.substring(0, 50) } },
          ],
        },
        select: { id: true, slug: true },
      });
      
      if (existing) {
        console.log(`⏭️  Already processed (${existing.slug})`);
        skippedCount++;
        continue;
      }
      
      // Process through pipeline
      try {
        console.log('🔄 Running through pipeline...');
        
        const result = await runContentPipeline({
          url: article.url,
          title: article.title,
          text: '', // Will be fetched by pipeline
          useFullTextMode: false,
        });
        
        if (result.success) {
          console.log('✅ Article published successfully!');
          processedCount++;
        } else {
          console.log(`⏭️  Skipped or failed`);
          skippedCount++;
        }
        
        // Small delay between articles (be respectful to the server)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error: any) {
        console.error(`❌ Pipeline failed: ${error.message}`);
        failedCount++;
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 CinemaHolic Auto-Pipeline Complete!');
    console.log('='.repeat(70));
    console.log(`✅ Processed: ${processedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`📦 Total: ${articles.length}`);
    
  } catch (error) {
    console.error('❌ Auto-pipeline failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run
processCinemaHolicArticles().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
