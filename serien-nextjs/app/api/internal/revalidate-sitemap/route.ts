/**
 * Internal: Revalidate /news-sitemap.xml on demand.
 *
 * Called after each article publish from scripts/pipeline-v2.ts via
 * prewarmNewsSitemap() in lib/google-indexing.ts. Works server-to-server only
 * (dedicated REVALIDATE_SECRET bearer token). Purges the Data/Edge Cache
 * entry for the news sitemap so the very next Googlebot request sees the
 * refreshed Last-Modified + new <url> entries instead of the 60s-stale copy.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireInternalAuth } from '@/lib/internal-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authFailure = requireInternalAuth(req);
  if (authFailure) return authFailure;

  revalidatePath('/news-sitemap.xml', 'page');

  return NextResponse.json({
    revalidated: true,
    path: '/news-sitemap.xml',
    at: new Date().toISOString(),
  });
}
