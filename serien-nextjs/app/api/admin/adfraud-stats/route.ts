/**
 * Admin-Endpoint für Ad-Fraud-Blocks-Statistiken.
 *
 * Aggregiert die `ad_fraud_blocks_daily`-Tabelle zu Zeitreihen:
 *  - Last 24h / 7d / 30d Totals
 *  - Top-Gründe
 *  - Top-Länder
 *  - Top-Bot-Signals
 *
 * Auth: gleiches Muster wie andere /api/admin/*-Endpoints.
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const { payload } = await jwtVerify(auth.substring(7), JWT_SECRET);
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = todayUtc();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export async function GET(req: NextRequest) {
  try {
    if (!(await verifyAdmin(req))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const from30 = daysAgo(29); // inklusiv heute = 30 Tage
    const from7 = daysAgo(6);
    const yesterday = daysAgo(1);

    // Alle Rows der letzten 30 Tage laden — bei ~50 Rows/Tag × 30 = 1500 Rows,
    // Neon-schonend genug für einen Admin-Refresh-Cycle.
    const rows = await prisma.ad_fraud_blocks_daily.findMany({
      where: { date: { gte: from30 } },
      orderBy: { date: 'desc' },
    });

    // Aggregations
    const sum = (predicate: (r: typeof rows[number]) => boolean) =>
      rows.filter(predicate).reduce((s, r) => s + r.count, 0);

    const total24h = sum((r) => r.date.getTime() >= yesterday.getTime());
    const total7d = sum((r) => r.date.getTime() >= from7.getTime());
    const total30d = sum(() => true);

    // Top by reason (30d)
    const byReason = new Map<string, number>();
    for (const r of rows) byReason.set(r.reason, (byReason.get(r.reason) || 0) + r.count);
    const topReasons = [...byReason.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // Top by country (30d), leere Country ignorieren
    const byCountry = new Map<string, number>();
    for (const r of rows) {
      if (!r.country) continue;
      byCountry.set(r.country, (byCountry.get(r.country) || 0) + r.count);
    }
    const topCountries = [...byCountry.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Top by bot signal (30d), leere ignorieren
    const byBot = new Map<string, number>();
    for (const r of rows) {
      if (!r.botUa) continue;
      byBot.set(r.botUa, (byBot.get(r.botUa) || 0) + r.count);
    }
    const topBots = [...byBot.entries()]
      .map(([signal, count]) => ({ signal, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Daily timeline (letzten 14 Tage für kompakte Ansicht)
    const dailyMap = new Map<string, number>();
    for (const r of rows) {
      if (r.date.getTime() < daysAgo(13).getTime()) continue;
      const key = r.date.toISOString().slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) || 0) + r.count);
    }
    const daily = [...dailyMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      totals: { last24h: total24h, last7d: total7d, last30d: total30d },
      topReasons,
      topCountries,
      topBots,
      daily,
    });
  } catch (err) {
    console.error('[admin-adfraud-stats]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
