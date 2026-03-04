/**
 * Fandom.com Scraper - Apify Integration
 * Fast and reliable web scraping using Apify Actor
 */

import * as cheerio from 'cheerio';

interface FandomCharacterData {
  name: string;
  bio?: string;
  description?: string;
  portrayed_by?: string;
  first_appearance?: string;
  status?: string;
  relationships?: string[];
  trivia?: string[];
  source_url: string;
  found: boolean;
}

/**
 * Fetch Fandom page via Apify Actor (Web Scraper with Puppeteer)
 */
async function fetchViaApify(url: string): Promise<string | null> {
  try {
    const apiToken = process.env.APIFY_API_TOKEN;
    
    if (!apiToken) {
      console.log('[Apify] ⚠️  No API token found, falling back to browser method');
      return null;
    }

    console.log(`[Apify] Fetching: ${url}`);

    // Use Web Scraper with Puppeteer (handles JS, bypasses Cloudflare)
    const actorInput = {
      startUrls: [{ url }],
      useChrome: true,
      useStealth: false,
      proxyConfiguration: {
        useApifyProxy: true,
      },
      maxConcurrency: 1,
      maxRequestsPerCrawl: 1,
      pageFunction: `async function pageFunction(context) {
        const { request, page } = context;
        
        // Wait for body to load
        await page.waitForSelector('body', { timeout: 10000 });
        
        // Get the full HTML
        const html = await page.content();
        
        return {
          url: request.url,
          html: html,
        };
      }`,
    };

    // Run Web Scraper with Puppeteer (NO waitForFinish - we'll poll manually)
    // Actor ID: apify/puppeteer-scraper
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/apify~puppeteer-scraper/runs?token=${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput),
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.log(`[Apify] Run failed: HTTP ${runResponse.status} - ${errorText}`);
      return null;
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;
    
    console.log(`[Apify] Run started: ${runId}`);

    // Poll for completion (max 20 seconds to keep it fast)
    const maxWaitSeconds = 20;
    const pollInterval = 2000; // 2s
    const maxAttempts = Math.floor(maxWaitSeconds / (pollInterval / 1000));
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const statusResponse = await fetch(
        `https://api.apify.com/v2/acts/apify~puppeteer-scraper/runs/${runId}?token=${apiToken}`
      );

      if (!statusResponse.ok) {
        console.log(`[Apify] Status check failed: HTTP ${statusResponse.status}`);
        return null;
      }

      const statusData = await statusResponse.json();
      const status = statusData.data.status;

      if (status === 'SUCCEEDED') {
        console.log(`[Apify] ✅ Run completed in ${(attempt + 1) * (pollInterval / 1000)}s`);
        
        // Get results from dataset
        const resultsResponse = await fetch(
          `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`
        );

        if (!resultsResponse.ok) {
          console.log(`[Apify] Results fetch failed: HTTP ${resultsResponse.status}`);
          return null;
        }

        const results = await resultsResponse.json();
        
        if (results.length > 0) {
          const item = results[0];
          
          // Check for errors
          if (item['#error']) {
            console.log(`[Apify] ❌ PageFunction error:`, item['#error']);
            return null;
          }
          
          const html = item.html;
          
          if (html) {
            console.log(`[Apify] ✅ HTML fetched (${html.length} chars)`);
            return html;
          }
        }
        
        console.log(`[Apify] ⚠️  No valid content in results`);
        return null;
        
      } else if (status === 'FAILED' || status === 'ABORTED') {
        console.log(`[Apify] ❌ Run ${status}`);
        return null;
      }
    }

    console.log(`[Apify] ⏱️  Timeout after ${maxWaitSeconds}s (run still processing, falling back)`);
    return null;

  } catch (error: any) {
    console.log(`[Apify] Error: ${error.message}`);
    return null;
  }
}

/**
 * METHOD 1: Browser Automation (Playwright) - Fallback
 */
async function fetchViaBrowser(url: string): Promise<string | null> {
  try {
    console.log(`[Fandom Browser] Launching browser for: ${url}`);

    const { chromium } = await import('playwright');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await page.waitForSelector('.portable-infobox, .mw-parser-output', {
      timeout: 10000,
    }).catch(() => {
      console.log('[Fandom Browser] Warning: Infobox not found, continuing...');
    });

    const html = await page.content();
    await browser.close();

    console.log(`[Fandom Browser] ✅ Content fetched (${html.length} chars)`);

    return html;
  } catch (error: any) {
    console.log(`[Fandom Browser] Error: ${error.message}`);
    return null;
  }
}

/**
 * Parse character data from HTML
 */
function parseCharacterData(html: string, url: string): FandomCharacterData {
  const $ = cheerio.load(html);

  const pageTitle = $('h1.page-header__title, h1#firstHeading').text().trim();
  
  if (!pageTitle || pageTitle.includes('Search results') || pageTitle.includes('not found')) {
    return { name: '', found: false, source_url: url };
  }

  const characterData: FandomCharacterData = {
    name: pageTitle,
    found: true,
    source_url: url,
  };

  // Extract infobox data
  const infobox = $('.portable-infobox, .infobox');

  infobox.find('.pi-item, tr').each((_, elem) => {
    const label = $(elem).find('.pi-data-label, th').text().trim().toLowerCase();
    const value = $(elem).find('.pi-data-value, td').text().trim();

    if ((label.includes('portrayed') || label.includes('actor') || label.includes('played')) && value) {
      characterData.portrayed_by = value;
    } else if (label.includes('first') && label.includes('appearance') && value) {
      characterData.first_appearance = value;
    } else if (label.includes('status') && value) {
      characterData.status = value;
    }
  });

  // Extract description from paragraphs
  const contentParagraphs: string[] = [];
  $('.mw-parser-output > p, .article-content > p').each((i, elem) => {
    if (i < 3) {
      const text = $(elem).text().trim();
      if (text.length > 50) {
        contentParagraphs.push(text);
      }
    }
  });

  if (contentParagraphs.length > 0) {
    characterData.description = contentParagraphs.join('\n\n');
  }

  // Extract biography section
  const bioSection = $('h2:contains("Biography"), h2:contains("Background")')
    .next('p')
    .text()
    .trim();
    
  if (bioSection && bioSection.length > 50) {
    characterData.bio = bioSection;
  }

  return characterData;
}

/**
 * Main function: Search for character with Apify + Browser fallback
 */
export async function searchFandomCharacter(
  characterName: string,
  seriesName: string
): Promise<FandomCharacterData> {
  try {
    console.log(`\n[Fandom] Searching: ${characterName} from ${seriesName}`);

    // Build wiki domain variations
    const seriesSlug = seriesName
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]+/g, '');

    const characterSlug = characterName.replace(/\s+/g, '_');

    const wikiDomains = [
      `${seriesSlug}.fandom.com`,
      `${seriesName.toLowerCase().replace(/\s+/g, '-')}.fandom.com`,
      `${seriesName.toLowerCase().replace(/\s+/g, '_')}.fandom.com`,
    ];

    // STRATEGY 1: Try Apify (if token available)
    if (process.env.APIFY_API_TOKEN) {
      console.log(`[Fandom] Strategy 1: Apify Web Scraper (fast & reliable)`);

      // Try only the first domain with Apify (stop after first success)
      const url = `https://${wikiDomains[0]}/wiki/${characterSlug}`;
      const html = await fetchViaApify(url);

      if (html) {
        const characterData = parseCharacterData(html, url);
        if (characterData.found) {
          console.log(`[Fandom] ✅ Found via Apify: ${url}`);
          return characterData;
        }
      }
    }

    // STRATEGY 2: Browser automation fallback (only 1 attempt!)
    console.log(`[Fandom] Strategy 2: Browser Automation (last resort)`);

    // 🔥 OPTIMIZATION: Try only the FIRST domain, not all 3!
    const url = `https://${wikiDomains[0]}/wiki/${characterSlug}`;
    const html = await fetchViaBrowser(url);

    if (html) {
      const characterData = parseCharacterData(html, url);
      if (characterData.found) {
        console.log(`[Fandom] ✅ Found via Browser: ${url}`);
        return characterData;
      }
    }

    console.log(`[Fandom] ⚠️  Character not found`);
    return {
      name: characterName,
      found: false,
      source_url: '',
    };

  } catch (error: any) {
    console.error(`[Fandom] Error:`, error.message);
    return {
      name: characterName,
      found: false,
      source_url: '',
    };
  }
}

/**
 * Format Fandom data for character content generation
 */
export function formatFandomDataForContent(fandomData: FandomCharacterData): string {
  if (!fandomData.found) {
    return '';
  }

  let content = `# ${fandomData.name}\n\n`;

  if (fandomData.description) {
    content += `${fandomData.description}\n\n`;
  }

  if (fandomData.bio) {
    content += `## Biography\n\n${fandomData.bio}\n\n`;
  }

  if (fandomData.portrayed_by) {
    content += `**Portrayed by:** ${fandomData.portrayed_by}\n\n`;
  }

  if (fandomData.status) {
    content += `**Status:** ${fandomData.status}\n\n`;
  }

  content += `\n*Source: [Fandom](${fandomData.source_url})*\n`;

  return content;
}
