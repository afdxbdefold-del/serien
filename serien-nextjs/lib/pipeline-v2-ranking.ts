/**
 * PIPELINE_V2: RANKING/LISTICLE PIPELINE
 * Specialized pipeline for ranking/list articles with chunked processing
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();

interface RankingPipelineInput {
  sourceTitle: string;
  sourceUrl: string;
  sourceText: string;
  itemCount: number;
  primarySeriesId?: number;
  primarySeriesName?: string;
}

const RANKING_INTRO_PROMPT = `Du bist ein erfahrener Redakteur für Serien-Rankings.

Schreibe eine EINLEITUNG (2-3 Absätze, 120-180 Wörter) für ein Ranking-Artikel.

STRUKTUR:
Absatz 1: Serie nennen, Plattform, kurzer Kontext (Laufzeit, kulturelle Bedeutung)
Absatz 2: Was macht dieses Ranking besonders, Auswahlkriterien
Absatz 3 (optional): Einordnung der Serie im Genre

TONALITÄT:
- Sachlich, aber enthusiastisch
- Faktenbasiert, keine Übertreibungen
- Glaubwürdig wie echter Redakteur

VERBOTEN:
- "Fans werden begeistert sein"
- "Die beste Serie aller Zeiten"
- KI-Phrasen

Schreibe NUR die Einleitung (2-3 Absätze, reiner Text).`;

const RANKING_BATCH_PROMPT = `Du bist ein erfahrener Redakteur für Serien-Rankings.

Schreibe detaillierte Beschreibungen für eine BATCH von Ranking-Items.

FÜR JEDES ITEM:
- ÜBERSCHRIFT: [Platzierung]. [Episode/Item-Titel]
- KONTEXT: In welcher Staffel, welcher Handlungsbogen? (1 Satz)
- HIGHLIGHT: Was passiert konkret? (3-4 Sätze mit Details)
- WARUM TOP: Warum gehört es zum Ranking? (1-2 Sätze)

Länge pro Item: 80-140 Wörter

TONALITÄT:
- Konkret, mit Plot-Details
- Sachlich, aber wertschätzend
- Keine leeren Phrasen

Schreibe die Items nacheinander (ein Item pro Block, durch Leerzeile getrennt).`;

/**
 * Generate ranking intro
 */
async function generateRankingIntro(
  seriesName: string,
  platform: string,
  itemCount: number,
  facts: string[]
): Promise<string> {
  const apiKey = process.env.EMERGENT_LLM_KEY;
  if (!apiKey) throw new Error('EMERGENT_LLM_KEY not found');
  
  const client = new OpenAI({
    apiKey,
    baseURL: 'http://localhost:8002/v1',
  });
  
  const userPrompt = `
Serie: ${seriesName}
Plattform: ${platform || 'Streaming'}
Anzahl Items im Ranking: ${itemCount}

Fakten zur Serie:
${facts.slice(0, 5).map((f, i) => `${i + 1}. ${f}`).join('\n')}

Schreibe jetzt die Einleitung (120-180 Wörter).
`.trim();
  
  const response = await client.chat.completions.create({
    model: 'gpt-5.1',
    messages: [
      { role: 'system', content: RANKING_INTRO_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 400,
  });
  
  return response.choices[0]?.message?.content?.trim() || '';
}

/**
 * Generate a batch of ranking items
 */
async function generateRankingBatch(
  seriesName: string,
  batchItems: Array<{ rank: number; title: string; context: string }>,
  facts: string[]
): Promise<string> {
  const apiKey = process.env.EMERGENT_LLM_KEY;
  if (!apiKey) throw new Error('EMERGENT_LLM_KEY not found');
  
  const client = new OpenAI({
    apiKey,
    baseURL: 'http://localhost:8002/v1',
  });
  
  const itemsDescription = batchItems.map(item => 
    `Platz ${item.rank}: ${item.title} - ${item.context}`
  ).join('\n');
  
  const userPrompt = `
Serie: ${seriesName}
Batch-Items (${batchItems.length} Stück):
${itemsDescription}

Zusätzliche Fakten:
${facts.slice(0, 10).map((f, i) => `${i + 1}. ${f}`).join('\n')}

Schreibe jetzt die Beschreibungen für alle ${batchItems.length} Items (je 80-140 Wörter pro Item).
`.trim();
  
  const response = await client.chat.completions.create({
    model: 'gpt-5.1',
    messages: [
      { role: 'system', content: RANKING_BATCH_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: Math.min(2000, batchItems.length * 300),
  });
  
  return response.choices[0]?.message?.content?.trim() || '';
}

/**
 * Extract items from source text
 */
function extractRankingItems(sourceText: string, itemCount: number): Array<{ rank: number; title: string; context: string }> {
  const items: Array<{ rank: number; title: string; context: string }> = [];
  
  // Try to extract from H2/H3 headings
  const headingRegex = /<h[23][^>]*>(.*?)<\/h[23]>/gi;
  const headings = Array.from(sourceText.matchAll(headingRegex));
  
  if (headings.length >= itemCount) {
    headings.slice(0, itemCount).forEach((match, i) => {
      const title = match[1].replace(/<[^>]*>/g, '').trim();
      const rank = i + 1;
      
      // Extract some context after the heading (next 200 chars)
      const startIndex = match.index! + match[0].length;
      const context = sourceText.substring(startIndex, startIndex + 200).replace(/<[^>]*>/g, ' ').trim();
      
      items.push({ rank, title, context });
    });
  } else {
    // Fallback: Generate generic items
    for (let i = 1; i <= itemCount; i++) {
      items.push({
        rank: i,
        title: `Episode/Item ${i}`,
        context: 'Details aus dem Original-Artikel',
      });
    }
  }
  
  return items;
}

/**
 * Main PIPELINE_V2 function
 */
export async function runRankingPipeline(input: RankingPipelineInput): Promise<any> {
  console.log('\n' + '='.repeat(70));
  console.log('🎯 PIPELINE_V2: RANKING/LISTICLE PIPELINE');
  console.log('='.repeat(70));
  console.log(`📄 Title: ${input.sourceTitle}`);
  console.log(`📊 Item Count: ${input.itemCount}`);
  console.log(`🔗 URL: ${input.sourceUrl}`);
  console.log('');
  
  try {
    // Extract items from source
    console.log('━'.repeat(70));
    console.log('STEP 1: EXTRACT ITEMS');
    console.log('━'.repeat(70));
    
    const items = extractRankingItems(input.sourceText, input.itemCount);
    console.log(`✅ Extracted ${items.length} items`);
    
    // Generate intro
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 2: GENERATE INTRO');
    console.log('━'.repeat(70));
    
    const intro = await generateRankingIntro(
      input.primarySeriesName || 'Serie',
      'Streaming',
      input.itemCount,
      [] // Facts would come from fact extractor
    );
    
    console.log(`✅ Intro generated (${intro.length} chars)`);
    
    // Generate items in batches
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 3: GENERATE ITEMS (BATCHED)');
    console.log('━'.repeat(70));
    
    const batchSize = 5;
    const generatedItems: string[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, Math.min(i + batchSize, items.length));
      console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (${batch.length} items)...`);
      
      const batchContent = await generateRankingBatch(
        input.primarySeriesName || 'Serie',
        batch,
        []
      );
      
      generatedItems.push(batchContent);
      console.log(`✅ Batch generated (${batchContent.length} chars)`);
      
      // Small delay between batches
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Combine all content
    const fullContent = `
<p>${intro}</p>

${generatedItems.join('\n\n')}

<p>Diese Auswahl zeigt, warum ${input.primarySeriesName || 'die Serie'} zu den besten ihrer Art gehört.</p>
    `.trim();
    
    const wordCount = fullContent.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(w => w.length > 0).length;
    
    console.log('\n' + '━'.repeat(70));
    console.log('STEP 4: COMBINE & VALIDATE');
    console.log('━'.repeat(70));
    console.log(`✅ Total word count: ${wordCount}`);
    console.log(`✅ Target range: 900-1800 words`);
    
    if (wordCount < 900) {
      console.log(`⚠️  Below target (${wordCount} < 900)`);
    } else if (wordCount > 1800) {
      console.log(`⚠️  Above target (${wordCount} > 1800)`);
    } else {
      console.log(`✅ Within target range!`);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 PIPELINE_V2 COMPLETE');
    console.log('='.repeat(70));
    
    return {
      success: true,
      contentHtml: fullContent,
      wordCount,
      headline: input.sourceTitle, // Keep original headline (translated)
    };
    
  } catch (error: any) {
    console.error('\n❌ PIPELINE_V2 FAILED:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
