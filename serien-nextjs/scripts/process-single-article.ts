/**
 * Single Article Pipeline Test
 * 
 * Fetches a specific article and runs it through the pipeline
 */

import { chromium } from 'playwright';
import { runContentPipeline } from './pipeline-v1';

async function fetchAndProcessArticle(url: string) {
  console.log('\n🎬 SINGLE ARTICLE PIPELINE TEST');
  console.log('='.repeat(70));
  console.log(`URL: ${url}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('📄 Loading article page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Extract article data
    const articleData = await page.evaluate(() => {
      // Get title
      const titleElement = 
        document.querySelector('h1.entry-title') ||
        document.querySelector('h1') ||
        document.querySelector('.post-title');
      
      const title = titleElement?.textContent?.trim() || '';

      // Get article content
      const contentElement = 
        document.querySelector('.entry-content') ||
        document.querySelector('article') ||
        document.querySelector('.post-content');

      if (!contentElement) return { title, content: '' };

      // Remove unwanted elements
      contentElement.querySelectorAll('script, style, iframe, .ad, .advertisement, .social-share').forEach(el => el.remove());

      // Get paragraphs
      const paragraphs = contentElement.querySelectorAll('p');
      const content = Array.from(paragraphs)
        .map(p => p.textContent?.trim())
        .filter(t => t && t.length > 30)
        .join('\n\n');

      return { title, content };
    });

    await browser.close();

    if (!articleData.title || !articleData.content) {
      console.log('❌ Failed to extract article data');
      return;
    }

    console.log(`✅ Article extracted:`);
    console.log(`   Title: ${articleData.title}`);
    console.log(`   Content length: ${articleData.content.length} chars`);
    console.log('');

    // Run through pipeline
    console.log('🚀 Running through pipeline...\n');

    const result = await runContentPipeline({
      title: articleData.title,
      url: url,
      text: articleData.content
    });

    // Display result
    console.log('\n' + '='.repeat(70));
    console.log('📊 PIPELINE RESULT');
    console.log('='.repeat(70));

    if ('skipped' in result && result.skipped) {
      console.log(`\n⚠️  SKIPPED`);
      console.log(`   Reason: ${result.reason}`);
      
      if ('draft' in result && result.draft) {
        console.log(`   Draft saved: ${result.draft.id}`);
      }
    } else if ('success' in result && result.success) {
      console.log(`\n✅ SUCCESS - Article published!`);
      console.log(`   Article ID: ${result.article.id}`);
      console.log(`   Slug: ${result.article.slug}`);
      console.log(`   Publish Mode: ${result.article.publishMode}`);
      console.log(`   Content Type: ${result.classification.content_type}`);
      console.log(`   Primary Series: ${result.resolution.primarySeries.name}`);
      console.log('');
      console.log(`   🌐 View at: https://serien-5v18x10.vercel.app/${result.article.slug}`);
    }

  } catch (error: any) {
    await browser.close();
    console.error('\n❌ Error:', error.message);
  }
}

async function main() {
  const url = process.argv[2] || 'https://thecinemaholic.com/tell-me-lies-season-3-ending-explained/';
  await fetchAndProcessArticle(url);
}

if (require.main === module) {
  main().catch(console.error);
}
