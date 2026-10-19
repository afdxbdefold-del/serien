import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

export const ADS_EDITOR_COOKIE = 'serien_ads_editor';
const ISSUER = 'serien.de/ads-editor';
const AUDIENCE = 'ads-editor';
const SESSION_SECONDS = 60 * 60 * 4;

function signingKey(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  return secret && secret.length >= 32 ? new TextEncoder().encode(secret) : null;
}

export function adsEditorConfigured(): boolean {
  return Boolean(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(process.env.ADS_EDITOR_PASSWORD_HASH || '') && signingKey());
}

export async function createAdsEditorSession(): Promise<string> {
  const key = signingKey();
  if (!key) throw new Error('Ads editor session is not configured');
  return new SignJWT({ scope: 'ads-editor' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject('ads-editor')
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(key);
}

export async function hasAdsEditorSession(request: NextRequest): Promise<boolean> {
  const key = signingKey();
  const token = request.cookies.get(ADS_EDITOR_COOKIE)?.value;
  if (!key || !token) return false;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE,
    });
    return payload.sub === 'ads-editor' && payload.scope === 'ads-editor';
  } catch {
    return false;
  }
}

export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host.toLowerCase() === host.toLowerCase() &&
      (parsed.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:'));
  } catch {
    return false;
  }
}

export const ADS_EDITOR_RESPONSE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

export const ADS_EDITOR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/ads-editor',
  maxAge: SESSION_SECONDS,
};
