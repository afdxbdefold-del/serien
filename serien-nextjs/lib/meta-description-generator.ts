/**
 * Generate Google Discover optimized Meta Description
 * Uses distinct-lead-generator for unique, non-generic descriptions
 */

import { LLM_CONFIG } from './llm-config';

interface MetaDescriptionInput {
  title: string;
  content: string;
  primarySeries: string;
  wasBedeutetDas?: string;
  articleType?: string;
}

/**
 * Main export - Generate unique meta description
 */
export async function generateMetaDescription(input: MetaDescriptionInput): Promise<string> {
  // Import distinct lead generator
  const { generateDistinctLead } = await import('./distinct-lead-generator');
  
  // Extract key facts from content
  const plainText = input.content.replace(/<[^>]*>/g, ' ').trim();
  const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 20).slice(0, 5);
  
  console.log(`   📝 Generating unique meta description via distinct-lead-generator`);
  
  // Generate unique lead using the same system as articles
  try {
    const uniqueLead = await generateDistinctLead({
      articleHtml: input.content,
      headline: input.title,
      seriesName: input.primarySeries || 'die Serie',
      facts: sentences
    });
    
    // Trim to 155 characters for meta description with smart truncation
    let description = uniqueLead.trim();
    
    if (description.length > 155) {
      // Import smart truncate
      const { smartTruncate } = await import('./smart-truncate');
      description = smartTruncate(description, 155);
    }
    
    console.log(`   ✅ Meta description length: ${description.length} chars`);
    return description;
    
  } catch (error: any) {
    console.error(`❌ Meta description generation failed: ${error.message}`);
    throw new Error(`Cannot generate meta description with unique content: ${error.message}`);
  }
}
