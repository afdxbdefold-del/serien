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
import { detectBot } from '@/lib/crawler-logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EVENT = 'x_news_click';

// Zusätzliche generische Bot-/Crawler-/Suspicious-UA-Heuristiken, die der
// strenge crawler-logger nicht abdeckt. Lower-cased Substring-Matches.
const GENERIC_BOT_HINTS = [
  'bot', 'crawler', 'spider', 'scrap', 'curl/', 'wget/', 'python-requests',
  'http-client', 'go-http-client', 'okhttp/', 'java/', 'libwww-perl',
  'headlesschrome', 'phantomjs', 'puppeteer', 'playwright', 'lighthouse',
  'pagespeed', 'gtmetrix', 'monitor', 'uptimerobot', 'pingdom', 'newrelic',
  'datadog', 'archive.org', 'wayback',
];

function classifyUserAgent(ua: string | null): { isBot: boolean; label: string } {
  if (!ua) return { isBot: true, label: 'no-user-agent' };
  // First: named bot from crawler-logger (Google, Bing, Twitter, etc.)
  const named = detectBot(ua);
  if (named) return { isBot: true, label: named };
  // Then: generic suspicious patterns
  const low = ua.toLowerCase();
  for (const hint of GENERIC_BOT_HINTS) {
    if (low.includes(hint)) return { isBot: true, label: `generic:${hint}` };
  }
  return { isBot: false, label: 'human' };
}

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
    select: { createdAt: true, path: true, referrer: true, country: true, userAgent: true },
  });

  const perDay: Record<string, { total: number; human: number; bot: number }> = {};
  // 14 Buckets vorinitialisieren (auch leere Tage zeigen)
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
    perDay[d.toISOString().slice(0, 10)] = { total: 0, human: 0, bot: 0 };
  }

  // Counter für Bot-Analyse über die letzten 7 + 24h Fenster
  let bot24h = 0, bot7d = 0, bot14d = 0;
  const botLabels: Record<string, number> = {};

  for (const ev of events14d) {
    const day = ev.createdAt.toISOString().slice(0, 10);
    const cls = classifyUserAgent(ev.userAgent);
    if (day in perDay) {
      perDay[day].total++;
      if (cls.isBot) perDay[day].bot++;
      else perDay[day].human++;
    }
    if (cls.isBot) {
      bot14d++;
      if (ev.createdAt >= ago7d) bot7d++;
      if (ev.createdAt >= ago24h) bot24h++;
      botLabels[cls.label] = (botLabels[cls.label] || 0) + 1;
    }
  }

  const pct = (part: number, total: number) =>
    total > 0 ? Math.round((part / total) * 1000) / 10 : 0;

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

  // 4. IVT (Invalid Traffic) Metriken — Blocks aus blocked_visitors-Tabelle
  const [activeBlocks, blocksLast24h, blocksLast7d, blocksLast14d] = await Promise.all([
    prisma.blocked_visitors.count({ where: { expiresAt: { gt: now }, manualWhitelist: false } }),
    prisma.blocked_visitors.count({ where: { blockedAt: { gte: ago24h }, manualWhitelist: false } }),
    prisma.blocked_visitors.count({ where: { blockedAt: { gte: ago7d }, manualWhitelist: false } }),
    prisma.blocked_visitors.count({ where: { blockedAt: { gte: ago14d }, manualWhitelist: false } }),
  ]);

  // Top-Block-Gründe (gruppiert)
  const recentBlocks = await prisma.blocked_visitors.findMany({
    where: { blockedAt: { gte: ago7d }, manualWhitelist: false },
    select: { reason: true },
  });
  const reasonBuckets: Record<string, number> = {};
  for (const b of recentBlocks) {
    // Reason normalisieren: "hard-block:Googlebot" → "hard-block", "behavior:rate>5/24h+geo-anomaly" → "behavior"
    const key = b.reason.split(':')[0];
    reasonBuckets[key] = (reasonBuckets[key] || 0) + 1;
  }

  // IVT-Rate: Anteil Bots+Blocks an Total-Klicks (inkl. der ignored blocked
  // Aufrufe, die NICHT in analytics_events stehen, aber im X-Block-Reason Header
  // gezählt werden könnten). Da wir Blocks NICHT als Event loggen, schätzen
  // wir die IVT-Rate konservativ via UA-Klassifikation der geloggten Klicks.
  const ivtRate24h = last24h > 0 ? pct(bot24h, last24h) : 0;
  const ivtRate7d  = last7d  > 0 ? pct(bot7d,  last7d)  : 0;
  const ivtRate14d = last14d > 0 ? pct(bot14d, last14d) : 0;

  return NextResponse.json({
    generated_at: now.toISOString(),
    totals: {
      last_24h: last24h,
      last_7d: last7d,
      last_14d: last14d,
    },
    bot_traffic: {
      last_24h: { count: bot24h, pct_of_total: ivtRate24h },
      last_7d:  { count: bot7d,  pct_of_total: ivtRate7d },
      last_14d: { count: bot14d, pct_of_total: ivtRate14d },
      top_bot_labels: topN(botLabels),
    },
    ivt: {
      rate_24h_pct: ivtRate24h,
      rate_7d_pct:  ivtRate7d,
      rate_14d_pct: ivtRate14d,
      blocks: {
        active_now:  activeBlocks,
        new_last_24h: blocksLast24h,
        new_last_7d:  blocksLast7d,
        new_last_14d: blocksLast14d,
      },
      top_block_categories: topN(reasonBuckets),
    },
    per_day: perDay,
    top_destinations: topN(destBuckets),
    top_referrers: topN(refBuckets),
    top_countries: topN(ctryBuckets),
  });
}
