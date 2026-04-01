/**
 * Robust JSON parser for LLM responses (Claude Sonnet compatible)
 * Handles: markdown code blocks, German quotes, unescaped quotes in strings,
 * unescaped newlines, control characters, truncated JSON
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
  
  // Attempt 1: direct parse
  try {
    return JSON.parse(text);
  } catch {
    // pass
  }
  
  // Attempt 2: fix newlines, tabs, German quotes inside strings
  let fixed = escapeStringInternals(text);
  try {
    return JSON.parse(fixed);
  } catch {
    // pass
  }
  
  // Attempt 3: smart quote disambiguation
  // Claude often writes "geplant" inside JSON strings — the quotes break the parser.
  // Use context to distinguish structural vs content quotes.
  fixed = smartQuoteFix(text);
  try {
    return JSON.parse(fixed);
  } catch {
    // pass
  }

  // Attempt 4: aggressive regex-based repair
  fixed = aggressiveRepair(text);
  try {
    return JSON.parse(fixed);
  } catch {
    // pass
  }
  
  // Attempt 5: repair truncated JSON
  fixed = repairTruncated(smartQuoteFix(text));
  try {
    return JSON.parse(fixed);
  } catch {
    // pass
  }

  fixed = repairTruncated(aggressiveRepair(text));
  try {
    return JSON.parse(fixed);
  } catch {
    // pass
  }
  
  // Give up
  throw new SyntaxError(`Failed to parse LLM JSON response. First 200 chars: ${text.substring(0, 200)}`);
}

/**
 * Walk character by character and escape illegal chars inside JSON strings
 */
function escapeStringInternals(text: string): string {
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
      if (ch === '\n') { fixed += '\\n'; continue; }
      if (ch === '\r') { fixed += '\\r'; continue; }
      if (ch === '\t') { fixed += '\\t'; continue; }
      // Replace German typographic quotes with apostrophes
      if ('\u201E\u201C\u201D\u2018\u2019\u00AB\u00BB'.includes(ch)) { fixed += "'"; continue; }
      // Remove other control characters
      const code = ch.charCodeAt(0);
      if (code < 32) { continue; }
    }
    
    fixed += ch;
  }
  
  return fixed;
}

/**
 * Smart quote disambiguation: determines if a " inside a string is structural or content.
 * When inside a string, a closing " should be followed by : , ] } or whitespace then one of these.
 * If followed by a letter/word character, it's likely a content quote that should be escaped.
 */
function smartQuoteFix(text: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    
    if (ch === '\\') {
      result += ch;
      escaped = true;
      continue;
    }
    
    if (ch === '"') {
      if (!inString) {
        // Opening quote — always structural
        inString = true;
        result += ch;
        continue;
      }
      
      // We're inside a string and hit a "
      // Use positional context to decide if structural or content
      if (isStructuralClose(text, i)) {
        // Structural close
        inString = false;
        result += ch;
      } else {
        // Content quote inside string — escape it
        result += '\\"';
      }
      continue;
    }
    
    if (inString) {
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
      if ('\u201E\u201C\u201D\u2018\u2019\u00AB\u00BB'.includes(ch)) { result += "'"; continue; }
      const code = ch.charCodeAt(0);
      if (code < 32) { continue; }
    }
    
    result += ch;
  }
  
  return result;
}

/** Look ahead past whitespace and return the first non-whitespace char */
function lookAhead(text: string, pos: number): string {
  while (pos < text.length && (text[pos] === ' ' || text[pos] === '\n' || text[pos] === '\r' || text[pos] === '\t')) {
    pos++;
  }
  return pos < text.length ? text[pos] : 'END';
}

/** Get position of first non-whitespace char at or after pos */
function lookAheadPos(text: string, pos: number): number {
  while (pos < text.length && (text[pos] === ' ' || text[pos] === '\n' || text[pos] === '\r' || text[pos] === '\t')) {
    pos++;
  }
  return pos;
}

/** 
 * Check if a `"` is a structural closing quote.
 * After a structural close, the JSON must continue with , : } ] or end.
 * But after `,` we also need to check: does a new JSON element follow (e.g. `"key":`)?
 * If after `,` we see a word (not `"` or `{` or `[`), it's likely content text.
 */
function isStructuralClose(text: string, quotePos: number): boolean {
  const nextPos = lookAheadPos(text, quotePos + 1);
  if (nextPos >= text.length) return true; // end of input
  
  const next = text[nextPos];
  
  // } ] : → always structural
  if (next === '}' || next === ']' || next === ':') return true;
  
  // , → structural ONLY if followed by another JSON element
  if (next === ',') {
    const afterCommaPos = lookAheadPos(text, nextPos + 1);
    if (afterCommaPos >= text.length) return true;
    const afterComma = text[afterCommaPos];
    // New JSON element: "key" or { or [ or number or true/false/null
    if (afterComma === '"' || afterComma === '{' || afterComma === '[' ||
        afterComma === 't' || afterComma === 'f' || afterComma === 'n' ||
        (afterComma >= '0' && afterComma <= '9') || afterComma === '-') {
      // Extra check: if afterComma is `"`, verify it could be a key or array element
      // by checking if the text between the comma and this quote is just whitespace
      return true;
    }
    // After comma we see a regular letter → this is content text, not structural
    return false;
  }
  
  // Anything else (letter, number) → content quote
  return false;
}

/**
 * Aggressive regex-based repair:
 * 1. Replace all string values using a key-value pattern matcher
 * 2. Escape any unescaped quotes inside matched values
 */
function aggressiveRepair(text: string): string {
  // First, handle newlines and German quotes globally
  let cleaned = text
    .replace(/\u201E/g, "'").replace(/\u201C/g, "'").replace(/\u201D/g, "'")
    .replace(/\u00AB/g, "'").replace(/\u00BB/g, "'")
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'");
  
  // Try to fix by replacing string values one at a time
  // Match pattern: "key": "value" where value might contain unescaped quotes
  // Strategy: find ": " then capture until we find ", " or "} or "] 
  
  // Regex to match JSON string values and escape internal quotes
  // This works for simple cases like: "key": "text with \"quotes\" inside"
  try {
    // Replace unescaped newlines in string contexts
    cleaned = cleaned.replace(/(:\s*"[^"]*)\n([^"]*")/g, (match) => {
      return match.replace(/\n/g, '\\n');
    });
    
    // Try parse after basic cleanup
    return JSON.parse(cleaned);
  } catch {
    // pass
  }
  
  // More aggressive: use smartQuoteFix on the cleaned text
  return smartQuoteFix(cleaned);
}

/**
 * Repair truncated JSON by closing open braces/brackets
 */
function repairTruncated(text: string): string {
  let repaired = text;
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
  
  if (openBraces <= 0 && openBrackets <= 0) return repaired;
  
  // Truncated — try to close cleanly
  // If we're inside a string, close it first
  if (inStr) {
    // Find a safe truncation point
    const lastComplete = findLastCompletePair(repaired);
    if (lastComplete > 0) {
      repaired = repaired.substring(0, lastComplete);
    } else {
      repaired += '"';
    }
  }
  
  // Remove trailing comma
  repaired = repaired.trimEnd();
  if (repaired.endsWith(',')) {
    repaired = repaired.slice(0, -1);
  }
  
  // Recalculate
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
  
  return repaired;
}

/**
 * Find the position after the last complete "key": "value" pair
 * Used to truncate cleanly when JSON is cut off mid-string
 */
function findLastCompletePair(text: string): number {
  // Find the last complete string value (ending with ")
  // by looking for patterns like: ","  or "]" or "}"
  const patterns = [
    /"\s*,\s*$/,
    /"\s*\]\s*$/,
    /"\s*\}\s*$/,
    /"\s*,/g,
    /"\s*\]/g,
    /"\s*\}/g,
  ];
  
  let lastPos = -1;
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, 'g');
    while ((match = regex.exec(text)) !== null) {
      const pos = match.index + match[0].length;
      if (pos > lastPos) lastPos = pos;
    }
  }
  
  return lastPos;
}
