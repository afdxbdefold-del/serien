/**
 * DEACTIVATED (Feb 2026)
 *
 * Vorher: Cron griff sich alle tmdbIds aus `streaming_releases` ohne
 * Serien-Row und rief `importSeriesById` für sie auf — bulk-Import ohne
 * Bezug zu einem Artikel.
 *
 * Neue Regel (User-Direktive): Serien werden ausschließlich zusammen mit
 * einem Artikel angelegt (siehe scripts/pipeline-v2.ts).
 *
 * Endpoint bleibt bestehen (verhindert 404-Errors bei Cron-Referenzen),
 * tut aber nichts mehr.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (request.headers.get('x-vercel-cron')) return true;
  const secret = request.nextUrl.searchParams.get('secret');
  return Boolean(secret && secret === process.env.CRON_SECRET);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    disabled: true,
    reason: 'backfill-streaming-series deaktiviert — Serien werden nur noch mit Artikeln angelegt.',
    since: '2026-02',
  });
}
