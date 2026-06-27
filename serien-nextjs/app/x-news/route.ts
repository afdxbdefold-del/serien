/**
 * GET /x-news
 *
 * Zufalls-Redirect auf einen Artikel aus den 20 neuesten Veröffentlichungen.
 * Liefert KEIN 302, sondern eine minimale HTML-Seite mit 4 redundanten
 * Referer-Strip-Layern, damit der Ziel-Artikel garantiert KEINE Quell-URL
 * erfährt — auch nicht in alten Mobile-Browsern oder WebViews:
 *
 *   1. HTTP-Header Referrer-Policy: no-referrer
 *   2. <meta name="referrer" content="no-referrer">
 *   3. <script>window.location.replace(...)</script>  (instant, History-replace
 *      → "Zurück" überspringt /x-news komplett)
 *   4. <meta http-equiv="refresh" content="0;url=...">  (No-JS Fallback)
 *
 * Performance: < 5 KB HTML, kein Loading-UI, JS-Replace feuert vor dem ersten
 * Paint → User sieht ZERO Flash der Interstitial-Seite, nur die finale URL.
 *
 * Verwendungszweck: Newsletter-Footer, Social-Bio-Link, Push-Notifications,
 * 404-CTA. Der externe Referer (Google, Twitter, Newsletter-Provider) wird
 * nie an den Ziel-Artikel oder dessen Trackern (AdSense, GA4) durchgereicht.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createHash, randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function escapeJs(s: string): string {
  return JSON.stringify(s).replace(/</g, '\\u003c');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Stabile, anonyme Visitor-ID: SHA-256(IP + UA + Tagesdatum), 16 Bytes.
 * Privacy: KEIN reverse-lookup auf IP möglich, IP wird nie roh gespeichert,
 * Tagesrotation begrenzt die zeitliche Korrelation.
 */
function anonVisitorId(ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${ip}|${ua}|${day}`).digest('hex').slice(0, 32);
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const headers = (request as any).headers as Headers;

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

  // Fire-and-forget tracking — darf den Redirect NIE bremsen.
  // Wenn DB hängt, kommt der User trotzdem durch.
  if (picked) {
    const ip =
      headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      headers.get('x-real-ip') ||
      'unknown';
    const ua = (headers.get('user-agent') || '').slice(0, 500);
    const refererRaw = headers.get('referer') || '';
    const country = headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry') || null;
    const city = headers.get('x-vercel-ip-city') || null;
    const vid = anonVisitorId(ip, ua);

    // Asynchron, ohne await — wir blockieren den Response nicht.
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
        city,
      },
    }).catch(() => { /* tracking-failure darf nichts brechen */ });
  }

  const html =
    `<!doctype html><html><head>` +
    `<meta charset="utf-8">` +
    `<meta name="referrer" content="no-referrer">` +
    `<meta http-equiv="refresh" content="0;url=${escapeAttr(target)}">` +
    `<title>…</title>` +
    `<script>window.location.replace(${escapeJs(target)})</script>` +
    `</head><body></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
