/**
 * Ad-Fraud Firewall Aggregat-Endpoint.
 *
 * Von middleware.ts fire-and-forget aufgerufen. Zählt Blocks pro Tag /
 * Grund / Land / Bot-Signal via Prisma-Upsert-Increment.
 *
 * Neon-Cost-optimiert: eine Row pro (Datum, Grund, Land, botUa) statt
 * eine Row pro Request. Bei ~50k Blocks/Tag = ~50 Rows/Tag.
 *
 * Nicht auth-geschützt (interner Endpoint, wird nur von unserem eigenen
 * Middleware aufgerufen). Falls jemand von außen POST feuert → nur
 * Counter-Pollution, kein Sicherheitsrisiko.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BlockLogPayload {
  reason: string;
  country?: string;
  botSignal?: string;
}

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BlockLogPayload;
    if (!body?.reason) {
      return NextResponse.json({ ok: false, error: 'reason required' }, { status: 400 });
    }

    const reason = body.reason.slice(0, 40);
    const country = (body.country || '').slice(0, 4).toUpperCase();
    const botUa = (body.botSignal || '').slice(0, 80);

    await prisma.ad_fraud_blocks_daily.upsert({
      where: {
        date_reason_country_botUa: {
          date: todayUtc(),
          reason,
          country,
          botUa,
        },
      },
      create: {
        date: todayUtc(),
        reason,
        country,
        botUa,
        count: 1,
      },
      update: {
        count: { increment: 1 },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn('[adfraud-block-log]', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
