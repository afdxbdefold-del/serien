/**
 * HEADLINE POLICY
 * 
 * Default: TRANSLATE_ONLY
 * Headlines werden treu übersetzt, nicht umgeschrieben
 */

export const HEADLINE_POLICY = {
  default: 'TRANSLATE_ONLY',
  
  rules: {
    keep_structure: true,
    keep_intent: true,
    no_marketing: true,
    no_platform_addition: true,
    no_tense_change: true,
    no_certainty_change: true,
  },
  
  rewrite_allowed_if: {
    untranslatable_wordplay: true,
    clickbait_without_substance: true,
    misleading_or_vague: true,
    translated_length_over_110_chars: true,
    factual_accuracy_improves: true,
  },
  
  rewrite_style: {
    tone: 'neutral',
    style: 'journalistic',
    approach: 'factual',
    avoid: ['hype', 'reader_address', 'marketing'],
  },
  
  seo_rules: {
    priority: 'clarity_over_keywords',
    series_name_unchanged: true,
    avoid_generic_verbs: ['bestätigt', 'kommt', 'endlich'],
  },
};

export interface HeadlineTranslationResult {
  translatedHeadline: string;
  wasRewritten: boolean;
  rewriteReason?: string;
  originalHeadline: string;
  translationNote?: string;
}

export async function translateHeadline(
  originalEnglishHeadline: string,
  seriesName: string,
  platform?: string
): Promise<HeadlineTranslationResult> {
  // Simple direct translation for now
  // In production, this would call an LLM with TRANSLATE_ONLY instruction
  
  console.log(`\n📰 Headline Translation (TRANSLATE_ONLY mode):`);
  console.log(`   Original: "${originalEnglishHeadline}"`);
  
  // For now, just return the original as translated
  // The Editorial Rewriter will handle actual translation
  
  return {
    translatedHeadline: originalEnglishHeadline, // Will be translated by Editorial Rewriter
    wasRewritten: false,
    originalHeadline: originalEnglishHeadline,
  };
}
