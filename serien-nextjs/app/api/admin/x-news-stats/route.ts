/**
 * GET /api/admin/x-news-stats
 *
 * Liefert Click-Statistik des /x-news Zufalls-Redirects:
 *   - last_24h_total      → Klicks der letzten 24 Stunden (rolling)
 *   - last_7d_total       → Klicks der letzten 7 Tage
 *   - per_day             → Tages-Buckets der letzten 14 Tage
 *   - top_destinations    → Top-10 Ziel-Artikel der letzten 7 Tage
 *   - top_referrers       → Top-10 eingehende Referrer der letzten 7 Tage
 *                            (z.B. https://www.google.com/, t.co, etc.)
 *   - top_countries       → Top-10 Länder (CF/Vercel Geo-Headers)
 *
 * Quelldaten: analytics_events table, event='x_news_click'.
 * Aufruf: GET https://serien.de/api/admin/x-news-stats
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EVENT = 'x_news_click';

export async function GET() {
  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 3600 * 1000);
  const ago7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const ago14d = new Date(now.getTime() - 14 * 24 * 3600 * 1000);

  // 1. Raw counts
  const [last24h, last7d, last14d] = await Promise.all([
    prisma.analytics_events.count({ where: { event: EVENT, createdAt: { gte: ago24h } } }),
    prisma.analytics_events.count({ where: { event: EVENT, createdAt: { gte: ago7d } } }),
    prisma.analytics_events.count({ where: { event: EVENT, createdAt: { gte: ago14d } } }),
  ]);

  // 2. Per-day Tages-Buckets der letzten 14 Tage. Wir holen alle Rows roh
  //    und bucketen in JS — bei ≤ 14 Tagen Volume noch günstig genug.
  const events14d = await prisma.analytics_events.findMany({
    where: { event: EVENT, createdAt: { gte: ago14d } },
    select: { createdAt: true, path: true, referrer: true, country: true },
  });

  const perDay: Record<string, number> = {};
  // 14 Buckets vorinitialisieren (auch leere Tage zeigen)
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
    perDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const ev of events14d) {
    const day = ev.createdAt.toISOString().slice(0, 10);
    if (day in perDay) perDay[day]++;
  }

  // 3. Top destinations (letzte 7 Tage)
  const events7d = events14d.filter((e) => e.createdAt >= ago7d);
  const destBuckets: Record<string, number> = {};
  const refBuckets: Record<string, number> = {};
  const ctryBuckets: Record<string, number> = {};

  for (const ev of events7d) {
    destBuckets[ev.path] = (destBuckets[ev.path] || 0) + 1;
    if (ev.referrer) {
      // Auf Origin reduzieren, damit nicht jeder Query-String einzeln steht
      let host = ev.referrer;
      try {
        host = new URL(ev.referrer).hostname || ev.referrer;
      } catch { /* keep raw */ }
      refBuckets[host] = (refBuckets[host] || 0) + 1;
    }
    if (ev.country) ctryBuckets[ev.country] = (ctryBuckets[ev.country] || 0) + 1;
  }

  const topN = (b: Record<string, number>, n = 10) =>
    Object.entries(b)
      .sort((a, c) => c[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));

  return NextResponse.json({
    generated_at: now.toISOString(),
    totals: {
      last_24h: last24h,
      last_7d: last7d,
      last_14d: last14d,
    },
    per_day: perDay,
    top_destinations: topN(destBuckets),
    top_referrers: topN(refBuckets),
    top_countries: topN(ctryBuckets),
  });
}
