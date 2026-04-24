/**
 * Internal: Revalidate arbitrary page paths on demand.
 *
 * Server-to-server only (Authorization: Bearer $JWT_SECRET).
 * Used e.g. to purge the ISR cache for /top-10 after the FlixPatrol cron
 * re-ingests rankings, or when an admin action should take effect immediately.
 *
 *   POST /api/internal/revalidate
 *   Body: { "paths": ["/top-10", "/"] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'JWT_SECRET not configured' }, { status: 500 });
  }

  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { paths?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const paths = Array.isArray(body.paths) ? body.paths.filter((p) => typeof p === 'string' && p.startsWith('/')) : [];
  if (paths.length === 0) {
    return NextResponse.json({ error: 'paths[] required (each must start with "/")' }, { status: 400 });
  }

  const revalidated: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  for (const p of paths) {
    try {
      revalidatePath(p, 'page');
      revalidated.push(p);
    } catch (e: any) {
      errors.push({ path: p, error: e?.message || 'unknown' });
    }
  }

  return NextResponse.json({
    revalidated,
    errors,
    at: new Date().toISOString(),
  });
}
