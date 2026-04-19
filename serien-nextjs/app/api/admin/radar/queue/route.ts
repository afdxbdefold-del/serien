/**
 * Radar Queue — persists saved topics and content queue items (article / reel /
 * carousel / faq / saved).
 *
 * POST /api/admin/radar/queue   { type, topic, question, headline?, ... }
 * GET  /api/admin/radar/queue?type=...&status=...
 * PATCH /api/admin/radar/queue  { id, status } - update status
 * DELETE /api/admin/radar/queue?id=...
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = ['article', 'reel', 'carousel', 'faq', 'saved'] as const;
const ALLOWED_STATUS = ['pending', 'done', 'dismissed'] as const;

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const type = (b.type || '').toString();
    if (!ALLOWED_TYPES.includes(type as typeof ALLOWED_TYPES[number])) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    const topic = (b.topic || '').toString().trim();
    const question = (b.question || '').toString().trim();
    if (!topic || !question) {
      return NextResponse.json({ error: 'topic and question required' }, { status: 400 });
    }

    const created = await prisma.content_queue.create({
      data: {
        type,
        status: 'pending',
        topic,
        question,
        headline: b.headline || null,
        category: b.category || null,
        intentType: b.intentType || null,
        recommendedFormat: b.recommendedFormat || null,
        seoScore: typeof b.seoScore === 'number' ? b.seoScore : null,
        discoverScore: typeof b.discoverScore === 'number' ? b.discoverScore : null,
        socialScore: typeof b.socialScore === 'number' ? b.socialScore : null,
        monetizationScore: typeof b.monetizationScore === 'number' ? b.monetizationScore : null,
        competitionScore: typeof b.competitionScore === 'number' ? b.competitionScore : null,
        freshness: b.freshness || null,
        notes: b.notes || null,
      },
      select: { id: true, type: true, status: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, item: created });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');
  const status = req.nextUrl.searchParams.get('status') || 'pending';
  const topic = req.nextUrl.searchParams.get('topic');
  const where: Record<string, unknown> = {};
  if (type && ALLOWED_TYPES.includes(type as typeof ALLOWED_TYPES[number])) where.type = type;
  if (status && ALLOWED_STATUS.includes(status as typeof ALLOWED_STATUS[number])) where.status = status;
  if (topic) where.topic = topic;

  const items = await prisma.content_queue.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const counts = await prisma.content_queue.groupBy({
    by: ['type', 'status'],
    _count: { _all: true },
  });

  return NextResponse.json({ items, counts });
}

export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json();
    const id = (b.id || '').toString();
    const status = (b.status || '').toString();
    if (!id || !ALLOWED_STATUS.includes(status as typeof ALLOWED_STATUS[number])) {
      return NextResponse.json({ error: 'id and valid status required' }, { status: 400 });
    }
    const updated = await prisma.content_queue.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, item: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    await prisma.content_queue.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
