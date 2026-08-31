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
import { requireCronAuth } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authFailure = requireCronAuth(request);
  if (authFailure) return authFailure;

  return NextResponse.json({
    ok: true,
    disabled: true,
    reason: 'tmdb-sync deaktiviert — Serien werden nur noch mit Artikeln angelegt.',
    since: '2026-02',
  });
}
