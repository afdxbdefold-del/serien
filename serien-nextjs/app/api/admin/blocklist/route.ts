/**
 * BLOCKLIST ADMIN API
 *
 * GET    /api/admin/blocklist              — list all entries with hit stats
 * POST   /api/admin/blocklist              — create new entry { label, tmdbIds?, urlPatterns?, titleKeywords?, note?, enabled? }
 * PATCH  /api/admin/blocklist?id=<id>      — update entry (same fields; also `enabled` toggle)
 * DELETE /api/admin/blocklist?id=<id>      — remove entry
 *
 * Auth: Bearer JWT with role=admin
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';
import { invalidateBlocklistCache } from '@/lib/series-blocklist';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const { payload } = await jwtVerify(auth.substring(7), JWT_SECRET);
    return payload.role === 'admin';
  } catch { return false; }
}

function normalize(body: any) {
  const out: any = {};
  if (typeof body.label === 'string') out.label = body.label.trim();
  if (Array.isArray(body.tmdbIds)) out.tmdbIds = body.tmdbIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n));
  if (Array.isArray(body.urlPatterns)) out.urlPatterns = body.urlPatterns.map((s: any) => String(s).trim()).filter(Boolean);
  if (Array.isArray(body.titleKeywords)) out.titleKeywords = body.titleKeywords.map((s: any) => String(s).trim()).filter(Boolean);
  if (typeof body.enabled === 'boolean') out.enabled = body.enabled;
  if (typeof body.note === 'string') out.note = body.note.trim() || null;
  return out;
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await prisma.blocklist_entries.findMany({
    orderBy: [{ enabled: 'desc' }, { hits: 'desc' }, { createdAt: 'desc' }],
  });
  const entries = rows.map((r) => ({
    id: r.id,
    label: r.label,
    tmdbIds: r.tmdbIds,
    urlPatterns: r.urlPatterns,
    titleKeywords: r.titleKeywords,
    enabled: r.enabled,
    hits: r.hits,
    lastHitAt: r.lastHitAt?.toISOString() ?? null,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const data = normalize(body);
  if (!data.label) return NextResponse.json({ error: 'label required' }, { status: 400 });
  const hasAny = (data.tmdbIds?.length || 0) + (data.urlPatterns?.length || 0) + (data.titleKeywords?.length || 0) > 0;
  if (!hasAny) return NextResponse.json({ error: 'Mindestens ein Match-Kriterium erforderlich (tmdbIds / urlPatterns / titleKeywords)' }, { status: 400 });

  const row = await prisma.blocklist_entries.create({
    data: {
      label: data.label,
      tmdbIds: data.tmdbIds || [],
      urlPatterns: data.urlPatterns || [],
      titleKeywords: data.titleKeywords || [],
      enabled: data.enabled ?? true,
      note: data.note ?? null,
    },
  });
  invalidateBlocklistCache();
  return NextResponse.json({ ok: true, entry: row });
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const data = normalize(body);

  try {
    const row = await prisma.blocklist_entries.update({ where: { id }, data });
    invalidateBlocklistCache();
    return NextResponse.json({ ok: true, entry: row });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await prisma.blocklist_entries.delete({ where: { id } }).catch(() => {});
  invalidateBlocklistCache();
  return NextResponse.json({ ok: true });
}
