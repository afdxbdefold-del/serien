import { NextRequest, NextResponse } from 'next/server';
import { ADS_EDITOR_COOKIE, ADS_EDITOR_COOKIE_OPTIONS, ADS_EDITOR_RESPONSE_HEADERS, sameOrigin } from '@/lib/ads-editor-auth';

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 403, headers: ADS_EDITOR_RESPONSE_HEADERS });
  const response = NextResponse.json({ ok: true }, { headers: ADS_EDITOR_RESPONSE_HEADERS });
  response.cookies.set(ADS_EDITOR_COOKIE, '', { ...ADS_EDITOR_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
