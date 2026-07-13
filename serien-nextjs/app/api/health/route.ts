// Health-Endpoint für Coolify / Docker Healthcheck.
// Antwortet 200 ohne DB-Roundtrip, damit ein DB-Timeout den Container nicht
// unnötig neu startet. Ausführlichere Health-Info in /api/admin/dashboard.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    { status: 'ok', ts: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
