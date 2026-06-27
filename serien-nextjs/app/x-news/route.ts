/**
 * GET /api/random-news
 *
 * Wählt aus den 20 neuesten veröffentlichten Artikeln einen zufälligen aus
 * und leitet via 302 dorthin weiter. Ideal für Newsletter-Footer, Push-
 * Notification-„Überraschungsbutton", Social-Bio-Link, „Was lesen?"-CTA.
 *
 * Verhalten:
 *  - 302 Redirect → /<slug> (Artikel-URL)
 *  - Cache-Control: no-store, damit jeder Klick wirklich neu zieht
 *  - Falls keine Artikel vorhanden (sollte nie passieren) → 302 zur Homepage
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const candidates = await prisma.articles.findMany({
    where: {
      OR: [{ status: 'published' }, { status: 'PUBLISHED' }],
      publishedAt: { not: null, lte: new Date() },
    },
    orderBy: { publishedAt: 'desc' },
    take: 20,
    select: { slug: true },
  });

  const origin = new URL(request.url).origin;

  if (candidates.length === 0) {
    return NextResponse.redirect(origin, { status: 302 });
  }

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const target = `${origin}/${picked.slug}`;

  return NextResponse.redirect(target, {
    status: 302,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      // Referrer der eingehenden Anfrage NICHT an das Ziel weitergeben.
      // Browser entfernt den Referer-Header beim Follow des Redirects,
      // d.h. der Ziel-Artikel sieht keine Quelle (kein "von wo kam der
      // Klick"). Nützlich um external Referrer-Leaks zu blockieren.
      'Referrer-Policy': 'no-referrer',
    },
  });
}
