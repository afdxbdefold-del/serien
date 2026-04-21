/**
 * Internal crawler tracking endpoint.
 * Called by middleware (fire-and-forget) on every bot request.
 * Runs on Node runtime so Prisma works.
 *
 * POST body: { bot: string, path: string, userAgent: string, ip?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bot, path, userAgent, ip } = body || {};
    if (!bot || !path) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    await prisma.crawler_hits.create({
      data: {
        bot: String(bot).slice(0, 80),
        path: String(path).slice(0, 500),
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
        ip: ip ? String(ip).slice(0, 80) : null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.warn('[crawler-track] failed:', e?.message ?? e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
