import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import {
  ADS_EDITOR_COOKIE, ADS_EDITOR_COOKIE_OPTIONS, ADS_EDITOR_RESPONSE_HEADERS,
  adsEditorConfigured, createAdsEditorSession, sameOrigin,
} from '@/lib/ads-editor-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60_000;

function allowAttempt(request: NextRequest): boolean {
  // Only hashed client identifiers are retained, in memory, for one window.
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const key = createHash('sha256').update(ip).digest('hex');
  const now = Date.now();
  if (attempts.size > 10_000) {
    for (const [id, entry] of attempts) if (entry.resetAt <= now) attempts.delete(id);
  }
  const previous = attempts.get(key);
  const current = previous && previous.resetAt > now ? previous : { count: 0, resetAt: now + WINDOW_MS };
  current.count++;
  attempts.set(key, current);
  return current.count <= 5;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 403, headers: ADS_EDITOR_RESPONSE_HEADERS });
  if (!adsEditorConfigured()) return NextResponse.json({ error: 'Editor noch nicht eingerichtet.' }, { status: 503, headers: ADS_EDITOR_RESPONSE_HEADERS });
  if (!allowAttempt(request)) return NextResponse.json({ error: 'Zu viele Versuche. Bitte später erneut probieren.' }, {
    status: 429, headers: { ...ADS_EDITOR_RESPONSE_HEADERS, 'Retry-After': '900' },
  });
  try {
    const raw = await request.text();
    if (raw.length > 2048) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400, headers: ADS_EDITOR_RESPONSE_HEADERS });
    const body: unknown = JSON.parse(raw);
    const password = (body as { password?: unknown })?.password;
    if (typeof password !== 'string' || password.length > 200 || !password) {
      return NextResponse.json({ error: 'Ungültige Anmeldung.' }, { status: 401, headers: ADS_EDITOR_RESPONSE_HEADERS });
    }
    if (!(await bcrypt.compare(password, process.env.ADS_EDITOR_PASSWORD_HASH!))) {
      return NextResponse.json({ error: 'Ungültige Anmeldung.' }, { status: 401, headers: ADS_EDITOR_RESPONSE_HEADERS });
    }
    const response = NextResponse.json({ ok: true }, { headers: ADS_EDITOR_RESPONSE_HEADERS });
    response.cookies.set(ADS_EDITOR_COOKIE, await createAdsEditorSession(), ADS_EDITOR_COOKIE_OPTIONS);
    return response;
  } catch {
    return NextResponse.json({ error: 'Ungültige Anmeldung.' }, { status: 401, headers: ADS_EDITOR_RESPONSE_HEADERS });
  }
}
