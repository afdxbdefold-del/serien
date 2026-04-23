/**
 * TIME AXIS CORRECTION v1.0
 * 
 * Verhindert, dass alte Inhalte als neue News erscheinen.
 * Klassifiziert Content basierend auf sourcePublishedAt.
 */

export type ContentAgeClass = 'FRESH_NEWS' | 'RECENT_UPDATE' | 'BACKGROUND';

export interface TimeAxisResult {
  contentAgeClass: ContentAgeClass;
  contentAgeDays: number;
  sourcePublishedAt: Date;
  publishedAt: Date;
  allowedContentTypes: string[];
  discoverEligible: boolean;
  headlineRestrictions: {
    forbidden: string[];
    allowed: string[];
  };
  publishDecision: 'PUBLISH' | 'SKIP' | 'BACKGROUND_ONLY';
  reasons: string[];
}

interface TimeAxisInput {
  sourcePublishedAt: Date | string;
  headline: string;
  contentType: 'NEWS' | 'UPDATE' | 'CONTEXT' | 'BACKGROUND';
}

/**
 * Classify content age and determine publish strategy
 */
export function classifyContentAge(input: TimeAxisInput): TimeAxisResult {
  const now = new Date();
  const sourceDate = new Date(input.sourcePublishedAt);
  
  // Calculate age in days
  const ageMs = now.getTime() - sourceDate.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  console.log(`⏰ Time Axis Check:`);
  console.log(`   Source Date: ${sourceDate.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}`);
  console.log(`   Content Age: ${ageDays} days`);

  let contentAgeClass: ContentAgeClass;
  let allowedContentTypes: string[];
  let discoverEligible: boolean;
  let publishedAt: Date;
  let publishDecision: 'PUBLISH' | 'SKIP' | 'BACKGROUND_ONLY';
  const reasons: string[] = [];

  // === CLASSIFICATION LOGIC ===
  
  if (ageDays <= 7) {
    // FRESH NEWS (0-7 days)
    contentAgeClass = 'FRESH_NEWS';
    allowedContentTypes = ['NEWS'];
    discoverEligible = true;
    publishedAt = now;
    publishDecision = 'PUBLISH';
    
    console.log(`   ✅ Class: FRESH_NEWS (≤7 days)`);
    console.log(`   → Publish Mode: STANDARD NEWS`);
    
  } else if (ageDays <= 30) {
    // RECENT UPDATE (8-30 days)
    contentAgeClass = 'RECENT_UPDATE';
    allowedContentTypes = ['UPDATE', 'CONTEXT'];
    discoverEligible = false; // No Discover for older content
    publishedAt = now;
    publishDecision = 'PUBLISH';
    
    console.log(`   ⚠️  Class: RECENT_UPDATE (8-30 days)`);
    console.log(`   → Publish Mode: UPDATE/CONTEXT only`);
    console.log(`   → Discover: DISABLED`);
    
    reasons.push('Content is 8-30 days old - only UPDATE/CONTEXT allowed');
    
  } else {
    // BACKGROUND (>30 days)
    contentAgeClass = 'BACKGROUND';
    allowedContentTypes = ['BACKGROUND'];
    discoverEligible = false;
    publishedAt = sourceDate; // Use original date
    publishDecision = 'BACKGROUND_ONLY';
    
    console.log(`   🚫 Class: BACKGROUND (>${ageDays} days old)`);
    console.log(`   → Publish Mode: BACKGROUND ONLY`);
    console.log(`   → Discover: DISABLED`);
    console.log(`   → PublishedAt: ${sourceDate.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })} (original)`);
    
    reasons.push(`Content is ${ageDays} days old - BACKGROUND only`);
    reasons.push('No Discover eligibility for old content');
  }

  // === HEADLINE RESTRICTIONS ===
  
  const headlineRestrictions = getHeadlineRestrictions(contentAgeClass);
  
  // Check if headline violates time restrictions
  if (contentAgeClass === 'BACKGROUND') {
    const violations = checkHeadlineViolations(input.headline, headlineRestrictions.forbidden);
    if (violations.length > 0) {
      console.log(`   ⚠️  Headline violations detected: ${violations.join(', ')}`);
      reasons.push(`Headline contains present-tense verbs for old content: ${violations.join(', ')}`);
    }
  }

  return {
    contentAgeClass,
    contentAgeDays: ageDays,
    sourcePublishedAt: sourceDate,
    publishedAt,
    allowedContentTypes,
    discoverEligible,
    headlineRestrictions,
    publishDecision,
    reasons
  };
}

/**
 * Get headline restrictions based on content age
 */
function getHeadlineRestrictions(contentAgeClass: ContentAgeClass): {
  forbidden: string[];
  allowed: string[];
} {
  switch (contentAgeClass) {
    case 'FRESH_NEWS':
      return {
        forbidden: [],
        allowed: ['startet', 'bestätigt', 'arbeitet an', 'kehrt zurück', 'animiert']
      };

    case 'RECENT_UPDATE':
      return {
        forbidden: ['startet jetzt', 'heute', 'gerade'],
        allowed: ['wird fortgesetzt', 'ist in Produktion', 'wurde bestätigt']
      };

    case 'BACKGROUND':
      return {
        forbidden: ['startet', 'arbeitet an', 'animiert', 'kehrt zurück', 'bestätigt', 'produziert'],
        allowed: ['wurde produziert', 'erschien', 'war verantwortlich', 'lief von']
      };
  }
}

/**
 * Check if headline contains forbidden time-related words
 */
function checkHeadlineViolations(headline: string, forbidden: string[]): string[] {
  const violations: string[] = [];
  const lowerHeadline = headline.toLowerCase();
  
  for (const word of forbidden) {
    if (lowerHeadline.includes(word.toLowerCase())) {
      violations.push(word);
    }
  }
  
  return violations;
}

/**
 * Determine if content should be published based on time axis
 */
export function shouldPublishBasedOnAge(timeAxisResult: TimeAxisResult): {
  shouldPublish: boolean;
  publishMode: 'DISCOVER' | 'SEARCH_ONLY' | 'NOINDEX' | 'SKIP';
  reason: string;
} {
  switch (timeAxisResult.contentAgeClass) {
    case 'FRESH_NEWS':
      // Fresh news can go through normal Discover flow
      return {
        shouldPublish: true,
        publishMode: 'DISCOVER',
        reason: 'Fresh news - eligible for Discover'
      };

    case 'RECENT_UPDATE':
      // Recent updates are publishable but no Discover
      return {
        shouldPublish: true,
        publishMode: 'SEARCH_ONLY',
        reason: 'Recent update - SEARCH_ONLY (no Discover)'
      };

    case 'BACKGROUND':
      // Background content: low priority, may be skipped
      if (timeAxisResult.contentAgeDays > 90) {
        // Very old content - skip publication
        return {
          shouldPublish: false,
          publishMode: 'SKIP',
          reason: `Content too old (${timeAxisResult.contentAgeDays} days) - SKIP`
        };
      } else {
        // 30-90 days: publish as NOINDEX or SEARCH_ONLY
        return {
          shouldPublish: true,
          publishMode: 'SEARCH_ONLY',
          reason: 'Background content - SEARCH_ONLY (no Discover, no indexing priority)'
        };
      }
  }
}

/**
 * Generate neutral headline for old content
 */
export function neutralizeOldContentHeadline(
  headline: string, 
  contentAgeClass: ContentAgeClass
): string {
  if (contentAgeClass !== 'BACKGROUND') {
    return headline;
  }

  // Replace present tense with past tense
  let neutralized = headline
    .replace(/\bstartet\b/gi, 'startete')
    .replace(/\barbeitet an\b/gi, 'arbeitete an')
    .replace(/\banimiert\b/gi, 'wurde animiert')
    .replace(/\bkehrt zurück\b/gi, 'kehrte zurück')
    .replace(/\bbestätigt\b/gi, 'wurde bestätigt')
    .replace(/\bproduziert\b/gi, 'wurde produziert');

  return neutralized;
}
