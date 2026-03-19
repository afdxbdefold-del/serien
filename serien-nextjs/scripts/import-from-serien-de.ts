/**
 * SERIEN.DE CONTENT IMPORTER
 * 
 * Imports all articles from serien.de (owned by the same operator)
 * - Fetches article list from sitemap
 * - Scrapes full content including images
 * - Stores in local database with original content
 * - Downloads and re-hosts images to Emergent Object Storage
 */

import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

// ========== EMERGENT OBJECT STORAGE ==========
const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";
const APP_NAME = "serien-nextjs";
let storageKey: string | null = null;

interface ImportedArticle {
  url: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  category: string;
  heroImage: string | null;
  images: string[];
  publishedAt: Date;
}

interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Initialize Emergent Object Storage
 */
async function initStorage(): Promise<string> {
  if (storageKey) return storageKey;

  const emergentKey = process.env.EMERGENT_LLM_KEY;
  if (!emergentKey) {
    throw new Error('EMERGENT_LLM_KEY not found in environment');
  }

  const response = await fetch(`${STORAGE_URL}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergent_key: emergentKey }),
  });

  if (!response.ok) {
    throw new Error(`Storage init failed: ${response.statusText}`);
  }

  const data = await response.json();
  storageKey = data.storage_key;
  console.log('✅ Emergent Object Storage initialized');
  return storageKey!;
}

/**
 * Upload image to Emergent Object Storage
 */
async function uploadImageToStorage(
  imageUrl: string,
  slug: string,
  index: number
): Promise<string | null> {
  try {
    const key = await initStorage();
    
    // Download the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`   ⚠️  Failed to download image: ${imageUrl}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Determine file extension
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('gif')) ext = 'gif';
    
    const storagePath = `${APP_NAME}/imported/${slug}/${index === 0 ? 'hero' : `image-${index}`}.${ext}`;
    
    // Upload to storage
    const uploadResponse = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
      method: 'PUT',
      headers: {
        'X-Storage-Key': key,
        'Content-Type': contentType,
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      console.log(`   ⚠️  Failed to upload image: ${uploadResponse.statusText}`);
      return null;
    }

    const result = await uploadResponse.json();
    return result.path;
  } catch (error: any) {
    console.log(`   ⚠️  Image upload error: ${error.message}`);
    return null;
  }
}

/**
 * Fetch all article URLs from sitemap
 */
async function fetchArticleUrls(): Promise<string[]> {
  console.log('📋 Fetching article URLs from sitemap...');
  
  const response = await fetch('https://serien.de/post-sitemap.xml');
  const xml = await response.text();
  
  // Extract URLs using regex (simple approach)
  const urls: string[] = [];
  const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
  
  for (const match of matches) {
    urls.push(match[1]);
  }
  
  console.log(`✅ Found ${urls.length} article URLs`);
  return urls;
}

/**
 * Generate slug from URL
 */
function extractSlugFromUrl(url: string): string {
  const path = new URL(url).pathname;
  return path.replace(/^\/|\/$/g, '');
}

/**
 * Scrape a single article from serien.de
 */
async function scrapeArticle(url: string): Promise<ImportedArticle | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`   ❌ Failed to fetch: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract title
    const title = $('h1').first().text().trim() || 
                  $('title').text().replace(' - serien.de', '').trim();
    
    if (!title) {
      console.log('   ❌ No title found');
      return null;
    }
    
    // Extract main content
    const contentSelectors = [
      'article .entry-content',
      '.entry-content',
      'article',
      '.post-content',
      '.content'
    ];
    
    let contentHtml = '';
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        // Remove unwanted elements
        element.find('script, style, .sharedaddy, .share-buttons, .related-posts, .comments, form, .navigation').remove();
        contentHtml = element.html() || '';
        break;
      }
    }
    
    if (!contentHtml) {
      // Fallback: get body content
      $('body').find('header, footer, nav, aside, script, style, .sidebar').remove();
      contentHtml = $('body').html() || '';
    }
    
    // Extract excerpt (first paragraph or meta description)
    const excerpt = $('meta[name="description"]').attr('content') ||
                    $('p').first().text().trim().substring(0, 300) ||
                    '';
    
    // Extract category
    const category = $('a[rel="category tag"]').first().text().trim() ||
                     $('.category').first().text().trim() ||
                     'Allgemein';
    
    // Extract hero image
    const heroImage = $('article img').first().attr('src') ||
                      $('meta[property="og:image"]').attr('content') ||
                      $('.entry-content img').first().attr('src') ||
                      null;
    
    // Extract all images
    const images: string[] = [];
    $('article img, .entry-content img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('data:image') && !images.includes(src)) {
        images.push(src);
      }
    });
    
    // Extract publish date
    const dateStr = $('time').attr('datetime') ||
                    $('meta[property="article:published_time"]').attr('content') ||
                    null;
    const publishedAt = dateStr ? new Date(dateStr) : new Date();
    
    return {
      url,
      slug: extractSlugFromUrl(url),
      title,
      content: contentHtml,
      excerpt,
      category,
      heroImage,
      images,
      publishedAt
    };
    
  } catch (error: any) {
    console.log(`   ❌ Scrape error: ${error.message}`);
    return null;
  }
}

/**
 * Save article to database
 */
async function saveArticle(article: ImportedArticle, uploadImages: boolean = true): Promise<boolean> {
  try {
    // Check if article already exists by slug or sourceUrl
    const existingBySlug = await prisma.articles.findUnique({
      where: { slug: article.slug }
    });
    
    if (existingBySlug) {
      console.log(`   ⏭️  Already exists (slug): ${article.slug}`);
      return false;
    }
    
    const existingByUrl = await prisma.articles.findUnique({
      where: { sourceUrl: article.url }
    });
    
    if (existingByUrl) {
      console.log(`   ⏭️  Already exists (url): ${article.slug}`);
      return false;
    }
    
    // Upload hero image if enabled
    let heroImagePath = article.heroImage;
    if (uploadImages && article.heroImage) {
      const uploadedPath = await uploadImageToStorage(article.heroImage, article.slug, 0);
      if (uploadedPath) {
        heroImagePath = uploadedPath;
        console.log(`   📷 Hero image uploaded`);
      }
    }
    
    // Get or create default author
    let author = await prisma.users.findFirst({
      where: { email: 'redaktion@serien.de' }
    });
    
    if (!author) {
      author = await prisma.users.create({
        data: {
          id: crypto.randomUUID(),
          email: 'redaktion@serien.de',
          name: 'serien.de Redaktion',
          role: 'AUTHOR'
        }
      });
    }
    
    // Generate unique ID
    const articleId = crypto.randomUUID();
    
    // Create article using correct schema field names
    await prisma.articles.create({
      data: {
        id: articleId,
        slug: article.slug,
        title: article.title,
        contentHtml: article.content,
        excerpt: article.excerpt,
        heroImageUrl: heroImagePath,
        heroLocalUrl: heroImagePath,
        category: article.category,
        status: 'published',
        publishedAt: article.publishedAt,
        updatedAt: new Date(),
        authorId: author.id,
        sourceUrl: article.url,
        contentType: 'IMPORTED',
        publishMode: 'DISCOVER',
        imageAttribution: 'serien.de'
      }
    });
    
    return true;
    
  } catch (error: any) {
    console.log(`   ❌ Save error: ${error.message}`);
    return false;
  }
}

/**
 * Main import function
 */
export async function importFromSerienDe(options: {
  limit?: number;
  skipImages?: boolean;
  startFrom?: number;
  dryRun?: boolean;
} = {}): Promise<ImportStats> {
  const { limit, skipImages = false, startFrom = 0, dryRun = false } = options;
  
  console.log('\n' + '='.repeat(70));
  console.log('🚀 SERIEN.DE CONTENT IMPORTER');
  console.log('='.repeat(70));
  console.log(`Options: limit=${limit || 'all'}, skipImages=${skipImages}, startFrom=${startFrom}, dryRun=${dryRun}\n`);
  
  const stats: ImportStats = {
    total: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };
  
  try {
    // Initialize storage if uploading images
    if (!skipImages && !dryRun) {
      await initStorage();
    }
    
    // Fetch all article URLs
    let urls = await fetchArticleUrls();
    stats.total = urls.length;
    
    // Apply startFrom
    if (startFrom > 0) {
      urls = urls.slice(startFrom);
      console.log(`⏭️  Starting from index ${startFrom}`);
    }
    
    // Apply limit
    if (limit) {
      urls = urls.slice(0, limit);
      console.log(`📊 Processing ${urls.length} of ${stats.total} articles`);
    }
    
    // Process each article
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const progress = `[${i + 1}/${urls.length}]`;
      
      console.log(`\n${progress} Processing: ${extractSlugFromUrl(url)}`);
      
      // Scrape article
      const article = await scrapeArticle(url);
      
      if (!article) {
        stats.failed++;
        stats.errors.push(`Failed to scrape: ${url}`);
        continue;
      }
      
      if (dryRun) {
        console.log(`   📝 Title: ${article.title}`);
        console.log(`   📂 Category: ${article.category}`);
        console.log(`   📷 Images: ${article.images.length}`);
        console.log(`   ✅ DRY RUN - would import`);
        stats.imported++;
        continue;
      }
      
      // Save to database
      const saved = await saveArticle(article, !skipImages);
      
      if (saved) {
        stats.imported++;
        console.log(`   ✅ Imported: ${article.title}`);
      } else {
        stats.skipped++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
  } catch (error: any) {
    console.error('❌ Import failed:', error.message);
    stats.errors.push(error.message);
  }
  
  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total articles:  ${stats.total}`);
  console.log(`Imported:        ${stats.imported}`);
  console.log(`Skipped:         ${stats.skipped}`);
  console.log(`Failed:          ${stats.failed}`);
  
  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more`);
    }
  }
  
  console.log('='.repeat(70));
  
  return stats;
}

// CLI runner
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const options: any = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--skip-images') {
      options.skipImages = true;
    } else if (args[i] === '--start-from' && args[i + 1]) {
      options.startFrom = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--help') {
      console.log(`
Usage: npx tsx scripts/import-from-serien-de.ts [options]

Options:
  --limit <n>       Import only first n articles
  --skip-images     Don't upload images to cloud storage
  --start-from <n>  Start from index n (for resuming)
  --dry-run         Preview what would be imported without saving
  --help            Show this help

Examples:
  npx tsx scripts/import-from-serien-de.ts --dry-run --limit 5
  npx tsx scripts/import-from-serien-de.ts --limit 50
  npx tsx scripts/import-from-serien-de.ts --start-from 100 --limit 50
`);
      process.exit(0);
    }
  }
  
  importFromSerienDe(options)
    .then(stats => {
      process.exit(stats.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
