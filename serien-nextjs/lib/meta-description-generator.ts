/**
 * Generate Google Discover optimized Meta Description
 * Uses strict templates based on article type
 */

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.EMERGENT_LLM_KEY,
  baseURL: 'https://llm.kindo.ai/v1',
});

interface MetaDescriptionInput {
  title: string;
  content: string;
  primarySeries: string;
  wasBedeutetDas?: string;
  articleType?: string; // From classification
}

/**
 * Determine article type from title and content
 */
function detectArticleType(title: string, content: string): 'NEWS' | 'THEORY' | 'REVIEW' {
  const titleLower = title.toLowerCase();
  const contentStart = content.substring(0, 500).toLowerCase();
  
  // THEORY indicators (must be checked first, most specific)
  if (
    /theorie|spekulation|könnte|möglich|denkbar|vielleicht/i.test(titleLower) ||
    /theorie|spekulation|könnte passieren|möglicherweise|denkbar/i.test(contentStart)
  ) {
    return 'THEORY';
  }
  
  // REVIEW indicators (explicit reviews only, not breakdowns/explanations)
  // Exclude "episode breakdown" style content
  const isEpisodeBreakdown = /episode|staffel.*episode|folge|erklärt|analysiert|breakdown|breaks down/i.test(titleLower);
  
  if (!isEpisodeBreakdown) {
    if (
      /review|kritik|bewertung|fazit/i.test(titleLower) ||
      /(review|kritik|bewertung):/i.test(contentStart)
    ) {
      return 'REVIEW';
    }
  }
  
  // Default: NEWS (includes episode breakdowns, news, announcements)
  return 'NEWS';
}

/**
 * Extract core fact from content (for NEWS template)
 */
function extractCoreFact(content: string, title: string): string {
  const plainText = content.replace(/<[^>]*>/g, ' ').trim();
  const titleLower = title.toLowerCase();
  
  // Episode breakdown/explanation
  if (/episode|staffel.*episode|folge|erklärt|analysiert|breakdown|breaks down/i.test(titleLower)) {
    return 'Episode-Details';
  }
  
  // Look for key patterns
  if (/neue staffel|staffel \d+|weitere staffel/i.test(plainText)) {
    return 'neue Staffel';
  }
  if (/besetzung|cast|schauspieler|rolle/i.test(plainText)) {
    return 'Besetzung';
  }
  if (/fortsetzung|verlängert|erneuert|renewed/i.test(plainText)) {
    return 'Fortsetzung';
  }
  if (/produktion|dreh|filming|production/i.test(plainText)) {
    return 'Produktion';
  }
  if (/zukunft|ausblick|was kommt/i.test(plainText)) {
    return 'Zukunft der Serie';
  }
  if (/handlung|story|plot/i.test(plainText)) {
    return 'Handlung';
  }
  
  // Default
  return 'aktuelle Entwicklungen';
}

/**
 * Extract theme from content (for THEORY template)
 */
function extractTheme(content: string): string {
  const plainText = content.replace(/<[^>]*>/g, ' ').trim();
  
  if (/handlung|story|plot|geschehen/i.test(plainText)) {
    return 'Handlung';
  }
  if (/figuren|charaktere|personen/i.test(plainText)) {
    return 'Figuren';
  }
  if (/staffel|season|fortsetzung/i.test(plainText)) {
    return 'Zukunft der Serie';
  }
  
  return 'mögliche Entwicklungen';
}

/**
 * Generate template-based meta description
 */
async function generateTemplateDescription(
  type: 'NEWS' | 'THEORY' | 'REVIEW',
  seriesName: string,
  content: string,
  title: string
): Promise<string> {
  let description = '';
  
  switch (type) {
    case 'NEWS':
      const coreFact = extractCoreFact(content, title);
      description = `Aktuelle Entwicklungen zu ${seriesName}. Neue Informationen zu ${coreFact}, offiziell bekannt und verständlich zusammengefasst.`;
      break;
      
    case 'THEORY':
      const theme = extractTheme(content);
      description = `Was bei ${seriesName} als Nächstes passieren könnte. Plausible Theorien zur ${theme}, basierend auf bekannten Informationen.`;
      break;
      
    case 'REVIEW':
      description = `Eine sachliche Einordnung zu ${seriesName}. Stärken, Schwächen und was die Serie für Fans wirklich bietet.`;
      break;
  }
  
  // Ensure length is within bounds
  if (description.length > 155) {
    // Try to shorten by removing last part
    const parts = description.split('.');
    if (parts.length > 2) {
      description = parts.slice(0, 2).join('.') + '.';
    } else {
      description = description.substring(0, 152) + '...';
    }
  }
  
  return description;
}

export async function generateMetaDescription(input: MetaDescriptionInput): Promise<string> {
  const plainText = input.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Detect article type
  const articleType = detectArticleType(input.title, plainText);
  
  console.log(`   📋 Detected Article Type: ${articleType}`);
  
  // Generate template-based description
  const templateDescription = await generateTemplateDescription(
    articleType,
    input.primarySeries,
    plainText,
    input.title
  );
  
  console.log(`   📝 Template used: ${articleType}`);
  
  return templateDescription;
}
