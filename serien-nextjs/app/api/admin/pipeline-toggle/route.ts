/**
 * Pipeline Cron Kill-Switch
 * GET  → { paused: boolean }
 * POST { paused: boolean } → updates the flag
 *
 * When paused, /api/cron/news returns 200 with "skipped: true" without running.
 * Use this when pipeline is failing (e.g. LLM safety-block storm) to stop
 * the bleeding without a redeploy.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBoolSetting, setSetting, SETTINGS } from '@/lib/app-settings';

export const dynamic = 'force-dynamic';

async function authorize(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== 'admin') return null;
    return String(payload.email || payload.username || 'admin');
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const user = await authorize(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const paused = await getBoolSetting(SETTINGS.PIPELINE_CRON_PAUSED, false);
  return NextResponse.json({ paused });
}

export async function POST(req: NextRequest) {
  const user = await authorize(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const paused = Boolean(body.paused);
  await setSetting(SETTINGS.PIPELINE_CRON_PAUSED, paused ? 'true' : 'false', user);
  return NextResponse.json({ paused });
}
