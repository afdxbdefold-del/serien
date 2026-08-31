import { jwtVerify } from 'jose/jwt/verify';
import type { NextRequest } from 'next/server';

/**
 * Route-level defence in depth for admin endpoints. The middleware applies
 * the same policy centrally, but routes can also use this helper when called
 * directly from tests or future server-side code.
 */
export async function verifyAdminRequest(request: NextRequest): Promise<boolean> {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) return false;

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;
  const token = bearerToken || request.cookies.get('auth-token')?.value;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret),
      { algorithms: ['HS256'] },
    );
    return Boolean(payload.userId) && payload.role === 'admin';
  } catch {
    return false;
  }
}
