import { NextRequest, NextResponse } from 'next/server';
import { ADS_EDITOR_RESPONSE_HEADERS, hasAdsEditorSession, sameOrigin } from '@/lib/ads-editor-auth';
import { AdsEditorConflict, changeAdsDocument, getAdsDocument } from '@/lib/ads-editor-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await hasAdsEditorSession(request))) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401, headers: ADS_EDITOR_RESPONSE_HEADERS });
  try {
    const doc = await getAdsDocument();
    return NextResponse.json({
      version: doc.version,
      lines: doc.lines,
      history: doc.history.map(({ id, at, action, lines, restoredFrom }) => ({ id, at, action, count: lines.length, restoredFrom })),
    }, { headers: ADS_EDITOR_RESPONSE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Datenbank derzeit nicht erreichbar.' }, { status: 503, headers: ADS_EDITOR_RESPONSE_HEADERS });
  }
}

export async function POST(request: NextRequest) {
  if (!(await hasAdsEditorSession(request))) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401, headers: ADS_EDITOR_RESPONSE_HEADERS });
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 403, headers: ADS_EDITOR_RESPONSE_HEADERS });
  try {
    const raw = await request.text();
    if (raw.length > 60_000) return NextResponse.json({ error: 'Eingabe zu groß.' }, { status: 413, headers: ADS_EDITOR_RESPONSE_HEADERS });
    const body: unknown = JSON.parse(raw);
    const input = body as { action?: unknown; expectedVersion?: unknown; payload?: unknown };
    if (!input || (input.action !== 'append' && input.action !== 'rollback') ||
        typeof input.expectedVersion !== 'string' || typeof input.payload !== 'string') {
      return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400, headers: ADS_EDITOR_RESPONSE_HEADERS });
    }
    const doc = await changeAdsDocument(input.expectedVersion, input.action, input.payload);
    return NextResponse.json({ ok: true, version: doc.version, count: doc.lines.length }, { headers: ADS_EDITOR_RESPONSE_HEADERS });
  } catch (error) {
    if (error instanceof AdsEditorConflict) return NextResponse.json({ error: error.message }, { status: 409, headers: ADS_EDITOR_RESPONSE_HEADERS });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400, headers: ADS_EDITOR_RESPONSE_HEADERS });
    if (error instanceof Error && /^(Zeile |Maximal |Bitte |Alle |Die verwaltete |Diese Version)/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: ADS_EDITOR_RESPONSE_HEADERS });
    }
    return NextResponse.json({ error: 'Speichern fehlgeschlagen; es wurde nichts geändert.' }, { status: 503, headers: ADS_EDITOR_RESPONSE_HEADERS });
  }
}
