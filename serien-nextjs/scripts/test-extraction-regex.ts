const title = "'Cross' Renewed for Season 3 at Amazon Prime";
const text = "Amazon Prime has finally renewed the crime thriller show 'Cross' for its third season...";

// Test extraction
function extractSeriesNameFromContext(title: string, articleText: string): string[] {
  const candidates: string[] = [];
  
  // 1. Extract from title (quoted names) - HIGHEST PRIORITY
  const quotedMatches = title.matchAll(/["'„"]([^"'""]{2,40})["'""]/g);
  for (const match of quotedMatches) {
    if (match[1] && match[1].length > 2) {
      candidates.push(match[1]);
    }
  }
  
  console.log('After quoted match:', candidates);
  
  // 2. Extract from beginning before "Season", "Staffel", "Renewed"
  const seasonMatch = title.match(/^([A-Z][a-zA-Z\s]{2,40}?)\s+(?:Season|Staffel|Renewed|Cancelled|um|bekommt)/i);
  if (seasonMatch && seasonMatch[1]) {
    const cleaned = seasonMatch[1].trim();
    if (cleaned.length > 3 && !cleaned.match(/^(The|A|An|Der|Die|Das|New|Old)$/i)) {
      candidates.push(cleaned);
    }
  }
  
  console.log('After season match:', candidates);
  
  // Deduplicate and filter
  const unique = [...new Set(candidates)]
    .filter(c => c.length > 2 && c.length < 40)
    .filter(c => !c.match(/^(Renewed|Season|Staffel|for|um|eine|bei|verlängert)$/i));
  
  return unique;
}

const result = extractSeriesNameFromContext(title, text);
console.log('\nFinal candidates:', result);
