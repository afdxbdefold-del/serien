/**
 * DEACTIVATED (Feb 2026)
 *
 * Vorher: Cron importierte 30 „hot"-Serien pro Lauf aus TMDB direkt in die
 * DB (ohne Artikel). Resultat: tausende „Karteileichen"-Serien, die weder
 * SEO-Wert noch Traffic brachten.
 *
 * Neue Regel (User-Direktive): Serien werden ausschließlich zusammen mit
 * einem Artikel angelegt. Der Artikel-Pipeline-Code in
 * `scripts/pipeline-v2.ts` (~Zeile 984) macht das automatisch beim
 * ersten Artikel für eine neue Serie via `prisma.series.upsert`.
 *
 * Endpoint bleibt bestehen (verhindert 404-Errors bei alten Coolify-
 * Scheduled-Tasks / Vercel-Cron-Referenzen), tut aber nichts mehr.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const secret = request.nextUrl.searchParams.get('secret');
  return secret === process.env.CRON_SECRET;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    disabled: true,
    reason: 'tmdb-sync deaktiviert — Serien werden nur noch mit Artikeln angelegt.',
    since: '2026-02',
  });
}
