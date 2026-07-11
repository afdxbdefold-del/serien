/**
 * Admin-Endpoint für Social-Referrer-Analyse.
 *
 * Aggregiert die `social_referrer_daily`-Tabelle:
 *  - Total pro Source × Verdict (last 24h / 7d / 30d)
 *  - Top-Signal-Kombinationen pro Source (warum "fake"?)
 *  - Top-Länder pro Source
 *  - Top-UA-Families pro Source
 *  - Daily-Timeline
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

    const from30 = daysAgo(29);
    const from7 = daysAgo(6);
    const yesterday = daysAgo(1);

    const rows = await prisma.social_referrer_daily.findMany({
      where: { date: { gte: from30 } },
      orderBy: { date: 'desc' },
    });

    const sumIf = (pred: (r: typeof rows[number]) => boolean) =>
      rows.filter(pred).reduce((s, r) => s + r.count, 0);

    // Totals pro Source × Verdict
    type SourceStats = {
      source: string;
      total24h: number;
      total7d: number;
      total30d: number;
      real: number;
      suspicious: number;
      fake: number;
    };
    const sourceMap = new Map<string, SourceStats>();
    for (const r of rows) {
      const s = sourceMap.get(r.claimedSource) || {
        source: r.claimedSource,
        total24h: 0,
        total7d: 0,
        total30d: 0,
        real: 0,
        suspicious: 0,
        fake: 0,
      };
      s.total30d += r.count;
      if (r.date.getTime() >= from7.getTime()) s.total7d += r.count;
      if (r.date.getTime() >= yesterday.getTime()) s.total24h += r.count;
      if (r.verdict === 'real') s.real += r.count;
      else if (r.verdict === 'suspicious') s.suspicious += r.count;
      else if (r.verdict === 'fake') s.fake += r.count;
      sourceMap.set(r.claimedSource, s);
    }
    const bySource = [...sourceMap.values()].sort((a, b) => b.total30d - a.total30d);

    // Top Signal-Combos für fake+suspicious (letzte 30 Tage)
    const bySignal = new Map<string, { key: string; source: string; verdict: string; count: number }>();
    for (const r of rows) {
      if (r.verdict === 'real') continue;
      const k = `${r.claimedSource}|${r.verdict}|${r.signalsKey}`;
      const cur = bySignal.get(k);
      if (cur) cur.count += r.count;
      else bySignal.set(k, { key: k, source: r.claimedSource, verdict: r.verdict, count: r.count });
    }
    const topSignals = [...bySignal.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 25)
      .map((s) => ({
        source: s.source,
        verdict: s.verdict,
        signals: s.key.split('|').slice(2).join('|'),
        count: s.count,
      }));

    // Top-Länder gesamt
    const byCountry = new Map<string, number>();
    for (const r of rows) {
      if (!r.country) continue;
      byCountry.set(r.country, (byCountry.get(r.country) || 0) + r.count);
    }
    const topCountries = [...byCountry.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Top-UA-Families gesamt
    const byUa = new Map<string, number>();
    for (const r of rows) {
      byUa.set(r.uaFamily, (byUa.get(r.uaFamily) || 0) + r.count);
    }
    const topUaFamilies = [...byUa.entries()]
      .map(([uaFamily, count]) => ({ uaFamily, count }))
      .sort((a, b) => b.count - a.count);

    // Daily-Timeline (letzte 14 Tage, aufgeschlüsselt nach Verdict)
    const dailyMap = new Map<string, { date: string; real: number; suspicious: number; fake: number }>();
    for (const r of rows) {
      if (r.date.getTime() < daysAgo(13).getTime()) continue;
      const key = r.date.toISOString().slice(0, 10);
      const cur = dailyMap.get(key) || { date: key, real: 0, suspicious: 0, fake: 0 };
      if (r.verdict === 'real') cur.real += r.count;
      else if (r.verdict === 'suspicious') cur.suspicious += r.count;
      else if (r.verdict === 'fake') cur.fake += r.count;
      dailyMap.set(key, cur);
    }
    const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      totals: {
        last24h: sumIf((r) => r.date.getTime() >= yesterday.getTime()),
        last7d: sumIf((r) => r.date.getTime() >= from7.getTime()),
        last30d: sumIf(() => true),
        real24h: sumIf((r) => r.verdict === 'real' && r.date.getTime() >= yesterday.getTime()),
        suspicious24h: sumIf((r) => r.verdict === 'suspicious' && r.date.getTime() >= yesterday.getTime()),
        fake24h: sumIf((r) => r.verdict === 'fake' && r.date.getTime() >= yesterday.getTime()),
      },
      bySource,
      topSignals,
      topCountries,
      topUaFamilies,
      daily,
    });
  } catch (err) {
    console.error('[admin-social-referrer-stats]', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
