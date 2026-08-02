/**
 * Internal crawler tracking endpoint.
 * Feb 2026: Tracking komplett abgeschaltet (User-Vorgabe). Endpoint gibt
 * nur noch 200 zurück, damit alte Middleware-Deployments, die noch POSTen,
 * keinen Fehler werfen. Kein DB-Write mehr.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json({ ok: true, disabled: true });
}
