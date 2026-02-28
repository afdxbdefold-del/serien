/**
 * Q&A Generator - Simplified Version
 * Generates 2-3 Q&A pairs for articles
 */

export interface QAItem {
  question: string;
  answer: string;
  factual: boolean;
}

export interface ArticleQAInput {
  title: string;
  contentHtml: string;
  seriesName: string;
  seriesStatus?: string;
}

export async function generateArticleQA(input: ArticleQAInput): Promise<QAItem[]> {
  try {
    const apiKey = process.env.EMERGENT_LLM_KEY;
    if (!apiKey) {
      console.log('   ⚠️  No API key, skipping Q&A');
      return [];
    }

    // Extract plain text
    const plainText = input.contentHtml
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1500);

    console.log('   🤔 Generating Q&A...');

    // WORKAROUND: Using Claude Sonnet 4 due to GPT-5.2 filter issues
    const response = await fetch('https://integrations.emergentagent.com/anthropic/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are a helpful assistant. Create 2-3 simple questions and answers about this article in German. Return ONLY valid JSON with this structure: {"questions":[{"question":"...","answer":"...","factual":true}]}

Article about ${input.seriesName}:

${plainText}

Create 2-3 Q&A pairs in German. Return only the JSON, no explanation.`
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ⚠️  API error ${response.status}:`, errorText.substring(0, 100));
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.log('   ⚠️  No content in response');
      return [];
    }

    const parsed = JSON.parse(content);
    const questions = (parsed.questions || []).slice(0, 3);

    if (questions.length > 0) {
      console.log(`   ✅ Generated ${questions.length} Q&A pairs`);
    } else {
      console.log('   ⚠️  No questions generated');
    }

    return questions;

  } catch (error: any) {
    console.log('   ⚠️  Q&A generation failed:', error.message?.substring(0, 50));
    return [];
  }
}
