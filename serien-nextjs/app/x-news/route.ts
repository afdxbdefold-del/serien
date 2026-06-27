/**
 * GET /x-news
 *
 * Zufalls-Redirect auf einen Artikel aus den 20 neuesten Veröffentlichungen,
 * mit Gold-Standard-Referer-Strip + 2-stufiger IVT-/Fake-Human-Defense:
 *
 *   - Stufe A (Hard-Block):  UA-Bot ⇒ 204 No Content, kein Tracking, kein
 *                            Redirect, kein Ad-Impression-Risk.
 *   - Stufe B (Behavior):    Wenn der nicht-rotierende blockKey schon
 *                            in `blocked_visitors` steht ⇒ 204.
 *   - Asynchron nach Response: leichte Verhaltensanalyse (alle 25. Klick),
 *                              die neue Blocks pflegt.
 *
 *   - 4-Layer-Referer-Strip im HTML-Interstitial (keine Quelle leakt).
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createHash, randomUUID } from 'crypto';
import { checkHardBlock, computeBlockKey, analyzeBehavior } from '@/lib/x-news-fraud';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function escapeJs(s: string): string {
  return JSON.stringify(s).replace(/</g, '\\u003c');
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function anonVisitorId(ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${ip}|${ua}|${day}`).digest('hex').slice(0, 32);
}

/**
 * 204 No Content für geblockte Visitors. Kein Redirect, kein HTML, kein Body.
 * AdSense sieht NIE eine Impression. Stille Verbrennung des Klicks.
 */
function blockedResponse(label: string): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Block-Reason': label.slice(0, 80),
    },
  });
}

/**
 * Async Behavior-Analyzer. Wird sporadisch (1 von 25 Aufrufen) gestartet,
 * nachdem der Response schon zum Client unterwegs ist. Holt die letzten 24h
 * Klicks dieses block_key + Folge-Pageviews und schreibt ggf. einen Block.
 */
async function runBehaviorAnalysis(blockKey: string, country: string | null): Promise<void> {
  try {
    const existing = await prisma.blocked_visitors.findUnique({ where: { blockKey } });
    if (existing && existing.expiresAt > new Date() && !existing.manualWhitelist) return;

    const since24h = new Date(Date.now() - 24 * 3600 * 1000);

    // Wir suchen alle Klicks dieses blockKey in den letzten 24h. Da blockKey
    // im `metadata`-JSON liegt, queries wir per JSON-Path.
    const clicks = await prisma.$queryRaw<Array<{ createdAt: Date; country: string | null }>>`
      SELECT "createdAt", "country" FROM "analytics_events"
      WHERE "event" = 'x_news_click'
        AND "createdAt" >= ${since24h}
        AND "metadata"->>'block_key' = ${blockKey}
    `;

    if (clicks.length === 0) return;

    // Folge-Pageviews: gleicher visitorId-Hash (auch über Tagesrotation, daher
    // hier auch blockKey im metadata-Feld). Nur Events, die NACH dem ersten
    // x_news_click stattfanden und KEIN x_news_click sind.
    const firstClick = clicks.reduce((min, c) => (c.createdAt < min ? c.createdAt : min), clicks[0].createdAt);
    const followUps = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "analytics_events"
      WHERE "createdAt" >= ${firstClick}
        AND "event" <> 'x_news_click'
        AND "metadata"->>'block_key' = ${blockKey}
      LIMIT 5
    `;

    const signals = analyzeBehavior({
      clicks,
      followUpPageViewsCount: followUps.length,
      primaryCountry: country,
    });

    if (signals.score >= 2) {
      const reasons = [
        signals.highRate && 'rate>5/24h',
        signals.rapidInterval && 'interval<3s',
        signals.zeroEngagement && 'zero-engagement',
        signals.geoAnomaly && 'geo-anomaly',
      ].filter(Boolean).join('+');
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      await prisma.blocked_visitors.upsert({
        where: { blockKey },
        create: {
          id: randomUUID(),
          blockKey,
          reason: `behavior:${reasons}`,
          signals: signals as any,
          expiresAt,
        },
        update: {
          reason: `behavior:${reasons}`,
          signals: signals as any,
          blockedAt: new Date(),
          expiresAt,
        },
      });
    }
  } catch { /* analysis darf nie crashen */ }
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const headers = (request as any).headers as Headers;

  const ip =
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown';
  const ua = (headers.get('user-agent') || '').slice(0, 500);
  const country = headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry') || null;

  // ════════════════════════════════════════════════════════════════════
  // STUFE A — Hard-Block: UA-Bot Erkennung. Sofort 204, kein Tracking.
  // Optional: Persistiere den Block für 7 Tage, damit ein flippt-UA-Bot
  // beim nächsten Versuch über Stufe B sofort gefangen wird.
  // ════════════════════════════════════════════════════════════════════
  const hardBlock = checkHardBlock(ua);
  const blockKey = computeBlockKey(ip, ua);

  if (hardBlock.blocked) {
    // Async einen 7-Tage-Block schreiben (fire-and-forget)
    prisma.blocked_visitors.upsert({
      where: { blockKey },
      create: {
        id: randomUUID(),
        blockKey,
        reason: `hard-block:${hardBlock.label}`,
        signals: { ua_label: hardBlock.label } as any,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
      update: {
        reason: `hard-block:${hardBlock.label}`,
        blockedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    }).catch(() => { /* silent */ });

    return blockedResponse(`hard:${hardBlock.label}`);
  }

  // ════════════════════════════════════════════════════════════════════
  // STUFE B — DB-Block-Lookup. Wenn dieser blockKey schon als Bot oder
  // verdächtiges Verhalten markiert wurde (und noch nicht expired oder
  // manuell whitelisted), antworten wir mit 204.
  // ════════════════════════════════════════════════════════════════════
  const dbBlock = await prisma.blocked_visitors.findUnique({ where: { blockKey } }).catch(() => null);
  if (dbBlock && dbBlock.expiresAt > new Date() && !dbBlock.manualWhitelist) {
    return blockedResponse(`db:${dbBlock.reason}`);
  }

  // ════════════════════════════════════════════════════════════════════
  // Realer User — Redirect-Logik
  // ════════════════════════════════════════════════════════════════════
  const candidates = await prisma.articles.findMany({
    where: {
      OR: [{ status: 'published' }, { status: 'PUBLISHED' }],
      publishedAt: { not: null, lte: new Date() },
    },
    orderBy: { publishedAt: 'desc' },
    take: 20,
    select: { slug: true },
  });

  const picked = candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)].slug
    : '';

  const target = picked ? `${origin}/${picked}` : origin;

  // Fire-and-forget tracking
  if (picked) {
    const refererRaw = headers.get('referer') || '';
    const vid = anonVisitorId(ip, ua);

    prisma.analytics_events.create({
      data: {
        id: randomUUID(),
        sessionId: vid,
        visitorId: vid,
        event: 'x_news_click',
        path: `/${picked}`,
        referrer: refererRaw ? refererRaw.slice(0, 500) : null,
        userAgent: ua || null,
        country,
        city: headers.get('x-vercel-ip-city') || null,
        // block_key in metadata für die Behavior-Analyse (nicht-rotierend)
        metadata: { block_key: blockKey } as any,
      },
    }).catch(() => { /* tracking-failure darf nichts brechen */ });

    // Sporadisch (1 von 25) die Behavior-Analyse auslösen.
    if (Math.random() < 0.04) {
      void runBehaviorAnalysis(blockKey, country);
    }
  }

  const html =
    `<!doctype html><html><head>` +
    `<meta charset="utf-8">` +
    // same-origin: externe Referer (Twitter, Google, Newsletter) werden hier
    // gestoppt — der Ziel-Artikel sieht /x-news als Quelle. Das ist die
    // optimale Balance:
    //   1) externer Referer leakt NIE an Ziel/Tracker/AdSense
    //   2) AdSense sieht eine plausible interne Navigation → zählt normal
    //   3) "no-referrer" hatte den Nebeneffekt, dass AdSense viele dieser
    //      Hits als low-quality/direct/suspicious wertete und kaum CPMs ausspielte.
    `<meta name="referrer" content="same-origin">` +
    `<meta http-equiv="refresh" content="0;url=${escapeAttr(target)}">` +
    `<title>…</title>` +
    `<script>window.location.replace(${escapeJs(target)})</script>` +
    `</head><body></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
