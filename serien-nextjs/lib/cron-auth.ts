import { NextResponse } from 'next/server';

/**
 * Fail-closed authentication shared by every scheduled HTTP job.
 * Query-string credentials, platform-specific headers and hardcoded fallbacks
 * are intentionally unsupported.
 */
export function requireCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    console.error('[cron] CRON_SECRET is not configured');
    return NextResponse.json(
      { error: 'Cron authentication is not configured' },
      { status: 503 }
    );
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
