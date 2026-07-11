/**
 * Social-Referrer Klassifikations-Endpoint.
 *
 * Von middleware.ts fire-and-forget aufgerufen NUR wenn der eingehende
 * Request einen Social-Referrer trägt (facebook.com, t.co, instagram.com …).
 * Speichert eine aggregierte Row pro (Tag, Source, Verdict, Country, UA,
 * SignalsKey) — kein 1-Row-pro-Hit-Overhead.
 *
 * KEIN Blocking. Reine Analyse-Daten für /admin/social-referrer.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Payload {
  claimedSource: string;
  verdict: string;
  country?: string;
  uaFamily?: string;
  signalsKey?: string;
}

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Payload;
    if (!body?.claimedSource || !body?.verdict) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const claimedSource = body.claimedSource.slice(0, 24);
    const verdict = body.verdict.slice(0, 16);
    const country = (body.country || '').slice(0, 4).toUpperCase();
    const uaFamily = (body.uaFamily || 'other').slice(0, 24);
    const signalsKey = (body.signalsKey || 'none').slice(0, 120);

    await prisma.social_referrer_daily.upsert({
      where: {
        date_claimedSource_verdict_country_uaFamily_signalsKey: {
          date: todayUtc(),
          claimedSource,
          verdict,
          country,
          uaFamily,
          signalsKey,
        },
      },
      create: {
        date: todayUtc(),
        claimedSource,
        verdict,
        country,
        uaFamily,
        signalsKey,
        count: 1,
      },
      update: { count: { increment: 1 } },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn('[social-referrer-log]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
