const title = "'Allegiance' Renewed for Season 4 at CBS";
const text = "CBS has renewed 'Allegiance' for season 4...";

// Copy exact function from tmdb-search-enhanced.ts
function extractSeriesNameFromContext(title: string, articleText: string): string[] {
  const candidates: string[] = [];
  
  console.log('Input title:', title);
  console.log('Input text (first 100):', articleText.substring(0, 100));
  
  // 1. Extract from title (quoted names) - HIGHEST PRIORITY
  const quotedMatches = title.matchAll(/["'„"]([^"'""]{2,40})["'""]/g);
  console.log('\nTrying quoted regex...');
  for (const match of quotedMatches) {
    console.log('  Match found:', match[1]);
    if (match[1] && match[1].length > 2) {
      candidates.push(match[1]);
    }
  }
  
  console.log('After quoted match:', candidates);
  
  // 2. Extract after "um" or "bekommt" (German patterns)
  const germanMatch = title.match(/["'„"]([^"'""]{2,40})["'""]\s+(?:um|bekommt|erhält)/i);
  if (germanMatch && germanMatch[1]) {
    console.log('German match:', germanMatch[1]);
    candidates.push(germanMatch[1]);
  }
  
  // 3. Extract from beginning before "Season", "Staffel", "Renewed"
  const seasonMatch = title.match(/^([A-Z][a-zA-Z\s]{2,40}?)\s+(?:Season|Staffel|Renewed|Cancelled|um|bekommt)/i);
  if (seasonMatch && seasonMatch[1]) {
    const cleaned = seasonMatch[1].trim();
    console.log('Season match (cleaned):', cleaned);
    if (cleaned.length > 3 && !cleaned.match(/^(The|A|An|Der|Die|Das|New|Old)$/i)) {
      candidates.push(cleaned);
    }
  }
  
  // Deduplicate and filter
  const unique = [...new Set(candidates)]
    .filter(c => c.length > 2 && c.length < 40)
    .filter(c => !c.match(/^(Renewed|Season|Staffel|for|um|eine|bei|verlängert)$/i));
  
  return unique;
}

const result = extractSeriesNameFromContext(title, text);
console.log('\n=== FINAL CANDIDATES ===');
console.log(result);
