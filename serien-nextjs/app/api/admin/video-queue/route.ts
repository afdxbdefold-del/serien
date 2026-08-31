import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ACTIONS = new Set(['stats', 'enqueue', 'process']);

/**
 * Admin-only proxy for video queue controls. CRON_SECRET stays server-side;
 * the admin browser authenticates with its signed admin JWT instead.
 */
export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action') || 'stats';
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 503 }
    );
  }

  const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const baseUrl = configuredBaseUrl || request.nextUrl.origin;
  const target = new URL('/api/cron/videos', baseUrl);
  target.searchParams.set('action', action);

  try {
    const response = await fetch(target, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      cache: 'no-store',
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[admin video queue] proxy failed:', error);
    return NextResponse.json({ error: 'Video queue request failed' }, { status: 502 });
  }
}
