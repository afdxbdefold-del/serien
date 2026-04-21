/**
 * Debug endpoint: returns the currently configured LLM model + a build timestamp.
 * Call GET /api/debug/llm-version to verify which code is actually live.
 */
import { NextResponse } from 'next/server';
import { getLLMConfig } from '@/lib/llm-config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const cfg = getLLMConfig();
  return NextResponse.json({
    model: cfg.model,
    baseURL: cfg.baseURL,
    apiKeyPrefix: cfg.apiKey ? cfg.apiKey.slice(0, 10) + '…' : 'missing',
    buildMarker: 'v-2026-04-21-killswitch-plus-sanitize-catch',
    serverTime: new Date().toISOString(),
  });
}
