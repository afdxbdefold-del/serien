/**
 * Fandom.com Scraper
 * Extracts character and series information from Fandom wikis
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

interface FandomSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Search for a character on Fandom
 * @param characterName - Name of the character
 * @param seriesName - Name of the series
 * @returns Character data from Fandom
 */
export async function searchFandomCharacter(
  characterName: string,
  seriesName: string
): Promise<FandomCharacterData> {
  try {
    console.log(`[Fandom] Searching for character: ${characterName} from ${seriesName}`);
    
    // Build Fandom wiki URL (most TV shows have their own Fandom wiki)
    // Format: https://seriesname.fandom.com/wiki/Character_Name
    const seriesSlug = seriesName
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]+/g, '');
    
    const characterSlug = characterName
      .replace(/\s+/g, '_');
    
    // Try multiple possible Fandom URLs
    const possibleUrls = [
      `https://${seriesSlug}.fandom.com/wiki/${characterSlug}`,
      `https://${seriesName.toLowerCase().replace(/\s+/g, '-')}.fandom.com/wiki/${characterSlug}`,
      `https://${seriesName.toLowerCase().replace(/\s+/g, '_')}.fandom.com/wiki/${characterSlug}`,
    ];
    
    for (const url of possibleUrls) {
      console.log(`[Fandom] Trying URL: ${url}`);
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        console.log(`[Fandom]   Status: ${response.status}`);
        
        if (response.ok) {
          const html = await response.text();
          const characterData = parseFandomCharacterPage(html, url);
          
          if (characterData.found) {
            console.log(`[Fandom] ✅ Found character data at ${url}`);
            return characterData;
          }
        }
      } catch (error: any) {
        console.log(`[Fandom]   Error: ${error.message}`);
        continue;
      }
    }
    
    // If direct URLs fail, try Fandom search
    console.log(`[Fandom] Direct URLs failed, trying search...`);
    const searchData = await searchFandomViaGoogle(characterName, seriesName);
    
    if (searchData.found) {
      return searchData;
    }
    
    console.log(`[Fandom] ⚠️  Character not found on Fandom`);
    return {
      name: characterName,
      found: false,
      source_url: '',
    };
    
  } catch (error) {
    console.error(`[Fandom] Error searching for character:`, error);
    return {
      name: characterName,
      found: false,
      source_url: '',
    };
  }
}

/**
 * Parse a Fandom character page
 */
function parseFandomCharacterPage(html: string, url: string): FandomCharacterData {
  const $ = cheerio.load(html);
  
  // Check if this is actually a character page (not a 404 or redirect)
  const pageTitle = $('h1.page-header__title').text().trim();
  if (!pageTitle || pageTitle.includes('Search results')) {
    return { name: '', found: false, source_url: url };
  }
  
  // Extract character information from the infobox
  const infobox = $('.portable-infobox');
  
  const characterData: FandomCharacterData = {
    name: pageTitle,
    found: true,
    source_url: url,
  };
  
  // Extract infobox data
  infobox.find('.pi-item').each((_, elem) => {
    const label = $(elem).find('.pi-data-label').text().trim().toLowerCase();
    const value = $(elem).find('.pi-data-value').text().trim();
    
    if (label.includes('portrayed') || label.includes('actor') || label.includes('played')) {
      characterData.portrayed_by = value;
    } else if (label.includes('first') && label.includes('appearance')) {
      characterData.first_appearance = value;
    } else if (label.includes('status')) {
      characterData.status = value;
    }
  });
  
  // Extract bio/description from the first few paragraphs
  const contentParagraphs: string[] = [];
  $('.mw-parser-output > p').each((i, elem) => {
    if (i < 3) { // Take first 3 paragraphs
      const text = $(elem).text().trim();
      if (text.length > 50) { // Skip very short paragraphs
        contentParagraphs.push(text);
      }
    }
  });
  
  if (contentParagraphs.length > 0) {
    characterData.description = contentParagraphs.join('\n\n');
  }
  
  // Extract biography section if exists
  const bioSection = $('h2:contains("Biography"), h2:contains("Background")').next('p').text().trim();
  if (bioSection && bioSection.length > 50) {
    characterData.bio = bioSection;
  }
  
  console.log(`[Fandom] Extracted data for ${characterData.name}:`);
  console.log(`  - Description length: ${characterData.description?.length || 0} chars`);
  console.log(`  - Portrayed by: ${characterData.portrayed_by || 'N/A'}`);
  console.log(`  - Status: ${characterData.status || 'N/A'}`);
  
  return characterData;
}

/**
 * Search Fandom via Google site search
 */
async function searchFandomViaGoogle(
  characterName: string,
  seriesName: string
): Promise<FandomCharacterData> {
  try {
    // Use Google to search within Fandom
    const searchQuery = `site:fandom.com ${seriesName} ${characterName} character`;
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    console.log(`[Fandom] Google search: ${searchQuery}`);
    
    const response = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      return { name: characterName, found: false, source_url: '' };
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract first Fandom wiki link from Google results
    let fandomUrl = '';
    $('a').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && href.includes('fandom.com/wiki/') && !fandomUrl) {
        // Extract actual URL from Google redirect
        const match = href.match(/url\?q=([^&]+)/);
        if (match) {
          fandomUrl = decodeURIComponent(match[1]);
        }
      }
    });
    
    if (fandomUrl) {
      console.log(`[Fandom] Found via Google: ${fandomUrl}`);
      
      const pageResponse = await fetch(fandomUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      if (pageResponse.ok) {
        const pageHtml = await pageResponse.text();
        return parseFandomCharacterPage(pageHtml, fandomUrl);
      }
    }
    
    return { name: characterName, found: false, source_url: '' };
    
  } catch (error) {
    console.error(`[Fandom] Google search error:`, error);
    return { name: characterName, found: false, source_url: '' };
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
