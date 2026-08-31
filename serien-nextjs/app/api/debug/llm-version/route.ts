import { NextResponse } from 'next/server';
import { createLLMClient, getLLMConfig } from '@/lib/llm-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const cfg = getLLMConfig();
  const base = {
    model: cfg.model,
    baseURL: cfg.baseURL,
    apiKeyConfigured: Boolean(cfg.apiKey),
    buildMarker: 'v-2026-04-21-dash-protect-series-names',
    serverTime: new Date().toISOString(),
  };

  // Run a minimal authenticated provider check. Never expose key material or
  // a reusable key fingerprint in this response.
  const t0 = Date.now();
  try {
    const client = createLLMClient();
    const r = await client.chat.completions.create({
      model: cfg.model,
      messages: [{ role: 'user', content: 'Antworte nur mit OK.' }],
      max_completion_tokens: 5,
    });
    return NextResponse.json({
      ...base,
      ping: {
        ok: true,
        durationMs: Date.now() - t0,
        response: r.choices[0]?.message?.content?.trim()?.slice(0, 50) || '',
      },
    });
  } catch (e: any) {
    return NextResponse.json({
      ...base,
      ping: {
        ok: false,
        durationMs: Date.now() - t0,
        errorMessage: (e?.message || String(e)).slice(0, 500),
        errorStatus: e?.status ?? null,
        errorCode: e?.code ?? null,
      },
    });
  }
}
