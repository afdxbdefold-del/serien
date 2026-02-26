/**
 * The Cinema Holic Crawler
 * 
 * Crawlt nur die Startseite (ohne Load More) und filtert TV-Serien News
 */

import { chromium } from 'playwright';
import { runContentPipeline } from './pipeline-v1';

interface Article {
  title: string;
  url: string;
  excerpt: string;
}

async function crawlCinemaHolic(): Promise<Article[]> {
  console.log('\n🕷️  Starting Cinema Holic Crawler...');
  console.log('Target: https://thecinemaholic.com/');
  console.log('Mode: Homepage only (no pagination)\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Load homepage
    console.log('📄 Loading homepage...');
    await page.goto('https://thecinemaholic.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for articles to load
    await page.waitForTimeout(3000);

    console.log('✅ Page loaded');

    // Extract articles from homepage
    const articles = await page.evaluate(() => {
      const articleElements = document.querySelectorAll('article, .post, .entry');
      const results: { title: string; url: string; excerpt: string }[] = [];

      articleElements.forEach((article) => {
        // Find title and link
        const titleElement = article.querySelector('h2 a, h3 a, .entry-title a, .post-title a');
        const excerptElement = article.querySelector('.excerpt, .entry-excerpt, .post-excerpt, p');
        
        if (titleElement && titleElement.textContent) {
          const title = titleElement.textContent.trim();
          const url = titleElement.getAttribute('href') || '';
          const excerpt = excerptElement?.textContent?.trim() || '';

          // Only TV series related articles
          const isTVRelated = 
            title.toLowerCase().includes('season') ||
            title.toLowerCase().includes('series') ||
            title.toLowerCase().includes('show') ||
            title.toLowerCase().includes('tv') ||
            title.toLowerCase().includes('renewed') ||
            title.toLowerCase().includes('canceled') ||
            title.toLowerCase().includes('premiere') ||
            title.toLowerCase().includes('finale');

          if (isTVRelated && url && url.startsWith('http')) {
            results.push({ title, url, excerpt });
          }
        }
      });

      return results;
    });

    console.log(`\n📊 Found ${articles.length} TV-related articles on homepage`);

    await browser.close();
    return articles;

  } catch (error) {
    console.error('❌ Crawler error:', error);
    await browser.close();
    return [];
  }
}

async function fetchArticleContent(url: string): Promise<string> {
  console.log(`   Fetching content from: ${url.substring(0, 60)}...`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Extract article text
    const content = await page.evaluate(() => {
      const article = document.querySelector('article, .entry-content, .post-content, .content');
      if (!article) return '';

      // Remove scripts, styles, ads
      article.querySelectorAll('script, style, iframe, .ad, .advertisement').forEach(el => el.remove());

      // Get text content
      const paragraphs = article.querySelectorAll('p');
      const text = Array.from(paragraphs)
        .map(p => p.textContent?.trim())
        .filter(t => t && t.length > 50) // Only substantial paragraphs
        .join('\n\n');

      return text.substring(0, 2000); // Limit to 2000 chars
    });

    await browser.close();
    return content;

  } catch (error) {
    console.error('   ⚠️  Failed to fetch content');
    await browser.close();
    return '';
  }
}

async function main() {
  console.log('\n🎬 CINEMA HOLIC CRAWLER');
  console.log('='.repeat(70));

  // Step 1: Crawl homepage
  const articles = await crawlCinemaHolic();

  if (articles.length === 0) {
    console.log('\n❌ No TV-related articles found');
    return;
  }

  // Step 2: Process first 5 articles
  const limit = Math.min(5, articles.length);
  console.log(`\n📝 Processing top ${limit} articles...\n`);

  const results = [];

  for (let i = 0; i < limit; i++) {
    const article = articles[i];
    
    console.log(`\n[${ i + 1}/${limit}] ${article.title}`);
    console.log('─'.repeat(70));

    try {
      // Fetch full content
      const content = await fetchArticleContent(article.url);

      if (!content || content.length < 200) {
        console.log('   ⚠️  SKIPPED: Content too short or unavailable');
        results.push({ title: article.title, status: 'SKIPPED', reason: 'content_too_short' });
        continue;
      }

      // Run through pipeline
      const pipelineResult = await runContentPipeline({
        title: article.title,
        url: article.url,
        text: content
      });

      if ('skipped' in pipelineResult && pipelineResult.skipped) {
        console.log(`   ⚠️  SKIPPED: ${pipelineResult.reason}`);
        results.push({ 
          title: article.title, 
          status: 'SKIPPED', 
          reason: pipelineResult.reason 
        });
      } else if ('success' in pipelineResult && pipelineResult.success) {
        console.log(`   ✅ SUCCESS: ${pipelineResult.article.slug}`);
        console.log(`   Mode: ${pipelineResult.article.publishMode}`);
        results.push({ 
          title: article.title, 
          status: 'SUCCESS', 
          slug: pipelineResult.article.slug,
          publishMode: pipelineResult.article.publishMode 
        });
      }

    } catch (error: any) {
      console.error(`   ❌ ERROR: ${error.message}`);
      results.push({ 
        title: article.title, 
        status: 'ERROR', 
        error: error.message 
      });
    }

    // Rate limiting
    if (i < limit - 1) {
      console.log('\n⏳ Waiting 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 CINEMA HOLIC CRAWLER SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.status === 'SUCCESS').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  console.log(`✅ Successful: ${successful}/${limit}`);
  console.log(`⚠️  Skipped: ${skipped}/${limit}`);
  console.log(`❌ Errors: ${errors}/${limit}`);

  console.log('\n📝 Results:');
  results.forEach((r, i) => {
    const icon = r.status === 'SUCCESS' ? '✅' : r.status === 'SKIPPED' ? '⚠️' : '❌';
    console.log(`\n${icon} ${i + 1}. ${r.title.substring(0, 60)}...`);
    if (r.status === 'SUCCESS' && 'publishMode' in r) {
      console.log(`   Mode: ${r.publishMode}`);
    } else if (r.status === 'SKIPPED' && 'reason' in r) {
      console.log(`   Reason: ${r.reason}`);
    }
  });

  console.log('\n✅ Cinema Holic Crawler complete!\n');
}

if (require.main === module) {
  main().catch(console.error);
}
