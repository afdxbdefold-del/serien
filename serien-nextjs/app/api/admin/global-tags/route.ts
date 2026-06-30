/**
 * Admin-API für globale Custom-Tags (Script / iframe / HTML), die auf
 * Artikelseiten gerendert werden.
 *
 *   GET    /api/admin/global-tags        → alle Tags zurückgeben
 *   POST   /api/admin/global-tags        → create/update (per id)
 *   DELETE /api/admin/global-tags?id=…   → löschen
 *
 * Kein Auth-Layer hier — wie der Rest von /api/admin/* darauf vertrauen wir
 * dass das Admin-Layout den Zugang abdichtet.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidateTag } from 'next/cache';

const VALID_PLACEMENTS = new Set(['head', 'body-start', 'body-end']);

export async function GET() {
  const tags = await prisma.global_tags.findMany({
    orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json(tags);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const html = typeof body.html === 'string' ? body.html : '';
  const placement = typeof body.placement === 'string' ? body.placement : 'body-end';
  const isActive = !!body.isActive;
  const hideFromBots = body.hideFromBots !== false;
  const sortOrder = Number.isFinite(body.sortOrder) ? Math.floor(body.sortOrder) : 0;

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!html.trim()) return NextResponse.json({ error: 'html required' }, { status: 400 });
  if (!VALID_PLACEMENTS.has(placement)) {
    return NextResponse.json({ error: 'invalid placement' }, { status: 400 });
  }

  const data = { name, html, placement, isActive, hideFromBots, sortOrder };

  const saved = body.id
    ? await prisma.global_tags.update({ where: { id: body.id }, data })
    : await prisma.global_tags.create({ data });

  revalidateTag('global-tags');
  return NextResponse.json(saved);
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await prisma.global_tags.delete({ where: { id } }).catch(() => null);
  revalidateTag('global-tags');
  return NextResponse.json({ ok: true });
}
