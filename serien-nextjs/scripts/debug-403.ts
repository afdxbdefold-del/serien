import OpenAI from 'openai';

async function main() {
  const client = new OpenAI({
    apiKey: process.env.EMERGENT_LLM_KEY,
    baseURL: 'https://integrations.emergentagent.com/llm',
  });

  // Reproduce a real classifier call for a 403-ing URL
  const systemPrompt = `Classify TV news. Return JSON: {"content_type": "SINGLE_SERIES_NEWS"|"MOVIE"|"UNKNOWN", "confidence": 0-1, "reasoning": "..."}`;
  const userPrompt = `Title: ITV's 'Believe Me': Daniel Mays on the Toll of Playing the "Black Cab Rapist"\n\nText: An actor discusses playing a predator in a new crime drama series...`;

  try {
    const r = await client.chat.completions.create({
      model: 'claude-sonnet-4-5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: 200,
    });
    console.log('OK:', r.choices[0].message.content?.slice(0, 150));
  } catch (e: any) {
    console.log('=== ERROR STRUCTURE ===');
    console.log('type:', e.constructor.name);
    console.log('message:', e.message);
    console.log('status:', e.status);
    console.log('code:', e.code);
    console.log('error.code:', e.error?.code);
    console.log('error.message:', e.error?.message);
    console.log('response.status:', e.response?.status);
    console.log('response.data:', JSON.stringify(e.response?.data).slice(0, 300));
    console.log('keys:', Object.keys(e));
  }
}
main();
