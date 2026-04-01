import { parseJsonResponse } from './json-utils';
/**
 * FACT SAFETY LAYER
 * 
 * Verhindert falsche oder unbelegte Aussagen in Artikeln,
 * insbesondere bei Enddaten, Staffeln, Zeitangaben.
 */

import { createLLMClient, LLM_CONFIG } from './llm-config';

interface CriticalFact {
  type: 'SERIES_END' | 'SEASON_COUNT' | 'YEAR_DATE' | 'LAST_SEASON' | 'CANCELLATION' | 'RENEWAL';
  claim: string;
  verified: boolean;
  source?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  alternative?: string; // Neutral phrasing if unverified
}

interface FactSafetyResult {
  status: 'SAFE' | 'UNSAFE';
  criticalFacts: CriticalFact[];
  rejectedFacts: CriticalFact[];
  headlineViolations: string[];
  mustRewrite: boolean;
}

interface FactSafetyInput {
  articleHtml: string;
  headline: string;
  extractedFacts: string;
  tmdbSeriesData?: {
    status?: string; // "Ended", "Returning Series", "Canceled"
    lastAirDate?: string;
    numberOfSeasons?: number;
  };
}

/**
 * Main Fact Safety Check
 */
export async function factSafetyCheck(input: FactSafetyInput): Promise<FactSafetyResult> {
  const criticalFacts: CriticalFact[] = [];
  const rejectedFacts: CriticalFact[] = [];
  const headlineViolations: string[] = [];

  // Extract plain text
  const articleText = input.articleHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  console.log('🛡️  Fact Safety Layer - Checking critical claims...');

  // Use AI to detect critical facts
  const detectedFacts = await detectCriticalFacts(articleText, input.headline, input.extractedFacts);

  // Verify each critical fact
  for (const fact of detectedFacts) {
    const verified = verifyFactAgainstTMDB(fact, input.tmdbSeriesData);
    
    fact.verified = verified;
    
    // SOFT-PASS for SEASON_COUNT if not in headline
    const inHeadline = input.headline.toLowerCase().includes(fact.claim.toLowerCase().substring(0, 20));
    
    if (!verified && fact.type === 'SEASON_COUNT' && !inHeadline) {
      console.log(`   ⚠️  Unverified (SOFT-PASS): "${fact.claim}" (${fact.type})`);
      fact.verified = true; // Soft-pass: allow in body text
      fact.confidence = 'LOW';
    } else if (!verified) {
      rejectedFacts.push(fact);
      console.log(`   ⚠️  Unverified: "${fact.claim}" (${fact.type})`);
      
      // Check if it's in headline (CRITICAL)
      if (inHeadline) {
        headlineViolations.push(fact.claim);
      }
    } else {
      console.log(`   ✅ Verified: "${fact.claim}" (${fact.type})`);
    }
    
    criticalFacts.push(fact);
  }

  // Increased tolerance: Only fail if 3+ critical unverified facts OR headline violations
  const mustRewrite = rejectedFacts.length >= 3 || headlineViolations.length > 0;
  const status = mustRewrite ? 'UNSAFE' : 'SAFE';

  if (rejectedFacts.length > 0 && rejectedFacts.length < 3) {
    console.log(`\n⚠️  ${rejectedFacts.length} unverified fact(s) found - ACCEPTABLE (threshold: 3)`);
  } else if (rejectedFacts.length >= 3) {
    console.log(`\n🚨 ${rejectedFacts.length} unverified fact(s) found - MUST REWRITE`);
  }

  if (headlineViolations.length > 0) {
    console.log(`\n🚨 HEADLINE contains unverified facts - HARD FAIL`);
  }

  return {
    status,
    criticalFacts,
    rejectedFacts,
    headlineViolations,
    mustRewrite
  };
}

/**
 * Detect critical facts using AI
 */
async function detectCriticalFacts(
  articleText: string, 
  headline: string,
  extractedFacts: string
): Promise<CriticalFact[]> {
  const client = createLLMClient();

  const systemPrompt = `Fakten-Checker für TV-Serien-News. Identifiziere ausschließlich KRITISCHE Fakten dieser Typen:
- SERIES_END: Serienende-Aussagen
- SEASON_COUNT: Spezifische Staffelanzahlen
- YEAR_DATE: Jahreszahlen für Ende/Start
- LAST_SEASON: "letzte Staffel"-Claims
- CANCELLATION: Absetzungen
- RENEWAL: Verlängerungen mit Staffelzahlen

Keine normalen News-Fakten. Antwort als JSON:
{"facts": [{"type": "...", "claim": "Textpassage", "confidence": "HIGH|MEDIUM|LOW"}]}`;

  const userPrompt = `ARTIKEL:
${(articleText || '').substring(0, 1500)}

HEADLINE:
${headline || ''}

EXTRACTED FACTS:
${(extractedFacts || '').substring(0, 500)}

Finde alle KRITISCHEN FAKTEN.`;

  try {
    const response = await client.chat.completions.create({
      model: LLM_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_completion_tokens: 800,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{"facts":[]}');
    
    return (result.facts || []).map((f: any) => ({
      type: f.type,
      claim: f.claim,
      verified: false,
      confidence: f.confidence || 'NONE',
      alternative: generateNeutralAlternative(f.claim, f.type)
    }));
  } catch (error) {
    console.error('❌ AI fact detection failed:', error);
    return [];
  }
}

/**
 * Verify fact against TMDB data
 */
function verifyFactAgainstTMDB(
  fact: CriticalFact, 
  tmdbData?: { status?: string; lastAirDate?: string; numberOfSeasons?: number }
): boolean {
  if (!tmdbData) return false;

  switch (fact.type) {
    case 'SERIES_END':
    case 'LAST_SEASON':
      // Only verified if TMDB status is "Ended"
      return tmdbData.status === 'Ended';

    case 'CANCELLATION':
      return tmdbData.status === 'Canceled';

    case 'SEASON_COUNT':
      // Extract number from claim (improved regex)
      const seasonMatch = fact.claim.match(/\b(\d+)\s*\.?\s*(Staffel|Season|Seasons)/i);
      if (seasonMatch && tmdbData.numberOfSeasons) {
        const claimedSeasons = parseInt(seasonMatch[1]);
        const actualSeasons = tmdbData.numberOfSeasons;
        
        // Allow ±1 tolerance for ongoing series
        if (tmdbData.status === 'Returning Series') {
          return Math.abs(claimedSeasons - actualSeasons) <= 1;
        }
        
        // Exact match required for ended series
        return claimedSeasons === actualSeasons;
      }
      return false;

    case 'YEAR_DATE':
      // Can't verify future dates
      const yearMatch = fact.claim.match(/\b(202[4-9]|203[0-9])\b/);
      if (yearMatch) {
        const claimedYear = parseInt(yearMatch[1]);
        const currentYear = new Date().getFullYear();
        
        // Future dates are unverifiable
        if (claimedYear > currentYear) return false;
        
        // Past dates: check against TMDB
        if (tmdbData.lastAirDate) {
          const tmdbYear = new Date(tmdbData.lastAirDate).getFullYear();
          return claimedYear === tmdbYear;
        }
      }
      return false;

    case 'RENEWAL':
      return tmdbData.status === 'Returning Series';

    default:
      return false;
  }
}

/**
 * Generate neutral alternative phrasing
 */
function generateNeutralAlternative(claim: string, type: string): string {
  switch (type) {
    case 'SERIES_END':
    case 'LAST_SEASON':
      return claim.replace(
        /(endet|letzte Staffel|finale Season|final season)/gi,
        'ist als Abschluss geplant'
      );

    case 'YEAR_DATE':
      return claim.replace(
        /\b(202[4-9]|203[0-9])\b/g,
        'in den kommenden Jahren'
      );

    case 'SEASON_COUNT':
      return claim.replace(
        /insgesamt \d+ Staffeln?/gi,
        'mehrere Staffeln'
      );

    default:
      return 'laut aktuellen Angaben ' + claim;
  }
}
