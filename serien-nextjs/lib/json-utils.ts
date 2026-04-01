/**
 * Robust JSON parser for LLM responses (Claude Sonnet compatible)
 * Handles: markdown code blocks, German quotes, unescaped newlines in strings, control characters
 */
export function parseJsonResponse(content: string | null | undefined): any {
  let text = (content || '{}').trim();
  
  // Remove markdown code blocks
  if (text.startsWith('```json')) {
    text = text.slice(7);
  } else if (text.startsWith('```')) {
    text = text.slice(3);
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3);
  }
  text = text.trim();
  
  // Extract JSON object/array from surrounding text
  const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }
  
  // First attempt: direct parse
  try {
    return JSON.parse(text);
  } catch {
    // pass
  }
  
  // Second attempt: escape newlines INSIDE JSON string values
  // Walk the string character by character to properly handle escaping
  let fixed = '';
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    
    if (escaped) {
      fixed += ch;
      escaped = false;
      continue;
    }
    
    if (ch === '\\') {
      fixed += ch;
      escaped = true;
      continue;
    }
    
    if (ch === '"') {
      inString = !inString;
      fixed += ch;
      continue;
    }
    
    if (inString) {
      // Escape characters that are illegal inside JSON strings
      if (ch === '\n') { fixed += '\\n'; continue; }
      if (ch === '\r') { fixed += '\\r'; continue; }
      if (ch === '\t') { fixed += '\\t'; continue; }
      // Replace German quotes with apostrophes
      if (ch === '\u201E' || ch === '\u201C' || ch === '\u201D') { fixed += "'"; continue; }
      if (ch === '\u00AB' || ch === '\u00BB') { fixed += "'"; continue; }
      // Remove other control characters
      const code = ch.charCodeAt(0);
      if (code < 32 && code !== 10 && code !== 13 && code !== 9) { continue; }
    }
    
    fixed += ch;
  }
  
  try {
    return JSON.parse(fixed);
  } catch {
    // pass
  }
  
  // Third attempt: repair truncated JSON
  let repaired = fixed;
  let openBraces = 0, openBrackets = 0;
  let inStr = false, esc = false;
  
  for (const ch of repaired) {
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') openBraces++;
    if (ch === '}') openBraces--;
    if (ch === '[') openBrackets++;
    if (ch === ']') openBrackets--;
  }
  
  if (openBraces > 0 || openBrackets > 0) {
    // Truncated JSON - find last complete entry and close
    // Remove trailing incomplete string/value
    const lastQuote = repaired.lastIndexOf('"');
    const lastComma = repaired.lastIndexOf(',');
    const lastColon = repaired.lastIndexOf(':');
    
    // If we're in the middle of a string value, close it
    let truncPoint = repaired.length;
    if (inStr && lastQuote > 0) {
      truncPoint = lastQuote + 1;
      repaired = repaired.substring(0, truncPoint);
    }
    
    // Remove trailing comma if present
    repaired = repaired.trimEnd();
    if (repaired.endsWith(',')) {
      repaired = repaired.slice(0, -1);
    }
    
    // Recalculate open brackets
    openBraces = 0; openBrackets = 0; inStr = false; esc = false;
    for (const ch of repaired) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') openBraces++;
      if (ch === '}') openBraces--;
      if (ch === '[') openBrackets++;
      if (ch === ']') openBrackets--;
    }
    
    while (openBrackets > 0) { repaired += ']'; openBrackets--; }
    while (openBraces > 0) { repaired += '}'; openBraces--; }
    
    try {
      return JSON.parse(repaired);
    } catch {
      // pass
    }
  }
  
  // Give up
  throw new SyntaxError(`Failed to parse LLM JSON response. First 200 chars: ${text.substring(0, 200)}`);
}
