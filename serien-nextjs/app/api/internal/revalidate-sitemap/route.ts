/**
 * Internal: Revalidate /news-sitemap.xml on demand.
 *
 * Called after each article publish from scripts/pipeline-v2.ts via
 * prewarmNewsSitemap() in lib/google-indexing.ts. Works server-to-server only
 * (shared JWT_SECRET bearer token). Purges the Vercel Data Cache / Edge Cache
 * entry for the news sitemap so the very next Googlebot request sees the
 * refreshed Last-Modified + new <url> entries instead of the 60s-stale copy.
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

  revalidatePath('/news-sitemap.xml', 'page');

  return NextResponse.json({
    revalidated: true,
    path: '/news-sitemap.xml',
    at: new Date().toISOString(),
  });
}
