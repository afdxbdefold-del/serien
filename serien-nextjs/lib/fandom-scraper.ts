/**
 * Fandom.com Scraper - Browser Automation
 * Uses Playwright to bypass Cloudflare protection
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
 * Browser Automation (Playwright)
 * Bypasses Cloudflare by using a real browser
 */
async function fetchViaBrowser(url: string): Promise<string | null> {
  try {
    console.log(`[Fandom Browser] Launching browser for: ${url}`);

    // Dynamic import to avoid loading Playwright unless needed
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Navigate and wait for content
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Wait for character infobox or main content
    await page.waitForSelector('.portable-infobox, .mw-parser-output', {
      timeout: 10000,
    }).catch(() => {
      console.log('[Fandom Browser] Warning: Infobox not found, continuing...');
    });

    // Get page HTML
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

  // Check if this is a valid character page
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

  console.log(`[Fandom] Extracted data for ${characterData.name}:`);
  console.log(`  - Description: ${characterData.description?.length || 0} chars`);
  console.log(`  - Portrayed by: ${characterData.portrayed_by || 'N/A'}`);
  console.log(`  - Status: ${characterData.status || 'N/A'}`);

  return characterData;
}

/**
 * Main function: Search for character using browser automation
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

    // Try browser automation (only first domain for speed)
    console.log(`[Fandom] Using Browser Automation (Cloudflare bypass)`);

    const url = `https://${wikiDomains[0]}/wiki/${characterSlug}`;
    const html = await fetchViaBrowser(url);

    if (html) {
      const characterData = parseCharacterData(html, url);
      if (characterData.found) {
        console.log(`[Fandom] ✅ Found: ${url}`);
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
