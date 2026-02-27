/**
 * Quick test of TVLine scraper
 */

async function testScraper() {
  const sourceUrl = 'https://www.tvline.com/category/streaming/';
  
  console.log('🧪 Testing TVLine Scraper');
  console.log(`Fetching: ${sourceUrl}\n`);
  
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`✅ HTML fetched (${html.length} bytes)\n`);
    
    // Test the regex pattern (UPDATED PATTERN)
    const titleRegex = /<h[23][^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
    const matches = Array.from(html.matchAll(titleRegex));
    
    console.log(`📊 Found ${matches.length} article links\n`);
    
    if (matches.length === 0) {
      console.log('❌ No matches found. Let me check the HTML structure...\n');
      
      // Look for h2/h3 tags
      const h2h3Regex = /<h[23][^>]*>(.*?)<\/h[23]>/gi;
      const h2h3Matches = Array.from(html.matchAll(h2h3Regex));
      console.log(`Found ${h2h3Matches.length} h2/h3 tags total`);
      
      if (h2h3Matches.length > 0) {
        console.log('\nFirst 5 h2/h3 tags:');
        h2h3Matches.slice(0, 5).forEach((m, i) => {
          console.log(`${i + 1}. ${m[0].substring(0, 150)}...`);
        });
      }
      
      // Look for links
      const linkRegex = /<a[^>]*href="(https:\/\/tvline\.com[^"]+)"[^>]*>(.*?)<\/a>/gi;
      const linkMatches = Array.from(html.matchAll(linkRegex));
      console.log(`\nFound ${linkMatches.length} TVLine links`);
      
      if (linkMatches.length > 0) {
        console.log('\nFirst 5 links:');
        linkMatches.slice(0, 5).forEach((m, i) => {
          const url = m[1];
          const text = m[2].replace(/<[^>]*>/g, '').trim();
          console.log(`${i + 1}. ${text.substring(0, 60)}...`);
          console.log(`   URL: ${url}`);
        });
      }
      
    } else {
      console.log('✅ Articles found:\n');
      matches.slice(0, 10).forEach((match, i) => {
        const url = match[1];
        const title = match[2].replace(/<[^>]*>/g, '').trim();
        console.log(`${i + 1}. ${title}`);
        console.log(`   ${url}\n`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testScraper();
