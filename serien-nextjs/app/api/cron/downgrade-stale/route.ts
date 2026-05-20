import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/downgrade-stale
 *
 * Daily housekeeping: any article in publishMode=DISCOVER that is older
 * than 48h is moved to SEARCH_ONLY. Keeps the News-Sitemap compact and
 * the Discover quota uncluttered.
 */
export async function GET(request: Request) {
  // Optional auth (Vercel cron + manual triggers via JWT)
  const auth = request.headers.get('authorization');
  if (process.env.JWT_SECRET && auth !== `Bearer ${process.env.JWT_SECRET}` && !request.headers.get('x-vercel-cron')) {
    // Allow Vercel cron header to bypass; otherwise require JWT
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - 48 * 3600 * 1000);
  const res = await prisma.articles.updateMany({
    where: { publishMode: 'DISCOVER', publishedAt: { lt: cutoff } },
    data: { publishMode: 'SEARCH_ONLY' },
  });

  // Revalidate the news sitemap so Googlebot sees a fresh ETag immediately.
  try {
    revalidatePath('/news-sitemap.xml');
  } catch { /* best effort */ }

  return NextResponse.json({
    success: true,
    downgraded: res.count,
    cutoff: cutoff.toISOString(),
    at: new Date().toISOString(),
  });
}
