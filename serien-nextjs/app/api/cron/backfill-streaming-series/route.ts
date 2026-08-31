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
import { requireCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authFailure = requireCronAuth(request);
  if (authFailure) return authFailure;

  return NextResponse.json({
    ok: true,
    disabled: true,
    reason: 'backfill-streaming-series deaktiviert — Serien werden nur noch mit Artikeln angelegt.',
    since: '2026-02',
  });
}
