/**
 * HEADLINE PRESERVER
 * 
 * Preserves source headlines with minimal changes.
 * Only modifies when necessary for:
 * - Language (translate if needed)
 * - Consistency (facts vs. headline)
 * - Clickbait removal
 * - Series name protection
 */

interface FactsVerdict {
  renewalStatus: 'RENEWED' | 'NOT_RENEWED' | 'UNKNOWN';
  seasonMentioned: number | null;
  keyClaim: string;
  entities: {
    seriesNames: string[];
    peopleNames: string[];
    platforms: string[];
  };
}

interface HeadlineResult {
  final: string;
  mode: 'PRESERVED' | 'TRANSLATED' | 'MIN_FIX' | 'FULL_REWRITE';
  reason: string;
}

/**
 * Main function: Process headline with minimal changes
 */
export async function preserveHeadline(
  sourceTitle: string,
  facts: FactsVerdict
): Promise<HeadlineResult> {
  let headline = sourceTitle;
  let mode: HeadlineResult['mode'] = 'PRESERVED';
  let reasons: string[] = [];

  // ========== STEP A: CLEAN-UP (always) ==========
  headline = cleanupHeadline(headline);
  
  // ========== STEP B: LANGUAGE RULE ==========
  const languageCheck = await detectAndTranslate(headline, facts.entities.seriesNames);
  if (languageCheck.wasTranslated) {
    headline = languageCheck.headline;
    mode = 'TRANSLATED';
    reasons.push('translated from non-German');
  }

  // ========== STEP C: CONSISTENCY RULE (hard) ==========
  const consistencyCheck = checkConsistency(headline, facts);
  if (consistencyCheck.hasContradiction) {
    headline = consistencyCheck.fixedHeadline;
    mode = 'MIN_FIX';
    reasons.push(consistencyCheck.reason);
  }

  // ========== STEP D: CLICKBAIT FILTER (soft) ==========
  const clickbaitCheck = removeClickbait(headline);
  if (clickbaitCheck.wasChanged) {
    headline = clickbaitCheck.headline;
    if (mode === 'PRESERVED') {
      mode = 'MIN_FIX';
    }
    reasons.push('clickbait removed');
  }

  // ========== STEP E: SERIES NAME PROTECTION (enforced during translation) ==========
  // Already handled in detectAndTranslate

  // ========== STEP F: FINAL VALIDATION ==========
  if (headline.length > 110) {
    headline = headline.substring(0, 107) + '...';
    reasons.push('truncated to 110 chars');
  }

  // If still problematic after MIN_FIX, do FULL_REWRITE
  const finalCheck = validateHeadline(headline, facts);
  if (!finalCheck.valid) {
    headline = generateTemplateHeadline(facts);
    mode = 'FULL_REWRITE';
    reasons.push('full rewrite needed: ' + finalCheck.reason);
  }

  return {
    final: headline,
    mode,
    reason: reasons.join('; ') || 'no changes needed',
  };
}

/**
 * STEP A: Clean-up
 */
function cleanupHeadline(title: string): string {
  let cleaned = title.trim();
  
  // Remove double spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Remove trailing source branding
  const brandingPatterns = [
    / - TVLine$/i,
    / \| Deadline$/i,
    / - Variety$/i,
    / - THR$/i,
    / \(Exclusive\)$/i,
    / - EXCLUSIV$/i,
  ];
  
  for (const pattern of brandingPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Remove excessive exclamation marks (keep max 1)
  cleaned = cleaned.replace(/!+/g, '!');
  
  // Remove ALL CAPS (if entire headline is caps)
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 10) {
    cleaned = cleaned.charAt(0) + cleaned.slice(1).toLowerCase();
  }
  
  return cleaned.trim();
}

/**
 * STEP B: Language detection and translation
 */
async function detectAndTranslate(
  headline: string,
  seriesNames: string[]
): Promise<{ headline: string; wasTranslated: boolean }> {
  // Simple language detection: check for German tokens
  const germanTokens = ['der', 'die', 'das', 'und', 'mit', 'für', 'von', 'zu', 'nach', 'wird', 'ist', 'auf', 'staffel', 'keine', 'kommt', 'endet'];
  const englishTokens = ['season', 'episode', 'confirmed', 'renewed', 'cancelled', 'returns', 'coming', 'official'];
  
  const words = headline.toLowerCase().split(/\s+/);
  const germanCount = words.filter(w => germanTokens.includes(w)).length;
  const englishCount = words.filter(w => englishTokens.includes(w)).length;
  
  // If has English keywords, translate
  if (englishCount > 0 && germanCount === 0) {
    // Protect series names with placeholders
    let headlineWithPlaceholders = headline;
    const placeholders: Map<string, string> = new Map();
    
    seriesNames.forEach((name, i) => {
      const placeholder = `__SERIES_${i}__`;
      placeholders.set(placeholder, name);
      headlineWithPlaceholders = headlineWithPlaceholders.replace(new RegExp(name, 'gi'), placeholder);
    });

    // Translate
    const translated = await translateHeadline(headlineWithPlaceholders);
    
    // Restore series names
    let restored = translated;
    placeholders.forEach((originalName, placeholder) => {
      restored = restored.replace(new RegExp(placeholder, 'g'), originalName);
    });

    return { headline: restored, wasTranslated: true };
  }

  return { headline, wasTranslated: false };
}

/**
 * Translate headline to German
 */
async function translateHeadline(text: string): Promise<string> {
  try {
    const { createLLMClient, LLM_CONFIG } = await import('./llm-config');
    const openai = createLLMClient();

    const response = await openai.chat.completions.create({
      model: LLM_CONFIG.model,
      messages: [
        {
          role: 'system',
          content: 'Übersetze Headlines ins Deutsche. Behalte Platzhalter wie __SERIES_0__ unverändert. Nur die Übersetzung zurückgeben, keine Erklärungen.',
        },
        {
          role: 'user',
          content: `Übersetze: ${text}`,
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 100,
    });

    return response.choices[0]?.message?.content?.trim() || text;
  } catch (error: any) {
    console.error('Translation failed:', error.message);
    return text;
  }
}

/**
 * STEP C: Consistency check
 */
function checkConsistency(
  headline: string,
  facts: FactsVerdict
): { hasContradiction: boolean; fixedHeadline: string; reason: string } {
  const lower = headline.toLowerCase();
  
  // Check for NOT_RENEWED contradictions
  if (facts.renewalStatus === 'NOT_RENEWED') {
    // Forbidden patterns for NOT_RENEWED
    const forbiddenPatterns = [
      /staffel\s*[4-9]\d*/i,
      /bestätigt/i,
      /verlängert/i,
      /kommt zurück/i,
      /neue staffel/i,
    ];
    
    const hasForbidden = forbiddenPatterns.some(p => p.test(headline));
    
    if (hasForbidden) {
      // Extract series name (first capitalized phrase before colon or "Staffel")
      const seriesMatch = headline.match(/^([^:]+?)(?:\s*:|$)/);
      const seriesName = seriesMatch ? seriesMatch[1].trim() : facts.entities.seriesNames[0] || 'Die Serie';
      
      // Extract season number if mentioned
      const seasonMatch = headline.match(/staffel\s*(\d+)/i);
      const mentionedSeason = seasonMatch ? parseInt(seasonMatch[1]) : null;
      const actualLastSeason = facts.seasonMentioned || 3;
      
      const fixed = `${seriesName} endet nach Staffel ${actualLastSeason} – keine Staffel ${actualLastSeason + 1}`;
      
      return {
        hasContradiction: true,
        fixedHeadline: fixed,
        reason: 'headline implied renewal but series was cancelled',
      };
    }
  }
  
  // Check for UNKNOWN contradictions
  if (facts.renewalStatus === 'UNKNOWN') {
    const certaintyPatterns = [/bestätigt/i, /offiziell/i, /confirmed/i];
    const hasCertainty = certaintyPatterns.some(p => p.test(headline));
    
    if (hasCertainty && !facts.keyClaim.toLowerCase().includes('bestätigt')) {
      // Add uncertainty framing
      const fixed = headline
        .replace(/bestätigt/gi, 'noch nicht bestätigt')
        .replace(/offiziell/gi, 'inoffiziell');
      
      return {
        hasContradiction: true,
        fixedHeadline: fixed,
        reason: 'removed unwarranted certainty',
      };
    }
  }
  
  // Check for RENEWED season number mismatch
  if (facts.renewalStatus === 'RENEWED' && facts.seasonMentioned) {
    const seasonMatch = headline.match(/staffel\s*(\d+)/i);
    if (seasonMatch) {
      const headlineSeason = parseInt(seasonMatch[1]);
      if (headlineSeason !== facts.seasonMentioned) {
        const fixed = headline.replace(
          /staffel\s*\d+/i,
          `Staffel ${facts.seasonMentioned}`
        );
        
        return {
          hasContradiction: true,
          fixedHeadline: fixed,
          reason: `corrected season number to ${facts.seasonMentioned}`,
        };
      }
    }
  }
  
  return { hasContradiction: false, fixedHeadline: headline, reason: '' };
}

/**
 * STEP D: Remove clickbait
 */
function removeClickbait(headline: string): { headline: string; wasChanged: boolean } {
  const clickbaitTokens = [
    'Mega-',
    'Hammer-',
    'Schock',
    'sensationell',
    'endlich',
    'krass',
    'Wahnsinn',
    'unglaublich',
  ];
  
  let cleaned = headline;
  let wasChanged = false;
  
  for (const token of clickbaitTokens) {
    const pattern = new RegExp(token, 'gi');
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, '').replace(/\s+/g, ' ').trim();
      wasChanged = true;
    }
  }
  
  return { headline: cleaned, wasChanged };
}

/**
 * STEP F: Final validation
 */
function validateHeadline(
  headline: string,
  facts: FactsVerdict
): { valid: boolean; reason: string } {
  // Check if German (relaxed check - allow series names in English)
  const germanTokens = ['der', 'die', 'das', 'und', 'mit', 'nach', 'wird', 'staffel', 'keine', 'kommt', 'endet', 'von', 'zu', 'bei'];
  const hasGerman = germanTokens.some(token => headline.toLowerCase().includes(token));
  
  // Allow if has German keywords OR if it's a known German-structure headline
  const hasGermanStructure = /staffel\s*\d+/i.test(headline) || /keine/i.test(headline) || /endet/i.test(headline);
  
  if (!hasGerman && !hasGermanStructure && headline.length > 20) {
    return { valid: false, reason: 'not German' };
  }
  
  // Check length
  if (headline.length > 150) {
    return { valid: false, reason: 'too long' };
  }
  
  return { valid: true, reason: '' };
}

/**
 * STEP F: Generate template headline (fallback)
 */
function generateTemplateHeadline(facts: FactsVerdict): string {
  const seriesName = facts.entities.seriesNames[0] || 'Die Serie';
  const season = facts.seasonMentioned || 2;
  const platform = facts.entities.platforms[0] || 'Streaming-Dienst';
  
  switch (facts.renewalStatus) {
    case 'NOT_RENEWED':
      return `${seriesName} endet nach Staffel ${season} – keine Staffel ${season + 1}`;
    
    case 'RENEWED':
      return `${seriesName}: Staffel ${season} kommt – ${platform} bestellt neue Folgen`;
    
    case 'UNKNOWN':
    default:
      return `${seriesName} Staffel ${season}: Stand jetzt keine Bestätigung – was bekannt ist`;
  }
}
