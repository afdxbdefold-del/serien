import { NextResponse } from 'next/server';
import { createLLMClient, NEWS_LLM_CONFIG } from '@/lib/llm-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const base = {
    model: NEWS_LLM_CONFIG.model,
    reasoningEffort: NEWS_LLM_CONFIG.reasoning_effort,
    baseURL: 'https://api.openai.com/v1',
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    buildMarker: 'news-astra-2026-09-21',
    serverTime: new Date().toISOString(),
  };

  // Run a minimal authenticated provider check. Never expose key material or
  // a reusable key fingerprint in this response.
  const t0 = Date.now();
  try {
    const client = createLLMClient();
    const r = await client.chat.completions.create({
      ...NEWS_LLM_CONFIG,
      messages: [{ role: 'user', content: 'Antworte nur mit OK.' }],
      max_completion_tokens: 1024,
    }, { timeout: 45_000, maxRetries: 0 });
    const choice = r.choices[0];
    const ok = choice?.finish_reason === 'stop' && !choice.message.refusal && choice.message.content?.trim() === 'OK';
    return NextResponse.json({
      ...base,
      ping: {
        ok,
        durationMs: Date.now() - t0,
        response: ok ? 'OK' : '',
        ...(ok ? {} : { errorMessage: 'Provider probe returned no complete expected answer' }),
      },
    });
  } catch (error) {
    const status = (error as { status?: unknown })?.status;
    return NextResponse.json({
      ...base,
      ping: {
        ok: false,
        durationMs: Date.now() - t0,
        errorMessage: 'News model provider check failed; inspect private configuration',
        errorStatus: typeof status === 'number' && Number.isInteger(status) && status >= 100 && status < 600 ? status : null,
      },
    });
  }
}
