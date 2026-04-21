import { NextResponse } from 'next/server';
import { createLLMClient, getLLMConfig } from '@/lib/llm-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const cfg = getLLMConfig();
  const base = {
    model: cfg.model,
    baseURL: cfg.baseURL,
    apiKeyPrefix: cfg.apiKey ? cfg.apiKey.slice(0, 14) + '…' + cfg.apiKey.slice(-4) : 'MISSING',
    apiKeyLength: cfg.apiKey?.length ?? 0,
    buildMarker: 'v-2026-04-21-crawler-tracker-everywhere',
    serverTime: new Date().toISOString(),
  };

  // Do a real Claude ping to see whether the proxy actually reaches Claude
  const t0 = Date.now();
  try {
    const client = createLLMClient();
    const r = await client.chat.completions.create({
      model: cfg.model,
      messages: [{ role: 'user', content: 'Antworte nur mit OK.' }],
      max_tokens: 5,
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
